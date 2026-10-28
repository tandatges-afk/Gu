# GU Fix20 Rev7 — Deploy repair + Nhập kho hàng loạt

## Căn cứ log `logs_110461216045.zip`

- CI trên GitHub: pass, unit tests và build thành công.
- Job Production: lệnh `rsync` trong `.github/workflows/deploy-main.yml` dùng `--exclude='.github/'`, nên file `.github/workflows/deploy-main.yml` không được chuyển lên VPS. Có ba test đọc chính đường dẫn này, kết quả `ENOENT` và `326/329` pass.
- Pipeline dừng tại `npm test` trong bản release tạm; **chưa** tới `db:preflight`, build production tại VPS hay chuyển symlink; log này không cho thấy lỗi PostgreSQL.
- Fix: xóa `--exclude='.github/'` khỏi cả lệnh rsync staging và production, không vô hiệu hóa 3 test.

## Kho — Tab Nhập kho hàng loạt

Trong Kho sản phẩm, chọn **Thêm nhiều sản phẩm** hoặc tab **Nhập kho hàng loạt**. Mỗi dòng bao gồm tên, danh mục, màu sắc, đền bù, giặt; mở **Ảnh, góc chụp** để chụp/chọn ảnh và nhập góc giao/nhận. Nút **+ Thêm dòng**, **Lưu N sản phẩm**. Giới hạn 10 món/lượt để giữ transaction và request size nhỏ.

- Chuẩn hóa tiếng Việt: không phân biệt dấu, hoa/thường, khoảng trắng, dấu câu; phát hiện tên trùng trong danh sách đang nhập.
- Gọi server để báo tên đã tồn tại trong **toàn bộ kho** (không phụ thuộc phân trang hoặc kết quả tìm kiếm UI).
- `POST /api/items/bulk` xác thực nhân viên, hạn chế camera với Admin, kiểm tra quyền ảnh, serial máy, giá trị đền bù, yêu cầu giặt và góc ảnh; tạo đủ `items`, `skuIndex`, `productNameIndex`, `inventoryCounters`, `auditLogs` cùng một transaction PostgreSQL.
- Bấm lưu lặp với cùng `requestId` trả kết quả cũ, không tạo gấp đôi. Nếu bất cứ tên hoặc serial đã bị chiếm trước lúc lưu, toàn bộ yêu cầu bị từ chối, không lưu dở từng món.
- Ảnh bìa được thử tạo chỉ mục visual search trên client; nếu thất bại, vẫn cho lưu sản phẩm (giống cách xử lý ảnh hiện có).

## Mức độ xác minh

`node scripts/check-local-imports.mjs`, source guard, client directive, test và VPS test chạy thành công ở môi trường đóng gói. Do không cài được dependencies từ registry trong môi trường này, **chưa xác nhận `npm ci`, TypeScript typecheck hay Next.js build đầy đủ của Rev7**. Bắt buộc chạy GitHub CI hoặc máy Windows để xác minh.

## Cập nhật GitHub an toàn

Không chép đè source lên VPS và không deploy trực tiếp bản ZIP. Trên Windows, tạo nhánh mới từ `origin/main`, dùng full source Rev7 trong worktree sạch (giữ `.git`, `.env`), chạy `npm ci`, `npm run verify:release`, `npm run typecheck`, `npm test`, `npm run test:vps`, `npm run build`, sau đó commit/push nhánh review. Nếu `origin/main` đã có commit mới, phải kiểm tra diff trước khi ghi đè mã nguồn. Mở PR và cho CI qua; backup Production đã được kiểm chứng mới cho phép chạy workflow Production.

## Giới hạn

Không có khả năng khẳng định hệ thống production không còn lỗi khi chưa thử với dữ liệu PostgreSQL và hai nhân viên thực tế. Workflow `prod` vẫn yêu cầu mở khóa thủ công; không tự kích hoạt Production khi push.
