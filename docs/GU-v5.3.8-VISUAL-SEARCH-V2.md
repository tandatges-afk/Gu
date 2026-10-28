# GU v5.3.8 Beta 1 — Tìm bằng ảnh V2

## Vấn đề trước đây

GU v5.3.7 so sánh 24 thông số màu và một hash ngắn của **chỉ ảnh bìa**; sau đó bắt buộc hiển thị 12 kết quả, kể cả không có sản phẩm tương tự. So sánh hash cũ dùng điểm kề nhau làm nhiều ảnh khác nhau ra hash gần giống.

## Những thay đổi

1. Descriptor V2 so sánh histogram màu, độ sáng, tỉ lệ vật thể, bố cục 4×4, hướng cạnh, hash lấy mẫu trên toàn vật thể và màu trung bình. Ảnh có nền gần như đơn sắc được tách nền/căn vật thể trước khi so sánh.
2. Lập chỉ mục **tối đa 5 ảnh tham chiếu/sản phẩm**, lấy độ lệch nhỏ nhất giữa các góc chụp.
3. Không ép hiện đủ 12 món. Mặc định tối đa 6 món, áp dụng ngưỡng khoảng cách tuyệt đối và khoảng cách với ứng viên tốt nhất. Có tùy chọn **Mở rộng** để tìm những ảnh khác góc nhưng vẫn lọc kết quả quá khác.
4. Có bộ lọc danh mục. Với máy ảnh, phụ kiện, áo dài có màu/tư thế gần nhau, chọn danh mục giúp tránh đối chiếu sai loại sản phẩm.
5. Tìm ảnh chỉ tải đặc trưng số; ảnh sản phẩm chỉ tải cho vài kết quả phù hợp. Không thay đổi dữ liệu thuê/đặt, công nợ hoặc chứng từ nhạy cảm.
6. Ảnh nhập kho mới được lập chỉ mục V2; ảnh cũ phải lập lại V2 bằng thao tác Admin.

## Bắt buộc sau khi nâng cấp

- Admin mở **Tìm bằng ảnh → Lập chỉ mục ảnh cũ**, chờ hết lượt và xem tổng số ảnh bị lỗi. Có thể chạy lại nếu gián đoạn. Công cụ này chỉ đọc ảnh sản phẩm Cloudinary công khai và lưu đặc trưng tại bản ghi hàng tồn; **không xóa ảnh**.
- Nếu một ảnh lỗi CORS/không có URL Cloudinary hợp lệ, tải ảnh sản phẩm lên lại rồi thử chạy lại. Người dùng không có quyền Admin không được lập chỉ mục.
- Chọn đúng danh mục, chụp món đầy đủ (không chỉ một phần), đủ sáng, nền ít chi tiết. Nếu không có kết quả, thử **Mở rộng** rồi đối chiếu mã/màu bằng mắt.
- V2 là **so khớp hình ảnh bằng đặc trưng toán học**, chưa phải nhận dạng AI embedding CLIP. Không thể bảo đảm đúng khi ảnh chụp hoàn toàn khác góc, có người mặc, bị che khuất, hoặc hai đồ cùng màu/dáng. Muốn nâng lên nhận dạng ngữ nghĩa tốt hơn cần model image embedding chuyên dụng, cấu hình hosting và tập ảnh kiểm chứng thực tế.
- Bộ ngưỡng mặc định được kiểm tra bằng test đơn vị, **chưa được hiệu chỉnh bằng ảnh thật của cửa hàng**. Khi thử staging, ghi lại ảnh đúng, ảnh sai và kết quả không thấy để tinh chỉnh ngưỡng trước khi bật cho nhân viên.

## Kiểm thử

```bash
npm run verify:release
npm test
npm run typecheck
npm run build
```

Không cần Firebase migration. Dữ liệu chỉ mục V1 vẫn được giữ để tương thích nhưng **không dùng trộn vào V2**, tránh so sánh sai phiên bản.
