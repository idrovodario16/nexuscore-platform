import {createHash, randomBytes, scrypt, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {Body, Controller, Get, Headers, HttpCode, HttpException, Inject, Param, Patch, Post, Query, Res} from '@nestjs/common';
import {Pool} from 'pg';
import {z} from 'zod';
import {RevisionConflict} from '../application/operations.js';
import {createSchema, patchSchema, statuses, TransitionError} from '../domain/operation.js';
import {BusinessConflict,PostgresOperations} from '../infrastructure/postgres.js';
import {BusinessRepository,customerInput,paymentInput,productInput,receiptInput,saleInput} from '../infrastructure/business.js';

const deriveKey = promisify(scrypt);
const sessionSeconds = 8 * 60 * 60;
const hashToken = (token:string) => createHash('sha256').update(token).digest('hex');
const uuid = z.string().uuid();
const credentials = z.object({email:z.string().trim().email().max(254),password:z.string().min(1).max(256)}).strict();
const shipment = createSchema.omit({sector:true});
const filters = z.object({
 search:z.string().trim().max(120).default(''),
 status:z.enum(statuses).optional(),
 offset:z.coerce.number().int().min(0).max(1000000).default(0),
}).strict();
type CookieResponse = {setHeader(name:string,value:string):unknown};

function parse<T>(schema:z.ZodType<T>,input:unknown):T {
 const result = schema.safeParse(input);
 if(!result.success) throw new HttpException('Revisa los datos ingresados.',400);
 return result.data;
}

function requireMutationHeader(header:string|undefined){
 if(header!=='1') throw new HttpException('Solicitud de Workspace inválida.',403);
}

function readToken(cookies:string|undefined){
 const token = cookies?.match(/(?:^|;\s*)nexus_workspace=([a-f0-9]{64})(?:;|$)/)?.[1];
 return token ? hashToken(token) : null;
}

function setSession(response:CookieResponse,token:string,maxAge:number){
 const secure = process.env.WORKSPACE_INSECURE_COOKIE==='1' ? '' : '; Secure';
 response.setHeader('Set-Cookie',`nexus_workspace=${token}; Path=/workspace-api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`);
}

@Controller('workspace-api')
export class WorkspaceController {
 private readonly business:BusinessRepository;

 constructor(@Inject(Pool) private readonly pool:Pool,@Inject(PostgresOperations) private readonly operations:PostgresOperations){
  this.business = new BusinessRepository(operations);
 }

 private async user(cookies:string|undefined){
  const token = readToken(cookies);
  if(!token) throw new HttpException('Inicia sesión para continuar.',401);
  const result = await this.pool.query<{id:string;name:string}>(`SELECT u.id,u.name FROM workspace_sessions s
   JOIN workspace_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`,[token]);
  if(!result.rowCount) throw new HttpException('Inicia sesión para continuar.',401);
  return result.rows[0];
 }

 private async membership(cookies:string|undefined,organization:string){
  const user = await this.user(cookies);
  const org = parse(uuid,organization);
  const result = await this.pool.query(
   'SELECT role FROM workspace_memberships WHERE organization_id=$1 AND user_id=$2',[org,user.id]);
  if(!result.rowCount) throw new HttpException('No tienes acceso a esta empresa.',403);
  return {user,org,role:result.rows[0].role};
 }

 @Post('session')
 @HttpCode(200)
 async login(@Body() body:unknown,@Headers('x-nexus-workspace') marker:string,
  @Headers('cookie') cookies:string,@Res({passthrough:true}) response:CookieResponse){
  requireMutationHeader(marker);
  const input = parse(credentials,body);
  const result = await this.pool.query('SELECT id,password_hash FROM workspace_users WHERE email=$1',[input.email.toLowerCase()]);
  const account = result.rows[0];
  const [salt,stored] = (account?.password_hash ?? ('0'.repeat(32)+':'+ '0'.repeat(128))).split(':');
  const hash = await deriveKey(input.password,salt,64) as Buffer;
  if(!timingSafeEqual(hash,Buffer.from(stored,'hex')) || !account) throw new HttpException('Correo o contraseña incorrectos.',401);
  const token = randomBytes(32).toString('hex');
  await this.pool.query(`WITH expired AS (
   DELETE FROM workspace_sessions WHERE expires_at<=now() OR token_hash=$4
  ) INSERT INTO workspace_sessions(token_hash,user_id,expires_at)
    VALUES($1,$2,now()+$3::integer*interval '1 second')`,[hashToken(token),account.id,sessionSeconds,readToken(cookies)]);
  setSession(response,token,sessionSeconds);
  return {authenticated:true};
 }

 @Get('session')
 async session(@Headers('cookie') cookies:string){
  const user = await this.user(cookies);
  const organizations = await this.pool.query(`SELECT o.id,o.name,m.role
   FROM workspace_memberships m JOIN workspace_organizations o ON o.id=m.organization_id
   WHERE m.user_id=$1 ORDER BY o.name,o.id`,[user.id]);
  return {user,organizations:organizations.rows};
 }

 @Post('session/logout')
 @HttpCode(204)
 async logout(@Headers('cookie') cookies:string,@Headers('x-nexus-workspace') marker:string,
  @Res({passthrough:true}) response:CookieResponse){
  requireMutationHeader(marker);
  const token = readToken(cookies);
  if(token) await this.pool.query('DELETE FROM workspace_sessions WHERE token_hash=$1',[token]);
  setSession(response,'',0);
 }

 @Get('organizations/:organization/business')
 async businessOverview(@Headers('cookie') cookies:string,@Param('organization') organization:string){
  const {org} = await this.membership(cookies,organization);
  return this.business.overview(org);
 }

 @Post('organizations/:organization/business/:action')
 async businessCommand(@Headers('cookie') cookies:string,@Headers('x-nexus-workspace') marker:string,
  @Param('organization') organization:string,@Param('action') action:string,@Body() body:unknown){
  requireMutationHeader(marker);
  const {user,org} = await this.membership(cookies,organization);
  try {
   switch(action){
    case 'products': return await this.business.product(org,parse(productInput,body));
    case 'customers': return await this.business.customer(org,parse(customerInput,body));
    case 'receipts': return await this.business.receive(org,parse(receiptInput,body),user);
    case 'sales': return await this.business.sell(org,parse(saleInput,body),user);
    default: throw new HttpException('Acción no encontrada.',404);
   }
  } catch(error){
   if(error instanceof BusinessConflict) throw new HttpException(error.message,409);
   throw error;
  }
 }

 @Post('organizations/:organization/business/sales/:id/payment')
 async businessPayment(@Headers('cookie') cookies:string,@Headers('x-nexus-workspace') marker:string,
  @Param('organization') organization:string,@Param('id') id:string,@Body() body:unknown){
  requireMutationHeader(marker);
  const {user,org} = await this.membership(cookies,organization);
  try {
   return await this.business.pay(org,parse(uuid,id),parse(paymentInput,body),user);
  } catch(error){
   if(error instanceof BusinessConflict) throw new HttpException(error.message,409);
   throw error;
  }
 }

 @Get('organizations/:organization/shipments')
 async overview(@Headers('cookie') cookies:string,@Param('organization') organization:string,@Query() query:unknown){
  const {org} = await this.membership(cookies,organization);
  const {search,status,offset} = parse(filters,query);
  const result = await this.pool.query(`WITH filtered AS (
    SELECT o.* FROM operations o JOIN workspace_history h
     ON h.organization_id=o.organization_id AND h.operation_id=o.id AND h.revision=1
    WHERE o.organization_id=$1 AND ($2::text IS NULL OR o.status=$2)
     AND strpos(lower(o.title),lower($3))>0
   ), page AS (
    SELECT * FROM filtered ORDER BY created_at DESC,id LIMIT 25 OFFSET $4
   )
   SELECT (SELECT COALESCE(json_agg(page ORDER BY page.created_at DESC,page.id),'[]') FROM page) AS items,
    count(*)::int AS total,
    count(*) FILTER (WHERE status IN ('pending','in_progress'))::int AS open,
    count(*) FILTER (WHERE status='completed')::int AS completed
   FROM filtered`,[org,status??null,search,offset]);
  const {items,total,open,completed} = result.rows[0];
  return {items,total,open,completed,completion:total ? Math.round(completed/total*10000)/100 : 0,page_size:25};
 }

 @Post('organizations/:organization/shipments')
 async create(@Headers('cookie') cookies:string,@Headers('x-nexus-workspace') marker:string,
  @Param('organization') organization:string,@Body() body:unknown){
  requireMutationHeader(marker);
  const {user,org} = await this.membership(cookies,organization);
  return this.operations.create(org,{...parse(shipment,body),sector:'logistics'},user);
 }

 @Patch('organizations/:organization/shipments/:id')
 async change(@Headers('cookie') cookies:string,@Headers('x-nexus-workspace') marker:string,
  @Param('organization') organization:string,@Param('id') id:string,@Body() body:unknown){
  requireMutationHeader(marker);
  const {user,org,role} = await this.membership(cookies,organization);
  const input = parse(patchSchema,body);
  if(input.status==='cancelled' && role==='operator') throw new HttpException('Solo supervisión o administración pueden cancelar.',403);
  try {
   const row = await this.operations.update(org,parse(uuid,id),input,user);
   if(!row) throw new HttpException('Envío no encontrado.',404);
   return row;
  } catch(error){
   if(error instanceof RevisionConflict || error instanceof TransitionError || error instanceof BusinessConflict) throw new HttpException(error.message,409);
   throw error;
  }
 }

 @Get('organizations/:organization/shipments/:id/history')
 async history(@Headers('cookie') cookies:string,@Param('organization') organization:string,@Param('id') id:string){
  const {org} = await this.membership(cookies,organization);
  const result = await this.pool.query(`SELECT revision,actor_name,previous_status,status,occurred_at FROM workspace_history
   WHERE organization_id=$1 AND operation_id=$2 ORDER BY revision`,[org,parse(uuid,id)]);
  if(!result.rowCount) throw new HttpException('Envío no encontrado.',404);
  return result.rows;
 }
}
