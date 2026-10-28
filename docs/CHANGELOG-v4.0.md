# GU v4.0 changelog

- Nâng cấp trực tiếp từ v3.0.1, giữ nguyên Firestore collections và Cloudinary.
- Giặt tự động khi hoàn thành đơn trả hàng: `RENTED → LAUNDRY` nếu yêu cầu giặt, `RENTED → AVAILABLE` nếu không, `RENTED → MISSING` nếu thiếu. Không có `WAITING_LAUNDRY`.
- Xóa cách chỉnh tay `LAUNDRY` khỏi status select và API. Đã giặt được ghi audit.
- Thêm action `EXTEND` transactional: lock mới, tính thêm tiền, cập nhật returnDate và lịch sử thao tác.
- Chặn gia hạn khi quá hạn hoặc gặp xung đột.
- Hiển thị form gia hạn trên điện thoại và thống kê số món đang giặt ở dashboard.
- Đồng bộ nhãn Giặt và nâng version cache PWA.
