# GU v5.5.0 — AI Visual Search + lọc danh mục + VS Code Local

## Phạm vi

Bản này dựa trên full source **GU v5.4.0 TYPECHECK-HOTFIX** trong cuộc hội thoại. Bổ sung tìm kiếm theo hình ảnh với CLIP, lọc danh mục trực tiếp ở Firestore, so sánh tối đa 3 ảnh của mỗi sản phẩm, chế độ cắt vùng ảnh khách chọn, cache danh mục 5 phút trong `sessionStorage` và cache embedding ảnh sản phẩm trong IndexedDB. **Không tích hợp API ngân hàng, webhook nhận cọc hoặc chi hộ hoàn cọc.** Luồng chụp chứng từ, nhận/hoàn vật cọc và xác nhận thanh toán hiện có được giữ nguyên.

### Vận hành và giới hạn AI

- Người dùng bắt buộc chọn danh mục, ví dụ `Chân váy`, `Váy`, `Áo`, `Quần`, `Phụ kiện` theo danh mục thực sự đã tạo trong GU. Khi chọn **Tất cả**, hệ thống vẫn đọc toàn kho; nên hạn chế.
- So sánh AI là **CLIP `Xenova/clip-vit-base-patch32`** thông qua `@huggingface/transformers` trên **trình duyệt người dùng**. Trong lần chạy đầu máy phải tải mô hình ONNX từ Hugging Face; cần Internet và bộ nhớ đủ lớn. Đây không phải dịch vụ AI trả phí, không cần API key. Safari/iOS cũ hoặc thiết bị ít RAM có thể chạy chậm; dùng chế độ màu cơ bản nếu mô hình không tải được. Việc xử lý AI hiện chạy trên luồng trình duyệt, nên thiết bị yếu có thể khựng giao diện trong lúc phân tích nhiều ảnh.
- Chế độ nhanh sẽ lọc sơ bộ còn 60 sản phẩm gần màu, sau đó AI xếp hạng các sản phẩm trong nhóm; chọn **Quét kỹ toàn danh mục** để tăng khả năng tìm được mẫu khác phông nền/góc chụp, nhưng chạy lần đầu lâu hơn.
- Chọn cắt vùng `Vùng giữa`, `Nửa dưới`, `Nửa trái`, `Nửa phải` với ảnh người mẫu hoặc ảnh ghép. Thuật toán không tự phát hiện biên của trang phục; người dùng chủ động chọn vùng. Không hứa hẹn phát hiện sản phẩm giống hệt 100%.
- Embedding 512 chiều lưu theo URL ảnh Cloudinary ở IndexedDB; khi thay URL sản phẩm sẽ tự tạo embedding mới lần tìm sau. Cache theo trình duyệt, **chưa đồng bộ vector giữa thiết bị**. Thêm/sửa sản phẩm trong GU invalidates danh mục của tab hiện tại; các tab khác cập nhật tối đa 5 phút sau hoặc bấm **Cập nhật danh mục**.
- Ảnh khách được xử lý cục bộ trong trình duyệt; **không** gửi lên Firestore hoặc API GU. Ảnh sản phẩm vẫn lấy từ Cloudinary; cần trình duyệt kết nối Hugging Face để tải mô hình đầu tiên.
- Kết quả trả top 12; điểm cosine tương đồng **không phải xác suất** sản phẩm chính xác.

## Thiết lập máy Windows và VS Code

1. Cài Git, **Node.js 22.x**, VS Code. Kiểm tra `node -v`, `npm -v`, `git --version`.
2. Từ GitHub, **clone repository hiện tại** về ổ máy. Commit/sao lưu bản cũ. Chưa dùng `git clean -fdx`, `robocopy /MIR` hoặc xóa `.git`.
3. Tạo nhánh `git switch -c feature/gu-v5.5.0`.
4. Giải nén bộ mã nguồn vào thư mục repo, giữ **`.git` và `.env.local`**. Dự án này có thể chưa chứa một số commit v5.3.6–v5.3.9 phát sinh riêng trên GitHub; **phải so sánh `git diff` và hợp nhất** nếu muốn giữ các thay đổi đó. Đừng ghi đè nhánh Production nếu chưa đối chiếu.
5. `npm install` để cài mô hình `@huggingface/transformers` (trọng số CLIP tải khi người dùng tìm ảnh lần đầu).
6. `npm run verify:release && npm run test && npm run typecheck && npm run build` trên terminal Windows PowerShell, sau đó `npm run dev` để kiểm tra trên localhost.
7. Thử tìm ảnh ở Chrome, Edge và trên iPhone (đặc biệt tùy chọn cắt). So sánh lượt đọc trong Firebase Console.
8. Nếu đủ điều kiện triển khai: `git add -A`, `git commit -m "GU v5.5.0 AI Visual Search"`, `git push -u origin feature/gu-v5.5.0`, kiểm tra Preview trên Vercel và mới hợp nhất vào `main`.

## Firestore index

`firestore.indexes.json` thêm index `items(category ASC,name ASC)`. Không xóa các index đã có trên Firebase. Trong trường hợp thiếu index, Firestore sẽ trả về đường dẫn tạo index; dùng Firebase CLI theo đúng project ID: `firebase use` rồi `firebase deploy --only firestore:indexes`. Chỉ triển khai sau khi đã kiểm tra và hợp nhất index cũ của dự án thực tế.

## Phát sinh Reads

- Mỗi lượt bấm tìm dùng cache 5 phút nếu tìm lại cùng danh mục trên cùng một tab; mỗi lần cache hết hạn đọc lại số tài liệu thuộc **danh mục được chọn**, không phải toàn kho.
- Khi bấm làm mới danh mục, API đọc mới (server cache tối đa ~30 giây theo phiên bản này). Cache ở Vercel có thể không nhất quán giữa nhiều instance. Không dùng cache này cho đặt hàng, giữ chỗ hoặc thanh toán.
- 100–1.000 ảnh đầu tiên vẫn cần tải từ Cloudinary và chạy CLIP một lần trên từng thiết bị. Thiết bị yếu có thể chọn tìm nhanh 60 sản phẩm hoặc chỉ dùng so sánh màu.

## Bảo mật và giới hạn kiểm thử

- Không đưa `.env.local`, Firebase Admin private key, CCCD, ảnh cọc của khách vào repo.
- Bản ZIP không bao gồm `node_modules` hay bộ trọng số mô hình CLIP.
- Bài test từ source này kiểm tra logic và cấu trúc; `typecheck`/Next build cần thực thi bằng VS Code Local có dependency đầy đủ trước Production.

## Tùy chọn kiểm tra một lệnh trên Windows

Sau khi cài Node 22, ở thư mục GU trong VS Code PowerShell chạy `powershell -ExecutionPolicy Bypass -File .\scripts\check-v55-local.ps1`. Script chỉ cài dependency và chạy kiểm thử/build; **không** tự push, không ghi dữ liệu Firebase.
