import {Pool,type PoolClient} from 'pg';
import {randomUUID} from 'node:crypto';
import {assertTransition,eventFor,type Operation} from '../domain/operation.js';
import {RevisionConflict,type OperationsRepository} from '../application/operations.js';
function normalize(row:any):Operation{return {...row,created_at:row.created_at.toISOString(),updated_at:row.updated_at.toISOString()};}
export class PostgresOperations implements OperationsRepository {
 constructor(readonly pool:Pool){}
 async list(org:string,offset:number){const r=await this.pool.query('SELECT * FROM operations WHERE organization_id=$1 ORDER BY created_at DESC,id LIMIT 100 OFFSET $2',[org,offset]);return r.rows.map(normalize);}
 private async transaction<T>(org:string,run:(client:PoolClient)=>Promise<T>):Promise<T>{const client=await this.pool.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[org]);const result=await run(client);await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
 private async append(client:PoolClient,row:Operation){const event=eventFor(row,randomUUID());await client.query('INSERT INTO outbox(organization_id,event) VALUES($1,$2)',[row.organization_id,event]);}
 async create(org:string,input:{title:string;sector:string;amount_cents:number}){return this.transaction(org,async c=>{const r=await c.query('INSERT INTO operations(id,organization_id,title,sector,amount_cents) VALUES($1,$2,$3,$4,$5) RETURNING *',[randomUUID(),org,input.title,input.sector,input.amount_cents]);const row=normalize(r.rows[0]);await this.append(c,row);return row;});}
 async update(org:string,id:string,input:{status:Operation['status'];expected_revision:number}){return this.transaction(org,async c=>{const found=await c.query('SELECT * FROM operations WHERE organization_id=$1 AND id=$2 FOR UPDATE',[org,id]);if(!found.rowCount)return null;const old=normalize(found.rows[0]);if(old.revision!==input.expected_revision)throw new RevisionConflict('Revisión desactualizada');assertTransition(old.status,input.status);const r=await c.query('UPDATE operations SET status=$3,revision=revision+1,updated_at=clock_timestamp() WHERE organization_id=$1 AND id=$2 RETURNING *',[org,id,input.status]);const row=normalize(r.rows[0]);await this.append(c,row);return row;});}
 async events(org:string,after:number){const r=await this.pool.query('SELECT sequence::text,event FROM outbox WHERE organization_id=$1 AND sequence>$2 ORDER BY sequence LIMIT 100',[org,after]);return r.rows;}
}
