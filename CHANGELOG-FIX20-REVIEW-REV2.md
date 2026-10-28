# GU Fix20 — Audited source revision 2 (28/10/2026)

Source version remains `5.4.6-fix20.0` for compatibility with the current Fix20 deployment scripts. **The Git commit SHA distinguishes this audited revision from the previous ZIP.** Do not infer that it has passed UAT or deployed to production.

## Additional confirmed safeguards

1. `scripts/gu-fix20-product-photo-gc.mjs`: refuse a staging DB when `GU_UPLOAD_DIR` points to production photos (and vice versa). Prevent accidental deletion of media from the other environment.
2. `scripts/gu-fix20-preflight.mjs`: require `pg_index.indisvalid` and `indisready`; check the order-code unique index really is unique. `CREATE INDEX CONCURRENTLY` can leave a named but invalid index on failure, which the old name-only check did not detect.
3. `scripts/optimize-postgresql.mjs`: only permit `gu_v546_stage` and `gu_v546_prod` on local PostgreSQL. Even with a production opt-in variable, cannot use this script to modify legacy `gu_db` or a remote database by mistake.
4. `tests/fix20-safety.test.ts`: regression assertions for the three safeguards above.
5. `README.md`, `00-HUONG-DAN-PUSH-MAIN-VA-VPS.md`: correct obsolete RC1 copy/lockfile/auto-production guidance. New `PUSH-FIX20-TERMINAL-WINDOWS.md` gives explicit safe terminal instructions for the **existing** `GU-MAIN-READY` Git repo.

## Remaining release gates

- Build with downloaded dependencies, TypeScript typecheck, and GitHub Actions validate.
- Staging PostgreSQL integration with real data; role and UI testing across devices.
- Backup encrypted offsite, restore to disposable database, verify SHA and photos.
- Live concurrency (two separate staff accounts), business audit, load tests, rollback procedure.
- No claim that the user's local Git branch or remote production has been inspected or changed.
