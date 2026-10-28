# GU v5.0.0 Beta 8 — Cloudinary only & UI cleanup

- Admin → Hệ thống chỉ xem Cloudinary: credits, dung lượng, băng thông, biến đổi ảnh và số tài nguyên.
- API `/api/system` không gọi Cloud Monitoring hoặc đếm collection Firestore. **GU vẫn tiếp tục sử dụng Firestore cho toàn bộ đơn hàng và kho.**
- Xóa thẻ Vercel, Lưu ý về vận hành, hint góc chụp và hint tìm bằng ảnh.
- Phân trang chỉ hiện số kết quả khi dữ liệu tải xong, không còn `undefined kết quả`.
- Phân loại các mã lỗi Firestore tiêu chuẩn. Các lỗi khác vẫn trả mã `GU_SERVER_ERROR` để tra Vercel Logs.

## Lỗi `b8cb8115`

Đây là ID của một lần lỗi tại máy chủ. Không thể kết luận nguồn gốc từ ID một mình.
Trong Vercel → Project GU → Logs, lọc thời gian xảy ra sự cố và tìm `b8cb8115` hoặc `[GU_SERVER_ERROR]`. Sao chép `name`, `message`, phần stack liên quan, **loại bỏ khóa, token, số điện thoại và thông tin khách** trước khi chia sẻ.

## Kiểm tra

```bash
nvm use 22
npm install
npm run verify:release
npm run test
npm run typecheck
npm run build
```

**Không xóa hoặc reset Firebase** để giải quyết lỗi hiển thị thống kê.
