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

`package-lock.json` is not included in this source ZIP because npm registry was unavailable in the authoring environment. Generate and commit it **before any GitHub push** with the included Windows script. npm tests alone do not prove PostgreSQL performance, concurrent order correctness or user-permission security; run staging acceptance tests.

This repository also includes the original source's test suite, legacy docs, and V5 source archive documentation for comparison. The Firebase/Cloudinary-specific old tests are not counted as passing migration tests.
