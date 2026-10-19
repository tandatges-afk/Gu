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
  'src/lib/monitoring-error.ts',
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
  'src/app/mobile/page.tsx',
  'src/app/api/v5/orders/route.ts',
  'src/app/api/v5/orders/[id]/route.ts',
  'src/app/api/v5/jobs/route.ts',
  'src/components/GuV5Booking.tsx',
  'src/components/GuV5Review.tsx',
  'src/lib/hourly-pricing.ts',
  'src/lib/inspection-proof.ts',
  'firestore.rules',
  'vercel.json',
  'src/lib/camera-rental.ts',
  'src/lib/evidence-retention.ts',
  'src/lib/evidence-retention-rules.ts',
  'src/lib/v5-review-pricing.ts',
  'src/app/api/v5/evidence-cleanup/route.ts',
  'src/app/api/v5/evidence-history/[id]/route.ts'
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
checks.push(['Cloud Monitoring trả đủ điểm dữ liệu', /'view':'FULL'/, 'src/app/api/system/route.ts']);
checks.push(['nút cập nhật bỏ cache', /system\?refresh=1/, 'src/components/GuSystem.tsx']);
checks.push(['giá thuê theo 24h', /billableBlocks/, 'src/lib/hourly-pricing.ts']);
checks.push(['mobile chụp nhận trả', /sendPhoto/, 'src/app/mobile/page.tsx']);
checks.push(['admin duyệt ảnh', /GuV5Review/, 'src/app/page.tsx']);
checks.push(['chống trùng giờ', /checkIntervalAvailability/, 'src/app/api/v5/orders/route.ts']);
checks.push(['chỉ admin xóa và duyệt', /requireAdmin/, 'src/app/api/v5/orders/[id]/route.ts']);
checks.push(['có bảng giá Canon theo giờ', /CAMERA_PRICE/, 'src/lib/camera-rental.ts']);
checks.push(['phí trễ máy ảnh theo giờ dựa trên gói đã chốt', /cameraPackageHours/, 'src/lib/camera-rental.ts']);
checks.push(['phí trễ máy ảnh chưa chốt được tách khỏi kiểm nhận', /approvedLineQuote/, 'src/app/api/v5/orders/[id]/route.ts']);
checks.push(['admin mới được hủy các đơn', /'CANCEL','APPROVE_RETURN'/, 'src/app/api/v5/orders/[id]/route.ts']);
checks.push(['giới hạn 7 cặp ảnh', /KEEP_INSPECTION_ROUNDS=7/, 'src/lib/evidence-retention-rules.ts']);
checks.push(['Cloudinary xóa ảnh bản cũ có invalidate', /invalidate:'true'/, 'src/lib/evidence-retention.ts']);
checks.push(['theo dõi Cloud Monitoring 403', /Monitoring Viewer/, 'src/components/GuSystem.tsx']);
const absent = checks.filter(([name,pattern,file]) => missing.includes(file) || !pattern.test(read(file))).map(([name])=>name);
const pkg = JSON.parse(read('package.json'));
if (pkg.version !== '5.0.0-beta.4') absent.push('phiên bản 5.0.0-beta.4 trong package.json');
if (missing.length || absent.length) {
  console.error('KHÔNG ĐỒNG BỘ. Thiếu tệp:', missing.join(', ') || 'không');
  console.error('Thiếu thành phần:', absent.join(', ') || 'không');
  process.exit(1);
}
console.log(`OK - GU v${pkg.version}: ${required.length} tệp và ${checks.length} dấu hiệu đồng bộ đã kiểm tra.`);
console.log('Lưu ý: đây là kiểm tra cấu trúc; vẫn cần npm run typecheck và npm run build.');
