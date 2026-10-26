# GU v5.5.1 — AI Visual Simplification + Calendar UI

- Chỉ chọn danh mục và ảnh để tìm. CLIP được dùng mặc định; vùng ảnh tham chiếu tự chọn theo loại sản phẩm.
- Giữ bước lọc nhanh giới hạn 60 ứng viên cho danh mục lớn; tính điểm xếp hạng cuối vẫn dùng AI CLIP. Cách này không bảo đảm tìm được mọi sản phẩm cùng mẫu khi kho rất lớn; cần vector index server khi nâng tiếp.
- Dọn phần hướng dẫn dài và tooltip `title` lặp nội dung, giữ `aria-label` cho nút biểu tượng.
- Bộ lọc/điều hướng lịch một hàng trên desktop; mobile cuộn ngang để không vỡ layout.
- Giữ các bản vá Next.js 16 `--webpack` và PWA Vercel asset cache từ các bản vá trước.
- Không thay đổi quy trình cọc hiện tại; KHÔNG có API thu/hoàn cọc ngân hàng.

## Áp dụng patch bằng VS Code Local (Windows)

Giải nén ZIP patch vào thư mục repo `C:\Users\Admin\Desktop\Gu\Gu` và ghi đè đúng các file nằm trong ZIP. Kiểm tra `git diff` rồi chạy:

```powershell
npm.cmd install
npm.cmd run verify:release
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
```

Tạo nhánh dev nếu đang ở main và chưa có nhánh phù hợp. Sau khi tests + build thành công mới git add, commit, push branch. Vercel Preview phải được kiểm tra trước khi merge main.

**Bản patch dựa trên GU v5.5.0 + 2 hotfix trước đó, KHÔNG phải bản đọc trực tiếp từ GitHub.** Đừng ghi đè các file đã có sửa riêng mà chưa đối chiếu.
