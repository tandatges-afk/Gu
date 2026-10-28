# GU v5.4.5 Beta 1 — Gom sản phẩm cùng khách, ưu tiên lịch dày

## Phạm vi

Chỉ đổi thuật toán **hiển thị thứ tự các dòng** trên Lịch cho thuê. Không thay đổi giá, giao/nhận đồ, lịch đã đặt, khóa lịch Firestore, ảnh cọc, tiền thu, thứ tự các cột ngày, màu ô trạng thái hay quy tắc phân quyền.

## Quy tắc ưu tiên

1. Xác định trạng thái cho **ngày đầu tiên của khoảng lịch đang xem** và giữ thứ tự ưu tiên có sẵn: **Trả trễ → Cảnh báo 20h → Đã lấy → Đã giữ → Chưa sẵn sàng → Còn trống** (ngày đã qua xử lý riêng).
2. **Trong cùng trạng thái**, các sản phẩm của cùng một khách được xếp liền nhau; dùng `customerId` (dự phòng số điện thoại đã chuẩn hóa), **không ghép theo tên người**.
3. Khi một sản phẩm **trống vào ngày đầu** nhưng có đặt trước sau đó, sử dụng **đơn hợp lệ gần nhất trong 7 ngày đang xem** để xác định khách cần gom.
4. Sắp xếp các cụm theo **tổng số ô ngày có đơn** trong 7 ngày, nhiều hơn lên trước; trong cụm cũng ưu tiên món có nhiều ngày có đơn hơn. Nếu bằng nhau, xét số đơn khác nhau rồi ngày phát sinh lịch đầu tiên và tên/mã sản phẩm.
5. Đơn `CANCELLED`, `VOIDED`, `RETURNED` không được xem là có lịch đặt đang hoạt động. Nhiều hợp đồng thuê theo giờ trên cùng một ngày được tính là **1 ô ngày có lịch**, rồi mới xét số đơn như tiêu chí phụ.
6. Mỗi lần chuyển ngày đầu hiển thị, thứ tự được tính lại. Không can thiệp và không xóa dữ liệu đơn hàng.

### Ví dụ

Xem từ **01/01** đến **07/01**:

- G001 có lịch 01–05/01 → **5 ô ngày**
- G002 có lịch 01–03/01 → **3 ô ngày**
- G003 có lịch 02–03/01 → **2 ô ngày**
- G004 có lịch 02/01 → **1 ô ngày**

Kết quả: **G001 → G002 → G003 → G004**. Trong ví dụ trên, G001/G002 thuộc nhóm `Đã giữ` ngày 01/01 và G003/G004 thuộc nhóm `Còn trống` ngày 01/01.

Nếu G003 và G004 cùng một khách thì chúng được gom liền nhau. Nếu một món của khách X `Đã lấy` nhưng món khác `Đã giữ`, thứ tự trạng thái được giữ ưu tiên trước: không trộn hai trạng thái chỉ để gom khách.

## Giới hạn

- GU hiện phân trang kho ở **25 sản phẩm/trang**, thuật toán sắp xếp trong trang đang xem, **không xuyên các trang chưa tải**. Khi tìm kiếm/lọc, thứ tự áp dụng trên kết quả có sẵn trong trang.
- Nếu một món có đơn của nhiều khách trong cùng tuần, chọn đơn đang hiển thị ở ngày đầu; nếu ngày đầu trống thì chọn đơn hợp lệ **sớm nhất** trong 7 ngày để ghép nhóm, không cố ghép một món vào nhiều nhóm.
- Màu trạng thái và chức năng bấm mở chi tiết không thay đổi.

## Triển khai

```bash
cd /workspaces/Gu
unzip -o GU-v5.4.5-beta.1-CALENDAR-CUSTOMER-WEEK-SORT-FULL-CODESPACES.zip -d .
npm install
npm run verify:release
npm test
npm run typecheck
npm run build
```

Chỉ push sau khi các bước trên thành công. Thử trên Vercel Preview với nhiều sản phẩm của cùng khách, các đơn hôm nay trống/ngày mai giữ và các trường hợp giao/nhận quá hạn.
