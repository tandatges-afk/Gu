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
 const [metadata]=await bucket.getMetadata();
 console.log('Kết nối Firebase Storage thành công.');
 console.log('Bucket:',metadata.name,'| Location:',metadata.location,'| Project:',projectId);
 console.log('Không ghi, không đọc và không xóa ảnh.');
 console.log('Hãy thử tải 1 ảnh chứng từ trên Vercel Preview để kiểm chứng quyền ghi object.');
}catch(err){
 const code=typeof err==='object'&&err!==null&&'code' in err?String(err.code):'';
 const message=String(err?.message||'');
 if(code==='404'||/not found|does not exist/i.test(message))console.error('Bucket chưa tồn tại hoặc tên sai. Hãy đối chiếu đúng tên tại Firebase Console > Storage > Files.');
 else if(code==='403'||/permission|denied|billing/i.test(message))console.error('Thiếu quyền Storage hoặc Firebase project chưa bật Blaze. Kiểm tra IAM của service account và gói thanh toán.');
 else console.error('Không truy cập được bucket; kiểm tra cấu hình, IAM, API, kết nối mạng (mã lỗi: '+(code||'không rõ')+').');
 process.exitCode=1;
}finally{await deleteApp(instance);}
