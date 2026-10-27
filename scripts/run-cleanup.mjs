if(!process.env.CRON_SECRET||process.env.CRON_SECRET.length<24||process.env.CRON_SECRET.includes('REPLACE_WITH'))throw Error('CRON_SECRET missing or too short');
const response=await fetch('http://127.0.0.1:3301/api/v5/evidence-cleanup',{headers:{Authorization:`Bearer ${process.env.CRON_SECRET}`},signal:AbortSignal.timeout(90000)});
if(!response.ok)throw Error(`Evidence cleanup returned HTTP ${response.status}`);
const body=await response.json();console.log('Sensitive evidence cleanup:',JSON.stringify(body));
