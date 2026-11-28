import {test,expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {randomUUID,scryptSync} from 'node:crypto';

test.skip(process.env.RUN_INTEGRATION!=='1'||process.env.WORKSPACE_BROWSER_INTEGRATION!=='1',
 'Requires an explicitly enabled isolated PostgreSQL test database');

const orgA=randomUUID(),orgB=randomUUID();
const account=name=>({id:randomUUID(),email:randomUUID()+'@example.test',name});
const admin=account('Administradora de prueba');
const operator=account('Operador de prueba');
const outsider=account('Administrador de otra empresa');
const accounts=[admin,operator,outsider];
const password='ficticia-solo-para-browser-e2e';
let app,pool,runtimePool;
const previous={};

test.beforeAll(async()=>{
 const require=createRequire(new URL('../../api/package.json',import.meta.url));
 const {Pool}=require('pg');
 pool=new Pool({connectionString:process.env.DATABASE_URL});
 await pool.query("INSERT INTO workspace_organizations VALUES($1,'Empresa E2E A'),($2,'Empresa E2E B')",[orgA,orgB]);
 for(const user of accounts){
  const salt=randomUUID();
  const hash=salt+':'+scryptSync(password,salt,64).toString('hex');
  await pool.query('INSERT INTO workspace_users VALUES($1,$2,$3,$4)',[user.id,user.email,user.name,hash]);
 }
 for(const [org,user,role] of [[orgA,admin,'admin'],[orgA,operator,'operator'],[orgB,admin,'operator'],[orgB,outsider,'admin']]){
  await pool.query('INSERT INTO workspace_memberships VALUES($1,$2,$3)',[org,user.id,role]);
 }
 for(const key of ['DATABASE_URL','REQUIRE_DATABASE_ISOLATION','WORKSPACE_INSECURE_COOKIE'])previous[key]=process.env[key];
 const url=new URL(process.env.DATABASE_URL);
 url.searchParams.set('options','-c role=nexus_core_runtime');
 process.env.DATABASE_URL=url.toString();
 process.env.REQUIRE_DATABASE_ISOLATION='1';
 // HTTP is used only by this loopback test server; production cookie defaults stay secure.
 process.env.WORKSPACE_INSECURE_COOKIE='1';
 const {createApp}=await import('../../api/dist/src/interfaces/http.js');
 const instance=await createApp();
 app=instance.app;runtimePool=instance.pool;
 await app.listen(3000,'127.0.0.1');
});

test.afterAll(async()=>{
 try {
  if(pool){
   const ids=accounts.map(user=>user.id);
   await pool.query('DELETE FROM workspace_sessions WHERE user_id=ANY($1::uuid[])',[ids]);
   await pool.query('DELETE FROM workspace_memberships WHERE user_id=ANY($1::uuid[])',[ids]);
   await pool.query('DELETE FROM workspace_users WHERE id=ANY($1::uuid[])',[ids]);
   await pool.query('DELETE FROM workspace_organizations WHERE id IN ($1,$2)',[orgA,orgB]);
  }
 } finally {
  await app?.close();await runtimePool?.end();await pool?.end();
  for(const [key,value] of Object.entries(previous)){
   if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
 }
});

test('real login, tenant permissions, role revocation and session expiry through Vite proxy',async({page})=>{
 // No page.route: requests pass through the configured Vite proxy to NestJS/PostgreSQL.
 await page.goto('/?workspace=1');
 async function login(user){
  await expect(page.getByRole('heading',{name:'Inicia sesión',exact:true})).toBeVisible();
  await page.getByLabel('Correo',{exact:true}).fill(user.email);
  await page.getByLabel('Contraseña',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await expect(page.getByRole('button',{name:'Cerrar sesión',exact:true})).toBeVisible();
 }
 await login(admin);
 const cookie=(await page.context().cookies()).find(cookie=>cookie.name==='nexus_workspace');
 expect(cookie).toMatchObject({httpOnly:true,sameSite:'Strict',secure:false,path:'/workspace-api'});
 await page.getByRole('button',{name:'Usuarios',exact:true}).click();
 const panel=page.getByRole('region',{name:'Usuarios de la empresa'});
 await expect(panel.locator('tbody tr')).toHaveCount(2);
 await expect(panel.getByRole('cell',{name:operator.name,exact:true})).toBeVisible();
 await expect(panel.getByRole('cell',{name:outsider.name,exact:true})).toHaveCount(0);
 await page.getByRole('combobox',{name:'Empresa',exact:true}).selectOption(orgB);
 await expect(page.getByRole('button',{name:'Usuarios',exact:true})).toHaveCount(0);
 const memberStatus=org=>page.evaluate(async org=>{
  const response=await fetch('/workspace-api/organizations/'+org+'/members');
  return response.status;
 },org);
 expect(await memberStatus(orgB)).toBe(403);
 await page.getByRole('combobox',{name:'Empresa',exact:true}).selectOption(orgA);
 await page.getByRole('button',{name:'Usuarios',exact:true}).click();
 await expect(panel.locator('tbody tr')).toHaveCount(2);
 await pool.query("UPDATE workspace_memberships SET role='supervisor' WHERE organization_id=$1 AND user_id=$2",[orgA,admin.id]);
 await panel.getByRole('button',{name:'Actualizar usuarios'}).click();
 await expect(panel.getByRole('alert')).toContainText('Solo administración');
 await expect(panel.locator('tbody tr')).toHaveCount(0);
 await pool.query("UPDATE workspace_sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1",[admin.id]);
 await panel.getByRole('button',{name:'Actualizar usuarios'}).click();
 await expect(page.getByRole('heading',{name:'Inicia sesión',exact:true})).toBeVisible();
 await expect(page.getByRole('alert')).toContainText('Tu sesión expiró');
 await login(operator);
 await expect(page.getByRole('button',{name:'Usuarios',exact:true})).toHaveCount(0);
 expect(await memberStatus(orgA)).toBe(403);
 await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Inicia sesión',exact:true})).toBeVisible();
});
