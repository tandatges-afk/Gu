> **ĐÃ THAY THẾ:** Đây là trạng thái release cũ. Trạng thái hiện tại và yêu cầu nghiệm thu: `FIX20-HUONG-DAN-TRIEN-KHAI.md`.

# GU V5.4.6 VPS Fast RC1 — Kiểm tra trước bàn giao

## Đã kiểm tra trên bản mã nguồn này

- `npm test`: **222/222** đạt, exit code 0.
- `npm run test:vps`: **15/15** đạt, exit code 0.
- `npm run verify:release`: đạt.
- Trình kiểm tra cú pháp TypeScript cục bộ: **177 tệp**, không có lỗi cú pháp.
- **450 import nội bộ** qua trình kiểm tra đường dẫn; **22 module client** được kiểm tra.
- Script Bash triển khai `vps-main/gu-v5-release` và `vps-main/prepare-v5-vps.sh`: `bash -n` đạt.
- GitHub workflow YAML parse được với các job `validate`, `stage`, `production`.
- `.env.local`, SSH key, backup và ảnh của khách hàng không nằm trong gói source.

## Chưa được kiểm tra và phải làm trên máy Windows/VPS

- Chưa chạy `npm ci`, `npm run typecheck`, `npm run build` với dependencies thực tế do npm registry không khả dụng trong môi trường tạo gói.
- Thiếu `package-lock.json`: Windows script tạo bằng `npm install --package-lock-only`; bắt buộc commit lock trước push.
- Chưa chạy thử PostgreSQL V5, đặc biệt đồng thời nhiều đơn trên cùng sản phẩm; chưa xác nhận bảo mật với các tài khoản nhân viên thật.
- Chưa kiểm thử tải ảnh thực tế, sổ công nợ, tính phí trễ, xuất/nhập dữ liệu cũ và khôi phục backup.
- Chưa chạy GitHub Actions của commit V5 hoặc deploy VPS V5; chưa kiểm tra HTTP health-check sau deploy.

**Đây là bản release candidate hoàn thiện nhất có thể bàn giao theo kết quả kiểm thử hiện có; không tuyên bố production-ready.**
