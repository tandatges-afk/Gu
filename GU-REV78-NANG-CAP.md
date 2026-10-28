# GU Rev7.8 — Nhập kho nhiều món và hạn trả theo giờ thực nhận

## Phạm vi
- Nhập kho từ 1–100 sản phẩm/lượt, cùng một giao dịch PostgreSQL, có kiểm tra trùng tên và serial trên server. Giới hạn 100 để ngăn giao dịch quá lớn/timeout; có thể tạo các lượt tiếp theo tùy ý.
- Danh sách sản phẩm dạng thu gọn, tìm kiếm theo tên/số dòng, lọc dòng thiếu thông tin, chỉnh sửa từng hàng, ghim thanh hành động.
- Form tạo đơn trang phục/phụ kiện dùng gói 1–30 chu kỳ 24 giờ, tự tính giờ trả. Form máy ảnh dùng gói 3/6/24/48 giờ và tự tính giờ trả.
- Khi bàn giao thành công, giờ bắt đầu thuê và hạn trả được đồng bộ theo giờ giao thực tế cộng thời lượng gói. Giờ hẹn cũ vẫn giữ trong scheduledPickupAt / history.
- Khóa lịch trước/sau được cập nhật trong transaction. Nếu thời gian mới va chạm với đơn khác, API trả 409, không ghi nhận bàn giao, không thay đổi tiền/cọc hay kho.

## Quan trọng
- Không tự động sửa giờ trả của các đơn **đã giao trước Rev7.8**. Cần đối soát riêng với dữ liệu thực tế, số tiền và đơn kế tiếp trước khi thay đổi.
- Không thay đổi cấu trúc database hoặc xóa dữ liệu.
- Khoản tiền thuê đã chốt vẫn được bảo toàn ở bước giao. Phụ thu trễ tính bằng giờ trả thực tế theo gói trong bước nhận trả.
- Nếu giờ giao lệch dẫn đến chồng lịch, hệ thống **từ chối bàn giao**, cần điều chỉnh các đặt lịch liên quan trước.
- Repo vẫn yêu cầu CI/backup/production preflight; không push thẳng lên main khi chưa test Next.js build và kiểm thử giao–nhận trên môi trường thật.

## Kiểm tra trên Windows
```powershell
npm ci
foreach ($s in 'verify:release','typecheck','test','test:vps','build') {
  npm run $s
  if ($LASTEXITCODE -ne 0) { throw "FAILED: $s" }
}
```

## Nghiệm thu vận hành
1. Tạo 1 đơn trang phục 24h nhận lúc 10:15, bàn giao thật 09:50 -> hạn trả hôm sau 09:50.
2. Máy ảnh gói 3h hẹn 10:15, giao thật 09:50 -> hạn trả 12:50; giao muộn 10:30 -> 13:30 nếu lịch cho phép.
3. Khi có đặt lịch khác giao nhau với hạn mới, bàn giao bị chặn và giữ nguyên trạng thái cũ.
4. Kiểm tra giờ trên chi tiết đơn, bảng lịch, danh sách trả, và thu/hoàn cọc khi khách trả đúng/trễ.
5. Nhập 12–100 món, lọc, thu gọn, thử tên trùng và serial trùng; khi bị lỗi không tạo dở các món.
