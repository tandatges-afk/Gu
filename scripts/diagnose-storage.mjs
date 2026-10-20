/** Read-only check of an already-created private Storage bucket. Never prints credentials. */
import {cert,initializeApp,deleteApp} from 'firebase-admin/app';
import {getStorage} from 'firebase-admin/storage';

const name=(process.env.FIREBASE_STORAGE_BUCKET||'').trim();
const projectId=(process.env.FIREBASE_PROJECT_ID||'').trim();
const email=(process.env.FIREBASE_CLIENT_EMAIL||'').trim();
const key=(process.env.FIREBASE_PRIVATE_KEY||'').replace(/\\n/g,'\n');
if(!name||!projectId||!email||!key){
 console.error('Thiếu FIREBASE_STORAGE_BUCKET hoặc thông tin Firebase Admin. Xem docs/GU-v5.3.6-LATE-PICKUP-STORAGE.md.');process.exit(1);
}
if(name.startsWith('gs://')||name.includes('/')||!/^[a-z0-9._-]+$/.test(name)){
 console.error('FIREBASE_STORAGE_BUCKET chỉ chứa tên bucket (không có gs:// hoặc dấu /).');process.exit(1);
}
const instance=initializeApp({credential:cert({projectId,clientEmail:email,privateKey:key})},'gu-storage-diagnostic');
try{
 const bucket=getStorage(instance).bucket(name);
 if(process.argv.includes('--write-test')){
  const {randomUUID}=await import('node:crypto');
  const filename=`gu/diagnostics/${randomUUID()}.txt`;
  const object=bucket.file(filename);
  try{
   await object.save(Buffer.from('gu-storage-probe'),{resumable:false,metadata:{contentType:'text/plain',cacheControl:'private,no-store'}});
   console.log('Ghi thử object vào bucket thành công.');
  }finally{
   try{await object.delete({ignoreNotFound:true});console.log('Đã dọn object kiểm thử.');}
   catch(e){console.error('Không xóa được object kiểm thử; kiểm tra quyền storage.objects.delete.');throw e;}
  }
  console.log('Quyền ghi/xóa Firebase Storage hoạt động, không sử dụng ảnh khách.');
 }else{
  const [metadata]=await bucket.getMetadata();
  console.log('Kết nối Firebase Storage thành công.');
  console.log('Bucket:',metadata.name,'| Location:',metadata.location,'| Project:',projectId);
  console.log('Không ghi, không đọc và không xóa ảnh.');
  console.log('Muốn kiểm tra thực quyền ghi/xóa mà không đụng dữ liệu khách: npm run diagnose:storage -- --write-test');
 }
}catch(err){
 const code=typeof err==='object'&&err!==null&&'code' in err?String(err.code):'';
 const message=String(err?.message||'');
 if(code==='404'||/not found|does not exist/i.test(message))console.error('Bucket chưa tồn tại hoặc tên sai. Hãy đối chiếu đúng tên tại Firebase Console > Storage > Files.');
 else if(code==='403'||/permission|denied|billing/i.test(message))console.error('Thiếu quyền Storage hoặc Firebase project chưa bật Blaze. Kiểm tra IAM của service account và gói thanh toán.');
 else console.error('Không truy cập được bucket; kiểm tra cấu hình, IAM, API, kết nối mạng (mã lỗi: '+(code||'không rõ')+').');
 process.exitCode=1;
}finally{await deleteApp(instance);}
