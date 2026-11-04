import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/interfaces/http.js';
test('HTTP + PostgreSQL: autorización, revisión y outbox atómica', {skip:process.env.RUN_INTEGRATION!=='1'}, async()=>{
 const {app,pool}=await createApp();
 try {
  await app.listen(0,'127.0.0.1');
  const base=await app.getUrl();
  const headers={'Content-Type':'application/json',Authorization:'Bearer '+process.env.API_KEY,'X-Organization-ID':process.env.ORGANIZATION_ID!};
  assert.equal((await fetch(base+'/v1/operations')).status,401);
  assert.equal((await fetch(base+'/v1/operations',{headers:{...headers,'X-Organization-ID':'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}})).status,403);
  const bad=await fetch(base+'/v1/operations',{method:'POST',headers,body:JSON.stringify({title:'Bad',sector:'retail',amount_cents:-1})});
  assert.equal(bad.status,400);
  const res=await fetch(base+'/v1/operations',{method:'POST',headers,body:JSON.stringify({title:'Prueba ficticia',sector:'retail',amount_cents:1500})});
  assert.equal(res.status,201);
  const row=await res.json() as any;
  assert.equal((await fetch(base+'/v1/operations/'+row.id,{method:'PATCH',headers,body:JSON.stringify({status:'in_progress',expected_revision:1})})).status,200);
  assert.equal((await fetch(base+'/v1/operations/'+row.id,{method:'PATCH',headers,body:JSON.stringify({status:'completed',expected_revision:1})})).status,409);
  const events=await pool.query("SELECT event FROM outbox WHERE event->'data'->>'id'=$1 ORDER BY sequence",[row.id]);
  assert.equal(events.rowCount,2);assert.equal(events.rows[1].event.data.revision,2);
  await pool.query("DELETE FROM outbox WHERE event->'data'->>'id'=$1",[row.id]);
  await pool.query('DELETE FROM operations WHERE id=$1',[row.id]);
 } finally {await app.close();await pool.end();}
});
