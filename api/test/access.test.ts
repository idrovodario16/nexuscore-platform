import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {IntegrationAccess,AccessDenied} from '../src/application/integration-access.js';
const org='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const key='a'.repeat(40), second='b'.repeat(40);
const item=(token:string,organization_id=org,permissions=['read'])=>({key_sha256:createHash('sha256').update(token).digest('hex'),organization_id,permissions});
test('scoped keys deny cross-tenant requests and unauthorized writes',()=>{
 const access=new IntegrationAccess({INTEGRATION_CREDENTIALS:JSON.stringify([item(key),item(second,other,['write'])])});
 assert.equal(access.authorize('Bearer '+key,org,'read'),org);
 assert.equal(access.authorize('Bearer '+second,other,'write'),other);
 for(const [token,tenant,permission,status] of [[key,other,'read',403],[key,org,'write',403],[second,other,'read',403],['c'.repeat(40),org,'read',401]] as const){
  assert.throws(()=>access.authorize('Bearer '+token,tenant,permission),(e:unknown)=>e instanceof AccessDenied&&e.status===status);
 }
 assert.throws(()=>access.authorize(key,org,'read'));
});
test('invalid explicit configuration never falls back to legacy access',()=>{
 for(const config of ['', '[]','{}','null',JSON.stringify([item(key),item(key,other)]),JSON.stringify([{...item(key),permissions:['admin']}])]){
  assert.throws(()=>new IntegrationAccess({INTEGRATION_CREDENTIALS:config,API_KEY:key,ORGANIZATION_ID:org}));
 }
});
test('legacy access remains scoped and configuration is captured at startup',()=>{
 const env={API_KEY:key,ORGANIZATION_ID:org};const access=new IntegrationAccess(env);
 env.ORGANIZATION_ID=other;
 assert.equal(access.authorize('Bearer '+key,org,'write'),org);
 assert.throws(()=>access.authorize('Bearer '+key,other,'read'));
});
