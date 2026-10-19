# GU v5 Beta 6 — Giao diện nhân viên mobile & dọn dữ liệu demo

## Giao diện mới

Nhân viên Mobile có **hai chức năng duy nhất**: Giao/nhận bằng ảnh và Tìm bằng ảnh. Đã thiết kế lại màn hình đăng nhập, menu dưới cùng, danh sách đơn, popup đơn mới, ảnh mẫu/ảnh khi giao/ảnh nhận đặt cạnh nhau, theo dõi số góc đã chụp, ghi nhận hiện trạng và thanh xác nhận ở cuối bước. Quyền server giữ nguyên: nhân viên mobile không được tạo/hủy đơn và không xem số tiền, số điện thoại hay giá trị đền bù.

Tìm bằng ảnh hiện vẫn là so màu/bố cục tối đa 150 món đầu tiên, **chưa phải model AI nhận diện 2.000 món**.

## Giải thích `firestore` trong mục Hệ thống

Ảnh màn hình là **thống kê**, không phải dữ liệu dùng để khôi phục/xóa DB. Các chỉ số Cloudinary 0,18 credits là mức tiêu thụ dịch vụ, **không phải số dư của Firestore**. `Cloud Monitoring 403` là lỗi truy cập số liệu thống kê, không có nghĩa đơn hàng bị lỗi. Xóa bản ghi Firestore không làm mới quota đọc/ghi, không xóa ảnh Cloudinary và không sửa lỗi IAM/Monitoring.

## Cách dọn sạch dữ liệu THỬ NGHIỆM trong Firebase Firestore

**CẢNH BÁO: thao tác không thể hoàn tác tự động. Phải tải bản sao lưu khỏi Codespaces trước khi chạy `--execute`.** Dừng tạo đơn, giao nhận, thao tác ảnh và đăng nhập các tài khoản nhân viên khác trong lúc reset. Ưu tiên thực hiện ở project Firebase staging, không làm trên cửa hàng thật.

Script chỉ dọn **19 collection nghiệp vụ** và giữ `staff` để Admin/nhân viên tiếp tục đăng nhập. Firebase Authentication, Firebase project, cấu hình `.env.local`, quota hằng ngày và Cloudinary vẫn giữ nguyên. Script sẽ dừng nếu gặp collection chưa kiểm toán, bản ghi mới/xóa sau sao lưu hoặc trên 3.000 document trong một collection.

### 1) Xem trước (không xóa)

```bash
cd /workspaces/Gu
node --env-file=.env.local scripts/reset-demo-data.mjs --plan
```

### 2) Sao lưu toàn bộ collection hiện có

```bash
node --env-file=.env.local scripts/reset-demo-data.mjs --backup
```

Lệnh sẽ in `BACKUP_OK: /đường/dẫn/private-backups/reset-...`. Hãy **tải toàn bộ thư mục sao lưu về máy riêng**, bảo quản an toàn vì chứa dữ liệu khách hàng, rồi mới tiếp tục. Dữ liệu JSONL giữ dạng `Timestamp` có đánh dấu kiểu; không phải tệp import tự phục hồi Firestore chỉ bằng 1 cú nhấp. Nếu cần phục hồi, phải có quy trình import kiểm chứng riêng.

### 3) Kiểm tra đường dẫn và cho phép xóa

**Thay `BACKUP_DIR` bằng đường dẫn `BACKUP_OK` của chính lệnh trên, không copy một tên giả.**

```bash
BACKUP_DIR="/workspaces/Gu/private-backups/reset-gugu-547e3-THAY-BANG-DUONG-DAN-THAT"
node --env-file=.env.local scripts/reset-demo-data.mjs \
  --execute \
  "--backup-dir=$BACKUP_DIR" \
  --confirm=RESET-gugu-547e3
```

Script đối chiếu project, SHA256 từng tệp, danh sách ID và số lượng tài liệu trước khi dọn; cần thấy `RESET_COMPLETE`. Nếu dừng giữa chừng (mạng/timeout), **không chạy lặp lại tùy tiện**; xem log, tạo sao lưu mới nếu cần và đối chiếu tình trạng toàn bộ collection.

**Không đưa `.env.local`, private-backups hoặc dữ liệu người dùng vào GitHub.**

### 4) Sau khi reset

- Đăng nhập Admin đang có; cấu hình lại danh mục mong muốn và góc ảnh sản phẩm.
- Tạo các sản phẩm mới, kiểm tra mã GU bắt đầu từ `GU-00001` khi các collection index/counter được dọn.
- Thử từ đầu một đơn PC → mobile chụp giao → mobile chụp nhận → Admin duyệt, đối chiếu kho và công nợ.
- Tệp ảnh trên Cloudinary vẫn tồn tại, kể cả tệp của đơn đã xóa khỏi Firestore. Muốn dọn Cloudinary cần **quy trình riêng**: liệt kê đúng các ảnh test, sao lưu/đối chiếu rồi xóa bằng quyền Cloudinary Admin. Tránh xóa tài sản thật.
- Nếu Firestore Monitoring còn HTTP 403, cần xử lý quyền/API truy vấn Google; dọn DB không khắc phục lỗi đó.

## Triển khai

Giải nén toàn bộ ZIP GU Beta 6 lên **nhánh thử nghiệm** trước. Chạy `npm run test`, `npm run typecheck`, `npm run build`. Chỉ merge/push `main` khi đã thử trọn luồng trên staging. Riêng lệnh `reset-demo-data` chỉ chạy trong Codespaces với Firebase Admin credentials, tuyệt đối không được gọi qua client hoặc API công khai.
