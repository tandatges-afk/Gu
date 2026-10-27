# GU v5.3.5 Beta 3 – TypeScript build fix

Đợt sửa dựa trên GU v5.3.5 Beta 2 để xử lý **5 lỗi TypeScript** từ Codespaces.

## Các file đã thay đổi

- `src/app/api/v5/orders/route.ts`: Không truyền `undefined` vào `.doc(id)`. Khách mới dùng `.doc()` tạo Firestore ID tự động; khách cũ tiếp tục dùng mã đã có. Kiểm tra `phoneIndex.customerId` có định dạng hợp lệ trước khi tạo tham chiếu.
- `src/app/page.tsx`: Bổ sung import `imageSignature`, `GuInventoryFilters`, `inventoryLayout`; khai báo kiểu string cho callback tìm kho.
- `tests/gu-v535-beta3-build-regression.test.ts`: Bổ sung kiểm thử để phát hiện nếu các import hoặc cách tạo ID lỗi trở lại.
- `package.json`, `scripts/verify-release.mjs`: Đồng bộ phiên bản Beta 3.

## Cập nhật trên Codespaces

```bash
cd /workspaces/Gu
unzip -o GU-v5.3.5-beta.3-TYPECHECK-FIX-FULL-CODESPACES.zip -d .
npm run verify:icons
npm run verify:release
npm test
npm run typecheck
npm run build
```

**Không push nếu `npm run typecheck` hoặc `npm run build` vẫn còn lỗi.** Tạo commit sao lưu trước khi giải nén nếu đang có thay đổi chưa commit. Không cần migration Firebase hay thay đổi biến môi trường cho bản vá này.

## Phạm vi xác minh

Bản vá đã chạy thành công các kiểm thử logic và kiểm tra import/directive trong môi trường nguồn; kết quả Production Build cần được xác nhận trên Codespaces có cài dependency. Dùng Node.js 22 theo `engines` trong package.json.
