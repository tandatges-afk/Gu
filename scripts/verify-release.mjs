import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const required = [
  'src/app/page.tsx',
  'src/app/globals.css',
  'src/app/api/bootstrap/route.ts',
  'src/app/api/smart-calendar/route.ts',
  'src/app/api/items/hanger-codes/route.ts',
  'src/app/api/orders/[id]/route.ts',
  'src/components/GuReturnFlow.tsx',
  'src/components/GuRentalForms.tsx',
  'src/components/GuPwa.tsx',
  'src/lib/types.ts',
  'src/lib/rental.ts',
  'src/lib/return-settlement.ts',
  'src/lib/hanger-code.ts',
  'src/lib/smart-calendar.ts',
  'src/lib/rental-extension.ts',
  'public/gu-sw.js',
  '.env.example',
  'firestore.rules'
];
const missing = required.filter(p => !existsSync(join(root,p)));
const read = p => readFileSync(join(root,p),'utf8');
const checks = [
  ['mã móc tự động', /hangerCode\??:/, 'src/lib/types.ts'],
  ['sản phẩm lưu trữ', /archivedAt\??:/, 'src/lib/types.ts'],
  ['số ngày trả trễ', /lateDays\??:/, 'src/lib/types.ts'],
  ['phí trả trễ', /lateFeeTotal\??:/, 'src/lib/types.ts'],
  ['phụ phí khác', /otherFeeTotal\??:/, 'src/lib/types.ts'],
  ['hàm tính ngày trễ', /export\s+(?:function|const)\s+lateDays\b/, 'src/lib/rental.ts'],
  ['hàm tính phí trễ', /export\s+(?:function|const)\s+lateBaseCharge\b/, 'src/lib/rental.ts'],
];
const absent = checks.filter(([name,pattern,file]) => missing.includes(file) || !pattern.test(read(file))).map(([name])=>name);
const pkg = JSON.parse(read('package.json'));
if (pkg.version !== '4.1.2') absent.push('phiên bản 4.1.2 trong package.json');
if (missing.length || absent.length) {
  console.error('KHÔNG ĐỒNG BỘ. Thiếu tệp:', missing.join(', ') || 'không');
  console.error('Thiếu thành phần:', absent.join(', ') || 'không');
  process.exit(1);
}
console.log(`OK - GU v${pkg.version}: ${required.length} tệp và ${checks.length} dấu hiệu đồng bộ đã kiểm tra.`);
console.log('Lưu ý: đây là kiểm tra cấu trúc; vẫn cần npm run typecheck và npm run build.');
