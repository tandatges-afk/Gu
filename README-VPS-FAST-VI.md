# GU 5.4.6 VPS Fast (Beta 2) — Code đầy đủ

- Giao diện/đơn thuê/lịch/giặt/công nợ/ca làm: phát triển trên GU 5.4.6 Beta 1.
- Truy vấn: kế thừa ý tưởng phân trang nhỏ và lookup index từ GU 5.0 Beta 10.
- Hạ tầng: PostgreSQL JSONB, auth GU riêng, ảnh trên VPS, Next.js 16 (không cần Firebase, Cloudinary, Vercel khi chạy code mới).
- Thêm tối ưu PostgreSQL count, batch getAll, chuẩn cursor và index; bộ đo p50/p95 trên DB staging.
- Xem `docs/PERFORMANCE-V5-VPS-VI.md` và `deploy-vps/README-STAGING-VI.md` trước khi cài.

**Đây là bản thử nghiệm chưa build/kiểm thử PostgreSQL tích hợp trên VPS.** Không tự thay GU 6.1 production và không tự đổi GitHub `main` khi chưa nghiệm thu. Staging bắt buộc dùng database `gu_v546_stage`, không dùng `gu_db`.

Đã qua: `npm test` (222/222), `npm run test:vps` (15/15), `npm run verify:release`, kiểm tra cú pháp TypeScript của các module mới. `npm install`, `npm run typecheck`, `npm run build`, test PostgreSQL thật và kiểm thử giao diện trên trình duyệt vẫn phải chạy tại staging.
