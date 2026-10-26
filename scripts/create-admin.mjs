import argon2 from 'argon2';
import pg from 'pg';
const [emailRaw,displayNameRaw]=process.argv.slice(2),password=process.env.GU_ADMIN_PASSWORD;
const email=emailRaw?.trim().toLowerCase(),name=displayNameRaw?.trim();
if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!name||!password||password.length<12||!process.env.DATABASE_URL)throw Error('Cần email, tên, GU_ADMIN_PASSWORD dài >=12 ký tự và DATABASE_URL.');
const hashed=await argon2.hash(password,{type:argon2.argon2id});
const client=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:false});
await client.connect();
try{const exists=await client.query('SELECT id FROM staff_users WHERE lower(email)=$1',[email]);if(exists.rowCount)throw Error('Email Admin đã tồn tại: để đổi mật khẩu, sử dụng chức năng Admin hoặc quy trình reset riêng.');const r=await client.query("INSERT INTO staff_users(email,display_name,password_hash,role) VALUES($1,$2,$3,'admin') RETURNING id,email",[email,name,hashed]);console.log('Admin PostgreSQL đã tạo:',r.rows[0].email);}finally{await client.end();}
