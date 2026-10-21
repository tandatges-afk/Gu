# GU v5.4.0 — Firestore Read Optimization

## Mục đích

Giảm số lượt đọc tài liệu Firestore mà không thay đổi tính nhất quán khi tạo đơn, khóa lịch, trả hàng, đối soát hoặc phân quyền ca. Các kết quả tra cứu có thể trễ tối đa vài chục giây; quyết định **tạo đơn** vẫn dùng **transaction đọc khóa mới nhất**, không dùng cache.

## Những thay đổi

- **Phiên:** Xác thực Firebase và kiểm tra ca ở mỗi API; dữ liệu `staff`/`shiftWeeks` được gom các yêu cầu đồng thời, cache mỗi instance 12 giây. Browser kiểm tra dự phòng 180 giây/lần, đồng thời hẹn giờ chính xác đến `allowedUntil`; quyền làm việc có thể bị từ chối trên API trước khi UI tự logout.
- **Lịch:** Thay nhiều trăm lần `getAll` khóa trống bằng 2 query khoảng `documentId`/sản phẩm, đọc các khóa có thật. Cache danh sách khóa và đơn 25 giây ở máy chủ; bộ nhớ không chia sẻ giữa instance Vercel.
- **Tìm ngày trống:** Dùng cùng API truy vấn sparse, cache 20 giây. Không dùng để xác nhận đặt trước.
- **Dashboard:** Tải toàn bộ lần đầu và sau thao tác ghi bằng `bootstrap?fresh=1`. Đồng bộ phần thay đổi (đơn có `updatedAt`, sản phẩm có `updatedAt`, khách mới, sản phẩm thuộc đơn vừa đổi) mỗi 3 phút. Tải lại đầy đủ sau 30 phút để phục hồi dữ liệu legacy và số liệu tổng. Không có đảm bảo realtime tuyệt đối; thao tác đặc biệt nên bấm Làm mới.
- **Công nợ:** API `debts` trả 100 dòng ledger/trang; tổng theo `AggregateField.sum/count`, cache tổng hợp 2 giây để tránh hiện số tiền cũ. UI có nút tải trang tiếp theo. Số tổng là toàn bộ ledger, nhưng danh sách/bộ lọc chỉ áp dụng các trang đã tải. Không thay đổi index/tiền.
- **Báo cáo:** `reports?mode=day|month|year` truy vấn ngày tương ứng (14 ngày/12 tháng/5 năm), cache 120 giây. Vẫn dùng `cashDaily`, `cashHistoryDaily` tổng hợp theo ngày, không quét đơn thuê.
- **Quan sát:** Admin → Hệ thống → Firestore API Reads, hoặc `GET /api/system/read-metrics`. Chỉ thống kê những API đã instrument; **ước tính tài liệu** không phải số tính phí; báo cáo theo instance có thể reset sau cold start. Bật `GU_READ_DIAGNOSTICS=1` để ghi một dòng thống kê gọn trong Vercel logs cho mỗi endpoint đã instrument.

## Điều kiện tiên quyết

1. Sao lưu Firebase / repo và thử trên Vercel Preview trước Production.
2. Giữ nguyên Firebase, Cloudinary và bucket hình riêng tư; không thay đổi Firestore Rules.
3. Giữ nguyên `GU_SHIFT_ENFORCE_FROM=2026-10-26` (hoặc ngày bắt đầu áp dụng lịch ca hiện tại).
4. Tạo chỉ mục Firestore cần thiết cho `SUM(outstanding)` bằng `firebase deploy --only firestore:indexes` sau khi đăng nhập Firebase CLI và xác minh đúng project; file định nghĩa là `firestore.indexes.json`. Nếu dự án đã có các chỉ mục tùy chỉnh khác, **hợp nhất vào file trước khi deploy**, tránh xóa chỉ mục cũ. Đợi trạng thái `Enabled` trong Firebase Console rồi thử tính công nợ.
5. Chạy `npm install`, `npm run verify:release`, `npm run test`, `npm run typecheck`, `npm run build` trên Codespaces. **Không deploy nếu typecheck/build thất bại.**
6. Đo Firebase Console → Firestore → Usage trong ít nhất 24–48 giờ, so với cùng số nhân viên/khối lượng đơn trước đó; không có cam kết Reads sẽ dưới 50K/ngày.

## Các giới hạn và chú ý

- Cache Node memory không chia sẻ giữa Vercel instances; không thay thế Redis / persistent cache nếu mở rộng lớn.
- Tổng công nợ `SUM/COUNT` vẫn tiêu thụ chi phí index entry theo Firestore; không miễn phí tuyệt đối.
- Delta chỉ chắc chắn nhận các thay đổi có timestamp đúng quy ước; thay đổi legacy thiếu `updatedAt` có thể đợi lượt tải toàn bộ 30 phút. Sản phẩm đổi trạng thái qua một đơn mới được bổ sung qua item ID của đơn thay đổi.
- Kết quả lịch/tìm đồ trống có thể cũ tối đa 20–25 giây; nếu 2 người chọn đồng thời, transaction sẽ xử lý xung đột.
- Truy vấn `SUM(outstanding)` có thể yêu cầu composite index `kind + outstanding`, đã đưa vào `firestore.indexes.json`; phải triển khai và đợi index sẵn sàng trước khi thử công nợ. Nếu Firebase báo cần index bổ sung, dùng liên kết trong log để thêm.
- Dữ liệu công nợ chuyển sang phân trang nên số khách/đơn đang nhìn thấy chưa phải toàn bộ danh sách; số tổng đầu trang là toàn bộ theo chỉ mục.

## Kiểm thử nghiệp vụ sau deploy Preview

1. Hai nhân viên chọn cùng món cùng khung giờ: chỉ một đơn được chấp nhận.
2. Hai nhân viên chuyển ngày và tìm ngày trống: trả kết quả đúng; sau khi tạo đơn, chờ tối đa 25 giây/nhấn tải lại, lịch phản ánh cập nhật.
3. Nhân viên ngoài ca bị từ chối API; nhân viên trong ca làm được; kết thúc ca cuối + 15 phút phải logout; hai ca liên tiếp không bị cắt phiên giữa ca.
4. Tạo đơn/thu tiền/trả hàng: công nợ và sổ quỹ khớp; nút Tải thêm trong Công nợ hoạt động.
5. Đổi chế độ báo cáo 14 ngày/12 tháng/5 năm; giá trị khớp đối soát cũ, đặc biệt ngày có hoàn tiền.
6. Trong Hệ thống, đọc số lượng call và Reads ước tính; so sánh đồ thị Usage thực ở Firebase để xác định endpoint chưa được instrument.

## Push từ Codespaces

```bash
unzip -o GU-v5.4.0-FULL-CODESPACES.zip -d .
npm install
npm run verify:imports
npm run verify:release
npm run test
npm run typecheck
npm run build
# Nếu TẤT CẢ đạt:
git add -A
git commit -m "GU v5.4.0 Firestore read optimization"
git push origin main
```

Các tệp `.env.local`, `.git`, token Firebase không nằm trong ZIP.

**Lưu ý chi phí:** Firestore tính phí Reads theo số tài liệu và index entries thực tế. Thống kê cache/máy chủ chỉ dùng để tìm điểm nóng; không bảo đảm mức dùng dưới 50K Reads/ngày hay miễn phí. Nguồn đối soát cuối cùng là Usage của Firebase Console.
