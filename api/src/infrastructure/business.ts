import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {BusinessConflict,PostgresOperations,type OperationActor} from './postgres.js';

const quantity = z.number().int().min(1).max(100000);
export const productInput = z.object({
 sku:z.string().trim().min(1).max(40).transform(sku=>sku.toUpperCase()),
 name:z.string().trim().min(2).max(120),
 price_cents:z.number().int().min(1).max(1000000000),
}).strict();
export const customerInput = z.object({
 name:z.string().trim().min(2).max(120),contact:z.string().trim().max(120),
}).strict();
export const receiptInput = z.object({
 product_id:z.string().uuid(),quantity,reference:z.string().trim().min(2).max(120),
}).strict();
export const saleInput = z.object({
 id:z.string().uuid(),customer_id:z.string().uuid(),
 items:z.array(z.object({product_id:z.string().uuid(),quantity}).strict()).min(1).max(25),
}).strict().refine(sale=>new Set(sale.items.map(item=>item.product_id)).size===sale.items.length);
export const paymentInput = z.object({method:z.enum(['cash','transfer','card'])}).strict();

export class BusinessRepository {
 constructor(private readonly operations:PostgresOperations){}

 async overview(org:string){
  const {rows:[data]} = await this.operations.pool.query(`WITH recent_sales AS (
   SELECT s.id,s.shipment_id,s.total_cents,s.created_at,s.paid_at,s.payment_method,s.cancelled_at,
    c.name AS customer,o.status AS shipment_status,
    (SELECT json_agg(json_build_object('product',p.name,'quantity',i.quantity,'unit_price_cents',i.unit_price_cents)
      ORDER BY p.name,p.id) FROM business_sale_items i JOIN business_products p
      ON p.organization_id=i.organization_id AND p.id=i.product_id
      WHERE i.organization_id=s.organization_id AND i.sale_id=s.id) AS items
   FROM business_sales s
   JOIN business_customers c ON c.organization_id=s.organization_id AND c.id=s.customer_id
   JOIN operations o ON o.organization_id=s.organization_id AND o.id=s.shipment_id
   WHERE s.organization_id=$1 ORDER BY s.created_at DESC,s.id LIMIT 50
  ), recent_movements AS (
   SELECT m.id,p.sku,p.name,m.delta,m.kind,m.reference,m.created_at,u.name AS actor
   FROM business_stock_movements m
   JOIN business_products p ON p.organization_id=m.organization_id AND p.id=m.product_id
   JOIN workspace_users u ON u.id=m.actor_id
   WHERE m.organization_id=$1 ORDER BY m.id DESC LIMIT 50
  )
  SELECT
   (SELECT COALESCE(json_agg(p ORDER BY p.name,p.sku),'[]') FROM
    (SELECT id,sku,name,price_cents,stock FROM business_products WHERE organization_id=$1) p) AS products,
   (SELECT COALESCE(json_agg(c ORDER BY c.name,c.id),'[]') FROM
    (SELECT id,name,contact FROM business_customers WHERE organization_id=$1) c) AS customers,
   (SELECT COALESCE(json_agg(s ORDER BY s.created_at DESC,s.id),'[]') FROM recent_sales s) AS sales,
   (SELECT COALESCE(json_agg(m ORDER BY m.id DESC),'[]') FROM recent_movements m) AS movements,
   count(*) FILTER (WHERE cancelled_at IS NULL)::int AS sales_count,
   COALESCE(sum(total_cents) FILTER (WHERE paid_at IS NOT NULL AND cancelled_at IS NULL),0) AS collected_cents,
   COALESCE(sum(total_cents) FILTER (WHERE paid_at IS NULL AND cancelled_at IS NULL),0) AS receivable_cents
  FROM business_sales WHERE organization_id=$1`,[org]);
  return data;
 }

 async product(org:string,input:z.infer<typeof productInput>){
  const result = await this.operations.pool.query(`INSERT INTO business_products(organization_id,id,sku,name,price_cents)
   VALUES($1,$2,$3,$4,$5) ON CONFLICT(organization_id,sku) DO NOTHING RETURNING id`,
   [org,randomUUID(),input.sku,input.name,input.price_cents]);
  if(!result.rowCount) throw new BusinessConflict('Ya existe un producto con ese código.');
  return result.rows[0];
 }

 async customer(org:string,input:z.infer<typeof customerInput>){
  const result = await this.operations.pool.query(`INSERT INTO business_customers(organization_id,id,name,contact)
   VALUES($1,$2,$3,$4) RETURNING id`,[org,randomUUID(),input.name,input.contact]);
  return result.rows[0];
 }

 async receive(org:string,input:z.infer<typeof receiptInput>,actor:OperationActor){
  return this.operations.transaction(org,async client=>{
   const updated = await client.query(`UPDATE business_products SET stock=stock+$3
    WHERE organization_id=$1 AND id=$2 RETURNING stock`,[org,input.product_id,input.quantity]);
   if(!updated.rowCount) throw new BusinessConflict('Selecciona un producto de esta empresa.');
   await client.query(`INSERT INTO business_stock_movements(organization_id,product_id,actor_id,delta,kind,reference)
    VALUES($1,$2,$3,$4,'receipt',$5)`,[org,input.product_id,actor.id,input.quantity,input.reference]);
   return updated.rows[0];
  });
 }

 async sell(org:string,input:z.infer<typeof saleInput>,actor:OperationActor){
  return this.operations.transaction(org,async client=>{
   const previous = await client.query('SELECT id,shipment_id FROM business_sales WHERE organization_id=$1 AND id=$2',[org,input.id]);
   if(previous.rowCount) return previous.rows[0];
   const {rows:[customer]} = await client.query('SELECT name FROM business_customers WHERE organization_id=$1 AND id=$2',[org,input.customer_id]);
   if(!customer) throw new BusinessConflict('Selecciona un cliente de esta empresa.');
   const lines = [];
   let total = 0;
   for(const item of input.items){
    const {rows:[product]} = await client.query(`UPDATE business_products SET stock=stock-$3
     WHERE organization_id=$1 AND id=$2 AND stock >= $3 RETURNING name,price_cents`,
     [org,item.product_id,item.quantity]);
    if(!product) throw new BusinessConflict('Stock insuficiente o producto no disponible. Revisa las cantidades.');
    total += product.price_cents * item.quantity;
    lines.push({...item,price:product.price_cents});
   }
   if(total>1000000000) throw new BusinessConflict('El total supera el máximo admitido.');
   const shipment = await this.operations.createWithin(client,org,{
    title:`Venta ${input.id.slice(0,8)} · ${customer.name}`.slice(0,120),sector:'logistics',amount_cents:total,
   },actor);
   await client.query(`INSERT INTO business_sales(organization_id,id,customer_id,shipment_id,total_cents,created_by)
    VALUES($1,$2,$3,$4,$5,$6)`,[org,input.id,input.customer_id,shipment.id,total,actor.id]);
   for(const line of lines){
    await client.query(`INSERT INTO business_sale_items(organization_id,sale_id,product_id,quantity,unit_price_cents)
     VALUES($1,$2,$3,$4,$5)`,[org,input.id,line.product_id,line.quantity,line.price]);
    await client.query(`INSERT INTO business_stock_movements(organization_id,product_id,actor_id,delta,kind,reference)
     VALUES($1,$2,$3,$4,'sale',$5)`,[org,line.product_id,actor.id,-line.quantity,input.id]);
   }
   return {id:input.id,shipment_id:shipment.id};
  });
 }

 async pay(org:string,id:string,input:z.infer<typeof paymentInput>,actor:OperationActor){
  return this.operations.transaction(org,async client=>{
   const result = await client.query(`UPDATE business_sales SET paid_at=now(),paid_by=$3,payment_method=$4
    WHERE organization_id=$1 AND id=$2 AND paid_at IS NULL AND cancelled_at IS NULL RETURNING paid_at`,
    [org,id,actor.id,input.method]);
   if(!result.rowCount) throw new BusinessConflict('La venta no está pendiente de cobro.');
   return result.rows[0];
  });
 }
}
