import {assertTransition,createSchema,patchSchema,type Operation} from '../domain/operation.js';
export interface OperationsRepository {list(org:string,offset:number):Promise<Operation[]>;create(org:string,input:ReturnType<typeof createSchema.parse>):Promise<Operation>;update(org:string,id:string,status:ReturnType<typeof patchSchema.parse>):Promise<Operation|null>;events(org:string,after:number):Promise<{sequence:string;event:unknown}[]>;}
export class RevisionConflict extends Error {}
export class OperationsService {
 constructor(private readonly repository:OperationsRepository){}
 list(org:string,offset:number){return this.repository.list(org,offset);}
 create(org:string,input:unknown){return this.repository.create(org,createSchema.parse(input));}
 update(org:string,id:string,input:unknown){return this.repository.update(org,id,patchSchema.parse(input));}
 events(org:string,after:number){return this.repository.events(org,after);}
}
export {assertTransition};
