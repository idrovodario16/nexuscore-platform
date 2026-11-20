import test from 'node:test';
import assert from 'node:assert/strict';
import {saleInput} from '../src/infrastructure/business.js';

const product='abcdefab-cdef-4abc-8def-abcdefabcdef';
const other='fedcbafe-dcba-4fed-8cba-fedcbafedcba';
const sale=(products:string[])=>({
 id:'11111111-1111-4111-8111-111111111111',
 customer_id:'22222222-2222-4222-8222-222222222222',
 items:products.map(product_id=>({product_id,quantity:1})),
});

test('sales reject duplicate product UUIDs regardless of casing or order',()=>{
 for(const products of [[product,product],[product,product.toUpperCase()],[product.toUpperCase(),product]]){
  assert.equal(saleInput.safeParse(sale(products)).success,false);
 }
});

test('sales accept distinct product UUIDs with independent quantities',()=>{
 const input=sale([product,other.toUpperCase()]);
 input.items[1].quantity=2;
 assert.deepEqual(saleInput.parse(input),input);
});

test('sales still reject malformed product UUIDs',()=>{
 assert.equal(saleInput.safeParse(sale([product,'not-a-uuid'])).success,false);
});
