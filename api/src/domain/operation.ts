import {z} from 'zod';
export const sectors=['logistics','retail','services'] as const;
export const statuses=['pending','in_progress','completed','cancelled'] as const;
export type Status=typeof statuses[number];
export const createSchema=z.object({title:z.string().trim().min(3).max(120),sector:z.enum(sectors),amount_cents:z.number().int().min(0).max(1000000000)}).strict();
export const patchSchema=z.object({status:z.enum(statuses),expected_revision:z.number().int().positive()}).strict();
export class TransitionError extends Error {}
export const transitions:Record<Status,Status[]>={pending:['in_progress','cancelled'],in_progress:['completed','cancelled'],completed:[],cancelled:[]};
export function assertTransition(from:Status,to:Status){if(!transitions[from].includes(to))throw new TransitionError('Transición no permitida');}
export interface Operation {id:string;organization_id:string;title:string;sector:typeof sectors[number];status:Status;amount_cents:number;revision:number;created_at:string;updated_at:string;}
export function eventFor(row:Operation,id:string){return {event_id:id,type:'operation.upserted.v1',schema_version:1,source:'nexuscore',organization_id:row.organization_id,occurred_at:row.updated_at,data:row};}
