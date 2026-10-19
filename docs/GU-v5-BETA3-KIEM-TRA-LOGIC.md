# GU v5.0.0 Beta 3 — Biên bản rà soát và bản sửa logic

**Tình trạng:** mã nguồn Beta, chưa được xác nhận vận hành trên Firebase/Cloudinary/Vercel thật. Bản gốc rà soát: `GU-v5.0.0-beta.2-CAMERA-RETENTION-FULL.zip`, không phải mã nguồn đang chạy trên GitHub của cửa hàng (trừ khi GitHub đã cập nhật đúng bản đó).

## 1. Lỗi đã xác định và sửa

1. **Quyền hủy/xóa:** `CANCEL` v5 và legacy chỉ Admin; `VOID`, duyệt trả và đối soát phí máy quá hạn chỉ Admin; các nút hủy của nhân viên được ẩn. Thanh toán và chỉnh đơn vẫn dành cho nhân viên PC theo quyền cũ. Mobile chỉ truy cập API được cấp quyền.
2. **Giao sớm:** giao trước giờ dự kiến phải kiểm tra trùng và thêm khóa khoảng giờ thực tế bằng Firestore Transaction trước khi lưu. Cập nhật `pickupAt`, `scheduledPickupAt` và giữ thời điểm giao thật; khi hủy/duyệt trả, khóa giờ được giải phóng. Nếu đã có đặt chỗ trong khoảng giờ giao sớm, trả lỗi 409 rõ ràng.
3. **Máy ảnh trả >48 giờ:** Admin có thể duyệt kiểm nhận vật lý mà không bịa giá trễ. Tiền thuê hiện có tạm giữ mức đã chốt; `cameraLateFeePending=true` và `cameraLatePendingItemIds` đánh dấu chờ quyết toán, công nợ vẫn thể hiện cả khi tiền dự kiến đã thu đủ. Chỉ Admin được nhập khoản phí trễ thủ công (có thể 0đ) với lý do; ghi riêng `lateFeeTotal` và audit. Trước khi quyết toán, hệ thống không cho đánh dấu thu tiền cuối cùng. **Đây chưa phải giá trễ máy ảnh tự động**.
4. **Hàng có vấn đề:** nhân viên chụp nhận phải ghi chú nếu `ISSUE` hoặc `MISSING`; Admin duyệt sẽ đặt **Bảo trì** với bất kỳ món `ISSUE` (kể cả quần áo), không cho về kho sạch chỉ nhờ bấm `Đã giặt`.
5. **Bảo mật Mobile:** API chi tiết đơn không trả số điện thoại, tổng tiền, khoản thu, giá trị đền bù hoặc toàn bộ dữ liệu sản phẩm cho tài khoản Mobile; vẫn giữ ảnh/đặc điểm/mã sản phẩm và tên nhân viên để đối chiếu.
6. **Tìm bằng ảnh:** chọn một kết quả giờ mở hồ sơ đối chiếu và nút sao chép mã. Đây chỉ là so màu/bố cục, **không phải AI**, chỉ khảo sát tối đa **150 ảnh**; không cam kết tìm đúng trên 2.000 sản phẩm.
7. **Ảnh giao bổ sung:** không được sử dụng lại URL ảnh của một món đã giao trong cùng đơn cho một món khác.
8. **Hàng đợi xóa ảnh:** xóa job cũ đã nằm lại trong 7 lượt phải giữ, và chuyển job lỗi xuống cuối hàng để những job khác có thể chạy. Cloudinary phải xác nhận xóa trước khi xóa liên kết Firestore. Không cam kết xóa cache/backup của nhà cung cấp ngay lập tức.
9. **TypeScript:** bỏ khai báo `category` trùng trong `InventoryItem`; giữ `category` của dòng đơn. Các nhập tiền, Firestore quota/Cloudinary monitoring từ v4.2 vẫn được giữ.

## 2. Luồng nghiệp vụ cần thử trực tiếp (bắt buộc trước Production)

- **Admin/PC:** tạo các đơn khác khung giờ cho cùng một món; hai nhân viên đặt trùng cùng lúc, một yêu cầu phải nhận 409; kiểm tra khách có công nợ.
- **Mobile:** tài khoản `staff_mobile` không thể tạo/hủy/thu tiền; mở đơn có thể chụp đủ các góc Admin đã tạo; nhân viên giao và nhận được ghi UID và tên.
- **Giờ giao:** đặt 10:00, giao 09:30; thử có/không có đơn khác từ 09:30–10:00. Giờ tính tiền phải bắt đầu từ 09:30 và khóa trước 10:00 phải được giải phóng khi đóng đơn.
- **Thiết bị:** 4 EOS R50 + 1 M50, từng serial riêng; kiểm tra đúng các bậc 3h, 6h, 24h, 48h. Quá 48h: duyệt ảnh vật lý thành công, dòng công nợ *Chưa chốt phí trễ* hiện rõ; Admin chốt thủ công có giải trình rồi mới thu tiếp.
- **Có vấn đề:** ảnh nhận `ISSUE` của quần áo phải vào Bảo trì, không được về AVAILABLE sau bấm giặt. Thiếu đồ tính đền bù theo giá Admin cấu hình.
- **Ảnh:** mỗi món làm 8 lượt giao–nhận hoàn chỉnh (không tính lượt thiếu ảnh); lượt 1 được đẩy xóa, chỉ còn 2–8 sau khi tác vụ xác nhận. Giả lập API Cloudinary lỗi và xác nhận hàng chờ được thử lại.
- **Đơn cũ:** giao/nhận đơn v4 theo nghiệp vụ cũ; không tạo mới bằng API cũ; v5 không trùng khoảng đã khóa bằng v4.

## 3. Những giới hạn CHƯA giải quyết

- **Chưa có AI tìm ảnh trên toàn bộ kho:** thuật toán ảnh hiện tại dùng trình duyệt, so sánh tối đa 150 ảnh. Cần bước tạo embeddings + lập chỉ mục và đo độ chính xác riêng cho 2.000 món.
- **Ảnh giao/nhận chưa riêng tư tuyệt đối:** URL ảnh Cloudinary có thể truy cập khi ai đó có URL. Không dùng làm bằng chứng nhạy cảm trên Production trước khi có private delivery/authorization. Cần quyết định cơ chế truy cập và thời hạn lưu ảnh.
- **Chưa chạy E2E thực trên staging:** không có quyền Firebase, Cloudinary hay tài khoản Vercel thật trong môi trường đóng gói.
- **Chưa kiểm chứng Next.js production build:** môi trường này không truy cập được npm registry. Các test chạy trên Node 22 không thay thế `next build`.
- **Quy định tăng giá quần áo mới có đến 30 chu kỳ**, máy ảnh chưa có biểu phí tự động quá 48h; trên 30 ngày cần Admin xử lý ngoài luồng.
- **Thống kê tài nguyên và tối ưu 5 năm** vẫn phụ thuộc cấu hình Cloud Monitoring, số liệu thực và kế hoạch lưu trữ.

## 4. Kiểm tra trong Codespaces (Node 22)

Sau khi tạo nhánh từ `main`, upload ZIP full và đồng bộ mã nguồn vào nhánh test như các bản trước. **Không áp dụng trên nhánh `main` ngay.**

```bash
nvm install 22
nvm use 22
npm install
npm run verify:release
npm run test
npm run typecheck
npm run build
npm run dev
```

Kiểm tra Firestore staging, Cloudinary staging riêng trước khi chạy thử tác vụ xóa ảnh. `npm audit` nếu npm cảnh báo, tránh `npm audit fix --force` khi chưa review breaking changes. Không commit `.env.local`, service-account JSON hay dữ liệu khách hàng. Chỉ merge vào `main` sau khi build và toàn bộ kiểm thử thủ công thành công.
