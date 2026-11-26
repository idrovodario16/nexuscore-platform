import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {createRestrictedApp} from './runtime.js';

test('Workspace members: admin scope, stable pagination and current authorization',{
 skip:process.env.RUN_INTEGRATION!=='1',
},async()=>{
 const {app,pool,runtimePool}=await createRestrictedApp();
 const orgA=randomUUID(),orgB=randomUUID();
 const members=Array.from({length:28},(_,index)=>{
  const id=randomUUID();
  return {id,name:'Usuario ficticio',email:id+'@example.test',role:index===0?'admin':index===1?'supervisor':'operator'};
 });
 const adminB={id:randomUUID(),name:'Usuario ficticio',email:randomUUID()+'@example.test',role:'admin'};
 const ids=[...members.map(user=>user.id),adminB.id];
 try {
  await pool.query("INSERT INTO workspace_organizations VALUES($1,'Empresa ficticia A'),($2,'Empresa ficticia B')",[orgA,orgB]);
  for(const user of [...members,adminB]){
   await pool.query('INSERT INTO workspace_users VALUES($1,$2,$3,$4)',[user.id,user.email,user.name,'fixture-not-for-login']);
   await pool.query('INSERT INTO workspace_memberships VALUES($1,$2,$3)',[user.id===adminB.id?orgB:orgA,user.id,user.role]);
  }
  // Administration in A does not confer administration in B.
  await pool.query("INSERT INTO workspace_memberships VALUES($1,$2,'operator')",[orgB,members[0].id]);
  async function session(userId:string){
   const token=randomBytes(32).toString('hex');
   await pool.query("INSERT INTO workspace_sessions VALUES($1,$2,now()+interval '1 hour')",[
    createHash('sha256').update(token).digest('hex'),userId,
   ]);
   return 'nexus_workspace='+token;
  }
  const [admin,supervisor,operator,otherAdmin]=await Promise.all([
   session(members[0].id),session(members[1].id),session(members[2].id),session(adminB.id),
  ]);
  await app.listen(0,'127.0.0.1');
  const base=await app.getUrl();
  const path=(org:string)=>'/workspace-api/organizations/'+org+'/members';
  const get=(org:string,cookie?:string,suffix='')=>fetch(base+path(org)+suffix,{headers:cookie?{cookie}:undefined});
  const anonymous=await get(orgA);
  assert.equal(anonymous.status,401);
  assert.equal(anonymous.headers.get('cache-control'),'no-store');
  for(const cookie of [supervisor,operator,otherAdmin])assert.equal((await get(orgA,cookie)).status,403);
  assert.equal((await get(orgB,admin)).status,403);
  assert.equal((await get('not-a-uuid',admin)).status,400);
  for(const suffix of ['?offset=-1','?offset=1.5','?offset=1000001','?offset=abc','?role=admin','?offset=0&offset=25']){
   assert.equal((await get(orgA,admin,suffix)).status,400);
  }
  type Member={id:string;name:string;email:string;role:string};
  type Page={items:Member[];total:number;page_size:number};
  const first=await get(orgA,admin);
  assert.equal(first.status,200);
  assert.equal(first.headers.get('cache-control'),'no-store');
  const page=await first.json() as Page;
  const next=await (await get(orgA,admin,'?offset=25')).json() as Page;
  assert.deepEqual([page.total,page.page_size,page.items.length,next.total,next.items.length],[28,25,25,28,3]);
  const byId=(a:Member,b:Member)=>a.id<b.id?-1:a.id>b.id?1:0;
  assert.deepEqual([...page.items,...next.items],[...members].sort(byId));
  for(const item of page.items)assert.deepEqual(Object.keys(item).sort(),['email','id','name','role']);
  assert.deepEqual(await (await get(orgA,admin,'?offset=1000000')).json(),{items:[],total:28,page_size:25});
  const other=await (await get(orgB,otherAdmin)).json() as Page;
  assert.equal(other.total,2);
  assert.deepEqual(other.items,[adminB,{...members[0],role:'operator'}].sort(byId));
  // Authorization is read again even while the same session cookie remains valid.
  await pool.query("UPDATE workspace_memberships SET role='supervisor' WHERE organization_id=$1 AND user_id=$2",[orgA,members[0].id]);
  assert.equal((await get(orgA,admin)).status,403);
  await pool.query("UPDATE workspace_sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1",[members[0].id]);
  assert.equal((await get(orgA,admin)).status,401);
 } finally {
  await pool.query('DELETE FROM workspace_sessions WHERE user_id=ANY($1::uuid[])',[ids]);
  await pool.query('DELETE FROM workspace_memberships WHERE user_id=ANY($1::uuid[])',[ids]);
  await pool.query('DELETE FROM workspace_users WHERE id=ANY($1::uuid[])',[ids]);
  await pool.query('DELETE FROM workspace_organizations WHERE id IN ($1,$2)',[orgA,orgB]);
  await app.close();await pool.end();await runtimePool.end();
 }
});
