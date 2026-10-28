import pg from 'pg';
import {scryptSync,randomBytes} from 'node:crypto';
import readline from 'node:readline/promises';
const opts=new Set(process.argv.slice(2));
if(!process.env.DATABASE_URL){console.error('DATABASE_URL is missing');process.exit(1);}
const databaseName=new URL(process.env.DATABASE_URL).pathname.replace(/^\//,'');
if((process.argv.includes('--init')||process.argv.includes('--admin')) && databaseName!=='gu_v546_stage' && process.env.GU_ALLOW_PRODUCTION_DB_SETUP!=='YES_I_HAVE_BACKUP'){
 console.error('Safety: V5 setup must use isolated gu_v546_stage; production setup requires explicit reviewed override.');
 process.exit(1);
}
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const schema=`
CREATE TABLE IF NOT EXISTS gu_documents(
 collection text NOT NULL, id text NOT NULL, data jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(collection,id));
CREATE INDEX IF NOT EXISTS gu_docs_collection_updated ON gu_documents(collection,updated_at DESC);
CREATE INDEX IF NOT EXISTS gu_docs_item_name ON gu_documents((data->>'name')) WHERE collection='items';
CREATE INDEX IF NOT EXISTS gu_docs_customer_phone ON gu_documents((data->>'phone')) WHERE collection='customers';
CREATE INDEX IF NOT EXISTS gu_docs_order_status ON gu_documents((data->>'status')) WHERE collection='orders';
CREATE TABLE IF NOT EXISTS gu_login_attempts(email text PRIMARY KEY,failures int NOT NULL DEFAULT 0,first_failure_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS gu_accounts (
 uid text PRIMARY KEY, email text NOT NULL UNIQUE,username text,name text NOT NULL,password_hash text NOT NULL,
 disabled boolean NOT NULL DEFAULT false,revoked_after timestamptz,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE gu_accounts ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS gu_accounts_username_unique ON gu_accounts(lower(username)) WHERE username IS NOT NULL;
`;
try{
 if(opts.has('--init')||opts.has('--admin')){await pool.query(schema);console.log('GU V5 schema OK');}
 if(opts.has('--check')){
  const r=await pool.query('SELECT version() AS version');console.log('PostgreSQL online:',r.rows[0].version);
  const a=await pool.query("SELECT to_regclass('public.gu_documents') as documents,to_regclass('public.gu_accounts') as accounts");console.log(a.rows[0]);
 }
 if(opts.has('--admin')){
  if(!process.stdin.isTTY)throw Error('Admin setup requires a terminal.');
  const rl=readline.createInterface({input:process.stdin,output:process.stdout});
  const username=(await rl.question('Admin username (3-32 chars): ')).trim().toLowerCase();
  const email=`${username}@accounts.gu.internal`;
  const name=(await rl.question('Admin display name: ')).trim();
  const password=await rl.question('Initial password (min 6 chars; terminal input may be visible): ');
  rl.close();
  if(!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)||name.length<2||password.length<6)throw Error('Invalid admin identity or password');
  const uid=randomBytes(16).toString('hex'),salt=randomBytes(16).toString('hex');
  const hash='scrypt:'+salt+':'+scryptSync(password,salt,64).toString('hex');
  const client=await pool.connect();try{
   await client.query('BEGIN');
   const count=await client.query("SELECT COUNT(*)::int n FROM gu_documents WHERE collection='staff' AND data->>'role'='admin'");
   if(count.rows[0].n>0)throw Error('Admin already exists. Use a manual audited reset, never duplicate Admin accounts.');
   await client.query('INSERT INTO gu_accounts(uid,email,username,name,password_hash) VALUES($1,$2,$3,$4,$5)',[uid,email,username,name,hash]);
   await client.query("INSERT INTO gu_documents(collection,id,data) VALUES('staff',$1,$2::jsonb)",[uid,JSON.stringify({name,username,email,role:'admin',disabled:false,createdAt:new Date().toISOString()})]);
   await client.query('COMMIT');console.log('Admin created. UID:',uid);
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }
} catch(e){console.error(e.message);process.exitCode=1;} finally{await pool.end();}
