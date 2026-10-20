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
  'src/lib/server-error-classifier.ts',
  'docs/GU-v5-BETA10-INDEX-AND-UI.md',
  'src/lib/product-name.ts',
  'src/lib/product-search.ts',
  'src/lib/return-risk.ts',
  'scripts/migrate-staff-unified.mjs',
  'src/app/api/v5/return-risk/route.ts',
  'scripts/migrate-product-names.mjs',
  'src/app/api/catalog/route.ts',
  'src/app/api/calendar/route.ts',
  'src/app/api/tasks/route.ts',
  'src/app/api/reports/route.ts',
  'src/lib/debt-index.ts',
  'scripts/migrate-debt-index.mjs',
  'scripts/migrate-revenue-history.mjs',
  'scripts/backup-firestore.mjs',
  'scripts/reset-demo-data.mjs',
  'scripts/diagnose-monitoring.mjs',
  'docs/GU-v5-BETA7-DESKTOP-UI-MONITORING.md',
  'docs/GU-V5-BETA6-MOBILE-RESET.md',
  'public/gu-sw.js',
  '.env.example',
  'src/components/GuOrderCapture.tsx',
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
  'src/lib/product-policies.ts',
  'src/lib/v5-review-pricing.ts',
  'src/app/api/v5/evidence-cleanup/route.ts',
  'src/app/api/v5/evidence-history/[id]/route.ts',
  'src/components/GuSecurePhoto.tsx',
  'src/components/GuSecureUpload.tsx',
  'src/app/api/v5/secure-photo/route.ts',
  'src/lib/gu-v52-workflow.ts',
  'src/lib/secure-evidence.ts',
  'src/lib/shift-schedule.ts',
  'src/app/api/shifts/route.ts',
  'src/components/GuStaffShifts.tsx',
  'src/app/api/v5/visual-availability/route.ts',
  'src/lib/visual-availability.ts',
  'src/lib/vn-datetime.ts',
  'src/lib/payment-review.ts',
  'src/components/GuVNDateTimeInput.tsx',
  'src/components/GuVisualFinder.tsx'
];
const missing = required.filter(p => !existsSync(join(root,p)));
const read = p => readFileSync(join(root,p),'utf8');
const checks = [
  ['công nợ theo khách', /summaryFromDebtIndex/, 'src/app/api/debts/route.ts'],
  ['đồng bộ chỉ mục nợ', /syncDebtIndex/, 'src/app/api/orders/[id]/route.ts'],
  ['giám sát lưu trữ admin', /GuSystem/, 'src/app/page.tsx'],
  ['mã sản phẩm tự động', /hangerCode\??:/, 'src/lib/types.ts'],
  ['lưu tên nhân viên tạo đơn', /createdByName:me\.name/, 'src/app/api/v5/orders/route.ts'],
  ['tên nhân viên trong lịch', /gu-calendar-cell-creator/, 'src/app/page.tsx'],
  ['sản phẩm lưu trữ', /archivedAt\??:/, 'src/lib/types.ts'],
  ['số ngày trả trễ', /lateDays\??:/, 'src/lib/types.ts'],
  ['phí trả trễ', /lateFeeTotal\??:/, 'src/lib/types.ts'],
  ['phụ phí khác', /otherFeeTotal\??:/, 'src/lib/types.ts'],
  ['hàm tính ngày trễ', /export\s+(?:function|const)\s+lateDays\b/, 'src/lib/rental.ts'],
  ['hàm tính phí trễ', /export\s+(?:function|const)\s+lateBaseCharge\b/, 'src/lib/rental.ts'],
];
checks.push(['catalog 1-field Firestore', /collection=collection\.orderBy\(field,descending\?'desc':'asc'\);/, 'src/app/api/catalog/route.ts']);
checks.push(['diagnostic endpoint Firestore', /endpoint\?\{endpoint\}/, 'src/lib/http.ts']);
checks.push(['responsive action buttons', /GU v5 Beta 10: deterministic action spacing/, 'src/app/globals.css']);
checks.push(['tên sản phẩm duy nhất giao dịch', /productNameIndex/, 'src/app/api/items/route.ts']);
checks.push(['sửa tên sản phẩm đồng bộ index', /nextNameRef/, 'src/app/api/items/[id]/route.ts']);
checks.push(['migrating tên sản phẩm cũ', /DUPLICATE GROUPS/, 'scripts/migrate-product-names.mjs']);
checks.push(['tiền phân cách hàng nghìn', /formatVndInput/, 'src/components/GuMoneyInput.tsx']);
checks.push(['giá thuê dùng tiền định dạng', /GuMoneyInput required/, 'src/app/page.tsx']);
checks.push(['không có trang /mobile', /GuOrderCapture/, 'src/app/page.tsx']);
checks.push(['tìm tên ở giữa từ không dấu', /nameSearchBigrams/, 'src/app/api/catalog/route.ts']);
checks.push(['cảnh báo sau 17 giờ', /vnClock/, 'src/lib/return-risk.ts']);
checks.push(['chỉ giữ Cloudinary trong giám sát Admin', /cloudinaryReport/, 'src/app/api/system/route.ts']);
checks.push(['nút cập nhật bỏ cache', /system\?refresh=1/, 'src/components/GuSystem.tsx']);
checks.push(['giá thuê theo 24h', /billableBlocks/, 'src/lib/hourly-pricing.ts']);
checks.push(['chụp kiểm nhận ngay trên đơn', /const upload=async/, 'src/components/GuOrderCapture.tsx']);
checks.push(['admin duyệt ảnh', /GuV5Review/, 'src/app/page.tsx']);
checks.push(['chống trùng giờ', /checkIntervalAvailability/, 'src/app/api/v5/orders/route.ts']);
checks.push(['chỉ admin xóa và duyệt', /requireAdmin/, 'src/app/api/v5/orders/[id]/route.ts']);
checks.push(['có bảng giá Canon theo giờ', /CAMERA_PRICE/, 'src/lib/camera-rental.ts']);
checks.push(['phí trễ máy ảnh theo giờ dựa trên gói đã chốt', /cameraPackageHours/, 'src/lib/camera-rental.ts']);
checks.push(['phí trễ máy ảnh chưa chốt được tách khỏi kiểm nhận', /approvedLineQuote/, 'src/app/api/v5/orders/[id]/route.ts']);
checks.push(['admin mới được hủy các đơn', /'CANCEL','APPROVE_RETURN'/, 'src/app/api/v5/orders/[id]/route.ts']);
checks.push(['giới hạn 7 cặp ảnh', /KEEP_INSPECTION_ROUNDS=7/, 'src/lib/evidence-retention-rules.ts']);
checks.push(['Cloudinary xóa ảnh bản cũ có invalidate', /invalidate:'true'/, 'src/lib/evidence-retention.ts']);
checks.push(['quy tắc ẩn giặt theo danh mục', /launderingForCategory/, 'src/app/api/items/route.ts']);
checks.push(['góc ảnh do Admin tự thêm', /Thêm góc chụp/, 'src/app/page.tsx']);
checks.push(['không tự điền góc ảnh', /DEFAULT_ANGLES:string\[\]=\[\]/, 'src/lib/inspection-proof.ts']);
checks.push(['đơn cần góc ảnh được thiết lập', /Admin cần thêm góc ảnh/, 'src/app/api/v5/orders/route.ts']);
checks.push(['chẩn đoán Cloud Monitoring 403', /BILLING_REQUIRED/, 'src/lib/monitoring-error.ts']);
checks.push(['menu PC không dùng bottom nav mobile', /gu-main-bottom-nav/, 'src/app/page.tsx']);
checks.push(['một giao diện cho PC và điện thoại', /GuOrderCapture/, 'src/app/page.tsx']);
checks.push(['chặn API ngoài ca ở backend', /!options\?\.allowSchedule&&!shift\.canWork/, 'src/lib/http.ts']);
checks.push(['giao dịch giữ chỗ atomic', /db\(\)\.runTransaction/, 'src/app/api/shifts/route.ts']);
checks.push(['màn đăng ký ca', /GuStaffShifts/, 'src/app/page.tsx']);
checks.push(['đăng xuất theo ca 20 giây', /20_000/, 'src/app/page.tsx']);
checks.push(['đặt trước thu đủ tiền thuê có bằng chứng', /readVerifiedEvidence\(tx,paymentProofId/, 'src/app/api/v5/orders/route.ts']);
checks.push(['sổ quỹ đặt trước', /kind:'PAYMENT',amount:total/, 'src/app/api/v5/orders/route.ts']);
checks.push(['ảnh cọc lưu private', /evidenceBucket\(\)\.file\(path\)\.save/, 'src/app/api/v5/secure-photo/route.ts']);
checks.push(['nhận trả không cần Admin giải phóng kho', /status:'RETURNED' as const/, 'src/app/api/v5/orders/[id]/route.ts']);
checks.push(['admin chỉ kiểm tra ảnh', /action==='REVIEW_PHOTOS'/, 'src/app/api/v5/orders/[id]/route.ts']);
checks.push(['nhân viên xác nhận hoàn vật cọc', /action==='RETURN_COLLATERAL'/, 'src/app/api/v5/orders/[id]/route.ts']);
checks.push(['thu đủ tự động sau nhận trả', /Thu đủ \{money\(due\)\}/, 'src/components/GuOrderCapture.tsx']);
checks.push(['gợi ý SĐT nổi dưới ô nhập', /\.gu-v11-customer-results\{position:absolute/, 'src/app/globals.css']);
checks.push(['hiển thị giờ giao và giờ nhận', /gu-calendar-cell-time/, 'src/app/page.tsx']);
checks.push(['tìm ảnh kèm trạng thái và lịch 7 ngày', /visual-availability/, 'src/components/GuVisualFinder.tsx']);
checks.push(['cảnh báo đóng được', /setDismissedRiskSignature\(riskSignature\)/, 'src/app/page.tsx']);
checks.push(['lọc lịch thiết kế riêng', /gu-calendar-controls-v532/, 'src/app/page.tsx']);
checks.push(['cache trong phiên không reload tab', /tabCacheRef/, 'src/app/page.tsx']);
checks.push(['đồng hồ VN 24h', /formatVNDateTime/, 'src/lib/vn-datetime.ts']);
checks.push(['đối soát thu thừa', /overpaid/, 'src/lib/payment-review.ts']);
const absent = checks.filter(([name,pattern,file]) => missing.includes(file) || !pattern.test(read(file))).map(([name])=>name);
const pkg = JSON.parse(read('package.json'));
if (pkg.version !== '5.3.3-beta.2') absent.push('phiên bản 5.3.3-beta.2 trong package.json');
if (missing.length || absent.length) {
  console.error('KHÔNG ĐỒNG BỘ. Thiếu tệp:', missing.join(', ') || 'không');
  console.error('Thiếu thành phần:', absent.join(', ') || 'không');
  process.exit(1);
}
console.log(`OK - GU v${pkg.version}: ${required.length} tệp và ${checks.length} dấu hiệu đồng bộ đã kiểm tra.`);
console.log('Lưu ý: đây là kiểm tra cấu trúc; vẫn cần npm run typecheck và npm run build.');
