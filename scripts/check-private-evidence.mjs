/** GU v5.5.4 local Cloudinary authenticated evidence check (no customer file upload). */
const cloud=(process.env.CLOUDINARY_CLOUD_NAME||'').trim();
const key=(process.env.CLOUDINARY_API_KEY||'').trim();
const secret=(process.env.CLOUDINARY_API_SECRET||'').trim();
if(!/^[A-Za-z0-9_-]{2,100}$/.test(cloud)||!key||!secret){
 console.error('Cloudinary thiếu CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY hoặc CLOUDINARY_API_SECRET trong .env.local.');
 process.exitCode=2;
}else{
 console.log('OK: Đã có Cloudinary credentials; ảnh CCCD mới dùng image/authenticated, không cần Firebase Storage.');
 if(process.argv.includes('--check-remote')){
  try{
   const response=await fetch(`https://api.cloudinary.com/v1_1/${cloud}/usage`,{
    headers:{Authorization:'Basic '+Buffer.from(key+':'+secret).toString('base64')},cache:'no-store',signal:AbortSignal.timeout(12000)});
   if(!response.ok){console.error('Cloudinary không xác nhận quyền API. HTTP',response.status);process.exitCode=2;}
   else console.log('OK: Kết nối Cloudinary API thành công. Chưa thực hiện upload thử ảnh riêng tư.');
  }catch(e){console.error('Không kết nối Cloudinary API:',e instanceof Error?e.name:'UNKNOWN');process.exitCode=2;}
 }
}
