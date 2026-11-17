import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {PostgresOperations} from '../src/infrastructure/postgres.js';
import {verifyDatabaseIsolation,tenantTables} from '../src/infrastructure/database-security.js';

test('Tenant writes share one lock across UUID casing and release it on commit/rollback', {skip:process.env.RUN_INTEGRATION!=='1'},async()=>{
 const pool=new Pool({connectionString:process.env.DATABASE_URL,options:'-c role=nexus_core_runtime',max:1});
 const probe=new Pool({connectionString:process.env.DATABASE_URL,options:'-c role=nexus_core_runtime',max:1});
 const repo=new PostgresOperations(pool);
 const org='abcdefab-cdef-4abc-8def-abcdefabcdef';
 const other='fedcbafe-dcba-4fed-8cba-fedcbafedcba';
 const available=async(id:string)=>{
  // A standalone query releases its transaction lock before returning the connection.
  const result=await probe.query('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS available',[id]);
  return result.rows[0].available;
 };
 const check=async()=>{
  assert.equal(await available(org),false,'lowercase company lock must already be held');
  assert.equal(await available(other),true,'a different company remains independent');
 };
 try {
  for(const spelling of [org,org.toUpperCase()]){
   await repo.transaction(spelling,check);
   assert.equal(await available(org),true,'commit releases the company lock');
   await assert.rejects(()=>repo.transaction(spelling,async()=>{
    await check();
    throw Error('intentional rollback');
   }),/intentional rollback/);
   assert.equal(await available(org),true,'rollback releases the company lock');
  }
 } finally {
  await pool.end();await probe.end();
 }
});

test('RLS: unfiltered SQL, denied writes and transaction context cleanup', {skip:process.env.RUN_INTEGRATION!=='1'},async()=>{
 const admin=new Pool({connectionString:process.env.DATABASE_URL});
 const pool=new Pool({connectionString:process.env.DATABASE_URL,options:'-c role=nexus_core_runtime',max:1});
 const repo=new PostgresOperations(pool);const a=randomUUID(),b=randomUUID();
 try {
  await assert.rejects(()=>verifyDatabaseIsolation(admin));
  await verifyDatabaseIsolation(pool);
  await repo.create(a,{title:'Company A',sector:'retail',amount_cents:100});
  const rowB=await repo.create(b,{title:'Company B',sector:'retail',amount_cents:900});
  assert.equal((await pool.query('SELECT * FROM operations')).rowCount,0);
  assert.deepEqual((await repo.query(a,'SELECT organization_id FROM operations')).rows.map(r=>r.organization_id),[a]);
  for(const table of tenantTables){
   assert.equal((await pool.query(`SELECT * FROM ${table}`)).rowCount,0);
   assert.equal((await repo.query(a,`SELECT * FROM ${table} WHERE organization_id=$1`,[b])).rowCount,0);
  }
  assert.equal((await repo.query(a,'UPDATE operations SET title=$1 WHERE id=$2',['Forbidden',rowB.id])).rowCount,0);
  await assert.rejects(()=>repo.query(a,'UPDATE operations SET organization_id=$1',[b]),{code:'42501'});
  await assert.rejects(()=>repo.query(a,'INSERT INTO outbox(organization_id,event) VALUES($1,$2)',[b,{}]),{code:'42501'});
  assert.equal((await pool.query('SELECT * FROM operations')).rowCount,0);
  assert.equal((await repo.list(b,0))[0].amount_cents,900);
  await assert.rejects(()=>repo.withTenant(a,async()=>{throw Error('rollback');}),/rollback/);
  assert.equal((await pool.query('SELECT * FROM operations')).rowCount,0);
  await assert.rejects(()=>pool.query('TRUNCATE outbox'),{code:'42501'});
 } finally {
  await admin.query('DELETE FROM outbox WHERE organization_id IN ($1,$2)',[a,b]);
  await admin.query('DELETE FROM operations WHERE organization_id IN ($1,$2)',[a,b]);
  await pool.end();await admin.end();
 }
});
