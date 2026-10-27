# GU v5 Beta 7 — Fix CSS ba client và chẩn đoán Monitoring 403

## Đã xác nhận trong mã nguồn Beta 6

- `globals.css` khai báo `.gu-mobile-bottom-nav` ngoài media query ở cuối file, ghi đè `display:none` trên PC. Trang chính và `/mobile` dùng trùng tên class; `.gu-mobile-brand` cũng trùng giữa hai client.
- Cả API Monitoring và trang Admin đang gộp lỗi Google HTTP 403 vào lời nhắc IAM chung, dù chủ cửa hàng đã xác nhận Monitoring API bật và tài khoản có Monitoring Viewer.
- `Firestore` vẫn đang lưu sản phẩm/khách hàng/đơn bình thường: Monitoring không hoạt động **không phải mất dữ liệu Firestore**.

## Sửa trong Beta 7

1. Điều hướng trang chính: `.gu-main-bottom-nav` chỉ hiện ở chiều rộng `<=850px`.
2. Điều hướng nhân viên mobile: `.gu-staff-bottom-nav` chỉ trong `.gu-mobile-new` và chỉ hiện `<=850px`; nếu mở `/mobile` từ PC thì có `.gu-staff-top-tabs` ở đầu trang để chuyển hai tác vụ.
3. Tách tên class hiển thị thương hiệu nhân viên `.gu-staff-brand` khỏi `.gu-mobile-brand` của trang chính.
4. Thêm `monitoringFailureCategory` nhận biết lỗi Google yêu cầu billing, IAM, API chưa bật, OAuth scope, truy vấn không hợp lệ, thay vì luôn kết luận thiếu quyền.
5. Vercel Logs ghi sự cố dưới `[GU_MONITORING_FAILURE]` với project, metric, HTTP status, Google status, reason và nhóm lỗi. **Không ghi access token, private key hay body phản hồi gốc**.
6. `npm run diagnose:monitoring` chạy độc lập tại Codespaces (nếu `.env.local` sử dụng cùng tài khoản dịch vụ), chỉ xuất kết quả đã lọc an toàn.
7. Tăng phiên bản cache PWA để tránh lưu nhầm tài nguyên cũ.

## Monitoring 403: cách xác định nguyên nhân thật

Đã xác thực rằng Google Cloud Monitoring API bật ở project `gugu-547e3` và IAM chứa Monitoring Viewer. Vì chưa có raw error từ Google/Vercel nên **chưa kết luận nguyên nhân cuối cùng**. Với project Firebase gói Spark, có một trường hợp 403 đáng chú ý: thông báo `This API method requires billing to be enabled` cho truy vấn Cloud Monitoring dùng service-account token. Trường hợp này đã được cộng đồng Google báo cáo nhưng không đồng nghĩa mọi project Spark đều bị 403. Không bật billing chỉ để thử khi chưa hiểu chi phí.

Chạy trên Codespaces (không gửi khóa cho người khác):

```bash
cd /workspaces/Gu
node --version
npm run diagnose:monitoring
```

Nếu nhận `BILLING_REQUIRED`, có thể mở Firebase Console → Firestore → Usage để xem số liệu theo cách chính thức mà không cần tự động bật billing. Nếu nhận `IAM_DENIED`, cần kiểm tra tài khoản dịch vụ đang dùng tại Production/Preview. Nếu `PERMISSION_DENIED_UNKNOWN`, xem bản ghi `[GU_MONITORING_FAILURE]` trong Vercel Logs rồi kiểm tra phản hồi gốc bằng phương thức an toàn trong Google Cloud; không tăng quyền bừa bãi.

Các chỉ số Monitoring có độ trễ và không phải số tiền bị tính phí chính xác. GUI không hiện `0` giả khi thiếu dữ liệu.

## Cài toàn bộ nguồn từ ZIP và chạy test

```bash
cd /workspaces/Gu
# Kiểm tra thay đổi của mình trước khi đè source
 git status
mkdir -p /tmp/gu-beta7
unzip -t GU-v5.0.0-beta.7-FULL-MONITORING-UI-AUDIT.zip
unzip -oq GU-v5.0.0-beta.7-FULL-MONITORING-UI-AUDIT.zip -d /tmp/gu-beta7
SRC=/tmp/gu-beta7/GU-v5.0.0-beta.7
for dir in src public tests scripts docs; do
  test -d "$SRC/$dir" || exit 1
  mkdir -p "$dir"; rsync -a --delete "$SRC/$dir/" "$dir/"
done
for file in package.json tsconfig.json next.config.ts next-env.d.ts firebase.json firestore.rules vercel.json .gitignore .env.example README.md; do
  test -f "$SRC/$file" && cp "$SRC/$file" .
done
nvm use 22
npm install
npm run verify:release
npm run test
npm run typecheck
npm run build
```

Không triển khai Production khi còn lỗi TypeScript/build hoặc chưa thử PC, điện thoại, 3 client, quy trình giao nhận, ảnh so sánh và API. `rsync --delete` có thể ghi đè thay đổi chưa commit trong các thư mục đồng bộ; giữ `.env.local`, dữ liệu khách hàng và backup ngoài Git.

## Triển khai Production sau kiểm thử

Giữ source mới trên nhánh thử nghiệm (ví dụ `test/gu-v5-beta7`) khi kiểm tra. Sau khi commit và đã thử với dữ liệu staging, merge vào `main` rồi `git push origin main` nếu Vercel Production Branch theo dõi `main`.

## Giới hạn đã biết

Chúng tôi không thể gọi Google Cloud Monitoring bằng bí mật thật của cửa hàng trong môi trường đóng gói; không thể khẳng định HTTP 403 đã hết cho tới khi chạy chẩn đoán. Đồng thời không thể bảo đảm mọi màn hình chạy đúng nghiệp vụ mà không có Firebase staging và thử nghiệm browser ứng dụng thực tế; đã kiểm tra cấu trúc CSS, breakpoints và tests mã nguồn.
