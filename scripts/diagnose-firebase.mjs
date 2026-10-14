/* Local-only configuration checker; intentionally never prints secrets. */
const keys = [
  'NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_APP_ID',
  'FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY',
];
let failures = 0;
for (const key of keys) {
  const value = process.env[key]?.trim();
  const ok = Boolean(value && !/^(DIEN_|REPLACE_ME|AIza\.\.\.|1:\.\.\.)/i.test(value));
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${key}: ${ok ? 'đã nhập' : 'thiếu hoặc vẫn là giá trị mẫu'}`);
  if (!ok) failures++;
}
const project = 'gugu-547e3';
for (const key of ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT_ID']) {
  if (process.env[key] !== project) {
    console.log(`FAIL ${key}: phải trùng Project ID ${project}`); failures++;
  }
}
const domain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
if (domain && domain !== `${project}.firebaseapp.com`) {
  console.log('WARN authDomain khác gugu-547e3.firebaseapp.com; kiểm tra Web Config của Firebase.');
}
const email = process.env.FIREBASE_CLIENT_EMAIL || '';
if (email && !email.endsWith(`@${project}.iam.gserviceaccount.com`)) {
  console.log('FAIL FIREBASE_CLIENT_EMAIL có vẻ không thuộc Service Account của gugu-547e3.'); failures++;
}
const key = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
if (key && (!key.includes('-----BEGIN PRIVATE KEY-----') || !key.includes('-----END PRIVATE KEY-----') || key.includes('REPLACE_ME'))) {
  console.log('FAIL FIREBASE_PRIVATE_KEY không đúng định dạng PEM hoặc vẫn là giá trị mẫu.'); failures++;
}
console.log(failures ? `KẾT QUẢ: ${failures} mục cần kiểm tra. Không in thông tin bí mật.` : 'KẾT QUẢ: cấu hình cơ bản hợp lệ; chưa xác minh khóa thật với Firebase.');
process.exitCode = failures ? 1 : 0;
