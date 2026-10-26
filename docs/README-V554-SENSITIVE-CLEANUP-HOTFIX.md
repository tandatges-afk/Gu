# GU v5.5.4 – Sensitive Evidence Cleanup hotfix

## Nguyên nhân
Bản v5.5.4 chuyển ảnh bảo mật mới từ Firebase Storage sang Cloudinary authenticated.
Nhưng `src/lib/sensitive-evidence-cleanup.ts` (còn từ một nhánh trước) vẫn import
`evidenceBucket` từ `secure-evidence.ts`. Export này đã bị gỡ bỏ khi đổi backend,
vì vậy TypeScript báo TS2305.

## Phạm vi bản vá
- Chỉ thay `src/lib/sensitive-evidence-cleanup.ts`. Không sửa dữ liệu Firestore, kho ảnh hay lệnh thanh toán.
- Hỗ trợ metadata **mới** ở `secureEvidenceUploads/{id}.asset` (Cloudinary authenticated).
- Vẫn hỗ trợ metadata Cloudinary **cũ** ở các trường gốc `provider/publicId/format/contentType`.
- Chỉ gọi Firebase Storage nếu ảnh cũ có `path` thực sự; yêu cầu tên bucket cũ tồn tại. Không âm thầm bỏ qua lỗi xóa.
- Giữ nguyên điều kiện duyệt Admin, công việc xóa có thể thử lại và thứ tự xóa ảnh trước khi xóa liên kết Firestore.

## Cách áp dụng trên VS Code Local / Windows
1. Dừng Next.js local. `git status` để biết thay đổi đang có và sao lưu code.
2. Giải nén ZIP vào thư mục dự án `C:\Users\Admin\Desktop\Gu\Gu` và ghi đè duy nhất tệp `src/lib/sensitive-evidence-cleanup.ts`; hoặc chạy `powershell -NoProfile -File .\apply-hotfix.ps1` sau khi giải nén giữ nguyên cấu trúc.
3. Chạy:

```powershell
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
```

4. Nếu đều thành công:

```powershell
git add src/lib/sensitive-evidence-cleanup.ts
git commit -m "fix: Cloudinary authenticated evidence cleanup compatibility"
git push origin HEAD
```

5. Kiểm tra bản Vercel Preview trước khi merge vào Production.

## An toàn dữ liệu
Không sửa `FIREBASE_STORAGE_BUCKET` nếu không có ảnh cũ. Nếu ảnh đã từng nằm ở Firebase, chỉ khai báo chính xác bucket để dọn xóa ảnh **cũ**. Không công khai URL ảnh CCCD hoặc đưa ảnh lên Cloudinary với `type=upload`.

**Giới hạn xác minh:** Đã kiểm tra cú pháp TypeScript của bản vá và kiểm tra hành vi nhánh xóa với mô phỏng, nhưng chưa chạy `npm run build` đầy đủ với repository thực tế của người dùng. Bản vá này chỉ xử lý sai lệch mã của hàm cleanup; những lỗi khác từ các file chưa được đồng bộ trên nhánh hiện tại cần kiểm tra riêng.
