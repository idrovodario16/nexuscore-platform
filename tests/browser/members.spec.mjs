import {test,expect} from '@playwright/test';

const orgA='11111111-1111-4111-8111-111111111111';
const orgB='22222222-2222-4222-8222-222222222222';
const users=Array.from({length:28},(_,index)=>({
 id:`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,
 name:`Usuario ${String(index+1).padStart(2,'0')}`,
 email:`usuario${index+1}@example.test`,role:index===0?'admin':index===1?'supervisor':'operator',
}));
const business={products:[],customers:[],sales:[],movements:[],sales_count:0,collected_cents:0,receivable_cents:0};
const answer=(route,json,status=200)=>route.fulfill({status,json});

async function backend(page,{role='admin',otherRole='operator',members}={}){
 await page.route('**/workspace-api/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/workspace-api/session')return answer(route,{
   user:{id:users[0].id,name:'Cuenta ficticia'},organizations:[
    {id:orgA,name:'Empresa Atlas',role},{id:orgB,name:'Empresa Pacífico',role:otherRole},
   ],
  });
  if(url.pathname.endsWith('/business'))return answer(route,business);
  if(url.pathname.endsWith('/members')){
   if(members)return members(route,url);
   const offset=Number(url.searchParams.get('offset'));
   return answer(route,{items:users.slice(offset,offset+25),total:users.length,page_size:25});
  }
  throw new Error('Unexpected fixture request: '+url.pathname);
 });
 await page.goto('/?workspace=1');
 await expect(page.getByRole('combobox',{name:'Empresa',exact:true})).toBeVisible();
}

test('admin reads roles and navigates both pages without horizontal page overflow',async({page},info)=>{
 await backend(page);
 await page.getByRole('button',{name:'Usuarios',exact:true}).click();
 const panel=page.getByRole('region',{name:'Usuarios de la empresa'});
 await expect(panel.getByText('Mostrando 1–25 de 28 usuarios')).toBeVisible();
 await expect(panel.locator('tbody tr')).toHaveCount(25);
 await expect(panel.getByText('Administración',{exact:true})).toBeVisible();
 await expect(panel.getByText('Supervisión',{exact:true})).toBeVisible();
 await expect(panel.getByRole('button',{name:'Anterior',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 expect(await panel.locator('.table-scroll').evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
 await page.screenshot({path:info.outputPath('users.png')});
 await panel.getByRole('button',{name:'Siguiente',exact:true}).click();
 await expect(panel.getByText('Mostrando 26–28 de 28 usuarios')).toBeVisible();
 await expect(panel.locator('tbody tr')).toHaveCount(3);
 await expect(panel.getByText('Usuario 01',{exact:true})).toHaveCount(0);
 await expect(panel.getByRole('button',{name:'Siguiente',exact:true})).toBeDisabled();
 await panel.getByRole('button',{name:'Anterior',exact:true}).click();
 await expect(panel.getByText('Mostrando 1–25 de 28 usuarios')).toBeVisible();
 await page.getByRole('combobox',{name:'Empresa',exact:true}).selectOption(orgB);
 await expect(page.getByRole('button',{name:'Usuarios',exact:true})).toHaveCount(0);
 await expect(panel).toHaveCount(0);
});

test('operator has no users view and makes no member requests',async({page})=>{
 let calls=0;
 await backend(page,{role:'operator',members:route=>{calls++;return answer(route,{});}});
 await expect(page.getByRole('button',{name:'Resumen',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Usuarios',exact:true})).toHaveCount(0);
 expect(calls).toBe(0);
});

test('refresh removes old rows on server errors, denied access and expired session',async({page})=>{
 let status=200;
 await backend(page,{members:route=>status===200 ? answer(route,{items:[users[0]],total:1,page_size:25}) :
  answer(route,{message:status===403?'Acceso denegado a esta empresa.':'internal-fictional-secret'},status)});
 await page.getByRole('button',{name:'Usuarios',exact:true}).click();
 const panel=page.getByRole('region',{name:'Usuarios de la empresa'});
 await expect(panel.getByText(users[0].email)).toBeVisible();
 status=500;
 await panel.getByRole('button',{name:'Actualizar usuarios'}).click();
 await expect(panel.getByRole('alert')).toContainText('No se pudo conectar con NexusCore.');
 await expect(panel.locator('tbody tr')).toHaveCount(0);
 await expect(page.getByText('internal-fictional-secret')).toHaveCount(0);
 status=403;
 await panel.getByRole('button',{name:'Actualizar usuarios'}).click();
 await expect(panel.getByRole('alert')).toContainText('Acceso denegado');
 await expect(panel.locator('tbody tr')).toHaveCount(0);
 status=401;
 await panel.getByRole('button',{name:'Actualizar usuarios'}).click();
 await expect(page.getByRole('heading',{name:'Inicia sesión',exact:true})).toBeVisible();
 await expect(page.getByRole('alert')).toContainText('Tu sesión expiró');
 await expect(panel).toHaveCount(0);
});

test('switching companies aborts the pending list and shows only the new company',async({page})=>{
 let release;
 const held=new Promise(resolve=>{release=resolve;});
 await backend(page,{otherRole:'admin',members:async(route,url)=>{
  if(url.pathname.includes(orgA)){
   await held;
   // This request is intentionally aborted when switching company below.
   return answer(route,{items:[users[0]],total:1,page_size:25}).catch(()=>{});
  }
  return answer(route,{items:[{...users[1],name:'Usuario Pacífico'}],total:1,page_size:25});
 }});
 try {
  await page.getByRole('button',{name:'Usuarios',exact:true}).click();
  await expect(page.getByText('Cargando usuarios…',{exact:true})).toBeVisible();
  const aborted=page.waitForEvent('requestfailed',request=>request.url().includes(orgA+'/members'));
  await page.getByRole('combobox',{name:'Empresa',exact:true}).selectOption(orgB);
  await aborted;
  await page.getByRole('button',{name:'Usuarios',exact:true}).click();
  await expect(page.getByRole('cell',{name:'Usuario Pacífico',exact:true})).toBeVisible();
  release();
  await expect(page.getByRole('cell',{name:'Usuario 01',exact:true})).toHaveCount(0);
 } finally {release();}
});
