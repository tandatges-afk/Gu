import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 CLOUDINARY_EVIDENCE_TYPE,CLOUDINARY_EVIDENCE_LIMIT,
 evidencePublicId,privateEvidenceCredentials,isEvidenceRef,cloudinarySignature,
 privateEvidenceDownloadUrl,uploadAuthenticatedEvidence,downloadAuthenticatedEvidence,
 type CloudinaryEvidenceRef
} from '../src/lib/cloudinary-private-evidence.ts';
const sample:CloudinaryEvidenceRef={provider:'cloudinary',deliveryType:'authenticated',publicId:'gu/secure-evidence/staffA/550e8400-e29b-41d4-a716-446655440000',format:'jpg',contentType:'image/jpeg'};
const credentials={cloud:'gucloud',key:'111',secret:'abc123'};

test('evidence requires authenticated and scoped opaque public ID',()=>{
 assert.equal(CLOUDINARY_EVIDENCE_TYPE,'authenticated');
 assert.equal(evidencePublicId('staffA','550e8400-e29b-41d4-a716-446655440000'),sample.publicId);
 assert.equal(isEvidenceRef(sample),true);
 assert.equal(isEvidenceRef({...sample,deliveryType:'upload'}),false);
 assert.equal(isEvidenceRef({...sample,publicId:'gu/products/other/image'}),false);
 assert.equal(isEvidenceRef({...sample,format:'svg'}),false);
 assert.throws(()=>evidencePublicId('../admin','550e8400-e29b-41d4-a716-446655440000'));
});
test('Cloudinary API signatures sort parameter names, not accept client-controlled secret',()=>{
 const a={public_id:'abc',timestamp:123,type:'authenticated'};
 const b={type:'authenticated',timestamp:123,public_id:'abc'};
 assert.equal(cloudinarySignature(a,'s'),cloudinarySignature(b,'s'));
 assert.notEqual(cloudinarySignature(a,'s'),cloudinarySignature(a,'different'));
 assert.throws(()=>privateEvidenceCredentials({CLOUDINARY_CLOUD_NAME:'',CLOUDINARY_API_KEY:'a',CLOUDINARY_API_SECRET:'b'} as NodeJS.ProcessEnv));
});
test('time-limited Cloudinary download is signed and only uses API hostname',()=>{
 const url=new URL(privateEvidenceDownloadUrl(sample,1234567890,credentials));
 assert.equal(url.hostname,'api.cloudinary.com');
 assert.equal(url.pathname,'/v1_1/gucloud/image/download');
 assert.equal(url.searchParams.get('type'),'authenticated');
 assert.equal(url.searchParams.get('expires_at'),'1234567950');
 assert.equal(url.searchParams.get('signature'),cloudinarySignature({timestamp:1234567890,public_id:sample.publicId,format:'jpg',type:'authenticated',expires_at:1234567950},credentials.secret));
});
test('upload never exposes Cloudinary URLs to clients and uses authenticated type',async()=>{
 const env={...process.env};
 process.env.CLOUDINARY_CLOUD_NAME=credentials.cloud;process.env.CLOUDINARY_API_KEY=credentials.key;process.env.CLOUDINARY_API_SECRET=credentials.secret;
 try{
  let called=false;
  const mock=(async(url:string|URL|Request,init?:RequestInit)=>{
   called=true;assert.equal(new URL(String(url)).hostname,'api.cloudinary.com');
   assert.equal(init?.method,'POST');
   const form=init?.body as FormData;
   assert.equal(form.get('type'),'authenticated');assert.equal(form.get('api_key'),credentials.key);
   assert.equal(form.get('overwrite'),'false');
   assert.equal(form.get('public_id'),sample.publicId);
   const params={public_id:sample.publicId,type:'authenticated',overwrite:'false',timestamp:Number(form.get('timestamp'))};
   assert.equal(form.get('signature'),cloudinarySignature(params,credentials.secret));
   return Response.json({public_id:sample.publicId,type:'authenticated',resource_type:'image',format:'jpg',secure_url:'NEVER_USE_THIS_URL'});
  }) as typeof fetch;
  const asset=await uploadAuthenticatedEvidence(Buffer.from([255,216,255,1]),'image/jpeg','staffA','550e8400-e29b-41d4-a716-446655440000',mock);
  assert.equal(called,true);assert.equal(asset.publicId,sample.publicId);
  assert.equal(JSON.stringify(asset).includes('secure_url'),false);
  assert.equal(JSON.stringify(asset).includes('NEVER_USE_THIS_URL'),false);
  await assert.rejects(()=>uploadAuthenticatedEvidence(Buffer.alloc(CLOUDINARY_EVIDENCE_LIMIT+1),'image/jpeg','staffA','550e8400-e29b-41d4-a716-446655440000',mock));
  const publicMock=(async()=>Response.json({public_id:sample.publicId,type:'upload',resource_type:'image',format:'jpg'})) as typeof fetch;
  await assert.rejects(()=>uploadAuthenticatedEvidence(Buffer.from([255,216,255]),'image/jpeg','staffA','550e8400-e29b-41d4-a716-446655440000',publicMock));
 }finally{for(const key of ['CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET']){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key];}}
});
test('proxy refuses non-image responses and validates magic bytes',async()=>{
 const original={...process.env};
 process.env.CLOUDINARY_CLOUD_NAME=credentials.cloud;process.env.CLOUDINARY_API_KEY=credentials.key;process.env.CLOUDINARY_API_SECRET=credentials.secret;
 try{
  const mock=(async(url:string|URL|Request)=>{
   assert.equal(new URL(String(url)).pathname,'/v1_1/gucloud/image/download');
   return new Response(new Uint8Array([255,216,255,0,1]),{status:200,headers:{'Content-Type':'image/jpeg'}});
  }) as typeof fetch;
  assert.deepEqual(await downloadAuthenticatedEvidence(sample,mock),Buffer.from([255,216,255,0,1]));
  const reject=(async()=>new Response('missing',{status:404})) as typeof fetch;
  await assert.rejects(()=>downloadAuthenticatedEvidence(sample,reject));
  const bad=(async()=>new Response('html instead of jpeg',{status:200})) as typeof fetch;
  await assert.rejects(()=>downloadAuthenticatedEvidence(sample,bad));
 }finally{for(const key of ['CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET']){if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];}}
});
test('secure photo routes verify staff and link to order, no direct Cloudinary URL',()=>{
 const route=readFileSync('src/app/api/v5/secure-photo/route.ts','utf8');
 const lib=readFileSync('src/lib/secure-evidence.ts','utf8');
 assert.match(route,/await staffUser\(req\)/g);
 assert.match(route,/consumedOrderId/);
 assert.match(route,/readPrivateEvidenceDocument\(info\)/);
 assert.match(route,/return NextResponse\.json\(\{id\}/);
 assert.doesNotMatch(route,/secure_url|\.getSignedUrl\(/);
 assert.match(lib,/return readLegacyFirebaseEvidence/);
 assert.match(lib,/isEvidenceRef\(e\?\.asset\)/);
});

test('download rejects redirects to third-party hosts',async()=>{
 const original={...process.env};
 process.env.CLOUDINARY_CLOUD_NAME=credentials.cloud;process.env.CLOUDINARY_API_KEY=credentials.key;process.env.CLOUDINARY_API_SECRET=credentials.secret;
 try{
  let calls=0;
  const mock=(async()=>{calls++;return new Response(null,{status:302,headers:{Location:'https://evil.example.test/stolen-image'}});}) as typeof fetch;
  await assert.rejects(()=>downloadAuthenticatedEvidence(sample,mock));
  assert.equal(calls,1);
 }finally{for(const key of ['CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET']){if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];}}
});
