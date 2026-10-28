# GU Fix20 Integrated Rev6 — Full Source

**Đây là toàn bộ mã nguồn để kiểm tra trên staging, CHƯA PHẢI bản đã nghiệm thu Production.**

## Lý do có Rev6

- Giữ nguyên toàn bộ các file từ nhánh GitHub `main` Fix17 tại commit `a076693d4baf7f2d09992e5c97bb8d6d355159f9` và tích hợp mã Fix20 từ `GU_FIX20_FROM_GITHUB.zip`.
- Khóa GitHub Actions: job Production chỉ nhận **workflow_dispatch trên `refs/heads/main`**, đồng thời vẫn yêu cầu biến cho phép và Environment approval trên GitHub, cũng như cờ chặn trên VPS. Review branch KHÔNG thể ra lệnh deploy Production.
- Script PowerShell tự tạo thư mục/nhánh mới nếu bản cũ còn tồn tại, không sửa `GU-MAIN-READY`, không rebase, không merge, không push và không tác động VPS.
- Kiểm tra SHA-256 mọi file mã nguồn được liệt kê trong `REV6-FILE-SHA256.json` trước và sau copy. Nếu bản ZIP thiếu/hỏng, dừng ngay.
- Giữ source guard chống route/test/script cũ còn sót; CI chạy `verify:release`, typecheck, unit tests, VPS tests và Next.js build.

## Cài trên máy Windows

1. Tải **GU_FIX20_INTEGRATED_REV6_FULL_SOURCE.zip** và giải nén vào một thư mục MỚI, ví dụ `C:\Users\Admin\Downloads\GU-FIX20-REV6-SOURCE`. Mở PowerShell ngay tại thư mục chứa `package.json` và `CAI-FIX20-VA-KIEM-TRA.ps1`.
2. Chạy:

```powershell
powershell -ExecutionPolicy Bypass -File .\CAI-FIX20-VA-KIEM-TRA.ps1
```

- Script lấy `origin/main` và chỉ chấp nhận commit `a076693d4baf7f2d09992e5c97bb8d6d355159f9` đã tích hợp. Nếu GitHub main đổi, **DỪNG**: cần đối chiếu lại, không force push.
- Tạo worktree mới mặc định ở Desktop `GU-FIX20-REV6-VERIFIED` với nhánh `gu-fix20-integrated-rev6`. Nếu đường dẫn hoặc nhánh đã tồn tại, sẽ chọn hậu tố `-2`, `-3`, v.v.
- Chạy lần lượt: kiểm tra hash → source guard → `npm ci` → `verify:release` → `typecheck` → `test` → `test:vps` → `build` → `git diff --check`.
- Nếu bất kỳ lệnh nào lỗi: **dừng**, không commit/push. Gửi nguyên log lỗi và đường dẫn worktree mà script in ra.

## Sau khi tất cả kiểm tra đạt

```powershell
# Đổi đường dẫn nếu script đã tạo thư mục có hậu tố -2, -3...
cd "$env:USERPROFILE\Desktop\GU-FIX20-REV6-VERIFIED"
git status -sb
git diff --check
git add -A
git diff --cached --check
git diff --cached --name-only
# KIỂM TRA file được stage, không có .env, SSH key, ảnh khách, dữ liệu database

git commit -m "GU Fix20 integrated Rev6 - release gates and source integrity"
git push -u origin gu-fix20-integrated-rev6
```

Nếu script chọn nhánh với hậu tố, dùng tên nhánh đã in ra thay vì cố định `gu-fix20-integrated-rev6`.

**KHÔNG merge main, KHÔNG deploy Production ngay.** Hãy xác nhận CI trên nhánh review → triển khai staging → nghiệm thu hai nhân viên, thanh toán, ảnh, PostgreSQL migration và thử backup/restore trên môi trường độc lập trước.

## Các giới hạn xác minh

Tại môi trường dựng ZIP, bộ test độc lập và kiểm tra source có thể chạy được; việc `npm ci` bị lỗi môi trường npm nên **chưa thể chạy TypeScript typecheck và Next.js optimized build hoàn chỉnh tại đây**. Số test không chứng minh DB lock/chi phí khi vận hành đồng thời, bảo mật thực tế hay đúng UI mobile. Cần máy Windows và staging VPS xác nhận. Không ai có thể xác nhận "100% không lỗi" chỉ từ source và unit test.
