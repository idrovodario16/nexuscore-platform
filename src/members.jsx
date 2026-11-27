import React,{useEffect,useState} from 'react';

const roles={admin:'Administración',supervisor:'Supervisión',operator:'Operación'};

export function Members({organization,request,onExpired}){
 const [offset,setOffset]=useState(0);
 const [version,setVersion]=useState(0);
 const [result,setResult]=useState(null);
 const path='/organizations/'+organization.id+'/members?offset='+offset;
 const current=result?.path===path&&result.version===version ? result : null;
 const data=current?.data;

 useEffect(()=>{
  if(organization.role!=='admin') return;
  const controller=new AbortController();
  let active=true;
  request(path,{signal:controller.signal}).then(data=>{
   if(active) setResult({path,version,data});
  }).catch(error=>{
   if(!active||error.name==='AbortError') return;
   if(error.status===401) onExpired();
   else setResult({path,version,error:error.message});
  });
  return ()=>{active=false;controller.abort();};
 },[path,version,organization.role]);

 if(organization.role!=='admin') return <p>Solo administración puede consultar los usuarios de esta empresa.</p>;

 return <section className="panel nx-list nx-members" aria-label="Usuarios de la empresa">
  <div className="nx-top">
   <div><h2>Usuarios de la empresa</h2><p>{organization.name}</p></div>
   <button disabled={!current} onClick={()=>setVersion(value=>value+1)}>Actualizar usuarios</button>
  </div>
  {!current ? <p role="status">Cargando usuarios…</p> : current.error ?
   <p className="nx-error" role="alert">{current.error}</p> : data&&<>
    <p role="status">{data.items.length ?
     `Mostrando ${offset+1}–${offset+data.items.length} de ${data.total} usuarios` :
     `No hay usuarios en esta página. Total: ${data.total}.`}</p>
    {data.items.length>0&&<div className="table-scroll"><table>
     <thead><tr><th scope="col">Usuario</th><th scope="col">Correo</th><th scope="col">Rol</th></tr></thead>
     <tbody>{data.items.map(user=><tr key={user.id}>
      <td>{user.name}</td><td>{user.email}</td><td>{roles[user.role]??user.role}</td>
     </tr>)}</tbody>
    </table></div>}
    {(offset>0||data.total>data.page_size)&&<nav className="nx-row-actions" aria-label="Páginas de usuarios">
     <button disabled={offset===0} onClick={()=>setOffset(value=>Math.max(0,value-data.page_size))}>Anterior</button>
     <button disabled={offset+data.page_size>=data.total} onClick={()=>setOffset(value=>value+data.page_size)}>Siguiente</button>
    </nav>}
   </>}
 </section>;
}
