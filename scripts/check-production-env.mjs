/** Refuse to run GU V5 against the old GU 6.1 database. */
const errors=[];
try {
  const url=new URL(process.env.DATABASE_URL||'');
  if(url.pathname!=='/gu_v546_prod')errors.push('Database must be gu_v546_prod (not gu_db).');
  if(!['localhost','127.0.0.1'].includes(url.hostname))errors.push('Use local PostgreSQL.');
} catch {errors.push('Invalid DATABASE_URL.');}
if(process.env.APP_URL!=='https://guthuedo.io.vn')errors.push('Wrong APP_URL.');
if(process.env.GU_UPLOAD_DIR!=='/var/lib/gu-v546-prod/uploads')errors.push('Wrong upload directory.');
if(!process.env.GU_SESSION_SECRET||process.env.GU_SESSION_SECRET.length<32||process.env.GU_SESSION_SECRET.includes('REPLACE'))errors.push('Missing session secret.');
if(errors.length){for(const e of errors) console.error('V5 production: '+e);process.exit(1);}
console.log('V5 production configuration is isolated from GU 6.1.');
