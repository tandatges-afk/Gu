# GU v5.4.0 – TypeScript + test drift hotfix (22/10/2026)

## Những lỗi đã sửa

1. `src/app/api/bootstrap/route.ts`: dùng `d.data()?.name` để TypeScript nhận biết snapshot data có thể `undefined`.
2. `src/lib/debt-page-merge.ts`: gộp danh sách công nợ phân trang theo cách bất biến, sao chép mảng `orders` và không ghi vào thuộc tính `readonly`.
3. `src/app/page.tsx`: gọi `mergeDebtPages` trong `setDebtSummary`.
4. `tsconfig.json`: tách mã ứng dụng khỏi các unit test, tránh ngăn Production Build khi tồn tại test của nhánh khác.
5. `tsconfig.tests.json` + `npm run typecheck:tests`: cho phép kiểm tra riêng toàn bộ test.
6. `tests/v5-4-1-typecheck-debt-pages.test.ts`: kiểm thử đồng bộ công nợ qua trang, không ghi đè tổng global và không mutate bản ghi nguồn.

## Test của các phiên bản khác trên Codespaces

Các tệp dưới đây có trong log của người dùng nhưng **không có trong bản phát hành GU v5.4.0 gốc**:
- `tests/visual-search-v538.test.ts`
- `tests/gu-v537-cameras-deposits.test.ts`
- `tests/v536-late-pickup-storage.test.ts`
- `tests/v539-split-rental-groups.test.ts`

Các test đó kỳ vọng `chosenCameraPackageSnapshot`, `overduePickupNotice`, `overduePickupNotices`, và việc loại bỏ `gu-smart-calendar` / cơ chế phân quyền ảnh khác với source v5.4.0. Đây là **vấn đề chưa đồng bộ mã nguồn**, không phải chỉ cần thêm import.

Không xóa các test này một cách âm thầm. Chúng có thể đại diện cho nghiệp vụ cần bảo toàn ở một nhánh khác. Để thực sự hòa nhập đầy đủ v5.3.6–v5.3.9, cần lấy source tương ứng, so sánh thay đổi và bổ sung test thích hợp.

## Cập nhật Codespaces (an toàn)

Trước khi ghi đè, commit mã nguồn hiện tại hoặc tạo nhánh sao lưu, bao gồm cả các file test nằm ngoài bản release. Đưa ZIP vào thư mục gốc rồi giải nén.

```
cd /workspaces/Gu
git status --short
# Nếu có thay đổi chưa commit: git add -A && git commit -m "Backup before GU hotfix"
git branch backup-before-gu-v54-hotfix
unzip -o GU-v5.4.0-TYPECHECK-HOTFIX-FULL-CODESPACES.zip -d .
npm install
npm run verify:release
npm run typecheck
npm run build
npm run test
npm run typecheck:tests
```

`npm run typecheck` và `npm run build` chỉ kiểm tra ứng dụng. `npm run test` và `npm run typecheck:tests` vẫn nhìn thấy các test tồn tại trong workspace. Nếu test của nhánh khác bị lỗi, **không kết luận mọi tính năng đã tương thích**; cần hòa nhập lại những tính năng tương ứng trước khi Production.

## Kết quả kiểm tra tại môi trường tạo gói

- `npm run verify:release`: đạt.
- Import nội bộ: 354 đường dẫn hợp lệ.
- `npm run test` trên bộ test đi kèm ZIP: 203/203 đạt.
- Chưa chạy được `npm run typecheck` và `npm run build` thật vì môi trường thiếu `node_modules` và gói npm không nằm trong offline cache.
- Không thay đổi Firebase schema, không xóa khách hàng/đơn thuê, không yêu cầu migration.
