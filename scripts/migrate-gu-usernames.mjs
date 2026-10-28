/** Non-destructive GU PostgreSQL username migration. Back up before running.
 * Does not change email, UID, password hashes or staff documents.
 */
import pg from 'pg';
const raw=process.env.DATABASE_URL||'';
let url;
try{url=new URL(raw);}catch{throw Error('Missing/invalid DATABASE_URL');}
const dbName=decodeURIComponent(url.pathname.replace(/^\//,''));
if(!['gu_v546_prod','gu_v546_stage'].includes(dbName)||!['127.0.0.1','localhost'].includes(url.hostname))
 throw Error('Refusing unexpected PostgreSQL host/database');
const pool=new pg.Pool({connectionString:raw,max:1,connectionTimeoutMillis:8000});
const client=await pool.connect();
try{
 await client.query('BEGIN');
 await client.query('SELECT pg_advisory_xact_lock(7941006)');
 await client.query('ALTER TABLE gu_accounts ADD COLUMN IF NOT EXISTS username text');
 const result=await client.query(`WITH candidates AS (
    SELECT uid, lower(split_part(email,'@',1)) AS candidate,
      row_number() OVER (PARTITION BY lower(split_part(email,'@',1)) ORDER BY created_at,uid) AS rn
    FROM gu_accounts WHERE username IS NULL
   ), resolved AS (
    SELECT c.uid, CASE
      WHEN c.candidate ~ '^[a-z0-9][a-z0-9._-]{2,31}$' AND c.rn=1
        AND NOT EXISTS (SELECT 1 FROM gu_accounts known WHERE lower(known.username)=c.candidate)
        THEN c.candidate
      ELSE 'user_' || left(md5(c.uid),20)
    END AS proposed FROM candidates c
   )
   UPDATE gu_accounts a SET username=r.proposed FROM resolved r
   WHERE a.uid=r.uid AND a.username IS NULL`);
 await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS gu_accounts_username_unique
   ON gu_accounts (lower(username)) WHERE username IS NOT NULL`);
 const validated=await client.query(`SELECT count(*)::int AS missing FROM gu_accounts WHERE username IS NULL OR username=''`);
 if(validated.rows[0].missing!==0)throw Error('Username backfill incomplete');
 await client.query('COMMIT');
 console.log(`GU_USERNAME_MIGRATION_OK database=${dbName} migrated=${result.rowCount||0}`);
}catch(e){await client.query('ROLLBACK');console.error('GU_USERNAME_MIGRATION_FAILED',e.message);process.exitCode=1;}
finally{client.release();await pool.end();}
