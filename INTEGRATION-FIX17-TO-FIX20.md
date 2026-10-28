# GU Fix20 Integrated — Diff-based integration from Fix17 main

**Status:** Staging Candidate — not yet approved for Production.

## Provenance
- Main: `GU_MAIN_FIX17.zip`, representing `origin/main` at `a076693` in user's Git log.
- Fix20: `GU_FIX20_FROM_GITHUB.zip`, from `gu-fix20-rev4-review` at `7288cfe` in user's Git log.
- Base: ALL 319 original Fix17 files retained unchanged unless listed in changed set.
- Applied: 23 modified files and 23 intended Fix20 new files.
- Excluded: 17 historical files present only in Fix20 that were removed in Fix17; do NOT reintroduce old DB/bootstrap/VPS migration routes.

## Excluded old-only paths
- `README-DEPLOY-VPS.md`
- `README-UPGRADE-6.1-VI.md`
- `db/001_schema.sql`
- `db/002_auth.sql`
- `db/003_v2.sql`
- `deploy/backup-gu.sh`
- `deploy/gu.service`
- `deploy/nginx-gu.conf`
- `deploy/upgrade-vps.sh`
- `docs/TEST-ACCEPTANCE-VI.md`
- `docs/V5-FEATURE-PARITY.md`
- `scripts/check-db.mjs`
- `scripts/create-admin.mjs`
- `scripts/migrate.mjs`
- `scripts/pg-smoke-test.mjs`
- `vps/gu-release-deploy`
- `vps/prepare-vps.sh`

## Safety gates
- Apply the supplied `.patch` on an isolated branch based on `origin/main` rather than attempting to rebase the divergent Rev4 commit.
- Build/test on Windows and GitHub; validate PostgreSQL schema + indexes on **staging only**.
- Staging backup/restore and real multi-account booking/payment tests required.
- Production is NOT auto-deployed on push; review the GitHub Actions workflow and production environment approval settings.
- No `.env`, database dumps, secrets or media should be copied into Git.

## Limitations
- Unit/source tests are not equivalent to full Next.js build or real PostgreSQL concurrency validation.
- The Fix20 app allows staff to supply compensation value and photo inspection configuration when adding products; confirm the role policy with Admin before Production.
- The source version stays `5.4.6-fix20.0` to remain compatible with release checks.
