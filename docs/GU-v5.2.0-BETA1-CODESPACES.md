# GU v5.2.0 Beta 1 – hướng dẫn nâng cấp Codespaces

## 1. Bản cập nhật có gì?

- **Gợi ý SĐT:** danh sách nổi dưới ô nhập, click chọn khách, không đẩy to popup. Khách trùng số KHÔNG bị tự chọn trước khi nhân viên bấm.
- **Lịch:** thông tin trong ô gồm tên khách → giờ giao–nhận → nhân viên, theo giờ Việt Nam.
- **Đặt lịch trước:** từ ngày mai hoặc nút "Đặt lịch trước" phải thu **100% tổng thuê** ngay khi tạo lịch. Chụp chứng từ chuyển khoản/tiền mặt, đánh dấu đã nhận tiền; backend tính lại giá và ghi sổ quỹ trong transaction Firestore. Không chụp sản phẩm tại bước này.
- **Giao:** nhân viên chụp đủ góc sản phẩm theo cấu hình Admin. Có thể chụp thêm **vật cọc CCCD / tiền / khác** (không bắt buộc mức tiền hoặc loại vật cọc), lưu riêng tư.
- **Nhận trả:** hiện ảnh vật cọc cho nhân viên trao lại. Chụp góc ảnh trả của sản phẩm, nhận trả trong một giao dịch để cập nhật tiền và giải phóng khóa giờ. Sản phẩm cần giặt sẽ ở trạng thái `LAUNDRY` cho đến khi nhân viên xác nhận giặt xong; các món không cần giặt chuyển `AVAILABLE`, món lỗi vào bảo trì, món thiếu vào thất lạc.
- **Thanh toán sau nhận:** popup **không đóng**, hiển thị số còn thu, nút **Thu tiền** (được nhập nếu thu một phần) và **Thu đủ** (auto điền đúng số), phụ thu chỉ dùng khi có phát sinh. Nếu trả đúng giờ và đã trả đủ tiền thuê thì không cần trả thêm.
- **Admin hậu kiểm:** ảnh được đẩy vào danh sách xem; bấm "Đã xem ảnh" chỉ xác nhận đã kiểm tra, không còn là điều kiện hoàn kho. Đơn V5 cũ đang `AWAITING_ADMIN` có nút nhân viên hoàn tất nhận trả cũ (trừ trường hợp cần xử lý hoàn tiền).
- **Hoàn tiền:** Admin xác nhận đã thực sự trả tiền ở bên ngoài (tiền mặt/chuyển khoản) rồi mới ghi REFUND vào sổ quỹ. Đơn đặt trước muốn hủy khi đã thanh toán phải hoàn tiền trước; không tự chuyển tiền qua API.

## 2. Thiết lập riêng cho ảnh nhạy cảm (BẮT BUỘC)

Ảnh cọc tài sản có thể chứa CCCD/giấy tờ. **Không lưu CCCD lên Cloudinary public.** Beta này sử dụng `firebase-admin/storage` / Google Cloud Storage bucket riêng tư.

1. Tạo hoặc chọn một bucket **không public**, tốt nhất riêng cho ảnh GU, bật Public Access Prevention. Không cấp `allUsers` hoặc `allAuthenticatedUsers` trong IAM.
2. Service account Firebase Admin dùng trên Vercel phải có quyền tạo/xem/xóa đối tượng trong bucket này (ưu tiên giới hạn theo bucket).
3. Đặt `FIREBASE_STORAGE_BUCKET=<tên-bucket>` ở **Vercel Environment Variables** và `.env.local` trong Codespaces (không commit secret). Nếu thiếu bucket, chức năng ảnh cọc/ảnh chuyển khoản sẽ báo lỗi 503 một cách có chủ đích.
4. Không bật Firebase Storage Rules công khai cho prefix `gu/secure-evidence/`. Admin SDK chạy qua quyền IAM; ứng dụng xem ảnh qua API có xác thực và trả về `Cache-Control: private,no-store`.
5. Chỉ chụp CCCD khi có căn cứ sử dụng phù hợp và đã thông báo cho khách. Cần thiết lập thời hạn giữ ảnh và quy trình xóa ảnh riêng theo chính sách cửa hàng; bản Beta **chưa có tác vụ xóa tự động cho ảnh cọc/chứng từ**.

Chú ý: tùy tình trạng project và quy định Firebase, Storage có thể yêu cầu bật thanh toán Blaze. Không đổi gói/bật billing nếu chưa xem chi phí.

## 3. Triển khai an toàn

1. Backup Firebase Firestore và source hiện tại. Test với Firebase project staging trước, tránh ghi dữ liệu thật khi thử thu tiền.
2. Dùng ZIP full-source đã giải nén vào root repo Codespaces, giữ nguyên `.git`, `.env.local` nếu đã có.
3. Node 22; chạy:

```bash
npm install
npm run verify:release
npm run test
npm run typecheck
npm run build
```

4. Khi tất cả đạt trên Codespaces, rà soát `git status`, chỉ commit source và tài liệu, **không commit `.env.local`, Firebase Private Key, ảnh chứng từ hay backup**:

```bash
git add -A
git commit -m "GU v5.2: prepayment, collateral photos, instant returns"
git push origin HEAD
```

5. Vercel có đầy đủ `FIREBASE_STORAGE_BUCKET` và biến Firebase Admin; thử nghiệm E2E dưới đây trên Preview deployment trước khi merge nhánh chính.

## 4. Danh sách test thủ công tối thiểu

- Gõ 3 chữ số SĐT → dropdown nhỏ ngay dưới input, chọn đúng khách; modal không nhảy và không tự chọn sai số.
- Bấm ngày mai trên lịch → mặc định đặt trước; không có ảnh chứng từ/không tick đã thu đủ → API từ chối tạo. Chọn chứng từ → tạo được → order.paid bằng order.total.
- Đặt ngay hôm nay bằng Giao ngay → không bắt chụp ảnh trả trước; sau khi tạo mới chụp giao.
- Nhân viên nhận cọc CCCD (có sự cho phép), chụp lên bucket private và nhìn thấy ảnh ở màn trả; thử truy cập trực tiếp bằng URL không đăng nhập phải bị chặn.
- Giao nhận hàng → chụp ảnh trả → kho chuyển LAUNDRY hoặc AVAILABLE tùy cấu hình ngay cả khi Admin chưa xem ảnh; Admin có thể xem và đánh dấu hậu kiểm sau.
- Trả đúng hạn và đã trả đủ → còn phải thu 0; chụp ảnh trả xong popup vẫn mở để xem thông tin.
- Trả trễ → kiểm tra phụ phí tự tính theo giá gói/ngày; nút Thu đủ ghi số còn thu chính xác. Thêm phụ thu cần nhập lý do.
- Bấm Đã hoàn vật cọc → lịch sử đơn ghi người thao tác và thời điểm; không chụp thêm ảnh.
- Đơn hoàn tiền/hủy đặt trước → Admin xác nhận hoàn tiền bên ngoài; thu/hoàn ghi ledger, không trùng khi bấm lại.
- Chạy 2 nhân viên tạo cùng 1 sản phẩm/giờ đồng thời, xác nhận chỉ một đơn đặt lịch thành công.

## 5. Giới hạn và lưu ý

Bản này có kiểm thử logic/kiểm tra cấu trúc. **Chưa được xác minh `npm run typecheck`, `next build`, Firebase/GCS thực tế hoặc tương tác trình duyệt trong môi trường tạo gói** vì không tải được dependency tại đây. Bắt buộc test trên Codespaces trước khi push production. Không sử dụng dữ liệu của khách thật để thử ảnh CCCD.

Các tính năng kế thừa ở Beta 11 và Patch 1 vẫn còn giới hạn như tạo đơn tối đa 12 món và một số danh sách hiển thị phân trang. Những hạn chế này không phải nội dung nâng cấp đợt này.
