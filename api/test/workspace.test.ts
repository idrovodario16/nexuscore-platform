import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,scryptSync} from 'node:crypto';
import {createApp} from '../src/interfaces/http.js';

test('Workspace: sesión, permisos, aislamiento, revisión, historial e indicadores', {
 skip:process.env.RUN_INTEGRATION!=='1',
},async()=>{
 const orgA = randomUUID();
 const orgB = randomUUID();
 const previousOrganization = process.env.ORGANIZATION_ID;
 process.env.ORGANIZATION_ID = orgA;
 const {app,pool} = await createApp();
 const password = 'prueba-ficticia-workspace';
 const salt = randomUUID();
 const hash = salt+':'+scryptSync(password,salt,64).toString('hex');
 const users = [
  {id:randomUUID(),org:orgA,name:'Operador A',role:'operator'},
  {id:randomUUID(),org:orgA,name:'Supervisor A',role:'supervisor'},
  {id:randomUUID(),org:orgB,name:'Operador B',role:'operator'},
 ];
 try {
  await app.listen(0,'127.0.0.1');
  const base = await app.getUrl();
  const api = base+'/workspace-api';
  await pool.query("INSERT INTO workspace_organizations VALUES($1,'Empresa A'),($2,'Empresa B')",[orgA,orgB]);
  for(const user of users) {
   await pool.query('INSERT INTO workspace_users VALUES($1,$2,$3,$4)',[user.id,user.id+'@example.com',user.name,hash]);
   await pool.query('INSERT INTO workspace_memberships VALUES($1,$2,$3)',[user.org,user.id,user.role]);
  }

  const headers = {'Content-Type':'application/json','X-Nexus-Workspace':'1'};
  async function login(user:typeof users[number]){
   const response = await fetch(api+'/session',{method:'POST',headers,body:JSON.stringify({email:user.id+'@example.com',password})});
   assert.equal(response.status,200,await response.text());
   const cookie = response.headers.get('set-cookie');
   assert.match(cookie ?? '',/HttpOnly; SameSite=Strict/);
   return cookie!.split(';')[0];
  }

  assert.equal((await fetch(api+'/session')).status,401);
  const cookieA = await login(users[0]);
  const supervisor = await login(users[1]);
  const cookieB = await login(users[2]);
  const pathA = api+'/organizations/'+orgA+'/shipments';
  const pathB = api+'/organizations/'+orgB+'/shipments';
  assert.equal((await fetch(pathA,{headers:{cookie:cookieB}})).status,403);

  const created = await fetch(pathA,{method:'POST',headers:{...headers,cookie:cookieA},
   body:JSON.stringify({title:'Envío de prueba',amount_cents:1500})});
  assert.equal(created.status,201,await created.clone().text());
  const operation = await created.json() as {id:string;status:string;revision:number};
  assert.equal(operation.status,'pending');
  const itemA = pathA+'/'+operation.id;
  const itemB = pathB+'/'+operation.id;
  const patch = (url:string,cookie:string,status:string,revision:number)=>fetch(url,{
   method:'PATCH',headers:{...headers,cookie},body:JSON.stringify({status,expected_revision:revision}),
  });
  assert.equal((await fetch(itemB+'/history',{headers:{cookie:cookieB}})).status,404);
  assert.equal((await patch(itemB,cookieB,'in_progress',1)).status,404);
  assert.equal((await patch(itemA,cookieA,'cancelled',1)).status,403);
  assert.equal((await patch(itemA,cookieA,'completed',1)).status,409);

  const legacy = await fetch(base+'/v1/operations/'+operation.id,{method:'PATCH',headers:{
   'Content-Type':'application/json',Authorization:'Bearer '+process.env.API_KEY,'X-Organization-ID':orgA,
  },body:JSON.stringify({status:'in_progress',expected_revision:1})});
  assert.equal(legacy.status,404);
  const competing = await Promise.all([
   patch(itemA,cookieA,'in_progress',1),
   patch(itemA,cookieA,'in_progress',1),
  ]);
  assert.deepEqual(competing.map(response=>response.status).sort(),[200,409]);
  assert.equal((await patch(itemA,supervisor,'completed',2)).status,200);
  const history = await fetch(itemA+'/history',{headers:{cookie:cookieA}}).then(response=>response.json()) as {actor_name:string;status:string}[];
  assert.deepEqual(history.map(entry=>[entry.actor_name,entry.status]),[
   ['Operador A','pending'],['Operador A','in_progress'],['Supervisor A','completed'],
  ]);
  const overview = await fetch(pathA+'?status=completed&search=prueba',{headers:{cookie:cookieA}}).then(response=>response.json()) as {total:number;open:number;completed:number;completion:number};
  assert.deepEqual([overview.total,overview.open,overview.completed,overview.completion],[1,0,1,100]);
  const other = await fetch(pathB,{headers:{cookie:cookieB}}).then(response=>response.json()) as {total:number};
  assert.equal(other.total,0);
  const events = await pool.query('SELECT event FROM outbox WHERE organization_id=$1 ORDER BY sequence',[orgA]);
  assert.deepEqual(events.rows.map(row=>row.event.data.revision),[1,2,3]);

  const business = api+'/organizations/'+orgA+'/business';
  const post = (action:string,body:unknown)=>fetch(business+'/'+action,{
   method:'POST',headers:{...headers,cookie:cookieA},body:JSON.stringify(body),
  });
  async function createdId(action:string,body:unknown){
   const response = await post(action,body);
   assert.equal(response.status,201,await response.clone().text());
   return (await response.json() as {id:string}).id;
  }
  assert.equal((await fetch(business,{headers:{cookie:cookieB}})).status,403);
  const product = await createdId('products',{sku:'CAD-36',name:'Cadena de prueba',price_cents:1250});
  const customer = await createdId('customers',{name:'Cliente de prueba',contact:''});
  assert.equal((await post('receipts',{product_id:product,quantity:6,reference:'Ingreso ficticio'})).status,201);
  const attempts = [randomUUID(),randomUUID()].map(id=>({
   id,customer_id:customer,items:[{product_id:product,quantity:4}],
  }));
  const responses = await Promise.all(attempts.map(body=>post('sales',body)));
  assert.deepEqual(responses.map(response=>response.status).sort(),[201,409]);
  const index = responses.findIndex(response=>response.ok);
  const firstSale = await responses[index].json() as {id:string;shipment_id:string};
  const retry = await post('sales',attempts[index]);
  assert.deepEqual(await retry.json(),firstSale);
  const stock = async()=>Number((await pool.query('SELECT stock FROM business_products WHERE organization_id=$1 AND id=$2',[orgA,product])).rows[0].stock);
  assert.equal(await stock(),2);
  assert.equal((await patch(pathA+'/'+firstSale.shipment_id,supervisor,'cancelled',1)).status,200);
  assert.equal(await stock(),6);
  const paid = await post('sales',{...attempts[index],id:randomUUID()});
  assert.equal(paid.status,201,await paid.clone().text());
  const paidSale = await paid.json() as {id:string;shipment_id:string};
  assert.equal((await post('sales/'+paidSale.id+'/payment',{method:'cash'})).status,201);
  assert.equal((await patch(pathA+'/'+paidSale.shipment_id,supervisor,'cancelled',1)).status,409);
  assert.equal(await stock(),2);
  const company = await fetch(business,{headers:{cookie:cookieA}}).then(response=>response.json()) as {sales_count:number;collected_cents:string;receivable_cents:string};
  assert.deepEqual([company.sales_count,Number(company.collected_cents),Number(company.receivable_cents)],[1,5000,0]);

  assert.equal((await fetch(api+'/session/logout',{method:'POST',headers:{...headers,cookie:cookieA}})).status,204);
  assert.equal((await fetch(pathA,{headers:{cookie:cookieA}})).status,401);
 } finally {
  const ids = users.map(user=>user.id);
  await pool.query('DELETE FROM business_stock_movements WHERE organization_id=$1',[orgA]);
  await pool.query('DELETE FROM business_sale_items WHERE organization_id=$1',[orgA]);
  await pool.query('DELETE FROM business_sales WHERE organization_id=$1',[orgA]);
  await pool.query('DELETE FROM business_products WHERE organization_id=$1',[orgA]);
  await pool.query('DELETE FROM business_customers WHERE organization_id=$1',[orgA]);
  await pool.query('DELETE FROM workspace_history WHERE organization_id=$1',[orgA]);
  await pool.query('DELETE FROM outbox WHERE organization_id=$1',[orgA]);
  await pool.query('DELETE FROM operations WHERE organization_id=$1',[orgA]);
  await pool.query('DELETE FROM workspace_memberships WHERE user_id=ANY($1::uuid[])',[ids]);
  await pool.query('DELETE FROM workspace_users WHERE id=ANY($1::uuid[])',[ids]);
  await pool.query('DELETE FROM workspace_organizations WHERE id IN ($1,$2)',[orgA,orgB]);
  await app.close();
  await pool.end();
  if(previousOrganization===undefined) delete process.env.ORGANIZATION_ID;
  else process.env.ORGANIZATION_ID=previousOrganization;
 }
});
