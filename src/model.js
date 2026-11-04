import { z } from 'zod';
export const ORGANIZATION_ID='11111111-1111-4111-8111-111111111111';
export const sectors={logistics:'Logística',retail:'Comercio',services:'Servicios'};
export const statuses={pending:'Pendiente',in_progress:'En curso',completed:'Completada',cancelled:'Cancelada'};
export const transitions={pending:['in_progress','cancelled'],in_progress:['completed','cancelled'],completed:[],cancelled:[]};
export const operationSchema=z.object({id:z.string().uuid(),organization_id:z.string().uuid(),title:z.string().trim().min(3).max(120),sector:z.enum(['logistics','retail','services']),status:z.enum(['pending','in_progress','completed','cancelled']),amount_cents:z.number().int().min(0).max(1000000000),revision:z.number().int().positive(),created_at:z.string().datetime(),updated_at:z.string().datetime()}).strict();
export const eventSchema=z.object({event_id:z.string().uuid(),type:z.literal('operation.upserted.v1'),schema_version:z.literal(1),source:z.literal('nexuscore'),organization_id:z.string().uuid(),occurred_at:z.string().datetime(),data:operationSchema}).strict().refine(e=>e.organization_id===e.data.organization_id,{message:'La organización del evento no coincide'});
export const batchSchema=z.array(eventSchema).max(1000);
export function mergeEvents(current,raw){const events=batchSchema.parse(raw);const map=new Map(current.map(r=>[r.organization_id+':'+r.id,r]));for(const e of events){const k=e.organization_id+':'+e.data.id;const old=map.get(k);if(!old||e.data.revision>old.revision)map.set(k,e.data);}return [...map.values()];}
export function metrics(rows){const completed=rows.filter(r=>r.status==='completed');return {total:rows.length,completed:completed.length,open:rows.filter(r=>['pending','in_progress'].includes(r.status)).length,completion:rows.length?Math.round(completed.length/rows.length*10000)/100:0,value_cents:completed.reduce((s,r)=>s+r.amount_cents,0)};}
export function snapshotEvents(rows){return rows.map(r=>({event_id:crypto.randomUUID(),type:'operation.upserted.v1',schema_version:1,source:'nexuscore',organization_id:r.organization_id,occurred_at:r.updated_at,data:r}));}
export function changeStatus(row,status){if(!(transitions[row.status]||[]).includes(status))throw new Error('Transición no permitida');return {...row,status,revision:row.revision+1,updated_at:new Date().toISOString()};}
export function download(name,content,type='application/json'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
export function csv(rows){const fields=['id','title','sector','status','amount_cents','revision','created_at'];return [fields.join(','),...rows.map(r=>fields.map(k=>'"'+safeCell(r[k]).replaceAll('"','""')+'"').join(','))].join('\r\n');}

function safeCell(value){const text=String(value);return /^[=+@\t\r-]/.test(text)?"'"+text:text;}
