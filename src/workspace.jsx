import React,{useEffect,useState} from 'react';
import {transitions} from './model';
import {Business} from './business';
import './workspace.css';

const labels = {pending:'Pendiente',in_progress:'En tránsito',completed:'Entregado',cancelled:'Cancelado'};
const roles = {admin:'Administración',supervisor:'Supervisión',operator:'Operación'};
const date = new Intl.DateTimeFormat('es-EC',{dateStyle:'medium',timeStyle:'short'});

async function request(path,{method='GET',body,signal}={}){
 const response = await fetch('/workspace-api'+path,{
  method,signal,credentials:'same-origin',
  headers:method==='GET' ? undefined : {'Content-Type':'application/json','X-Nexus-Workspace':'1'},
  body:body===undefined ? undefined : JSON.stringify(body),
 });
 if(response.status===204) return;
 const result = await response.json().catch(()=>null);
 if(!response.ok || result===null){
  const message = response.status>=500 || !result
   ? 'No se pudo conectar con NexusCore. Intenta nuevamente.'
   : result.message ?? 'No se pudo completar la solicitud.';
  throw Object.assign(new Error(message),{status:response.status});
 }
 return result;
}

export function Workspace(){
 const [session,setSession] = useState(undefined);
 const [org,setOrg] = useState('');
 const [section,setSection] = useState('summary');
 const [shipmentSearch,setShipmentSearch] = useState('');
 const [error,setError] = useState('');
 const [busy,setBusy] = useState(false);

 function loadSession(signal){
  return request('/session',{signal}).then(next=>{
   setSession(next);
   setOrg(next.organizations[0]?.id ?? '');
  });
 }

 useEffect(()=>{
  const controller = new AbortController();
  loadSession(controller.signal).catch(error=>{
   if(error.name==='AbortError') return;
   setSession(null);
   if(error.status!==401) setError(error.message);
  });
  return ()=>controller.abort();
 },[]);

 async function login(event){
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  setBusy(true);
  setError('');
  try {
   await request('/session',{method:'POST',body:Object.fromEntries(data)});
   await loadSession();
  } catch(error){setError(error.message);}
  finally {setBusy(false);}
 }

 async function logout(){
  setBusy(true);
  setError('');
  try {
   await request('/session/logout',{method:'POST'});
   setSession(null);
   setOrg('');
  } catch(error){setError(error.message);}
  finally {setBusy(false);}
 }

 function expire(){
  setSession(null);
  setOrg('');
  setError('Tu sesión expiró. Inicia sesión para continuar.');
 }

 function navigate(next,search=''){
  setShipmentSearch(search);
  setSection(next);
 }

 const organization = session?.organizations.find(item=>item.id===org);
 return <div className="nx-workspace">
  <div className="nx-top">
   <div><span className="eyebrow">NEXUSCORE · OPERACIONES</span><h1>NexusWorkspace</h1></div>
   {session&&<button disabled={busy} onClick={logout}>Cerrar sesión</button>}
  </div>
  {error&&<p role="alert" className="nx-error">{error}</p>}
  {session===undefined ? <p role="status">Comprobando sesión…</p> : session===null ?
   <section className="panel nx-login">
    <h2>Inicia sesión</h2>
    <p>Accede al espacio de operaciones de tu empresa.</p>
    <form onSubmit={login}>
     <label>Correo<input name="email" type="email" autoComplete="username" required maxLength={254}/></label>
     <label>Contraseña<input name="password" type="password" autoComplete="current-password" required maxLength={256}/></label>
     <button className="primary" disabled={busy}>{busy?'Ingresando…':'Entrar'}</button>
    </form>
   </section> :
   <>
    <div className="nx-company">
     <label>Empresa<select value={org} onChange={event=>setOrg(event.target.value)} disabled={!organization||busy}>
      {!organization&&<option value="">Sin empresas asignadas</option>}
      {session.organizations.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
     </select></label>
     <p>{session.user.name}{organization&&' · '+roles[organization.role]}</p>
    </div>
    {organization ? <>
     <nav className="nx-sections" aria-label="Módulos de la empresa">
      {[['summary','Resumen'],['inventory','Inventario'],['customers','Clientes'],['sales','Ventas y cobros'],['shipments','Despachos']]
       .map(([key,label])=><button key={key} aria-current={section===key?'page':undefined}
        className={section===key?'primary':undefined} onClick={()=>navigate(key)}>{label}</button>)}
     </nav>
     {section==='shipments' ? <Shipments key={org+shipmentSearch} organization={organization}
      initialSearch={shipmentSearch} onExpired={expire}/> :
      <Business key={org} organization={organization} section={section} request={request}
       onNavigate={navigate} onExpired={expire}/>}
    </> :
     <p>Esta cuenta aún no tiene una empresa asignada.</p>}
   </>}
 </div>;
}

function Shipments({organization,onExpired,initialSearch}){
 const path = '/organizations/'+organization.id+'/shipments';
 const [search,setSearch] = useState(initialSearch);
 const [status,setStatus] = useState('');
 const [offset,setOffset] = useState(0);
 const [version,setVersion] = useState(0);
 const [overview,setOverview] = useState(null);
 const [history,setHistory] = useState(null);
 const [selected,setSelected] = useState(null);
 const [notice,setNotice] = useState('');
 const [error,setError] = useState('');
 const [busy,setBusy] = useState(false);
 const query = new URLSearchParams({search,offset});
 if(status) query.set('status',status);
 const overviewPath = path+'?'+query;
 const visible = overview?.key===overviewPath ? overview.data : null;

 useEffect(()=>{
  const controller = new AbortController();
  request(overviewPath,{signal:controller.signal}).then(data=>setOverview({key:overviewPath,data})).catch(error=>{
   if(error.name==='AbortError') return;
   if(error.status===401) onExpired();
   else {setOverview({key:overviewPath,data:null});setError(error.message);}
  });
  return ()=>controller.abort();
 },[overviewPath,version]);

 useEffect(()=>{
  if(!selected) return;
  const controller = new AbortController();
  request(path+'/'+selected.id+'/history',{signal:controller.signal})
   .then(data=>setHistory({id:selected.id,data})).catch(error=>{
    if(error.name==='AbortError') return;
    if(error.status===401) onExpired();
    else {setHistory({id:selected.id,data:null});setError(error.message);}
   });
  return ()=>controller.abort();
 },[path,selected,version]);

 function refresh(){setVersion(current=>current+1);}

 async function mutate(target,method,body,onSuccess){
  setBusy(true);
  setNotice('');
  setError('');
  try {
   await request(target,{method,body});
   onSuccess();
   refresh();
  } catch(error){
   if(error.status===401) onExpired();
   else {
    setError(error.message);
    if(error.status===409) refresh();
   }
  } finally {setBusy(false);}
 }

 function create(event){
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  mutate(path,'POST',{title:data.get('title'),amount_cents:Math.round(Number(data.get('amount'))*100)},()=>{
   form.reset();
   setSearch('');
   setStatus('');
   setOffset(0);
   setNotice('Envío creado.');
  });
 }

 function change(row,next){
  if(!next) return;
  mutate(path+'/'+row.id,'PATCH',{status:next,expected_revision:row.revision},()=>{
   setOffset(0);
   setNotice('Estado actualizado.');
  });
 }

 return <>
  <section className="panel nx-create">
   <h2>Registrar envío</h2>
   <form onSubmit={create}>
    <label>Descripción<input name="title" required minLength={3} maxLength={120} placeholder="Ej. Envío de repuestos a Cuenca"/></label>
    <label>Monto USD<input name="amount" type="number" min="0" max="10000000" step="0.01" required defaultValue="0"/></label>
    <button className="primary" disabled={busy}>Crear envío</button>
   </form>
  </section>
  {notice&&<p className="notice" role="status">{notice}</p>}
  {error&&<div className="nx-error" role="alert">{error} <button onClick={()=>{setError('');refresh();}}>Recargar datos</button></div>}
  <section aria-label="Indicadores de envíos" className="kpis nx-kpis">
   {[
    ['Total',visible?.total],['Abiertos',visible?.open],['Entregados',visible?.completed],
    ['Tasa de entrega',visible&&visible.completion+'%'],
   ].map(([label,value])=><div className="kpi" key={label}><div>{label}</div><strong>{value??'—'}</strong></div>)}
  </section>
  <section className="panel nx-list">
   <h2>Envíos</h2>
   <div className="nx-filters">
    <label>Buscar por descripción<input value={search} maxLength={120} onChange={event=>{setSearch(event.target.value);setOffset(0);}}/></label>
    <label>Estado<select value={status} onChange={event=>{setStatus(event.target.value);setOffset(0);}}>
     <option value="">Todos los estados</option>
     {Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}
    </select></label>
   </div>
   {overview?.key!==overviewPath ? <p role="status">Cargando envíos…</p> : visible?.items.length===0 ?
    <p>Sin envíos para estos filtros.</p> : visible&&
    <div className="table-scroll"><table>
     <thead><tr><th>Envío</th><th>Estado</th><th>Acciones</th></tr></thead>
     <tbody>{visible.items.map(row=>{
      const allowed = transitions[row.status].filter(next=>next!=='cancelled'||organization.role!=='operator');
      return <tr key={row.id}>
       <td><strong>{row.title}</strong><small>Revisión {row.revision}</small></td>
       <td><span className={'status '+row.status}>{labels[row.status]}</span></td>
       <td><div className="nx-row-actions">
        {allowed.length>0&&<select value="" disabled={busy} aria-label={'Cambiar estado de '+row.title} onChange={event=>change(row,event.target.value)}>
         <option value="" disabled>Cambiar estado</option>
         {allowed.map(next=><option key={next} value={next}>{labels[next]}</option>)}
        </select>}
        <button onClick={()=>setSelected(row)} aria-label={'Ver historial de '+row.title}>Historial</button>
       </div></td>
      </tr>;
     })}</tbody>
    </table></div>}
   {visible&&(offset>0||visible.total>visible.page_size)&&<nav className="nx-row-actions" aria-label="Páginas de envíos">
    <button disabled={offset===0} onClick={()=>setOffset(offset-visible.page_size)}>Anterior</button>
    <button disabled={offset+visible.page_size>=visible.total} onClick={()=>setOffset(offset+visible.page_size)}>Siguiente</button>
   </nav>}
  </section>
  {selected&&<section className="panel nx-history" aria-label="Historial del envío">
   <div className="nx-top"><h2>Historial · {selected.title}</h2><button onClick={()=>setSelected(null)}>Cerrar historial</button></div>
   {history?.id!==selected.id ? <p role="status">Cargando historial…</p> : history.data&&
    <ol>{history.data.map(entry=><li key={entry.revision}>
     <strong>{entry.previous_status ? labels[entry.previous_status]+' → '+labels[entry.status] : 'Creado · '+labels[entry.status]}</strong>
     <span>{entry.actor_name} · {date.format(new Date(entry.occurred_at))}</span>
    </li>)}</ol>}
  </section>}
 </>;
}
