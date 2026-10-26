# GU v5.5.0 – Fix 404 _next/static trên Vercel (Asset Cache Hotfix)

Bản vá CHỈ có 3 file: `package.json` (giữ `--webpack` cho Next.js 16), `public/gu-sw.js` (bỏ cache Next.js JS/CSS, tự xóa cache static đời cũ khi SW kích hoạt), `tests/pwa-next-assets-v551.test.ts`.

Không can thiệp Firebase, đơn thuê, bảo mật, cọc hay xử lý ảnh AI.

**Lưu ý**: Sửa cache Service Worker giúp phòng ngừa lỗi phiên bản JS nhưng không thể tự khôi phục các chunks 404 thiếu trên deployment. Cần redeploy bản build thành công trên nhánh production và đối chiếu file chunks đúng theo HTML.

## VS Code Windows (tại C:\Users\Admin\Desktop\Gu\Gu)
1. Giải nén ZIP vào gốc dự án và cho phép ghi đè 2 file đã có, tạo 1 test mới. Kiểm tra diff `git diff`.
2. `npm.cmd install`
3. `npm.cmd run verify:release`
4. `npm.cmd run test`
5. `npm.cmd run typecheck`
6. `npm.cmd run build`
7. Chỉ khi thành công: `git add package.json public/gu-sw.js tests/pwa-next-assets-v551.test.ts` rồi `git commit -m "fix: bypass SW for Next.js assets"`.
8. Push nhánh tính năng, xem Vercel Preview. Để sửa `gu-nu.vercel.app` phải merge/đưa commit lên **Production Branch** (thường `main`) đã cấu hình trên Vercel.
9. Trên Vercel: kiểm tra deployment `Ready`, chọn `Redeploy` có thể tắt "Use existing Build Cache" nếu còn lỗi; kiểm tra Framework = Next.js, không cấu hình Output Directory sai.
10. Chrome: kiểm tra qua cửa sổ ẩn danh. Nếu ẩn danh hoạt động, vào F12 > Application > Service Workers > Unregister rồi Storage > Clear site data (thao tác này có thể làm bạn đăng xuất). Sau đó Ctrl+Shift+R.

## Test nhanh
`node --experimental-strip-types --test tests/pwa-next-assets-v551.test.ts`

### Phân biệt nguyên nhân
- Ẩn danh hoạt động, cửa sổ cũ lỗi => browser/service worker cache.
- Ẩn danh cũng lỗi => Vercel Production deployment, custom output/rewrite/cache, hoặc mismatch asset HTML.
- HTML cũ yêu cầu chunks của deployment khác => phục vụ không cùng phiên bản; hãy kiểm tra deploy alias, CDN, version skew.
