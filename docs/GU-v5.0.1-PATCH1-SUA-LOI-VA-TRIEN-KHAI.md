# GU v5.0.1-patch.1 — Nhật ký sửa lỗi, giới hạn & triển khai an toàn

> Xuất phát từ bản `GU-v5.0.0-beta.11` do người dùng cung cấp. **Đây là bản vá nguồn cần chạy `npm install`, `typecheck`, `build`, và thử trên Firebase staging trước khi triển khai vào kho thật.** Không khẳng định đã kết nối hay chỉnh sửa dữ liệu Firebase/Vercel đang chạy.

## 1. Phân tích lỗi ảnh chụp DevTools

- **400** `/api/catalog?kind=items&size=40&q=d`: xác định trực tiếp trong `src/app/api/catalog/route.ts` cũ, vì code trả HTTP 400 nếu tên tìm kiếm có dưới 2 ký tự. Bản vá hỗ trợ tìm cả **1 ký tự**, đưa các ký tự đơn vào `nameSearchBigrams` và tiếp tục tìm bằng trang dữ liệu.
- **400** ở một số dòng `orders:1` trong ảnh: không có Request URL, payload hoặc response body nên **chưa xác định nguồn**. Mã trả của GET/PATCH/POST khác nhau: mở Network để kiểm tra.
- **500** `POST /api/v5/orders`, phản hồi `{code:"GU_SERVER_ERROR", incidentId:"86d6aa0b"}`: không thể xác định chắc nguyên nhân nếu không có bản ghi lỗi trên Vercel theo mã sự cố. Một nguyên nhân hợp lý phát hiện trong nguồn là các trường không bắt buộc `cameraModel`, `cameraSerial`... nhận `undefined` khi viết nested record Firestore. `src/lib/firebase-admin.ts` bật `ignoreUndefinedProperties`, loại bỏ trường không xác định khỏi payload Firestore. Đồng thời đổi log lỗi `POST /api/v5/orders` và thêm giải thích lỗi cấu hình/undefined.
- **Mã `86d6aa0b` không thể tái sử dụng sau khi deploy** để truy xuất lỗi mới. Vercel Logs > tìm `86d6aa0b` **trong deployment đã phát sinh lỗi cũ**, hoặc tìm incident ID mới sau khi thử trên patch.

## 2. Những sửa đổi có code

### Thanh toán và hoàn tiền

- Khi Admin duyệt nhận trả, backend tính số tiền cần hoàn `max(0, đã_thu_ròng - tiền_thuê_thực_tế - đền_bù - phụ_phí)`.
- Nếu cần hoàn tiền, UI bắt buộc chọn **tiền mặt** hoặc **chuyển khoản** và tick **đã thực sự hoàn tiền bên ngoài hệ thống**; với chuyển khoản bắt buộc có mã giao dịch/nội dung đối chiếu.
- Một transaction Firestore ghi **cashMovements/REFUND**, số `refundTotal` tích lũy, cập nhật `paid` = đã thu ròng sau hoàn, giảm `cashDaily.amount`, tăng `cashDaily.refunds`, và cập nhật công nợ. Tự động cập nhật cùng duyệt trả; giao dịch thất bại không ghi một nửa.
- `PAY` mới cũng ghi `orders/{id}/cashMovements` để Admin tra chi tiết, nhưng các khoản tiền lịch sử trước patch không được tự động chuyển sang sổ phụ. Lịch sử đơn vẫn còn.
- **Không kết nối ngân hàng và không tự động chuyển tiền**. Nhân viên/Admin phải hoàn tiền xong rồi mới xác nhận; tuyệt đối không tick trước.

### Tìm lịch trống theo giờ

- `smart-calendar` so sánh các `v5DayIntervals.entries` theo giao nhau thực tế của khoảng giờ, không coi nguyên ngày là bận nếu chỉ có một lượt sáng. Khóa `rentalSlots` lịch sử vẫn chiếm trọn ngày nhằm giữ tương thích cũ.
- Giao diện thêm `Giờ nhận` và `Giờ trả` (giờ trả tính ở **ngày kế tiếp ngày cuối cùng chọn**). Khi nhấn đặt lịch từ kết quả tìm trống, form v5 dùng cùng khung giờ. Giao dịch tạo đơn sẽ **kiểm tra khóa lại một lần nữa**, kết quả tìm trống không phải khóa giữ chỗ.
- Còn giới hạn an toàn 30 chu kỳ thuê và 40 sản phẩm mỗi trang tra cứu; hiện không hỗ trợ tra cứu toàn bộ kho trong một lần gọi.

### Tìm kiếm, dữ liệu nhiều trang, tìm ảnh

- Từ khóa sản phẩm 1 ký tự không gây HTTP 400. Bổ sung unigrams vào index tìm kiếm; dữ liệu cũ **bắt buộc chạy đồng bộ chỉ mục** (mục 4).
- `/api/catalog` lọc không dấu và có cursor tiếp theo thay vì dừng cứng sau 400 candidates. Mỗi request quét tối đa 1.200 ứng viên để khống chế chi phí, kết quả tiếp tục ở trang sau.
- Đã thêm endpoint lấy món theo ID `GET /api/catalog?kind=items&ids=...` để modal đơn nhận diện món được bấm trên lịch, kể cả món ngoài nhóm preview Dashboard.
- `/api/audit` trả tối đa 100 thao tác mỗi trang và `cursor`; trang Nhật ký có nút **Tải thêm 100 nhật ký**. Dữ liệu cũ không bị xóa.
- Tìm bằng ảnh duyệt nhiều trang thay vì ba trang đầu (150 món). Hiện giới hạn 200 trang x 50 (=10.000) để tránh làm trình duyệt treo; vượt mức này có thông báo, **không có tuyên bố tìm vô hạn hay AI nhận diện**.
- Nguồn `/api/bootstrap` **vẫn dùng snapshot preview 80/30/80** để khởi động nhanh; các trang Kho/Khách/Đơn có API phân trang và số tổng `count()` không dựa vào preview. Đã chuyển tổng **Thu ròng** từ cộng tiền ở 80 đơn sang đọc sổ quỹ (`/api/reports`) và làm rõ phạm vi thống kê mẫu. Việc chuyển mọi widget phụ thuộc dữ liệu đầy đủ sang server-side aggregations vẫn là việc tiếp theo, không nên coi phần này đã xong toàn bộ.

### Luồng cũ, UI và bảo mật

- `POST /api/orders` v4 đã ngừng tạo đơn, trả `410`, giảm nguy cơ có **đơn mới** không theo quy trình chụp ảnh v5. `GET/PATCH /api/orders/[id]` vẫn giữ cho **đơn lịch sử hoặc đơn v4 đang hoạt động** nhằm tránh bỏ rơi hàng/khách/công nợ. Không tự động ép đơn cũ thành đơn mới vì chúng không có góc ảnh/giờ giao chính xác.
- UI tìm kiếm không dấu thống nhất ở màn thêm đồ của v5; trang duyệt trả có giải thích khoản hoàn, checkbox xác nhận và lịch sử thu/hoàn của v5.
- Header bảo mật: `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cache-Control: private,no-store` trên API; không thêm CSP cứng tùy tiện vì có thể làm hỏng Firebase/Cloudinary nếu chưa chạy browser E2E.
- Code nền `src/app/page.tsx` vẫn lớn và chưa tách hết các feature module. Không coi đây là cuộc tái cấu trúc kiến trúc hoàn thành.

## 3. Kiểm thử chạy trong môi trường xử lý ZIP

- Node.js v22.16.0: `node --experimental-strip-types --test tests/*.test.ts` → **182/182 pass**.
- `node scripts/verify-release.mjs` → **63 tệp, 43 chỉ dấu**, pass.
- TypeScript compiler `transpileModule` chạy trên 81 tệp nguồn TS/TSX → **0 lỗi cú pháp**.
- **Chưa xác minh `npm run typecheck` hoặc `npm run build`:** ZIP không chứa `node_modules` / `package-lock.json`, và môi trường không truy cập được npm registry (`EAI_AGAIN`). TypeScript compiler chạy thiếu các type `next`, `firebase-admin`, `react` nên không thể coi `tsc --noEmit` là kiểm thử hợp lệ.
- **Chưa kiểm thử Firestore/Cloudinary thực, browser E2E, hoặc giao dịch đồng thời với hai nhân viên**. Chạy trên Firebase staging trước khi đưa vào thực tế.

## 4. Triển khai từ GitHub Codespaces

**Bước 1: Sao lưu kho thực tế.** Tạo backup Firestore và lưu bản ZIP nguồn đang chạy. Không chạy script data reset xóa dữ liệu, không thay môi trường sản xuất nếu chưa có bản sao lưu.

**Bước 2: Thay nguồn.** Giải nén thư mục `GU-v5.0.1-patch.1`, đưa các thay đổi sang Git repo GU đang dùng, giữ `.env.local` / Environment Variables hiện hành (không thêm secrets vào Git).

**Bước 3: Tạo lockfile / build trên Codespaces có internet:**

```bash
node -v                       # Node 22.x
npm install                   # sinh/duy trì package-lock.json
npm run test
npm run verify:release
npm run typecheck
npm run build
```

**Bước 4: Đồng bộ index cho dữ liệu cũ.** Trên **staging trước**, đảm bảo env Firebase chính xác, sau đó:

```bash
npm run data:plan
npm run data:index-names
# Sao lưu trước khi chạy bước này, dự án mẫu là gugu-547e3:
npm run data:apply-names
```

Script reindex chạy trên project được cấu hình bởi biến môi trường, và yêu cầu chuỗi xác nhận `INDEX-<FIREBASE_PROJECT_ID>`. Với project khác, không được dùng xác nhận gugu-547e3; chạy trực tiếp script với `--execute --confirm=INDEX-<ID thực tế>` và đảm bảo đã backup. Đóng thao tác nhập/sửa sản phẩm trong lúc reindex.

**Bước 5: Deploy staging trên Vercel.** Kiểm tra Firebase Admin service-account, Firebase Web project cùng ID, Cloudinary config, hàm cleanup, cấu hình Cron. Thử checklist ngay dưới. Khi đã đạt mới merge lên nhánh production.

**Bước 6: Mở DevTools Network nếu lỗi cũ còn xuất hiện.** Chọn request đỏ → xem `Request URL`, `Status`, `Payload` và `Response`. Vercel > Logs tìm `[GU_SERVER_ERROR]`, `incidentId` đúng thời điểm. Không chia sẻ Firebase private key, bearer token, cookie, credentials hoặc thông tin khách thật.

## 5. Checklist nghiệm thu trước sản xuất

1. Search kho `d`, `ao`, `xanh`, `ÁO`; trang kết quả không rơi 400, reindex dữ liệu cũ thành công.
2. Có ít nhất một sản phẩm thường (không có `cameraModel`/`cameraSerial`), khách hợp lệ và góc chụp; tạo đơn v5 trả 201, code mới xuất hiện sau reload; không có 500.
3. Hai nhân viên cùng giữ giờ một sản phẩm: chỉ một lần tạo đơn thành công, một lần báo 409.
4. Cho thuê 09–12h và 12–16h cùng ngày: tìm trống theo giờ không chặn sai; khoảng giao nhau thật sẽ bị chặn.
5. Test đặt lịch từ hàng 81 trở đi và sản phẩm từ catalog: form vẫn thấy tên/giá/hình món đã chọn.
6. Test khách trả trước 80.000đ, tổng thực tế còn 50.000đ: nút duyệt buộc hoàn 30.000đ thực tế; kiểm tra `cashMovements`, sổ quỹ trừ 30.000đ, công nợ, lịch sử.
7. Không được cho hoàn lần nữa sau đã hoàn, không cho nhân viên không phải Admin truy cập danh sách thu hoàn.
8. Chụp ảnh giao, nhận; duyệt, giặt, trả; kiểm tra ảnh Cloudinary và nhật ký audit.
9. Nhật ký >200 bản ghi: nút tải thêm hoạt động; thử tìm ảnh ở món vượt nhóm 150 đầu.
10. Test di động iOS/Android, PC Chrome, nhập tiền VND và các nút lịch ở trang nhiều dữ liệu.

## 6. Việc vẫn chưa hoàn tất trong patch này

- Bản refactor chia `src/app/page.tsx` thành nhiều module riêng, kiến trúc tầng service/repository hoàn chỉnh; CSP nghiêm ngặt và Playwright E2E chưa làm.
- Bootstrap preview còn 80/30/80 để giữ hiệu năng; một số báo cáo theo khách/đơn vẫn chỉ xét dữ liệu màn hình đang tải, cần chuyển sang chỉ mục thống kê server đầy đủ.
- Tìm ảnh xử lý tối đa 10.000 candidate trong trình duyệt; với kho lớn cần ANN/vector search server-side. Đây là so khớp màu, không phải nhận diện AI.
- Lệnh sửa tự động lịch sử hóa toàn bộ giao dịch thu từ các đời trước chưa được triển khai; lịch sử cũ vẫn hiển thị trong đơn.
- Các luồng v4 đang mở chưa chuyển sang v5 do khác mô hình ngày/giờ và ảnh. Cần kế hoạch nghiệp vụ khi chuyển dữ liệu; **không được xóa các đơn cũ hoặc rentalSlots**.
- Chưa gỡ giới hạn 12 món/đơn và các giới hạn giao dịch Firestore — cần thiết kế chia batch/đồng bộ trước khi thay.
- Chưa giải quyết mô hình nhiều món vật lý trùng tên hoặc quy trình Admin từ chối ảnh và yêu cầu chụp lại. Đây là 2 hạng mục cần được xử lý riêng cùng migration tương ứng.
- Lỗi 500 cũ chưa được xác nhận nguyên nhân gốc bằng Vercel Logs; bản vá đã xử lý một nguyên nhân hợp lý nhưng cần kiểm chứng trên staging.

**Không chạy migration trên Production hoặc xác nhận hoàn tiền bằng thao tác thử nghiệm. Dùng dữ liệu staging và các khoản thu hoàn giả lập.**
