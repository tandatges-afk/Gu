# GU v5.3.5 Beta 2 – Hotfix Turbopack Lucide icon

## Nguyên nhân
`GuVisualFinder.tsx` sử dụng icon `ImageSearch` không được export bởi `lucide-react` đang cài đặt. Turbopack dừng build vì import không tồn tại.

## Sửa lỗi
- Thay icon `ImageSearch` thành `Search` có sẵn trong phiên bản đang dùng.
- Thêm `npm run verify:icons` để đối chiếu **tất cả named exports** `lucide-react` với bản package thực sự được cài trong Codespaces.
- Tự kiểm tra icon trong `npm run build` trước khi gọi `next build`.

## Lệnh kiểm tra sau khi giải nén vào repo
```bash
npm install
npm run verify:imports
npm run verify:release
npm run verify:icons
npm run test
npm run typecheck
npm run build
```

Nếu có lỗi mới, gửi **toàn bộ dòng lỗi** từ `typecheck`/`build`. Không push nếu build chưa đạt.
