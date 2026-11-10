import {Pool,type PoolClient} from 'pg';
import {randomUUID} from 'node:crypto';
import {assertTransition,eventFor,type Operation} from '../domain/operation.js';
import {RevisionConflict,type OperationsRepository} from '../application/operations.js';
export interface OperationActor { id: string; name: string }
export class BusinessConflict extends Error {}
function normalize(row:any):Operation{return {...row,created_at:row.created_at.toISOString(),updated_at:row.updated_at.toISOString()};}
export class PostgresOperations implements OperationsRepository {
 constructor(readonly pool:Pool){}
 async list(org:string,offset:number){const r=await this.pool.query('SELECT * FROM operations WHERE organization_id=$1 ORDER BY created_at DESC,id LIMIT 100 OFFSET $2',[org,offset]);return r.rows.map(normalize);}
 async transaction<T>(org:string,run:(client:PoolClient)=>Promise<T>):Promise<T>{
  const client = await this.pool.connect();
  try {
   await client.query('BEGIN');
   await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[org]);
   const result = await run(client);
   await client.query('COMMIT');
   return result;
  } catch(error){
   await client.query('ROLLBACK');
   throw error;
  } finally {
   client.release();
  }
 }
 private async append(client:PoolClient,row:Operation){const event=eventFor(row,randomUUID());await client.query('INSERT INTO outbox(organization_id,event) VALUES($1,$2)',[row.organization_id,event]);}
 private async audit(client:PoolClient,row:Operation,actor:OperationActor,previous:Operation['status']|null){
  await client.query(`INSERT INTO workspace_history
    (organization_id,operation_id,revision,actor_id,actor_name,previous_status,status,occurred_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [row.organization_id,row.id,row.revision,actor.id,actor.name,previous,row.status,row.updated_at]);
 }

 async create(org:string,input:{title:string;sector:string;amount_cents:number},actor?:OperationActor){
  return this.transaction(org,client=>this.createWithin(client,org,input,actor));
 }

 async createWithin(client:PoolClient,org:string,input:{title:string;sector:string;amount_cents:number},actor?:OperationActor){
   const result=await client.query(
    'INSERT INTO operations(id,organization_id,title,sector,amount_cents) VALUES($1,$2,$3,$4,$5) RETURNING *',
    [randomUUID(),org,input.title,input.sector,input.amount_cents]);
   const row=normalize(result.rows[0]);
   if(actor) await this.audit(client,row,actor,null);
   await this.append(client,row);
   return row;
 }

 private async cancelSale(client:PoolClient,org:string,shipment:Operation,actor:OperationActor){
  const {rows:[sale]} = await client.query(
   'SELECT id,paid_at FROM business_sales WHERE organization_id=$1 AND shipment_id=$2',[org,shipment.id]);
  if(!sale) return;
  if(sale.paid_at) throw new BusinessConflict('La venta ya fue cobrada. Este piloto no permite cancelar ventas cobradas.');
  if(shipment.status!=='pending') throw new BusinessConflict('El pedido ya salió. La devolución debe registrarse antes de reponer stock.');
  await client.query('UPDATE business_sales SET cancelled_at=now() WHERE organization_id=$1 AND id=$2',[org,sale.id]);
  await client.query(`WITH restored AS (
   UPDATE business_products p SET stock=p.stock+i.quantity FROM business_sale_items i
   WHERE i.organization_id=$1 AND i.sale_id=$2 AND p.organization_id=i.organization_id AND p.id=i.product_id
   RETURNING p.id,i.quantity
  ) INSERT INTO business_stock_movements(organization_id,product_id,actor_id,delta,kind,reference)
   SELECT $1,id,$3,quantity,'cancellation',$2::uuid::text FROM restored`,[org,sale.id,actor.id]);
 }

 async update(org:string,id:string,input:{status:Operation['status'];expected_revision:number},actor?:OperationActor){
  return this.transaction(org,async client=>{
   const found=await client.query(`SELECT o.*, EXISTS(
    SELECT 1 FROM workspace_history h WHERE h.organization_id=o.organization_id
    AND h.operation_id=o.id AND h.revision=1) AS workspace
    FROM operations o WHERE o.organization_id=$1 AND o.id=$2 FOR UPDATE`,[org,id]);
   if(!found.rowCount || found.rows[0].workspace!==Boolean(actor)) return null;
   const old=normalize(found.rows[0]);
   if(old.revision!==input.expected_revision) throw new RevisionConflict('Revisión desactualizada. Recarga la operación.');
   assertTransition(old.status,input.status);
   if(actor && input.status==='cancelled') await this.cancelSale(client,org,old,actor);
   const result=await client.query(
    'UPDATE operations SET status=$3,revision=revision+1,updated_at=clock_timestamp() WHERE organization_id=$1 AND id=$2 RETURNING *',
    [org,id,input.status]);
   const row=normalize(result.rows[0]);
   if(actor) await this.audit(client,row,actor,old.status);
   await this.append(client,row);
   return row;
  });
 }
 async events(org:string,after:number){const r=await this.pool.query('SELECT sequence::text,event FROM outbox WHERE organization_id=$1 AND sequence>$2 ORDER BY sequence LIMIT 100',[org,after]);return r.rows;}
}
