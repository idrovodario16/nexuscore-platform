import 'reflect-metadata';
import {Body,CanActivate,Controller,ExecutionContext,Get,Headers,HttpException,Inject,Module,Param,Patch,Post,Query,UseGuards} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {Pool} from 'pg';import {timingSafeEqual} from 'node:crypto';import {z,ZodError} from 'zod';
import {OperationsService,RevisionConflict} from '../application/operations.js';
import {TransitionError} from '../domain/operation.js';import {PostgresOperations} from '../infrastructure/postgres.js';
class AuthGuard implements CanActivate {canActivate(ctx:ExecutionContext){const req=ctx.switchToHttp().getRequest();const expected=process.env.API_KEY!;const actual=String(req.headers.authorization||'').replace(/^Bearer /,'');if(Buffer.byteLength(actual)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))throw new HttpException('Credencial inválida',401);if(req.headers['x-organization-id']!==process.env.ORGANIZATION_ID)throw new HttpException('Organización no autorizada',403);return true;}}
function integer(value:string|undefined){const n=Number(value??0);if(!Number.isSafeInteger(n)||n<0)throw new HttpException('Cursor u offset inválido',400);return n;}
async function handle<T>(work:()=>Promise<T>){try{return await work();}catch(e){if(e instanceof ZodError)throw new HttpException({message:'Entrada inválida',issues:e.issues},400);if(e instanceof TransitionError)throw new HttpException(e.message,409);if(e instanceof RevisionConflict)throw new HttpException(e.message,409);throw e;}}
@Controller('v1') @UseGuards(AuthGuard)
class OperationsController {
 constructor(@Inject(OperationsService) private readonly service:OperationsService){}
 @Get('operations') list(@Headers('x-organization-id') org:string,@Query('offset') offset?:string){return this.service.list(org,integer(offset));}
 @Post('operations') create(@Headers('x-organization-id') org:string,@Body() input:unknown){return handle(()=>this.service.create(org,input));}
 @Patch('operations/:id') update(@Headers('x-organization-id') org:string,@Param('id') id:string,@Body() input:unknown){if(!z.string().uuid().safeParse(id).success)throw new HttpException('UUID inválido',400);return handle(async()=>{const row=await this.service.update(org,id,input);if(!row)throw new HttpException('Operación no encontrada',404);return row;});}
 @Get('events') async events(@Headers('x-organization-id') org:string,@Query('after') after?:string){const cursor=integer(after);const items=await this.service.events(org,cursor);return {items:items.map(r=>r.event),next_cursor:items.length?String(items[items.length-1].sequence):String(cursor)};}
}
@Controller() class HealthController {@Get('health') health(){return {status:'ok',service:'nexuscore',version:'0.1.0'};}}
export async function createApp(){
 if(!process.env.API_KEY||process.env.API_KEY.length<32)throw Error('API_KEY debe contener al menos 32 caracteres');
 z.string().uuid().parse(process.env.ORGANIZATION_ID);if(!process.env.DATABASE_URL)throw Error('DATABASE_URL requerida');
 const pool=new Pool({connectionString:process.env.DATABASE_URL});await pool.query('SELECT 1');
 @Module({controllers:[HealthController,OperationsController],providers:[AuthGuard,{provide:OperationsService,useValue:new OperationsService(new PostgresOperations(pool))}]}) class AppModule{}
 const app=await NestFactory.create(AppModule,{logger:process.env.NODE_ENV==='test'?false:['error','warn','log'],bodyParser:true});
 app.enableCors({origin:process.env.WEB_ORIGIN||'http://localhost:5173',allowedHeaders:['Content-Type','Authorization','X-Organization-ID']});
 return {app,pool};
}
