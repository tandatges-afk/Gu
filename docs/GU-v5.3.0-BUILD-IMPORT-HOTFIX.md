# GU v5.3.0 beta.1 — Full source / hotfix thiếu module shift-schedule

## Vì sao phát sinh `Module not found: Can't resolve './shift-schedule'`?

File `src/lib/http.ts` import `src/lib/shift-schedule.ts`. Bản vá TypeScript chỉ gồm `http.ts` và test, **không chứa** module ca làm việc. Nếu chỉ ghi đè bản vá 2 file lên một repo thiếu module, Next.js không tìm được file.

Gói FULL-CODESPACES mới có `src/lib/shift-schedule.ts` và toàn bộ phần đăng ký ca, đồng thời thêm công cụ kiểm tra import trước khi chạy build.

## Cập nhật Codespaces

1. Commit hoặc sao lưu code hiện tại, giữ nguyên `.env.local` và `.git`.
2. Upload ZIP vào **thư mục gốc repo** (nơi có `package.json`).
3. Tại terminal trong thư mục đó, chạy:

```bash
unzip -o GU-v5.3.0-beta.1-BUILD-IMPORT-FIX-FULL-CODESPACES.zip -d .
ls -l src/lib/shift-schedule.ts
npm run verify:imports
npm run verify:release
npm run typecheck
npm run build
```

4. Nếu build thành công, commit và push:

```bash
git add -A
git status --short
git commit -m "Fix missing shift schedule module and validate imports"
git push origin HEAD
```

Lưu ý: file ZIP **không chứa `.env.local`, `node_modules` hay `.git`**; việc giải nén không tự xóa file đó. Tránh thao tác `rm -rf src` trước khi giải nén hoặc chỉ chép `http.ts`.

Nếu `ls -l src/lib/shift-schedule.ts` báo thiếu sau giải nén, bạn đang đứng sai thư mục hoặc đã upload chưa đúng ZIP. Trên Codespaces Linux, chữ hoa/chữ thường trong tên file phải khớp chính xác.

## Kiểm tra an toàn trước khi deploy

- Không deploy nếu `npm run typecheck` hoặc `npm run build` thất bại.
- Nếu đã cấu hình biến Vercel `GU_SHIFT_ENFORCE_FROM=2026-10-26`, giữ nguyên; bản sửa không thay đổi lịch đăng ký ca hay dữ liệu Firestore.
- `npm run verify:imports` kiểm tra đường dẫn import tồn tại, không xác nhận typecheck và build production.
