# GU Fix20 Rev7.5 — VPS local backup + auto Production

Rev7.5 là phương án triển khai phù hợp GU không còn R2/Firebase/Cloudinary/Vercel.
Mỗi lần push lên `main`: CI → local backup PostgreSQL+uploads (kiểm chứng) → build trên VPS → deploy 3302 → health check & rollback ứng dụng khi lỗi.
**Không có backup offsite tự động**; yêu cầu chuyển bản backup mã hóa về Windows thường xuyên (đã xác minh ít nhất một bản V2 ngày 29/10/2026).
BẮT BUỘC xem `AUTO-PROD-SETUP.md` để cài bootstrap tool trước khi push.
