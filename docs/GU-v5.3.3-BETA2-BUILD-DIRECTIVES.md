# GU v5.3.3 Beta 2 — Next.js client directive hotfix

Build lỗi với Next.js Turbopack vì import `formatVNDateTime` đứng trước `'use client';` trong ba component: `GuEvidenceHistory.tsx`, `GuExtras.tsx`, `GuSystem.tsx`.

## Thay đổi

- Đưa `'use client';` lên đầu cả ba component (trước import).
- Thêm `scripts/check-client-directives.mjs` để phát hiện import chen trước directive ở các lần sửa tiếp theo.
- Tích hợp bước này vào `npm run verify:imports`, `npm run verify:release` và `npm run build`.
- Giữ nguyên xử lý Firebase và nghiệp vụ GU v5.3.3 Beta 1.

## Triển khai trên Codespaces

```sh
cd /workspaces/Gu
unzip -o GU-v5.3.3-beta.2-BUILD-HOTFIX-FULL-CODESPACES.zip -d .
npm run verify:imports
npm test
npm run typecheck
npm run build
```

Chỉ push nếu tất cả lệnh trên đều thành công. ZIP không mang .env.local hoặc dữ liệu Firebase. Không chạy script reset dữ liệu.
