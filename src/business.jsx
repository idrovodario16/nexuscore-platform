import React,{useEffect,useRef,useState} from 'react';

const money = new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'});
const formatMoney = cents => money.format(Number(cents)/100);
const formatDate = value => new Date(value).toLocaleString('es-EC',{dateStyle:'short',timeStyle:'short'});
const states = {pending:'Pendiente',in_progress:'En tránsito',completed:'Entregado',cancelled:'Cancelado'};
const movementNames = {receipt:'Entrada',sale:'Venta',cancellation:'Reposición'};
const methods = {cash:'Efectivo',transfer:'Transferencia',card:'Tarjeta'};

function Records({headers,children,empty}){
 return children.length ? <div className="table-scroll"><table>
  <thead><tr>{headers.map(label=><th key={label}>{label}</th>)}</tr></thead>
  <tbody>{children}</tbody>
 </table></div> : <p>{empty}</p>;
}

export function Business({organization,section,onNavigate,onExpired,request}){
 const path = '/organizations/'+organization.id+'/business';
 const [data,setData] = useState(null);
 const [reload,setReload] = useState(0);
 const [error,setError] = useState('');
 const [notice,setNotice] = useState('');
 const [busy,setBusy] = useState(false);
 const [lines,setLines] = useState([{product_id:'',quantity:1}]);
 const pendingSale = useRef(null);

 function showError(error){
  if(error.status===401) onExpired();
  else setError(error.message);
 }

 useEffect(()=>{
  const controller = new AbortController();
  request(path,{signal:controller.signal}).then(setData).catch(error=>{
   if(error.name!=='AbortError') showError(error);
  });
  return ()=>controller.abort();
 },[path,reload]);

 async function submit(event,action,serialize,message){
  event.preventDefault();
  const form = event.currentTarget;
  const body = serialize(new FormData(form));
  setError('');
  setNotice('');
  setBusy(true);
  try {
   await request(path+'/'+action,{method:'POST',body});
   setData(await request(path));
   form.reset();
   if(action==='sales'){
    pendingSale.current = null;
    setLines([{product_id:'',quantity:1}]);
   }
   setNotice(message);
  } catch(error){
   if(action==='sales' && error.status>=400 && error.status<500) pendingSale.current=null;
   showError(error);
  } finally {setBusy(false);}
 }

 const form = (action,serialize,message)=>event=>submit(event,action,serialize,message);
 const products = data?.products ?? [];
 const customers = data?.customers ?? [];
 const sellable = products.filter(product=>product.stock>0);
 const total = lines.reduce((sum,line)=>sum+(products.find(product=>product.id===line.product_id)?.price_cents??0)*line.quantity,0);
 const changeLine = (index,field,value)=>setLines(current=>current.map((line,i)=>i===index?{...line,[field]:value}:line));

 return <>
  {notice&&<p className="notice" role="status">{notice}</p>}
  {error&&<div className="nx-error" role="alert">{error} <button onClick={()=>{setError('');setReload(value=>value+1);}}>Recargar datos</button></div>}
  {!data&&!error&&<p role="status">Cargando datos de la empresa…</p>}
  {data&&section==='summary'&&<>
   <section className="panel">
    <h2>Operación de la empresa</h2>
    <p>Da de alta productos y clientes, recibe mercancía y registra una venta. El despacho queda creado y el stock se actualiza al confirmar.</p>
    <div className="nx-row-actions">
     <button className="primary" onClick={()=>onNavigate('inventory')}>Abrir inventario</button>
     <button onClick={()=>onNavigate('customers')}>Abrir clientes</button>
     <button onClick={()=>onNavigate('sales')}>Abrir ventas</button>
    </div>
   </section>
   <section className="kpis nx-kpis" aria-label="Indicadores de negocio">
    {[['Productos',products.length],['Ventas activas',data.sales_count],
      ['Cobrado',formatMoney(data.collected_cents)],['Por cobrar',formatMoney(data.receivable_cents)]]
     .map(([label,value])=><div key={label} className="kpi"><div>{label}</div><strong>{value}</strong></div>)}
   </section>
  </>}
  {data&&section==='inventory'&&<>
   <div className="nx-business-grid">
    <section className="panel">
     <h2>Nuevo producto</h2>
     <form onSubmit={form('products',values=>({
      sku:values.get('sku'),name:values.get('name'),price_cents:Math.round(Number(values.get('price'))*100),
     }),'Producto registrado. Puedes recibir existencias ahora.')}>
      <label>Código SKU<input name="sku" required maxLength={40}/></label>
      <label>Nombre del producto<input name="name" required minLength={2} maxLength={120}/></label>
      <label>Precio de venta USD<input name="price" type="number" required min="0.01" max="10000000" step="0.01"/></label>
      <button className="primary" disabled={busy}>Guardar producto</button>
     </form>
    </section>
    <section className="panel">
     <h2>Entrada de inventario</h2>
     <form onSubmit={form('receipts',values=>({
      product_id:values.get('product'),quantity:Number(values.get('quantity')),reference:values.get('reference'),
     }),'Entrada registrada. Se actualizó el stock.')}>
      <label>Producto<select name="product" required defaultValue="">
       <option value="" disabled>Selecciona un producto</option>
       {products.map(product=><option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}
      </select></label>
      <label>Unidades recibidas<input name="quantity" type="number" min="1" max="100000" step="1" required/></label>
      <label>Proveedor o referencia<input name="reference" required minLength={2} maxLength={120}/></label>
      <button className="primary" disabled={busy||!products.length}>Registrar entrada</button>
     </form>
    </section>
   </div>
   <section className="panel">
    <h2>Existencias</h2>
    <Records headers={['Código','Producto','Precio','Stock']} empty="Todavía no hay productos.">
     {products.map(product=><tr key={product.id}><td>{product.sku}</td><td>{product.name}</td><td>{formatMoney(product.price_cents)}</td><td>{product.stock}</td></tr>)}
    </Records>
   </section>
   <section className="panel">
    <h2>Últimos movimientos de inventario</h2>
    <Records headers={['Fecha','Producto','Movimiento','Unidades','Referencia','Usuario']} empty="Todavía no hay movimientos.">
     {data.movements.map(item=><tr key={item.id}><td>{formatDate(item.created_at)}</td><td>{item.name}</td>
      <td>{movementNames[item.kind]}</td><td>{item.delta>0?'+':''}{item.delta}</td>
      <td>{item.kind==='receipt'?item.reference:item.reference.slice(0,8)}</td><td>{item.actor}</td></tr>)}
    </Records>
   </section>
  </>}
  {data&&section==='customers'&&<>
   <section className="panel">
    <h2>Nuevo cliente</h2>
    <form className="nx-inline-form" onSubmit={form('customers',values=>({
     name:values.get('name'),contact:values.get('contact'),
    }),'Cliente registrado.')}>
     <label>Nombre o razón social<input name="name" required minLength={2} maxLength={120}/></label>
     <label>Contacto (opcional)<input name="contact" maxLength={120}/></label>
     <button className="primary" disabled={busy}>Guardar cliente</button>
    </form>
   </section>
   <section className="panel">
    <h2>Clientes</h2>
    <Records headers={['Cliente','Contacto']} empty="Todavía no hay clientes.">
     {customers.map(customer=><tr key={customer.id}><td>{customer.name}</td><td>{customer.contact||'—'}</td></tr>)}
    </Records>
   </section>
  </>}
  {data&&section==='sales'&&<>
   <section className="panel">
    <h2>Nueva venta</h2>
    {(!customers.length||!sellable.length)&&<p>Registra un cliente y recibe stock de un producto para crear una venta.</p>}
    <form onSubmit={form('sales',values=>{
     pendingSale.current ??= crypto.randomUUID();
     return {id:pendingSale.current,customer_id:values.get('customer'),items:lines};
    },'Venta registrada. Se descontó el stock y se creó el despacho.')}>
     <label>Cliente<select name="customer" required defaultValue="">
      <option value="" disabled>Selecciona un cliente</option>
      {customers.map(customer=><option value={customer.id} key={customer.id}>{customer.name}</option>)}
     </select></label>
     {lines.map((line,index)=><div className="nx-inline-form" key={index}>
      <label>Producto {index+1}<select required value={line.product_id} onChange={event=>changeLine(index,'product_id',event.target.value)}>
       <option value="" disabled>Selecciona un producto</option>
       {sellable.map(product=><option key={product.id} value={product.id}
        disabled={lines.some((other,i)=>i!==index&&other.product_id===product.id)}>
        {product.name} · {formatMoney(product.price_cents)} · {product.stock} disponibles
       </option>)}
      </select></label>
      <label>Cantidad {index+1}<input type="number" required min="1" step="1"
       max={Math.min(100000,products.find(product=>product.id===line.product_id)?.stock??100000)}
       value={line.quantity} onChange={event=>changeLine(index,'quantity',Number(event.target.value))}/></label>
      {lines.length>1&&<button type="button" onClick={()=>setLines(current=>current.filter((_,i)=>i!==index))}>Quitar línea {index+1}</button>}
     </div>)}
     <div className="nx-row-actions">
      <button type="button" disabled={busy||lines.length>=Math.min(sellable.length,25)}
       onClick={()=>setLines(current=>[...current,{product_id:'',quantity:1}])}>Agregar producto</button>
      <strong>Total {formatMoney(total)}</strong>
      <button className="primary" disabled={busy||!customers.length||!sellable.length}>Confirmar venta</button>
     </div>
    </form>
   </section>
   <section className="panel">
    <h2>Últimas ventas y cobros</h2>
    <Records headers={['Venta','Cliente y productos','Total','Cobro','Despacho']} empty="Todavía no hay ventas.">
     {data.sales.map(sale=><tr key={sale.id}>
      <td>{sale.id.slice(0,8)}<small>{formatDate(sale.created_at)}</small></td>
      <td>{sale.customer}<small>{sale.items.map(item=>item.quantity+' × '+item.product).join(', ')}</small></td>
      <td>{formatMoney(sale.total_cents)}</td>
      <td>{sale.cancelled_at ? 'Cancelada' : sale.paid_at ? 'Cobrado · '+methods[sale.payment_method] :
       <form className="nx-row-actions" onSubmit={form('sales/'+sale.id+'/payment',values=>({method:values.get('method')}),'Cobro registrado.')}>
        <select name="method" aria-label={'Forma de cobro '+sale.id.slice(0,8)}>
         {Object.entries(methods).map(([key,label])=><option key={key} value={key}>{label}</option>)}
        </select>
        <button disabled={busy}>Registrar cobro</button>
       </form>}</td>
      <td>{states[sale.shipment_status]}<small><button onClick={()=>onNavigate('shipments',sale.id.slice(0,8))}>Ver despacho</button></small></td>
     </tr>)}
    </Records>
   </section>
  </>}
 </>;
}
