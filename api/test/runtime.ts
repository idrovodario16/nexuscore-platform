import {Pool} from 'pg';
import {createApp} from '../src/interfaces/http.js';

// Fixture setup/cleanup uses the migration account; every HTTP request uses RLS.
export async function createRestrictedApp(){
 const previous=process.env.DATABASE_URL;
 const flag=process.env.REQUIRE_DATABASE_ISOLATION;
 const url=new URL(previous!);url.searchParams.set('options','-c role=nexus_core_runtime');
 process.env.DATABASE_URL=url.toString();process.env.REQUIRE_DATABASE_ISOLATION='1';
 try {
  const {app,pool:runtimePool}=await createApp();
  return {app,runtimePool,pool:new Pool({connectionString:previous})};
 } finally {
  process.env.DATABASE_URL=previous;
  if(flag===undefined)delete process.env.REQUIRE_DATABASE_ISOLATION;else process.env.REQUIRE_DATABASE_ISOLATION=flag;
 }
}
