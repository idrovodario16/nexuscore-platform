import {Pool} from 'pg';
export const tenantTables=['operations','outbox','workspace_history','business_products',
 'business_customers','business_sales','business_sale_items','business_stock_movements'];

export async function verifyDatabaseIsolation(pool:Pool){
 const {rows:[role]}=await pool.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
 const {rows}=await pool.query(`SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,
  pg_has_role(current_user,c.relowner,'MEMBER') AS can_own
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname=ANY($1::text[])`,[tenantTables]);
 if(!role||role.rolsuper||role.rolbypassrls||rows.length!==tenantTables.length||
  rows.some(r=>!r.relrowsecurity||!r.relforcerowsecurity||r.can_own)){
  throw Error('Database isolation requires migrated tables and a non-owner role without SUPERUSER/BYPASSRLS');
 }
}
