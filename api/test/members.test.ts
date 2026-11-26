import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import {HttpException} from '@nestjs/common';
import type {Pool} from 'pg';
import {WorkspaceController} from '../src/interfaces/workspace.js';
import type {PostgresOperations} from '../src/infrastructure/postgres.js';

const org='11111111-1111-4111-8111-111111111111';
const cookie='nexus_workspace='+'a'.repeat(64);

function fixture(role?:string){
 const queries:string[]=[];
 const pool={query:async(sql:string)=>{
  queries.push(sql);
  if(sql.includes('FROM workspace_sessions'))return {rowCount:1,rows:[{id:org,name:'Prueba ficticia'}]};
  if(sql.startsWith('SELECT role'))return {rowCount:role?1:0,rows:role?[{role}]:[]};
  throw new Error('Unauthorized or invalid requests must not query the directory');
 }} as unknown as Pool;
 return {controller:new WorkspaceController(pool,{} as PostgresOperations),queries};
}

const status=(expected:number)=>(error:unknown)=>error instanceof HttpException && error.getStatus()===expected;

test('member directory requires a session and an admin membership before querying users',async()=>{
 const anonymous=fixture('admin');
 await assert.rejects(()=>anonymous.controller.members('',org,{}),status(401));
 assert.equal(anonymous.queries.length,0);
 for(const role of [undefined,'operator','supervisor']){
  const {controller,queries}=fixture(role);
  await assert.rejects(()=>controller.members(cookie,org,{}),status(403));
  assert.equal(queries.length,2);
 }
});

test('member directory rejects malformed organization and pagination before listing',async()=>{
 const {controller}=fixture('admin');
 await assert.rejects(()=>controller.members(cookie,'not-a-uuid',{}),status(400));
 for(const query of [{offset:'-1'},{offset:'1.5'},{offset:'1000001'},{offset:'abc'},{offset:['0','25']},{role:'admin'}]){
  await assert.rejects(()=>controller.members(cookie,org,query),status(400));
 }
});
