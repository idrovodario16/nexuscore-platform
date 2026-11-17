import {createHash, timingSafeEqual} from 'node:crypto';
import {z} from 'zod';

const credential = z.object({
 key_sha256:z.string().regex(/^[a-f0-9]{64}$/),
 organization_id:z.string().uuid(),
 permissions:z.array(z.enum(['read','write'])).min(1),
}).strict();
export class AccessDenied extends Error {
 constructor(public readonly status:number){super(status===401?'Invalid credential':'Access denied');}
}
export class IntegrationAccess {
 private readonly credentials:z.infer<typeof credential>[];
 constructor(env:NodeJS.ProcessEnv){
  if(env.INTEGRATION_CREDENTIALS!==undefined){
   try {this.credentials=z.array(credential).min(1).parse(JSON.parse(env.INTEGRATION_CREDENTIALS));}
   catch {throw Error('Invalid INTEGRATION_CREDENTIALS configuration');}
  } else {
   if(!env.API_KEY || env.API_KEY.length<32) throw Error('API_KEY must contain at least 32 characters');
   const org=z.string().uuid().safeParse(env.ORGANIZATION_ID);
   if(!org.success) throw Error('Invalid ORGANIZATION_ID');
   this.credentials=[{key_sha256:createHash('sha256').update(env.API_KEY).digest('hex'),organization_id:org.data,permissions:['read','write']}];
  }
  if(new Set(this.credentials.map(c=>c.key_sha256)).size!==this.credentials.length) throw Error('Duplicate integration credential');
 }
 authorize(authorization:unknown,organization:unknown,permission:'read'|'write'){
  if(typeof authorization!=='string'||!authorization.startsWith('Bearer ')||authorization.length>4096)throw new AccessDenied(401);
  const token=authorization.slice(7);
  if(token.length<32)throw new AccessDenied(401);
  const digest=createHash('sha256').update(token).digest();
  const match=this.credentials.find(c=>timingSafeEqual(digest,Buffer.from(c.key_sha256,'hex')));
  if(!match)throw new AccessDenied(401);
  if(organization!==match.organization_id||!match.permissions.includes(permission))throw new AccessDenied(403);
  return match.organization_id;
 }
}
