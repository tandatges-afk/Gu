# GU Fix20 Integrated — Full Source (Rev5, kiểm tra bổ sung)

Đây là **toàn bộ mã nguồn**, không phải bản vá `.patch`. Được dựng từ nhánh GitHub `main` ở commit **a076693d4baf7f2d09992e5c97bb8d6d355159f9** và bản Fix20 Rev4 do người dùng xuất trực tiếp từ GitHub, có kiểm tra các file khác biệt.

## Bản này sửa thêm điều gì?

- Bổ sung `tests` và `scripts` vào manifest kiểm tra nguồn. `source:check` phát hiện file thừa trong cả `src`, `tests`, `scripts` thay vì chỉ `src`.
- `source:prune` chỉ **chuyển** các file dư trong ba thư mục kể trên sang thư mục backup bên cạnh repo, không xóa vĩnh viễn, không động đến `.git`, `.env`, database hay ảnh.
- Có thêm test tái hiện trường hợp `tests/logic.test.ts` và script cũ còn lại sau `robocopy /E`.
- Có script `CAI-FIX20-VA-KIEM-TRA.ps1` cài vào **worktree Git mới** và dừng khi test/build lỗi. Không đẩy GitHub tự động.

## Cài mã nguồn trên Windows (không cần `.patch`)

1. Giải nén ZIP vào một thư mục độc lập, ví dụ `C:\Users\Admin\Downloads\GU_FIX20_INTEGRATED_VERIFIED`.
2. Đảm bảo `GU-MAIN-READY` có Git remote `origin` và nhánh `main` của GitHub vẫn ở commit nói trên. Không cần đổi nhánh đang sử dụng.
3. Mở PowerShell ngay trong thư mục vừa giải nén, chạy:

```powershell
powershell -ExecutionPolicy Bypass -File .\CAI-FIX20-VA-KIEM-TRA.ps1
```

Script tạo thư mục `C:\Users\Admin\Desktop\GU-FIX20-INTEGRATED-VERIFIED` trên nhánh `gu-fix20-integrated-verified`, copy mã nguồn và tự chạy `npm ci`, `verify:release`, `typecheck`, `test`, `test:vps`, `build`. Khi một bước lỗi, script **dừng ngay**, chưa commit/push.

**Nếu đã có nhánh hoặc thư mục đó:** không xóa nó. Có thể chỉ định một tên và đường dẫn mới bằng tham số `-Branch`, `-WorktreePath`.

**Chỉ sau khi hoàn thành tất cả kiểm tra:**

```powershell
cd "$env:USERPROFILE\Desktop\GU-FIX20-INTEGRATED-VERIFIED"
git status -sb
git add -A
git diff --cached --check
git diff --cached --name-only
# Xác minh không có .env, mật khẩu, ảnh khách hoặc backup database trong danh sách.
git commit -m "GU Fix20 integrated rev5 - source and test guard"
git push -u origin gu-fix20-integrated-verified
```

Không Force Push, không merge `main` và không deploy Production tự động.

## Kiểm tra đã thực hiện

- Các unit/source tests có thể chạy không cần dịch vụ bên ngoài.
- Các test kiểm tra cấu trúc PostgreSQL/VPS chạy độc lập.
- Kiểm tra import nội bộ và cú pháp TypeScript/TSX.
- Kiểm tra cú pháp shell của các script Bash.
- Kiểm tra file ZIP và hash SHA-256.

**Chưa thể xác minh:** cài npm đầy đủ và build Next.js trong môi trường đóng gói, database PostgreSQL thực tế, thao tác nhiều nhân viên trên staging, backup/restore ngoài VPS và kiểm thử giao diện trên máy/điện thoại. Những bước này là điều kiện trước khi chấp nhận GU Stable 1.0. Không có cam kết 100% không lỗi trong mọi điều kiện.
