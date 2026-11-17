import test from 'node:test';
i…1370 tokens truncated…qual((await post('receipts',{product_id:product,quantity:6,reference:'Ingreso ficticio'})).status,201);
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
  await pool.end();await runtimePool.end();
  if(previousOrganization===undefined) delete process.env.ORGANIZATION_ID;
  else process.env.ORGANIZATION_ID=previousOrganization;
 }
});
