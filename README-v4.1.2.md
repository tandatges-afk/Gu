# GU — Thuê đồ xinh v4.1.2

Nâng cấp từ GU v4.1.1: **kiểm đồ trước → tiền tự tính sau**. Chi tiết trong `docs/CHANGELOG-v4.1.2.md`.

## Cập nhật bản vá an toàn trên Codespaces

1. `cd /workspaces/Gu` và chạy `git status` để chắc không có thay đổi chưa lưu. Tạo nhánh dự phòng từ `main`.
2. Upload `GU-v4.1.2-Return-Flow-Patch.zip` vào thư mục Codespaces rồi chạy:

```bash
mkdir -p /tmp/gu-v412
unzip -q GU-v4.1.2-Return-Flow-Patch.zip -d /tmp/gu-v412
cp -a /tmp/gu-v412/. .
```

3. Chạy:

```bash
npm install
npm run test
npm run typecheck
npm run build
npm run dev
```

4. Kiểm thử bằng đơn thử nghiệm: đơn thuê 1 ngày, trễ 1 ngày, 2 món thiếu 1, không phụ phí, phụ phí khác có lý do, checkbox thu đủ và để công nợ. Kiểm tra nhân viên sau hoàn tất không thấy đơn, Admin vẫn thấy, logs và kho chuyển đúng LAUNDRY/MISSING.
5. Push **nhánh kiểm thử**, xem Vercel Preview trước khi merge vào `main`.

Không đưa `.env.local` hoặc khóa Firebase/Cloudinary lên GitHub. Các biến môi trường hiện tại dùng lại nguyên vẹn.
