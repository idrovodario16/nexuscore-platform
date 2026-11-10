import {randomBytes,scryptSync} from 'node:crypto';
import {Pool} from 'pg';

const password = process.env.WORKSPACE_DEMO_PASSWORD;
if(!password || password.length < 12 || password.length > 256) {
 throw new Error('Define WORKSPACE_DEMO_PASSWORD con 12 a 256 caracteres.');
}

const atlas = '21000000-0000-4000-8000-000000000001';
const pacifico = '21000000-0000-4000-8000-000000000002';
const organizations = [[atlas,'Atlas Logística'],[pacifico,'Pacífico Envíos']];
const users = [
 ['22000000-0000-4000-8000-000000000001','operador@atlas.example','Operador Atlas',atlas,'operator'],
 ['22000000-0000-4000-8000-000000000002','supervisor@atlas.example','Supervisión Atlas',atlas,'supervisor'],
 ['22000000-0000-4000-8000-000000000003','operador@pacifico.example','Operador Pacífico',pacifico,'operator'],
 ['22000000-0000-4000-8000-000000000004','admin@nexus.example','Administración Nexus',atlas,'admin'],
 ['22000000-0000-4000-8000-000000000004','admin@nexus.example','Administración Nexus',pacifico,'admin'],
];

const pool = new Pool({connectionString:process.env.DATABASE_URL});
const client = await pool.connect();
try {
 await client.query('BEGIN');
 for(const [id,name] of organizations) {
  await client.query('INSERT INTO workspace_organizations(id,name) VALUES($1,$2) ON CONFLICT(id) DO NOTHING',[id,name]);
 }
 for(const [id,email,name,org,role] of users) {
  const salt = randomBytes(16).toString('hex');
  const hash = salt+':'+scryptSync(password,salt,64).toString('hex');
  await client.query(`INSERT INTO workspace_users(id,email,name,password_hash) VALUES($1,$2,$3,$4)
   ON CONFLICT(id) DO UPDATE SET password_hash=EXCLUDED.password_hash`,[id,email,name,hash]);
  await client.query(`INSERT INTO workspace_memberships(organization_id,user_id,role) VALUES($1,$2,$3)
   ON CONFLICT(organization_id,user_id) DO NOTHING`,[org,id,role]);
 }
 await client.query('COMMIT');
 console.log('Empresas y cuentas ficticias de Workspace preparadas.');
} catch(error) {
 await client.query('ROLLBACK');
 throw error;
} finally {
 client.release();
 await pool.end();
}
