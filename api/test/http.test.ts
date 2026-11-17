import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {createApp} from '../src/interfaces/http.js';
test('HTTP + PostgreSQL: autorización, revisión y outbox atómica', {skip:process.env.RUN_INTEGRATION!=='1'}, async()=>{
 const {app,pool}=await createApp();
 try {
  await app.listen(0,'127.0.0.1');
  const base=await app.getUrl();
  const headers={'Content-Type':'application/json',Authorization:'Bearer '+process.env.API_KEY,'X-Organization-ID':process.env.ORGANIZATION_ID!};
  assert.equal((await fetch(base+'/v1/operations')).status,401);
  assert.equal((await fetch(base+'/v1/operations',{headers:{...headers,'X-Organization-ID':'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}})).status,403);
  const bad=await fetch(base+'/v1/operations',{method:'POST',headers,body:JSON.stringify({title:'Bad',sector:'retail',amount_cents:-1})});
  assert.equal(bad.status,400);
  const res=await fetch(base+'/v1/operations',{method:'POST',headers,body:JSON.stringify({title:'Prueba ficticia',sector:'retail',amount_cents:1500})});
  assert.equal(res.status,201);
  const row=await res.json() as any;
  assert.equal((await fetch(base+'/v1/operations/'+row.id,{method:'PATCH',headers,body:JSON.stringify({status:'in_progress',expected_revision:1})})).status,200);
  assert.equal((await fetch(base+'/v1/operations/'+row.id,{method:'PATCH',headers,body:JSON.stringify({status:'completed',expected_revision:1})})).status,409);
  const events=await pool.query("SELECT event FROM outbox WHERE event->'data'->>'id'=$1 ORDER BY sequence",[row.id]);
  assert.equal(events.rowCount,2);assert.equal(events.rows[1].event.data.revision,2);
  await pool.query("DELETE FROM outbox WHERE event->'data'->>'id'=$1",[row.id]);
  await pool.query('DELETE FROM operations WHERE id=$1',[row.id]);
 } finally {await app.close();await pool.end();}
});

test('HTTP + PostgreSQL: two scoped organizations cannot read or mutate each other', {skip:process.env.RUN_INTEGRATION!=='1'}, async()=>{
 const orgA=randomUUID(),orgB=randomUUID();
 const reader='reader-'+randomUUID(),writer='writer-'+randomUUID(),other='other-'+randomUUID();
 const previous=process.env.INTEGRATION_CREDENTIALS;
 process.env.INTEGRATION_CREDENTIALS=JSON.stringify([[reader,orgA,['read']],[writer,orgA,['read','write']],[other,orgB,['read','write']]].map(([key,organization_id,permissions])=>({key_sha256:createHash('sha256').update(key as string).digest('hex'),organization_id,permissions})));
 let instance;
 try {instance=await createApp();} finally {
  if(previous===undefined)delete process.env.INTEGRATION_CREDENTIALS;else process.env.INTEGRATION_CREDENTIALS=previous;
 }
 const {app,pool}=instance;
 const headers=(key:string,org:string)=>({'Content-Type':'application/json',Authorization:'Bearer '+key,'X-Organization-ID':org});
 try {
  await app.listen(0,'127.0.0.1');const base=await app.getUrl();
  const input=JSON.stringify({title:'Scoped test',sector:'retail',amount_cents:100});
  assert.equal((await fetch(base+'/v1/operations',{method:'POST',headers:headers(reader,orgA),body:input})).status,403);
  const created=await fetch(base+'/v1/operations',{method:'POST',headers:headers(writer,orgA),body:input});
  assert.equal(created.status,201);const row=await created.json() as any;
  assert.deepEqual(await (await fetch(base+'/v1/operations',{headers:headers(other,orgB)})).json(),[]);
  const events=await (await fetch(base+'/v1/events',{headers:headers(other,orgB)})).json() as any;
  assert.deepEqual(events.items,[]);
  assert.equal((await fetch(base+'/v1/operations/'+row.id,{method:'PATCH',headers:headers(other,orgB),body:JSON.stringify({status:'in_progress',expected_revision:1})})).status,404);
  for(const route of ['/v1/operations','/v1/events'])assert.equal((await fetch(base+route,{headers:headers(writer,orgB)})).status,403);
  assert.equal((await fetch(base+'/v1/operations',{headers:headers(reader,orgA)})).status,200);
 } finally {
  await pool.query('DELETE FROM outbox WHERE organization_id IN ($1,$2)',[orgA,orgB]);
  await pool.query('DELETE FROM operations WHERE organization_id IN ($1,$2)',[orgA,orgB]);
  await app.close();await pool.end();
 }
});
