# GU v4.2.0 — Quản trị hệ thống, tối ưu vận hành dài hạn

**Bản đầy đủ** nâng cấp từ GU v4.1.4 Full Fix ChevronDown. Giữ nguyên dữ liệu trong Firebase và ảnh gốc trong Cloudinary. Không tạo lại dự án.

## Đã thay đổi

1. **Danh sách theo trang:** `/api/catalog` phân trang 30–50 bản ghi, tra theo tiền tố tên / mã sản phẩm / điện thoại; Kho, Khách, Đơn và form tạo đơn đã kết nối tới tìm kiếm máy chủ. Firestore không phải công cụ tìm kiếm toàn văn: không cam kết tìm mọi chữ ở giữa tên. Bộ lọc phụ sau truy vấn chỉ áp dụng tập kết quả trang hiện tại.
2. **Công nợ:** `debtLedger` chỉ ghi các đơn chưa thu đủ hoặc đơn đặt trước còn khoản dự kiến. Đồng bộ chỉ mục trong transaction tại tạo đơn, nhận hàng, thêm món, gia hạn, thu tiền và trả đồ. Không quét mọi đơn đã hoàn tất khi Admin mở công nợ. Dữ liệu cũ phải chạy script chuyển đổi có checkpoint, nếu chưa xong hệ thống cảnh báo số liệu chưa đầy đủ.
3. **Lịch thuê:** tải 25 sản phẩm/trang; ngày trống từ khóa ngày thuê thực tế của 25 sản phẩm đó, không phụ thuộc 80 đơn gần nhất. Có thể tra thêm trang hoặc nhập đầu tên/mã; tìm đồ trống chỉ kiểm tra tối đa 40 sản phẩm trong mỗi lần tra để tránh quét toàn bộ dữ liệu.
4. **Báo cáo dòng tiền:** khoản thu mới cập nhật `cashDaily/YYYY-MM-DD` (theo giờ Việt Nam) bằng `FieldValue.increment` trong cùng transaction với đơn; báo cáo 5 năm truy vấn khoảng 1.825 bản ghi ngày, không quét 90.000 đơn. Muốn đầy đủ lịch sử trước nâng cấp phải chạy script có `--cutoff` chính xác, tránh đếm trùng.
5. **Cloudinary:** ảnh trong danh sách dùng URL `f_auto,q_auto,c_limit,w_360` mà không sửa ảnh gốc, giảm lưu lượng dữ liệu. Mỗi phiên bản ảnh mới có thể tiêu tốn transformations/derived storage nên hãy giám sát credits.
6. **Sao lưu và giám sát:** có công cụ xuất JSONL từng đợt tại `scripts/backup-firestore.mjs`. Sao lưu chứa dữ liệu cá nhân, nằm trong `.gitignore` và phải giữ ở nơi mã hóa, không public. Đây là công cụ sao lưu thủ công, **không phải sao lưu tự động** và chưa tải ảnh Cloudinary gốc.
7. **Admin → Hệ thống:** Cloud Monitoring số đọc/ghi/xóa + storage, Cloudinary Admin API credits nếu khả dụng, bandwidth/storage/transformations, số bản ghi và đường dẫn Vercel Dashboard. Cảnh báo ở 75% / 90%. Thiếu quyền/metrics thì ghi rõ chưa có dữ liệu; không hiển thị 0 giả.

## Quan trọng: quota và chu kỳ

- Firestore Standard/Spark: 50.000 lượt đọc, 20.000 lượt ghi, 20.000 lượt xóa/ngày; miễn phí 1 GiB dung lượng dữ liệu + chỉ mục. Quota được **Firebase tự reset** khoảng 00:00 Pacific (America/Los_Angeles), không phải 00:00 Việt Nam; trang Hệ thống hiển thị thời điểm quy đổi. Đây không phải tác vụ GU tự động khôi phục quota. Metrics Cloud Monitoring trễ vài phút và không thay báo cáo tính phí.
- Cloudinary Free: 25 credits / cửa sổ 30 ngày trượt; không reset về 0 lúc đầu tháng; dung lượng ảnh tích lũy. 1 credit tương đương khoảng 1 GB storage **hoặc** bandwidth **hoặc** 1.000 transformations (mức phổ biến, điều khoản nhà cung cấp là nguồn chuẩn). Nếu API Admin không trả `credits`, trang để trống, hướng dẫn mở Cloudinary Console.
- Vercel Hobby chỉ cho cá nhân phi thương mại; cửa hàng kinh doanh cần gói/nền tảng phù hợp. Không đảm bảo 0 đồng trong 5 năm.

## Mở quyền xem Firestore trong Admin → Hệ thống

Dùng **Firebase service account** đang có, bảo đảm dịch vụ Cloud Monitoring API đã bật và cấp quyền `Monitoring Viewer` hoặc IAM có `monitoring.timeSeries.list` cho service account của GU. Có thể phải cần quyền quản trị Google Cloud để cấp IAM. Không nhập khóa bí mật trong trình duyệt. Việc cấp IAM có thể bị hạn chế theo chính sách tài khoản; thiếu quyền thì GU vẫn vận hành bình thường nhưng bảng số liệu ghi 'Chưa có dữ liệu'.

Cloudinary Admin API dùng `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` phía **server**; các biến phải có trên Vercel Production. Không chuyển secrets thành `NEXT_PUBLIC_`. Không có credentials thì vẫn có thể đặt thuê/kiểm kho, nhưng báo cáo Cloudinary bị đánh dấu chưa kết nối.

## Triển khai toàn bộ mã nguồn (không dùng patch)

1. Sao lưu nhánh `main` bằng Git tag/branch; sao lưu Firestore khi dữ liệu thật quan trọng.
2. Giải nén ZIP v4.2.0. Chuyển sang nhánh `release/gu-v4.2.0` trên Codespaces, đồng bộ toàn bộ thư mục `src`, `public`, `tests`, `docs`, `scripts` và các tệp cấu hình gốc bằng rsync **sau khi đã đối chiếu thay đổi**. KHÔNG ghi đè `.env.local`; KHÔNG đưa `private-backups` lên GitHub.
3. Chạy `npm install`, `npm run verify:release`, `npm run test`, `npm run typecheck`, `npm run build`; xác minh trên Vercel Preview.
4. Kiểm tra Tạo đơn → Đã giao → Nhận trả → Thu tiền → Công nợ (nợ phát sinh và hết nợ), lịch trống từng sản phẩm, nhân viên, tìm mã sản phẩm, báo cáo và trang Hệ thống Admin.
5. Chỉ merge vào `main` và triển khai Production khi build thành công, đã sao lưu và thử nghiệp vụ.

## Chuyển dữ liệu cũ — cực kỳ quan trọng

**Công nợ:** Bản v4.1.4 lưu các đơn cũ trong `orders`, trong khi v4.2 đọc công nợ ở `debtLedger`. Vì vậy ngay sau deploy, nếu chưa chạy script, **tổng công nợ không đầy đủ**; giao diện sẽ cảnh báo. Trên Codespaces có đầy đủ `.env.local`:

```bash
node --env-file=.env.local scripts/migrate-debt-index.mjs --max=500
```

Chạy tiếp nhiều lần (tùy dung lượng và mức đọc/ghi còn lại của gói Firebase) cho tới `completed=true` ở `systemMigrations/debtLedger-v42`. Script đối chiếu đơn trong Firestore transaction để tránh ghi đè giao dịch thu tiền phát sinh đồng thời. Đây là thao tác Firestore **có dùng lượt đọc/ghi**, phải tránh chạy nhiều đợt quá sát trong gói Spark. Ưu tiên lúc cửa hàng nghỉ, sau sao lưu; nếu đang có ghi nhận thanh toán đồng thời, cần đối chiếu lại trước khi chốt số công nợ.

**Doanh thu lịch sử:** phải biết chính xác UTC thời điểm GU v4.2 bắt đầu ghi `cashDaily` trên Production. Ví dụ giả định (KHÔNG dùng nguyên timestamp này):

```bash
node --env-file=.env.local scripts/migrate-revenue-history.mjs --cutoff=2026-10-16T10:00:00.000Z --max=1000
```

Script chốt cutoff sau lần đầu; các lần sau **phải dùng lại đúng cutoff**, có checkpoint Firestore. Không đoán giờ; sai cutoff có thể đếm trùng hoặc bỏ sót giao dịch. Script cần hoàn thành trước khi dùng báo cáo 5 năm để quyết toán. Đối chiếu từng kỳ với sổ thu vì các đơn cũ có thể có bản ghi PAY chưa đầy đủ.

**Sao lưu:** chạy từng đợt, lưu ra `private-backups` dưới Codespaces. Tải ra thiết bị an toàn và mã hóa; Codespaces có thể bị xóa; script không tự backup Cloudinary ảnh gốc.

```bash
node --env-file=.env.local scripts/backup-firestore.mjs --limit=1000
```

## Giới hạn còn cần theo dõi

- Firestore đọc/ghi là quota toàn dự án và toàn client; nếu có ứng dụng khác dùng cùng Firebase, GU có thể không thấy nguyên nhân từ phía app khác.
- Dữ liệu kho / khách / đơn được phân trang, nhưng nhiều bộ lọc tự do vẫn là lọc ở danh sách của trang đang xem. Muốn tìm kiếm toàn văn khắp 2.000 món theo bất kỳ từ khóa nào cần bộ chỉ mục tìm kiếm chuyên dụng ở một giai đoạn tiếp theo.
- Chỉ mục công nợ `debtLedger` lấy toàn bộ khoản đang mở, tối đa 10.000 dòng; nếu vượt, API từ chối báo cáo thiếu thay vì giả vờ đầy đủ. Với khoảng 1.000 người còn nợ hiện tại, nên theo dõi số lượng đơn chưa trả từng người.
- Vercel/Cloudinary không tự nâng cấp plan. Trang Hệ thống không thể đảm bảo các mức miễn phí trong 5 năm.
- `npm run typecheck` và `npm run build` **chưa xác nhận trong môi trường đóng gói** vì môi trường không truy cập npm registry; phải chạy trong Codespaces trước Production.
