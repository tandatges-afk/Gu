/** Guardrail for testing the V5 port against an isolated database. */
const problems=[];
const db=process.env.DATABASE_URL;
if(!db)problems.push('DATABASE_URL missing');
else {
 try {const u=new URL(db);
   if(u.pathname!=='/gu_v546_stage')problems.push('DATABASE_URL must point at gu_v546_stage, not the GU production database');
   if(!['127.0.0.1','localhost'].includes(u.hostname))problems.push('Staging should use the local PostgreSQL server');
 }catch{problems.push('DATABASE_URL is not a valid URL');}
}
if(process.env.APP_URL!=='https://v5.guthuedo.io.vn')problems.push('APP_URL must be staging domain v5.guthuedo.io.vn');
if(process.env.GU_UPLOAD_DIR!=='/var/lib/gu-v546/uploads')problems.push('GU_UPLOAD_DIR must be separate from production uploads');
if(!process.env.GU_SESSION_SECRET||process.env.GU_SESSION_SECRET.length<32||process.env.GU_SESSION_SECRET.startsWith('REPLACE'))problems.push('GU_SESSION_SECRET missing or placeholder');
if(problems.length){for(const p of problems)console.error('Staging config:',p);process.exit(1);}
console.log('GU V5 staging isolation passed: separate database, uploads and domain.');
