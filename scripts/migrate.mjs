import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import pg from 'pg';
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL chưa được cấu hình');
const db=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:false});
await db.connect();
try{
 await db.query(`CREATE TABLE IF NOT EXISTS gu_schema_migrations(version text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())`);
 const dir=path.resolve('db'),list=(await fs.readdir(dir)).filter(x=>/^\d+_[a-z0-9_-]+\.sql$/.test(x)).sort();
 for(const f of list){const sql=await fs.readFile(path.join(dir,f),'utf8'),sha=createHash('sha256').update(sql).digest('hex');const prev=(await db.query('SELECT sha256 FROM gu_schema_migrations WHERE version=$1',[f])).rows[0];if(prev){if(prev.sha256!==sha)throw Error(`Migration ${f} đã thay đổi. Không được sửa file migration cũ.`);console.log('SKIP',f);continue;}
  // Each migration script owns its own BEGIN/COMMIT; it uses idempotent CREATE IF NOT EXISTS.
  await db.query(sql);
  await db.query('INSERT INTO gu_schema_migrations(version,sha256) VALUES($1,$2)',[f,sha]);
  console.log('OK  ',f);
 }
 console.log('Đã cập nhật PostgreSQL GU.');
}finally{await db.end();}
