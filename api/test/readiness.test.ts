import test from 'node:test';
import assert from 'node:assert/strict';
import {HttpException} from '@nestjs/common';
import type {Pool} from 'pg';
import {HealthController} from '../src/interfaces/http.js';

test('readiness queries PostgreSQL on every request; health stays independent', async()=>{
 const statements:string[]=[];
 const controller=new HealthController({query:async(sql:string)=>{statements.push(sql);}} as unknown as Pool);
 const headers:Record<string,string>={};
 const response={setHeader(name:string,value:string){headers[name]=value;}};
 assert.deepEqual(controller.health(),{status:'ok',service:'nexuscore',version:'0.1.0'});
 assert.deepEqual(statements,[]);
 for(let i=0;i<2;i++){
  assert.deepEqual(await controller.ready(response),{status:'ready',service:'nexuscore',version:'0.1.0'});
  assert.equal(headers['Cache-Control'],'no-store');
 }
 assert.deepEqual(statements,['SELECT 1','SELECT 1']);
});

test('readiness hides database errors and recovers on the next successful query', async()=>{
 let unavailable=true,queries=0;
 const controller=new HealthController({query:async()=>{queries++;if(unavailable)throw new Error('fictional-secret-in-error');}} as unknown as Pool);
 const headers:Record<string,string>={};
 const response={setHeader(name:string,value:string){headers[name]=value;}};
 await assert.rejects(()=>controller.ready(response),(error:unknown)=>{
  assert.ok(error instanceof HttpException);
  assert.equal(error.getStatus(),503);
  assert.equal(error.getResponse(),'Database unavailable');
  return true;
 });
 assert.equal(headers['Cache-Control'],'no-store');
 assert.equal(controller.health().status,'ok');
 unavailable=false;
 assert.equal((await controller.ready(response)).status,'ready');
 assert.equal(queries,2);
});
