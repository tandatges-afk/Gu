# GU v6.0 — VPS PILOT (không thay Production)

**Đọc đầu tiên:** `docs/GU-v6-VPS-PILOT.md`

Đã sửa trong source: tải toàn bộ danh sách kho/khách/đơn bằng cursor, lọc sau khi đủ kết quả, trang 50 dòng, và triển khai Next.js standalone bằng Docker + Caddy trên VPS. Có sẵn công cụ xuất Firestore và PostgreSQL staging.

**CHƯA** loại bỏ Firebase/Cloudinary khỏi API Production; **CHƯA** di chuyển dữ liệu, Auth, ảnh CCCD hoặc tên miền chính. Cần một bản backend PostgreSQL được kiểm thử đầy đủ trước bước đó. Không xóa tài khoản Firebase hay Cloudinary.

Mã nguồn này dựa trên ZIP v5.5.4 đã gửi trong chat, không phải code mới nhất trực tiếp từ nhánh main trên GitHub. So sánh diff trước khi merge. Khi copy file vào project hiện có, giữ `package-lock.json` của project và chạy `npm.cmd install` để đồng bộ trước khi push.

## Windows VS Code Local

```powershell
npm.cmd install
npm.cmd run verify:release
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build

git switch -c v6-vps-pilot
git add -A
git commit -m "GU v6 VPS pilot - deploy and full catalog pagination"
git push -u origin v6-vps-pilot
```

**Không push nếu kiểm thử/build chưa đạt.** Không đưa `.env.local` hoặc dữ liệu khách lên GitHub.
