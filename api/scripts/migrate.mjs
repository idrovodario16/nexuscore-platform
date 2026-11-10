import { Pool } from 'pg';
import { readFile, readdir } from 'node:fs/promises';

const db = new URL('../db/', import.meta.url);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query("SELECT pg_advisory_xact_lock(hashtext('nexuscore_migrations'))");
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY)');
  const applied = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map(row => row.name));
  for (const file of (await readdir(db)).filter(name => /^\d+_.*\.sql$/.test(name)).sort()) {
    if (applied.has(file)) continue;
    await client.query(await readFile(new URL(file, db), 'utf8'));
    await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [file]);
  }
  await client.query('COMMIT');
  console.log('NexusCore schema ready');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
