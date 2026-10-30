/** Read-only verifier for Fix16/20 source+staging+production identity. */
const stage='https://v5.guthuedo.io.vn/api/version';
const prod='https://guthuedo.io.vn/api/version';
const expected=process.env.GU_EXPECTED_COMMIT;
if(!expected||!/^[a-f0-9]{40}$/.test(expected))throw Error('Set GU_EXPECTED_COMMIT to the reviewed 40-character GitHub SHA');
const stageOnly=process.argv.includes('--stage-only');
let errors=[];
for(const [name,url] of [['staging',stage],...(stageOnly?[]:[['production',prod]])]){
 try{
  const res=await fetch(url,{signal:AbortSignal.timeout(8000),headers:{'Cache-Control':'no-cache'}});
  if(!res.ok)throw Error('HTTP '+res.status);
  const info=await res.json();
  const valid=info.version==='1.0.0'&&info.commit===expected;
  console.log(JSON.stringify({target:name,version:info.version,commit:info.commit,valid}));
  if(!valid)errors.push(name+' is not on the approved Fix20 commit');
 }catch(e){errors.push(name+': '+e.message);}
}
if(errors.length){for(const e of errors)console.error('GU VERSION MISMATCH:',e);process.exitCode=1;}
else console.log('GU FIX20: all checked targets match the approved GitHub SHA');
