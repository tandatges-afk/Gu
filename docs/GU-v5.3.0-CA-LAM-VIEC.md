# GU v5.3.0 Beta 1 — Hướng dẫn đăng ký ca và triển khai

## Quy tắc
- Giờ Việt Nam (Asia/Ho_Chi_Minh): ca S1 08:00–13:00 (5 giờ); S2 13:00–18:00 (5 giờ); S3 18:00–22:00 (4 giờ).
- Mỗi ca tối đa 2 nhân viên. Một người có thể đăng ký cả 3 ca cùng ngày.
- Mở tự đăng ký **Chủ nhật từ 12:00 đến trước 20:00**, cho **thứ Hai đến Chủ nhật tuần kế tiếp**.
- Khi gửi lịch, nhân viên phải chọn **ít nhất 5 ngày khác nhau** (không phải 5 ca) trong tuần. Không thể lưu lịch 1–4 ngày.
- Chỉ giữ chỗ khi Firestore transaction thành công. Hai nhân viên lưu gần như cùng lúc không được giữ quá 2 chỗ; người bị hết chỗ được báo lỗi để chọn lại.
- Có thể thay đổi lịch trong khung đăng ký, nhưng lịch sửa vẫn phải >=5 ngày. Nếu bỏ một ca, người khác có thể đăng ký chỗ vừa trống.
- Nhân viên chỉ có quyền xử lý dữ liệu trong ca đã đăng ký và 15 phút sau khi kết thúc ca. Nếu làm ca tiếp ngay liền kề sẽ không bị đăng xuất giữa hai ca. Nếu ca sau cách xa, phải đăng nhập lại khi ca sau bắt đầu.
- Không thể mở phiên đăng nhập mới trong 15 phút ân hạn (chỉ phiên đã xác thực trước khi kết thúc ca được thao tác nốt). Sau khoảng 15 phút cuối ca, trình duyệt kiểm tra 20 giây/lần và đăng xuất. Nếu tắt trình duyệt, server cũng chặn ngay yêu cầu API sau thời gian cho phép.
- Ngoài ca, chỉ trong khung giờ Chủ nhật nhân viên mới được xác thực để **vào riêng màn đăng ký ca**; các API đơn hàng, khách hàng, tài chính, kho vẫn bị từ chối.
- Admin không bị áp giới hạn ca, đăng nhập duy trì bằng Firebase Auth persistence của trình duyệt (phụ thuộc phiên, chính sách Firebase, đăng xuất thủ công hoặc xóa dữ liệu trình duyệt; không đảm bảo không bao giờ phải đăng nhập lại).

## Nguồn dữ liệu
- `shiftWeeks/{YYYY-MM-DD}`: một document cho cả tuần; `seats` gồm 21 ô ca, mỗi ô tối đa 2 thành viên `{uid,name,registeredAt}`. Backend sử dụng Firestore transaction đọc-ghi duy nhất document này để chống vượt số chỗ.
- `auditLogs`: ghi lịch sử mỗi lần thay đổi đăng ký.
- Firestore Rules vẫn deny client writes; tất cả yêu cầu được xác thực tại server qua Firebase Admin.
- `staffUser()` hiện kiểm tra ca trên tất cả API sử dụng helper chung. `/api/v5/session` và `/api/shifts` được cho phép qua cổng đăng ký giới hạn; cron đã có `CRON_SECRET` riêng.

## Triển khai **tránh khóa toàn bộ nhân viên ngay giữa tuần**
1. Sao lưu Firestore, deploy bản này trên Vercel Preview và đăng nhập thử bằng Admin.
2. Khi deploy trong tuần trước Chủ nhật đăng ký đầu tiên, đặt biến server `GU_SHIFT_ENFORCE_FROM=2026-10-26` (ví dụ cho tuần 19–25/10/2026). Ngày cắt sang chính sách **phải là thứ Hai**. Biến này chỉ hoãn kiểm tra ca, không thay đổi khung giờ đăng ký.
3. Chủ nhật 25/10/2026 từ 12:00–20:00, nhân viên đăng nhập GU, chọn ít nhất 5 ngày cho tuần 26/10–01/11, rồi nhấn **Xác nhận đăng ký**. Admin kiểm tra trang Đăng ký ca để phát hiện nhân viên còn thiếu đăng ký.
4. Đến thứ Hai 26/10, hệ thống tự áp kiểm tra ca cho nhân viên; Admin không bị ảnh hưởng. Sau khi toàn bộ nhân viên đã đăng ký, có thể giữ ngày cắt hoặc xóa biến; xóa biến khi đang chạy sẽ khiến chính sách có hiệu lực lập tức.
5. Nếu không dùng `GU_SHIFT_ENFORCE_FROM`, ngay lúc deploy nhân viên **chưa đăng ký lịch tuần hiện tại** không thể truy cập nghiệp vụ (Admin vẫn vào được). Không triển khai trực tiếp giữa tuần nếu chưa chuẩn bị lịch.

## Kiểm thử nên chạy trong Codespaces
```
npm install
npm run test
npm run verify:release
npm run typecheck
npm run build
```

Kiểm thử thủ công trên Vercel Preview với Firebase staging:
- Admin vào được ngày không có ca; nhân viên không có ca bị từ chối.
- Nhân viên chưa có ca chỉ vào được màn chọn lịch trong Chủ nhật 12–20; không vào được API `/api/bootstrap`, `/api/orders`, `/api/uploads`.
- Hai tài khoản nhân viên đăng ký cùng ca đang còn một chỗ: chỉ một người thành công.
- 5 ca cùng một ngày bị từ chối; 5 ngày khác nhau được chấp nhận.
- Nhân viên trực 13–18 được hoạt động tới 18:15, sau đó bị chặn; nếu trực liền 18–22 không bị đăng xuất lúc 18:15.
- Cuối ca kiểm tra logout cả khi tab còn mở và khi request API mới sau mốc 15 phút.

## Hạn chế và chính sách nhân sự
- Tổng chỗ một tuần là 7 ngày × 3 ca × 2 = **42 lượt ca**. Nếu yêu cầu mỗi người đi ít nhất 5 ngày, trên 8 nhân viên rất khó/không thể phân đủ ngày nếu mỗi ca chỉ 2 người (42 / 5 = 8.4); Admin cần điều chỉnh chính sách hoặc tăng chỗ.
- Nếu nhân viên không đăng ký đủ 5 ngày trước 20h, họ sẽ không có lịch và không được vào hệ thống khi không có ca. Admin cần xử lý thủ công lịch thiếu/đặc biệt; bản beta chưa có công cụ cấp ca ngoài giờ cho Admin. Không tự động gán ca hoặc lén tăng giới hạn 2 người.
- Chưa chạy integration test trên Firebase emulator, test multi-user browser hoặc production build trong môi trường này nếu không có dependencies. Các unit test chỉ xác minh hàm tính thời gian và luật giữ chỗ; không thay thế kiểm thử transaction thực.
