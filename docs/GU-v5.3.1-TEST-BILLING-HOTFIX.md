# GU v5.3.1-beta.2 — Fix test theo giờ đặt trước

## Nguyên nhân 194/196 bài test

Hai test cũ trong `tests/v5-3-clients.test.ts` và `tests/v5-beta3-audit.test.ts`
khẳng định giờ bàn giao thực tế phải ghi đè giờ thuê, trái với yêu cầu hiện tại của GU
(đặt 14:00, khách đến 15:00 hoặc 17:00 vẫn tính từ 14:00).

## Thay đổi

- Bổ sung hàm thuần `handoverBillingStart` tại `src/lib/gu-v52-workflow.ts`.
- `RESERVE`: giữ nguyên mốc giờ đã hẹn trong hợp đồng, ghi thời điểm giao/chụp ảnh
  thực tế ở `handoverProof.at`.
- `WALK_IN`: tính tiền từ lúc bàn giao thực tế.
- Giao trước giờ hẹn vẫn tạo khóa lịch cho khoảng giao trước, không ghi đè
  thời gian hẹn và không làm lỏng khóa chống trùng.
- Hai test cũ được thay bằng kiểm tra đúng nghiệp vụ; có kiểm tra cụ thể khách
  hẹn 14h lấy trễ đến 15h / 17h.
- Không thay đổi dữ liệu Firebase hay biến môi trường.

## Kiểm tra trên Codespaces

```bash
npm install
npm run verify:imports
npm run verify:release
npm run test
npm run typecheck
npm run build
```

Chỉ push/deploy khi toàn bộ lệnh đều thành công. Khi môi trường dùng Node 24,
nên chuyển sang Node 22 vì `package.json` yêu cầu `node: 22.x`.

## Lưu ý

Test Node thuần đạt 196/196 trong môi trường tạo gói. Đây không thay thế
kiểm thử tích hợp Firestore và `next build` với dependency đầy đủ.
