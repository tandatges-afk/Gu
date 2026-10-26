// Run with: GU_ADMIN_PASSWORD=<from hidden prompt> node --env-file=.env.local scripts/pg-create-admin.mjs admin@example.com "Admin GU"
import pg from 'pg';
import argon2 from 'argon2';
const email=String(process.argv[2]||'').trim().toLowerCase();
const name=String(process.argv[3]||'Quản trị GU').trim();
const password=process.env.GU_ADMIN_PASSWORD||'';
if(!/^\S+@\S+\.\S+$/.test(email)||!name||password.length<12||!process.env.DATABASE_URL){
 console.error('Cần email hợp lệ, GU_ADMIN_PASSWORD dài ít nhất 12 ký tự và DATABASE_URL.');process.exit(1);
}
const client=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:false});
try{
 await client.connect();
 const hashed=await argon2.hash(password,{type:argon2.argon2id,memoryCost:19456,timeCost:3,parallelism:1});
 const existing=await client.query('SELECT id FROM staff_users WHERE lower(email)=$1',[email]);
 if(existing.rowCount)throw Error('Email này đã tồn tại. Không ghi đè mật khẩu hoặc nâng quyền tài khoản cũ.');
 await client.query("INSERT INTO staff_users(email,display_name,password_hash,role) VALUES($1,$2,$3,'admin')",[email,name,hashed]);
 console.log('Đã tạo tài khoản Admin:',email);
}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
finally{await client.end();}
