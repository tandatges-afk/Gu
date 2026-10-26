# GU – PostgreSQL VPS: Giai đoạn 1 (bản thử nghiệm riêng biệt)

**Không phải bản chuyển đổi hoàn chỉnh**. Package này bổ sung thử nghiệm độc lập:

- PostgreSQL connection pooling (`pg`) và health-check bảng.
- Đăng nhập Admin với Argon2id, cookie HttpOnly và phiên lưu hash trong PostgreSQL.
- Các API `/api/pg/*` cho danh mục, khách hàng, sản phẩm, đơn thuê.
- Tạo đơn theo giao dịch, dùng exclusion constraint chống trùng sản phẩm/thời gian.
- Cập nhật đơn: `RESERVED -> PICKED_UP -> RETURNED` (sau trả chuyển `LAUNDRY`), hoặc Admin hủy `RESERVED`.
- Màn hình kiểm thử riêng tại `/pg-console`.

**Chưa chuyển** UI GU chính và các API `/api/*` cũ: Firestore, Firebase Auth, ca nhân viên, công nợ, ảnh chứng từ, AI và các luồng v5 vẫn là mã nguồn Firebase. Không xóa cấu hình Firebase hoặc deploy lên production ngay.

## 1. Mở nhánh mới trong VS Code

```bash
git switch -c vps-postgres
```

Giải nén patch này và chép **nội dung** vào thư mục dự án GU (không chép cả thư mục patch vào sâu bên trong). Không ghi đè `package.json` hoặc `package-lock.json` vì bản patch chỉ bổ sung các file mới.

## 2. Sửa dependency và lỗi build

Trên máy có internet (VS Code hoặc VPS) từ thư mục source:

```bash
npm install pg argon2 @huggingface/transformers
npm install --save-dev @types/pg
npm run typecheck
npm run build
```

Lệnh `npm install` cập nhật **cả** `package.json` và `package-lock.json`; commit cả hai để `npm ci` chạy ổn định. Không dùng `--force` để che lỗi.

## 3. Database (VPS)

Nếu đã nhập file `db/schema.sql` từ bước trước thì **không cần** tạo lại 15 bảng. Chỉ cần thêm bảng kiểm soát đăng nhập:

```bash
psql -h 127.0.0.1 -U gu_app -d gu_db -v ON_ERROR_STOP=1 -f db/phase1_auth.sql
```

Kiểm tra `DATABASE_URL` tồn tại trong `.env.local` trên VPS. Không đưa file `.env.local` lên GitHub.

```dotenv
DATABASE_URL="postgresql://gu_app:PASSWORD_URL_ENCODED@127.0.0.1:5432/gu_db"
```

Kiểm tra:

```bash
node --env-file=.env.local scripts/pg-check.mjs
node --env-file=.env.local scripts/pg-smoke-test.mjs
```

Phải trả về tối thiểu 16 bảng và thiếu 0 bảng.

## 4. Tạo tài khoản Admin PostgreSQL (chỉ một lần)

```bash
read -rs -p 'Mật khẩu admin mới (>=12 ký tự): ' GU_ADMIN_PASSWORD; echo
export GU_ADMIN_PASSWORD
node --env-file=.env.local scripts/pg-create-admin.mjs admin@your-domain.example "Admin GU"
unset GU_ADMIN_PASSWORD
```

Thay email trước khi chạy. Không lưu mật khẩu trong lệnh lịch sử, `.env.local`, commit, screenshot hoặc tin nhắn. Khởi tạo Admin cần PostgreSQL schema trước.

## 5. Chạy bản thử nghiệm

```bash
npm run build
npm run start -- -H 127.0.0.1 -p 3000
```

Cần Nginx HTTPS cho trình duyệt sử dụng cookie phiên production. Mở `https://ten-mien-thu-nghiem/pg-console`.

Đảm bảo chạy **trên subdomain staging**, không thay DNS website GU/Vercel đang phục vụ khách hàng. Ngay cả khi PostgreSQL mới rỗng, các trang GU cũ vẫn gọi Firebase và chưa dùng được nếu tắt Firebase.

## 6. Kiểm thử tối thiểu

1. Đăng nhập đúng/sai, hết phiên, logout, chặn người chưa đăng nhập.
2. Tạo danh mục, khách, sản phẩm, đơn thuê (và xem bảng PostgreSQL thay đổi).
3. Mở 2 trình duyệt, tạo 2 đơn cho **cùng một sản phẩm với thời gian giao nhau**. Một yêu cầu phải bị trả 409. Hai đơn tiếp giáp đúng thời điểm trả/nhận được phép.
4. Chuyển Đã giao → Đã trả; kiểm tra sản phẩm thành `LAUNDRY`.
5. Không chuyển đơn chưa nhận trực tiếp sang RETURNED hoặc đơn RETURNED ngược về PICKED_UP.

## 7. Push branch riêng

```bash
git add src/app/api/pg src/app/pg-console src/lib/pg-* scripts/pg-* db/phase1_auth.sql README-VPS-PG.md package.json package-lock.json
git commit -m "feat: bootstrap PostgreSQL VPS migration"
git push -u origin vps-postgres
```

Dùng branch `vps-postgres` để Vercel production (theo `main`) không tự triển khai bản chưa hoàn chỉnh. Sau khi thay **toàn bộ** API và UI Firebase và test xong mới merge.

## 8. Việc còn thiếu để thành bản GU hoàn chỉnh

Chuyển UI `src/app/page.tsx` đang dùng Firebase Auth sang cookie session; chuyển toàn bộ API Firestore trong `src/app/api/` sang SQL; ánh xạ schema đầy đủ để giữ hành vi, giá theo giờ, ca làm, công nợ, ảnh giao nhận, báo cáo, search, chứng từ riêng tư; viết tests từng luồng; đóng băng dữ liệu và switch DNS sau khi production được xác nhận. **Không xóa GitHub repo hoặc force-push.**
