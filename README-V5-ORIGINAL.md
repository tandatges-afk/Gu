# GU – Thuê đồ xinh · V5.4.6 → VPS PostgreSQL (BETA)

Đây là **bản port GU V5.4.6 sang VPS** giữ giao diện/logic V5, không phải bản production đã xác minh. Cơ sở dữ liệu mới là PostgreSQL JSONB, đăng nhập qua cookie/session GU, ảnh lưu riêng trên VPS. Không có cấu hình Firebase/Vercel/Cloudinary nào bắt buộc để chạy bản mới.

**Hướng dẫn đầy đủ:** [deploy-vps/README-STAGING-VI.md](deploy-vps/README-STAGING-VI.md).

- Staging: `https://v5.guthuedo.io.vn` (chỉ hoạt động sau khi người dùng cấu hình DNS, Nginx và SSL).
- Main hiện tại: `https://guthuedo.io.vn` — **chưa được thay**.
- `.env.example` chỉ là ví dụ; hãy tạo `.env.local` trên VPS, không đưa lên Git.
- Mã nguồn gốc không có `package-lock.json`; chạy `npm install` trên VPS, kiểm tra typecheck/build và mới commit lockfile sau khi thử thành công.
- **Dữ liệu Firebase, tài khoản nhân viên và chứng từ Cloudinary cũ chưa được nhập**. Muốn tiếp tục dùng dữ liệu cũ phải làm công đoạn xuất/nhập riêng. Không xóa dữ liệu cũ.
- Cấm chuyển Nginx production sang V5 trước khi chạy kiểm thử tạo đơn/chống trùng, tài chính, quyền và ảnh nhạy cảm.
