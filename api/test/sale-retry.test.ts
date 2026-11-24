import test from 'node:test';
import assert from 'node:assert/strict';
import {BusinessRepository} from '../src/infrastructure/business.js';
import {BusinessConflict,PostgresOperations} from '../src/infrastructure/postgres.js';

const org='11111111-1111-4111-8111-111111111111';
const customer='abcdefab-cdef-4abc-8def-abcdefabcdef';
const product='fedcbafe-dcba-4fed-8cba-fedcbafedcba';
const other='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const actor={id:'22222222-2222-4222-8222-222222222222',name:'Prueba ficticia'};
const original={id:'33333333-3333-4333-8333-333333333333',customer_id:customer,
 items:[{product_id:product,quantity:2},{product_id:other,quantity:1}]};
const sale={id:original.id,shipment_id:'44444444-4444-4444-8444-444444444444',customer_id:customer};

function repository(){
 const queries:string[]=[];
 const client={query:async(sql:string)=>{
  queries.push(sql);
  if(sql.includes('FROM business_sales '))return {rowCount:1,rows:[sql.includes('customer_id')?sale:{id:sale.id,shipment_id:sale.shipment_id}]};
  if(sql.includes('FROM business_sale_items '))return {rowCount:2,rows:original.items};
  throw new Error('A retry must not modify the sale or its stock');
 }};
 const operations={transaction:async(_org:string,work:(db:typeof client)=>Promise<unknown>)=>work(client)} as unknown as PostgresOperations;
 return {business:new BusinessRepository(operations),queries};
}

test('sale retries accept equivalent UUIDs and reordered lines without new writes',async()=>{
 for(const items of [original.items,[...original.items].reverse()]){
  const {business,queries}=repository();
  const input={...original,customer_id:customer.toUpperCase(),items:items.map(item=>({...item,product_id:item.product_id.toUpperCase()}))};
  assert.deepEqual(await business.sell(org,input,actor),{id:sale.id,shipment_id:sale.shipment_id});
  assert.ok(queries.every(sql=>sql.trimStart().startsWith('SELECT')));
 }
});

test('sale retries reject changed customers, quantities or product sets before writing',async()=>{
 const variants=[
  {...original,customer_id:other},
  {...original,items:[{product_id:product,quantity:3},original.items[1]]},
  {...original,items:[{product_id:customer,quantity:2},original.items[1]]},
  {...original,items:[original.items[0]]},
  {...original,items:[...original.items,{product_id:customer,quantity:1}]},
 ];
 for(const input of variants){
  const {business,queries}=repository();
  await assert.rejects(()=>business.sell(org,input,actor),BusinessConflict);
  assert.ok(queries.every(sql=>sql.trimStart().startsWith('SELECT')));
 }
});
