/** Import a deliberately reviewed, non-secret Firestore collection JSON export.
 * Default is dry-run. Does NOT import passwords, public access tokens or customer evidence files.
 * Format: { items:[{id,...fields}], customers:[...], orders:[...] }.
 */
import {readFileSync} from 'node:fs';
import pg from 'pg';
const [file,...args]=process.argv.slice(2);
if(!file)throw Error('Usage: npm run data:import-json -- /path/export.json [--apply]');
const doc=JSON.parse(readFileSync(file,'utf8'));
if(!doc||typeof doc!=='object'||Array.isArray(doc))throw Error('Expected {collection:[documents]}');
const reserved=new Set(['gu_accounts','staffCredentials','serviceAccounts']);
let count=0;
for(const [coll,docs] of Object.entries(doc)){
 if(!/^[A-Za-z][A-Za-z0-9_-]{1,80}$/.test(coll)||reserved.has(coll)||!Array.isArray(docs))throw Error('Invalid collection '+coll);
 for(const row of docs){if(typeof row.id!=='string'||!/^[A-Za-z0-9_%.-]{1,256}$/.test(row.id))throw Error('Bad document id in '+coll);count++;}
 console.log(coll,docs.length);
}
console.log('Total documents:',count, 'mode:',args.includes('--apply')?'apply':'dry-run');
if(!args.includes('--apply'))process.exit(0);
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL missing');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});const client=await pool.connect();
try{
 await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(702546)');
 for(const [collection,docs] of Object.entries(doc))for(const row of docs){const {id,...rest}=row;
  await client.query("INSERT INTO gu_documents(collection,id,data) VALUES($1,$2,$3::jsonb) ON CONFLICT(collection,id) DO NOTHING",[collection,id,JSON.stringify(rest)]);
 }
 await client.query('COMMIT');console.log('Import complete. Existing records were NOT overwritten.');
}catch(e){await client.query('ROLLBACK');console.error(e);process.exitCode=1;}finally{client.release();await pool.end();}
