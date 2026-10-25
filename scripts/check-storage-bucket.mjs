/** On local Windows: node --env-file=.env.local scripts/check-storage-bucket.mjs
 * Uses service account from local env only. Never prints secrets/customer images.
 */
import {cert,initializeApp,getApps} from 'firebase-admin/app';
import {getStorage} from 'firebase-admin/storage';
const projectId=process.env.FIREBASE_PROJECT_ID;
const clientEmail=process.env.FIREBASE_CLIENT_EMAIL;
const privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n');
const bucketName=(process.env.FIREBASE_STORAGE_BUCKET||'').trim().replace(/^gs:\/\//,'').replace(/\/$/,'');
if(!projectId||!clientEmail||!privateKey||!bucketName){console.error('Thiếu biến Firebase Admin hoặc FIREBASE_STORAGE_BUCKET trong .env.local.');process.exitCode=2;}
else{
 try{
  const app=getApps()[0]||initializeApp({credential:cert({projectId,clientEmail,privateKey})});
  const bucket=getStorage(app).bucket(bucketName);
  const [exists]=await bucket.exists();
  if(!exists){console.error('Bucket không tồn tại hoặc không truy cập được: '+bucketName+' — kiểm tra Firebase Console → Storage.');process.exitCode=2;}
  else console.log('Bucket tồn tại: '+bucketName+'; chưa kiểm tra quyền ghi. KHÔNG đưa ảnh CCCD lên Cloudinary công khai.');
 }catch(e){console.error('Không thể truy cập Storage bucket. Kiểm tra tên bucket, IAM và Blaze. Mã:',e?.code||'UNKNOWN');process.exitCode=2;}
}
