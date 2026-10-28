> **BẢN MỚI NHẤT: GU Fix20 Integrated Rev6.** Đọc [`00-BAT-DAU-REV6.md`](00-BAT-DAU-REV6.md) trước khi cài. Các hướng dẫn bên dưới chỉ để tham khảo lịch sử; không dùng lệnh reset, force push, copy đè hoặc deploy Production.

> **GU FIX20 (audited revision 2):** Before copying source into an existing Git repository, read [`PUSH-FIX20-TERMINAL-WINDOWS.md`](PUSH-FIX20-TERMINAL-WINDOWS.md). For database/VPS safety, read [`FIX20-HUONG-DAN-TRIEN-KHAI.md`](FIX20-HUONG-DAN-TRIEN-KHAI.md). Old RC1 instructions below are historical and must not be used to deploy Fix20.

# GU — Thuê đồ xinh | GU 5.4.6 VPS Fast RC1

GU V5 rental-management UI and business rules adapted for self-hosted Ubuntu VPS, PostgreSQL JSONB, and locally stored media. Primary branch: `main` at `tandatges-afk/Gu`. This is a **release candidate**, not a verified production cutover.

**Start here:** [`00-HUONG-DAN-PUSH-MAIN-VA-VPS.md`](00-HUONG-DAN-PUSH-MAIN-VA-VPS.md).

- PostgreSQL: isolated `gu_v546_stage` and `gu_v546_prod`, **never silently reusing the old GU 6.1 database `gu_db`**.
- Browser authentication: local HttpOnly cookie sessions, not Firebase SDK.
- Media: local VPS filesystem; legacy Cloudinary links are not automatically migrated.
- Release automation: `.github/workflows/deploy-main.yml`, staging port 3301, production port 3302, deployment script `vps-main/gu-v5-release`.
- GU 6.1 on port 3200 and domain `guthuedo.io.vn` remain undisturbed until the operator tests and switches Nginx.
- Old GitHub `main` history preserved as annotated tag when running the PowerShell replacement script.

## Quick local checks

```bash
npm install --package-lock-only --no-audit --no-fund # first time only; commit package-lock.json
npm ci
npm run verify:imports
npm run typecheck
npm test
npm run test:vps
npm run build
```

`package-lock.json` **is included** in the Fix20 ZIP. Run `npm ci` to install the locked dependency versions. Do not regenerate the lockfile unless you are deliberately upgrading dependencies. Tests alone do not prove PostgreSQL performance, concurrent order correctness or user-permission security; run staging acceptance tests.

This repository also includes the original source's test suite, legacy docs, and V5 source archive documentation for comparison. The Firebase/Cloudinary-specific old tests are not counted as passing migration tests.
