# GU Fix20 — Gộp Fix 17–20 | hướng dẫn triển khai an toàn

> **Bản rà soát rev2:** thêm ràng buộc thư mục ảnh theo DB cho script GC; chỉ cho phép tối ưu index trên hai DB V5 cục bộ; preflight phát hiện index INVALID sau `CREATE INDEX CONCURRENTLY`. Hướng dẫn push terminal chi tiết nằm tại `PUSH-FIX20-TERMINAL-WINDOWS.md`.

**Release:** `5.4.6-fix20.0` · **Trạng thái:** STAGING CANDIDATE, **CHƯA** nghiệm thu Production/Stable 1.0.

Đây là bản mã nguồn sửa trực tiếp từ `Gu-main (1).zip`. **Không** có kết nối VPS, GitHub thực tế hoặc PostgreSQL của cửa hàng trong môi trường tạo file. **Không tự động** cài đặt, backup dữ liệu hay triển khai lên server. Không đưa thư mục `.env.local`, mật khẩu hay ảnh/CCCD vào Git.

## Fix 17 — Chống lỗi đồng thời

- Giữ khóa advisory transaction của PostgreSQL, kiểm tra tồn kho/slot/stage trong transaction.
- `POST /api/v5/orders`: mã đơn dùng 12 ký tự ID thay 5 ký tự; có `createRequestId` cố định qua các lần retry, lưu `orderCreateRequests` cùng transaction với đơn, lịch, sổ thu tiền. Nếu retry giống hệt, trả lại đơn đã tạo. Khác payload dùng cùng UUID trả `409`.
- `PATCH /api/v5/orders/[id]`: thêm `mutationRequests` theo UUID của hành động (nếu client gửi); hỗ trợ replay an toàn sau mất mạng, gồm cả phụ thu, hoàn cọc và cập nhật kho. `GuV5OrderDetail` giữ mã khi request bị lỗi chưa chắc chắn. `PAY` tiếp tục có `cashMovements` theo `requestId` như bản gốc. Không bỏ điều kiện trạng thái giao/trả/hoàn đã có.
- `gu_docs_unique_active_order_code`: unique index cho mã đơn trong PostgreSQL. **Nếu database đang có mã trùng, không tự sửa; chạy audit và xử lý thủ công trước khi thêm index.**
- Chương trình thử đồng thời trên PostgreSQL staging: `scripts/gu-fix20-concurrency-stage.mjs` (test khóa/slot/trạng thái/thu tiền **mô phỏng**, không phải UAT HTTP hai tài khoản).

## Fix 18 — Kiểm toán nghiệp vụ

- `scripts/gu-fix20-audit.mjs`: chỉ đọc (`BEGIN READ ONLY`), kiểm tra mã đơn trùng, tiền thuê/đã thu bất hợp lệ, sản phẩm RENTED thiếu đơn, kho AVAILABLE còn `currentOrderId`, trùng khoảng giờ trong `v5DayIntervals`, hàng thuê không nằm trong line của đơn, đối soát `paid` với cashMovements và index tên còn thiếu. Cảnh báo trả mã `2` cho lỗi P0/P1.
- **Phải đối soát thủ công:** dòng tiền thực tế vs sổ quỹ, tiền cọc vật lý/CCCD, tính giá 3/6/24/48h, lịch dài ngày, hàng chuyển giao giữa ca, dữ liệu import legacy. Bộ kiểm toán chỉ đọc không được coi là bản quyết toán kế toán.

## Fix 19 — Hiệu năng và UX/UI

- Tìm sản phẩm bổ sung trong đơn: debounce 300 ms, bỏ qua phản hồi truy vấn cũ, giảm tải nhập từng ký tự.
- Tìm khách theo số điện thoại: kết quả trả về trễ không ghi đè truy vấn mới.
- Nhân viên tạo sản phẩm thường/phụ kiện có thể nhập trực tiếp **giá trị đền bù** và **góc chụp bắt buộc**, không tạo ra mặt hàng chưa dùng được; hành động được ghi audit. Máy ảnh vẫn chỉ Admin được nhập/chỉnh, chi tiết định giá sau nhập chỉ Admin chỉnh, theo chính sách cũ.
- Chưa chạy đo p50/p95 với 2.000 món/50 đơn ngày; chưa có kiểm thử iPhone/Android; không khẳng định đã hoàn thành toàn bộ UX/UI.

## Fix 20 — Bảo mật và VPS

- `jsonBody` và đường tải ảnh đọc theo stream và từ chối ngay khi >32 KB JSON / >3 MB ảnh kể cả request không có Content-Length.
- Quota upload mỗi tài khoản, mỗi ngày VN: staff 600 lần / 1 GiB; Admin 1.500 lần / 3 GiB; cập nhật bằng giao dịch để ngăn vượt hạn mức do nhiều tab.
- `gu-fix20-product-photo-gc.mjs`: quét ảnh sản phẩm không có tham chiếu và cũ >30 ngày, dry-run mặc định. Muốn xóa phải xác nhận tên DB, `GU_ACK_PHOTO_GC=yes`, tối đa 200 file/lần. Không xóa ảnh kiểm nhận/CCCD. **Chưa bật cron tự xóa** trước khi nghiệm thu.
- Script backup cũ `gu-v546-backup.sh` **vô hiệu hóa**, tránh backup sai `gu_db`. Script backup mới xác thực DB + đường dẫn ảnh Production V5, `pg_dump`, đóng gói ảnh và SHA256SUMS, mã hóa GPG public key trước khi gửi bằng rclone ra ngoài VPS. Khóa giải mã riêng phải lưu **ngoài** VPS.
- Timer riêng `gu-fix20-prod-backup.timer`; monitor production mỗi 15 phút bằng `gu-fix20-monitor.timer` (service, version, backup, dung lượng). Monitor ghi journal/systemd: **chưa cấu hình email/Telegram/SMS alert**.
- `db:preflight` chỉ đọc, từ chối release chưa có tên migration, index hoặc còn code trùng. GitHub Actions Production chỉ cho phép **workflow_dispatch target=prod**, biến `GU_V5_PRODUCTION_DEPLOY=enabled`, GitHub environment approval và sentinel `/etc/gu-v546/PRODUCTION_APPROVED` trên VPS.

## 1. Kiểm tra mã nguồn trên Windows (không triển khai)

Giải nén ZIP vào thư mục MỚI, sau đó mở PowerShell tại thư mục có `package.json`:

```powershell
node --version                # Node 22.x
npm ci
npm run verify:release
npm run typecheck
npm test                      # 317 tests, kỳ vọng nếu code đúng
npm run test:vps              # 15 tests
npm run build
```

**Nếu bất kỳ lệnh nào lỗi, KHÔNG PUSH/DEPLOY.** Trong môi trường phân tích ZIP, `npm ci --offline` không cài được do thiếu cache, nên `typecheck` và `next build` CHƯA được xác nhận. Kết quả test đọc nguồn không thay thế kiểm thử runtime.

## 2. Trước khi thử staging

- Chụp và xác minh backup đúng DB/phần ảnh của staging. Giữ lại nguyên bản GU đang chạy (DB `gu_db` trên port 3200 nếu vẫn sử dụng). Không chạy restore/import trên Production.
- DB staging `gu_v546_stage`, `GU_UPLOAD_DIR=/var/lib/gu-v546/uploads`, `APP_URL=https://v5.guthuedo.io.vn`; Production V5 `gu_v546_prod`, `GU_UPLOAD_DIR=/var/lib/gu-v546-prod/uploads`.
- Một lần duy nhất, sau backup staging đã xác minh, chạy migration tên. Ví dụ từ thư mục release staging, quyền user guapp:

```bash
GU_ACK_NAME_BACKUP=yes node --env-file=.env.local scripts/repair-product-name-index.mjs --apply --confirm-db=gu_v546_stage
npm run db:optimize
npm run db:preflight
npm run db:audit:read-only
GU_ACK_STAGE_CONCURRENCY=yes npm run test:concurrency:stage
npm run photos:gc:dry-run
```

**Lưu ý:** staging hiện phải được bootstrap/init/migrate/index trước lần deploy đầu tiên để qua preflight. Không chạy `db:preflight` trên DB chưa tạo. Trên Production, `db:optimize` phải có `GU_OPTIMIZE_ALLOW_OTHER_DB=yes` (chỉ sau khi backup và audit; nếu có mã trùng sẽ từ chối tạo unique index). `repair-product-name-index.mjs --apply` production yêu cầu `GU_ACK_NAME_BACKUP=yes --confirm-db=gu_v546_prod`. Không chèn biến môi trường tùy tiện để bỏ qua preflight.

## 3. GitHub Actions / đồng nhất Fix 16

- Chỉ sao chép source vào repo Git làm việc, **giữ Git history và giữ secrets ngoài repo**. Không dùng force-push; kiểm tra `git diff` trước khi commit.
- Push `main` chỉ chạy `validate`: version, typecheck, test, build; **không tự deploy prod**.
- Chạy workflow thủ công `GU Fix20 — Validate / Stage / Controlled Production` chọn **stage**. Khi staging lên, so SHA approved:

```bash
GU_EXPECTED_COMMIT=40_KY_TU_SHA_GITHUB node scripts/gu-fix20-versions.mjs --stage-only
```

- Production **không được chạy** khi chưa đủ điều kiện UAT bên dưới. Khi duyệt Production, GitHub environment + VPS sentinel cần được phê chuẩn riêng; run workflow thủ công `target=prod`. Sau đó chạy lại script phiên bản **không** có `--stage-only` và so trùng SHA stage/prod/GitHub.
- Khi cập nhật VPS, phải cài **bản mới** `vps-main/gu-v5-release` vào `/usr/local/sbin/gu-v5-release`; file Git được push không tự thay thế root script trên VPS.

## 4. Backup Production GPG + rclone (không bật khi chưa cấu hình)

Yêu cầu: `gpg`, `rclone`, `pg_dump`/`pg_restore` và remote rclone **nằm ngoài VPS**, quyền file secrets `0600`.

1. Tạo cặp khóa GPG trên máy/offsite tin cậy; import **public key** vào keyring root VPS. **Private key không được lưu trên VPS hoặc Git**.
2. Cấu hình rclone remote trong root VPS đến một kho khác server. Tạo `/etc/gu-v546/backup-prod.env` từ `deploy-vps/backup-prod.env.example` (sửa fingerprint và đường dẫn), chmod 600.
3. Kiểm tra `prod.env` thực sự có `DATABASE_URL` trỏ `gu_v546_prod`, `GU_UPLOAD_DIR=/var/lib/gu-v546-prod/uploads`.
4. Cài root script/service/timer, chạy một bản backup và xem journal:

```bash
sudo install -m 0750 deploy-vps/gu-fix20-encrypted-offsite-backup.sh /usr/local/sbin/gu-fix20-encrypted-offsite-backup
sudo install -m 0644 deploy-vps/gu-fix20-prod-backup.service /etc/systemd/system/
sudo install -m 0644 deploy-vps/gu-fix20-prod-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start gu-fix20-prod-backup.service
sudo journalctl -u gu-fix20-prod-backup.service -n 50 --no-pager
# Chỉ khi backup thành công và kiểm thử restore: 
sudo systemctl enable --now gu-fix20-prod-backup.timer
```

**Thử khôi phục BẮT BUỘC:** tải GPG ngoài VPS, giải mã ở máy an toàn, kiểm tra SHA256SUMS, dùng `pg_restore` vào một **database thử hoàn toàn mới**, mở ảnh thử theo tệp, so số dòng orders/items và checksum. **KHÔNG** restore vào `gu_v546_prod` khi thử. Backup thành công != restore thành công.

Giám sát sau khi backup và prod đã hoạt động:

```bash
sudo install -m 0750 deploy-vps/gu-fix20-monitor.sh /usr/local/sbin/gu-fix20-monitor
sudo install -m 0644 deploy-vps/gu-fix20-monitor.service /etc/systemd/system/
sudo install -m 0644 deploy-vps/gu-fix20-monitor.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gu-fix20-monitor.timer
sudo journalctl -u gu-fix20-monitor.service -n 50 --no-pager
```

**Không** bật lại timer `gu-v546-backup.timer` cũ vì nó trỏ sai DB/ảnh. Cần tắt riêng timer cũ sau khi kiểm tra timer mới đang chạy và có bản restore thử đạt.

## 5. Kịch bản UAT PHẢI đạt trước Production

- 2 tài khoản nhân viên khác nhau cùng bấm đặt một món/giờ: chỉ một đơn thành công; cùng UUID retry trả cùng ID.
- 2 thiết bị cùng giao một đơn: chỉ chuyển `RESERVED` → `PICKED_UP` một lần, ảnh đúng người chụp, kho RENTED cho đúng đơn.
- 2 thiết bị cùng nhận trả: `PICKED_UP` → `RETURNED` chỉ một lần; kho LAUNDRY/AVAILABLE/MISSING đúng và chỉ giải phóng interval đúng đơn.
- Thu tiền cùng `requestId` hai lần, hoàn tiền/cọc hoặc cộng phụ thu bị retry: sổ tiền và `paid` không bị cộng hai lần.
- Đơn giữ lịch trước thu 100% có chứng từ; hủy đơn đã thu tiền không tạo doanh thu lần hai; cọc CCCD/tiền giữ và hoàn đúng số.
- Ảnh kiểm nhận giao/trả, chứng từ nhạy cảm chỉ đúng người có quyền đọc; cleanup sau 5 ngày/7 lượt đúng; backup giữ dữ liệu có chủ ý.
- Các tình huống nhiều món, trùng ngày, qua 17h, máy ảnh 3/6/24/48h, khách không tới, trả trễ, bồi thường, nhập kho/giặt, tên sản phẩm có dấu/không dấu.
- PC Chrome/Edge và iPhone/Android: camera thật, ảnh, màn calendar, nhập số điện thoại, bàn phím, kết nối mạng yếu, refresh tab, menu mobile, báo lỗi.
- Chạy audit `exit=0` hoặc ghi nhận từng ngoại lệ và phương án khắc phục; benchmark dữ liệu mô phỏng 2.000 items / 50 orders/ngày; thử phục hồi backup và rollback app trên staging.

## 6. Rollback

- Release script có rollback symlink cũ nếu start/health lỗi. Nhưng **không** rollback DB migrations bằng thao tác này.
- Ghi lại SHA đã duyệt và đường dẫn `readlink -f /var/www/gu-v546-prod-deploy/current` TRƯỚC khi release. Nếu production có vấn đề hậu deploy: khóa thao tác nghiệp vụ, giữ nguyên DB và ảnh, quay symlink app về bản đã duyệt, restart service theo runbook máy thực tế; đối soát lại các giao dịch xảy ra trong giai đoạn sự cố.
- Nếu có lỗi dữ liệu, không tự `pg_restore --clean` vào Production. Cần quy trình phục hồi có sự đồng ý, đối soát delta và cửa sổ ngừng giao dịch.

## 7. Các giới hạn và công việc chưa đóng

- Chưa chạy `npm ci`, typecheck hoặc `next build` thành công trong môi trường soạn bản vá; chưa kiểm chứng VPS/PG thật. 317 bài test JS/TS mới+hiện hữu và 15 bài VPS test có thể chạy độc lập không dùng database.
- Không tự động sửa mã đơn trùng đã có; preflight chặn trước khi tạo unique index.
- Không tự động dọn ảnh sản phẩm; chỉ có công cụ dry-run/confirm riêng; phải đối chiếu với snapshot đơn cũ.
- Chưa thực hiện thay đổi toàn bộ chiến lược paging/UX hoặc chứng minh p95 mục tiêu; cần đo thực tế trước khi quyết định.
- Chưa có tích hợp thông báo từ xa cho monitor; journald phải được người quản trị theo dõi.
- Tên sản phẩm vẫn đang yêu cầu unique theo chuẩn hóa để tương thích `productNameIndex`; nếu cần nhiều đồ giống tên, thiết kế migration index nhiều chủ sở hữu phải tách ra một bản nâng cấp dữ liệu riêng có backup.
- **Trạng thái:** Fix17–20 đã được gộp vào một ứng viên mã nguồn; **chưa** đồng nghĩa với nghiệm thu Production hay GU Stable 1.0.
