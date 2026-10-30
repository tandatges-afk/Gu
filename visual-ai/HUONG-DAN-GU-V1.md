# GU v1 — Bản ứng dụng quản lý cho thuê và tìm kiếm ảnh ngầm bằng AI

## Giữ nguyên thao tác của nhân viên

Không có tab hay nhãn AI mới. Giao diện `GuVisualFinder` vẫn chọn danh mục (hoặc `Tất cả danh mục`), tải ảnh, bấm `Tìm sản phẩm`, xem kết quả. Frontend thử API AI trong nền; nếu dịch vụ chưa chạy, chưa lập chỉ mục hoặc lỗi sẽ dùng thuật toán ảnh hiện có. Đơn, lịch, tài chính, mã GU và dữ liệu khách hàng không bị AI sửa.

## Công nghệ AI thực sự

`visual-ai/worker.py` chạy mô hình thị giác đã huấn luyện **CLIP ViT-B/32** (`openai/clip-vit-base-patch32`, PyTorch + Transformers) riêng trên VPS. Ảnh sản phẩm được lập chỉ mục thành vector trong bảng PostgreSQL `gu_visual_ai_index` độc lập, tối đa ba ảnh/món (đổi bằng `GU_VISUAL_AI_MAX_PHOTOS`). Ảnh mới có URL lưu trên VPS sẽ được xử lý nền theo chu kỳ. Khi nhân viên bấm tìm, backend xác thực phiên đăng nhập, gửi ảnh tạm thời qua **localhost**, lấy kết quả và kiểm tra lại danh mục/quyền/trạng thái archived. Ảnh khách tìm **không được lưu**.

Nếu chọn một danh mục, truy vấn chỉ trả sản phẩm của danh mục đó. Mô hình so sánh ảnh toàn bộ và vùng trên/dưới ảnh để giảm nhầm áo với váy; nếu chọn Tất cả, mô hình xét cả các vùng và cân bằng nhiều danh mục. Đây là một bản AI thử nghiệm thực, **không bảo đảm độ chính xác 70–90%** và không phải model chuyên tách từng trang phục. Ngưỡng cần đo trên ảnh kho thật.

Bản này chỉ lập chỉ mục các URL ảnh sản phẩm **local** `/api/local-media/products/...`; ảnh Cloudinary/đường dẫn ngoài không được tải về vì nguyên tắc bảo mật. Nếu kho vẫn còn ảnh ngoài thì phải di chuyển về VPS (đã được người quản lý chấp thuận) trước khi lập chỉ mục. Không tự ý bật dịch vụ AI nếu VPS thiếu RAM/CPU.

## Windows — xác nhận source và build

1. Chép toàn bộ ZIP GU v1 vào thư mục **mới**, hoặc áp dụng patch từ source Rev7.9.7 chính xác vào working tree đã được sao lưu. Không ghi đè `.env`, backup hay ảnh gốc.
2. Đối với patch, chép `GU-v1-from-Rev7.9.7.patch` và `GU-V1-APPLY.ps1` vào cùng thư mục rồi chạy `powershell.exe -ExecutionPolicy Bypass -File .\GU-V1-APPLY.ps1`; script dừng nếu Git có thay đổi chưa commit hoặc patch không khớp. Đối với full source, chạy `GU-V1-LOCAL-CHECK.ps1` từ thư mục GU v1 (có tham số `-Repo` nếu muốn).
3. Chỉ khi tất cả bước PASS, review `git diff`, backup VPS rồi mới commit và push `main`. Push có thể kích hoạt Auto Production. **Tôi không push trên tài khoản của bạn.**

## VPS — CÀI dịch vụ AI SAU khi triển khai source GU v1 và backup thành công

**Điều kiện:** PostgreSQL Production khỏe, ảnh sản phẩm trên VPS, VPS có đủ RAM (khuyến nghị tối thiểu ~4 GB RAM tổng để cân bằng ứng dụng + mô hình CPU), dung lượng trống đủ cài PyTorch/mô hình (có thể vài GB), kết nối Internet một lần để tải model về. Kiểm tra `free -h`, `df -h` trước. Nên chuẩn bị trước trên môi trường Staging hoặc thời điểm cửa hàng ít khách; không bật worker nếu đang thiếu tài nguyên.

```bash
ssh root@103.176.25.226
free -h
df -h
systemctl is-active gu-v546-prod.service
systemctl start gu-fix20-prod-backup.service
systemctl show gu-fix20-prod-backup.service -p Result
```

Dừng nếu backup không `success` hoặc source `current/visual-ai/worker.py` chưa có. Nếu đáp ứng yêu cầu, lắp Python CPU worker (thao tác cài thư viện cần mạng):

```bash
apt-get update && apt-get install -y python3-venv python3-pip
mkdir -p /opt/gu-visual-ai/cache
python3 -m venv /opt/gu-visual-ai/.venv
/opt/gu-visual-ai/.venv/bin/pip install --upgrade pip
/opt/gu-visual-ai/.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
/opt/gu-visual-ai/.venv/bin/pip install -r /var/www/gu-v546-prod-deploy/current/visual-ai/requirements.txt
chown -R guapp:guapp /opt/gu-visual-ai
```

Cần **một bí mật chung cho GU Node và worker Python** trong `/etc/gu-v546/prod.env`. Nếu chưa tồn tại `GU_VISUAL_AI_SECRET`, tạo một giá trị duy nhất bằng `openssl rand -hex 32`; cấu hình:

```ini
GU_VISUAL_AI_ENABLED=true
GU_VISUAL_AI_PORT=3395
GU_VISUAL_AI_SECRET=<giá trị ngẫu nhiên ít nhất 32 ký tự, KHÔNG commit>
GU_VISUAL_AI_THREADS=2
GU_VISUAL_AI_MAX_PHOTOS=3
GU_VISUAL_AI_INDEX_INTERVAL=90
```

Thêm biến vào file môi trường của Production qua trình biên tập bảo mật (chú ý không có key trùng nhau), chmod 600 file. **Không gửi bí mật này vào chat, Git hoặc log.** Tham số `DATABASE_URL` và `GU_UPLOAD_DIR` phải là các giá trị thực tế của Production đã có sẵn.

```bash
cp /var/www/gu-v546-prod-deploy/current/visual-ai/gu-visual-ai.service /etc/systemd/system/gu-visual-ai.service
systemctl daemon-reload
systemctl enable --now gu-visual-ai.service
systemctl status gu-visual-ai.service --no-pager
journalctl -u gu-visual-ai.service -n 40 --no-pager
```

**Lập chỉ mục kho hiện có** (tùy chọn sau khi worker đã chạy, thực hiện lúc vắng khách; CPU có thể bị chiếm trong thời gian dài):

```bash
cp /var/www/gu-v546-prod-deploy/current/visual-ai/gu-visual-ai-backfill.service /etc/systemd/system/gu-visual-ai-backfill.service
systemctl daemon-reload
systemctl stop gu-visual-ai.service
systemctl start gu-visual-ai-backfill.service
systemctl show gu-visual-ai-backfill.service -p Result
systemctl start gu-visual-ai.service
journalctl -u gu-visual-ai.service -n 40 --no-pager
```

Dịch vụ `gu-visual-ai-backfill.service` sử dụng cùng `EnvironmentFile` với app và worker; không cần in bí mật ra terminal. Chỉ xem `Result=success` là thành công; nếu có lỗi, kiểm tra journal trước khi bật worker.

Cuối cùng restart app Next.js theo quy trình deploy đã kiểm chứng để nạp flags, xác minh `https://guthuedo.io.vn/api/version` có `version: "1.0.0"` và thử 20 ảnh khách thật. Khi chưa bật/tắt worker, giao diện không khác; khi worker không có hoặc lỗi thì tìm kiếm ảnh cũ vẫn hoạt động.

## Bảo mật và phạm vi

- Worker chỉ lắng nghe 127.0.0.1, yêu cầu shared token dài, không có cổng public, không upload ảnh khách vào PostgreSQL.
- API `POST /api/v5/visual-ai-search` yêu cầu ca làm/phiên đăng nhập hợp lệ, chống gửi >3 MB, chặn danh mục lạ/dữ liệu lỗi, giới hạn khoảng 8 lượt/phút mỗi user/process.
- Danh mục được lọc lại bằng PostgreSQL; chỉ trả ID sản phẩm còn hoạt động. Các dòng `orders`, `customers`, `proofUploads` không bị AI sửa.
- Ảnh kho thay thế: worker nhận URL local thay đổi và index ảnh mới, dọn vector ảnh cũ; nếu sửa nội dung tệp mà giữ nguyên URL thì phải xoá row index tương ứng và lập lại bằng quy trình quản trị.
- Mô hình chỉ hỗ trợ xếp hạng tương đồng. Nó không tự kết luận hai mã GU là cùng một món vật lý, không sửa đơn hoặc trạng thái thuê.

## Kiểm tra triển khai cuối

- `npm run verify:release`, `npm run typecheck`, `npm run test`, `npm run test:vps`, `npm run build` trên Windows cần PASS.
- CI GitHub phải hoàn tất và ghi nhận SHA đang chạy trên VPS; kiểm tra rollback nếu fail.
- Xác minh worker tải được model, bảng chỉ mục có dữ liệu từ đúng kho hiện có, và tìm ảnh thật không làm cao tải CPU hoặc chậm tạo đơn.
