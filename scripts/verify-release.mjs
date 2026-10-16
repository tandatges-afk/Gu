import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const required = [
  'src/app/page.tsx',
  'src/app/globals.css',
  'src/app/api/bootstrap/route.ts',
  'src/app/api/debts/route.ts',
  'src/components/GuDebts.tsx',
  'src/lib/debts.ts',
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
  'src/lib/order-creator.ts',
  'src/lib/smart-calendar.ts',
  'src/lib/rental-extension.ts',
  'src/components/GuSystem.tsx',
  'src/components/GuMoneyInput.tsx',
  'src/lib/vnd-input.ts',
  'src/app/api/system/route.ts',
  'src/app/api/catalog/route.ts',
  'src/app/api/calendar/route.ts',
  'src/app/api/tasks/route.ts',
  'src/app/api/reports/route.ts',
  'src/lib/debt-index.ts',
  'scripts/migrate-debt-index.mjs',
  'scripts/migrate-revenue-history.mjs',
  'scripts/backup-firestore.mjs',
  'public/gu-sw.js',
  '.env.example',
  'firestore.rules'
];
const missing = required.filter(p => !existsSync(join(root,p)));
const read = p => readFileSync(join(root,p),'utf8');
const checks = [
  ['công nợ theo khách', /summaryFromDebtIndex/, 'src/app/api/debts/route.ts'],
  ['đồng bộ chỉ mục nợ', /syncDebtIndex/, 'src/app/api/orders/[id]/route.ts'],
  ['giám sát lưu trữ admin', /GuSystem/, 'src/app/page.tsx'],
  ['mã sản phẩm tự động', /hangerCode\??:/, 'src/lib/types.ts'],
  ['lưu tên nhân viên tạo đơn', /createdByName:me\.name/, 'src/app/api/orders/route.ts'],
  ['tên nhân viên trong lịch', /gu-calendar-cell-creator/, 'src/app/page.tsx'],
  ['sản phẩm lưu trữ', /archivedAt\??:/, 'src/lib/types.ts'],
  ['số ngày trả trễ', /lateDays\??:/, 'src/lib/types.ts'],
  ['phí trả trễ', /lateFeeTotal\??:/, 'src/lib/types.ts'],
  ['phụ phí khác', /otherFeeTotal\??:/, 'src/lib/types.ts'],
  ['hàm tính ngày trễ', /export\s+(?:function|const)\s+lateDays\b/, 'src/lib/rental.ts'],
  ['hàm tính phí trễ', /export\s+(?:function|const)\s+lateBaseCharge\b/, 'src/lib/rental.ts'],
];
checks.push(['tiền phân cách hàng nghìn', /formatVndInput/, 'src/components/GuMoneyInput.tsx']);
checks.push(['giá thuê dùng tiền định dạng', /GuMoneyInput required/, 'src/app/page.tsx']);
checks.push(['theo dõi Cloud Monitoring 403', /roles\/monitoring\.viewer/, 'src/components/GuSystem.tsx']);
const absent = checks.filter(([name,pattern,file]) => missing.includes(file) || !pattern.test(read(file))).map(([name])=>name);
const pkg = JSON.parse(read('package.json'));
if (pkg.version !== '4.2.1') absent.push('phiên bản 4.2.1 trong package.json');
if (missing.length || absent.length) {
  console.error('KHÔNG ĐỒNG BỘ. Thiếu tệp:', missing.join(', ') || 'không');
  console.error('Thiếu thành phần:', absent.join(', ') || 'không');
  process.exit(1);
}
console.log(`OK - GU v${pkg.version}: ${required.length} tệp và ${checks.length} dấu hiệu đồng bộ đã kiểm tra.`);
console.log('Lưu ý: đây là kiểm tra cấu trúc; vẫn cần npm run typecheck và npm run build.');
