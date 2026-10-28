# GU Fix20 — Build repair revision 3 (28/10/2026)

This is a complete audited Fix20 source snapshot. Application version stays `5.4.6-fix20.0`; Git SHA differentiates revisions. **Not yet approved for production**.

## Verified root cause

The error routes `src/app/api/auth/route.ts`, `src/app/api/gu/[resource]/route.ts`, and `src/app/api/gu/[resource]/[id]/route.ts` are not part of Fix20 Revision 2 nor the originally uploaded GU archive. They are **stale routes** kept in the existing local checkout by `robocopy /E`; they import `argon2` but Fix20 intentionally does not depend on it. Installing `argon2` is the wrong resolution.

## Changes

- Added `scripts/gu-fix20-source-guard.mjs` and matching release manifest. `npm run source:check` lists obsolete source code in an old checkout; `npm run source:prune` **moves** it to a backup folder next to the Git repo (never deletes it). A missing expected release file prevents pruning. Does not touch `.git`, secrets, uploads, databases, or workflow files.
- The guard also reports extra `.github/workflows/*.yml` files and refuses to remove them automatically; an obsolete workflow could deploy Production on GitHub push.
- `npm run build` and `npm run verify:release` now stop early with a helpful error when the checkout contains old source files.
- `src/lib/local-media.ts`: annotate runtime `GU_UPLOAD_DIR` filesystem operations for Turbopack tracing. Images are stored on VPS volume outside the source tree; they are not build assets. This reduces spurious whole-project tracing warnings without changing URL format, directory or upload permissions.
- Added regression tests for the source guard, its safe backup, and external runtime media annotations.

## Validation still required locally

`npm ci && npm run source:check && npm run verify:release && npm run typecheck && npm test && npm run test:vps && npm run build` on Node 22.x and the actual checkout. This environment cannot establish an npm registry connection reliably. CI, staging database, integration/UAT, and offsite restore are still pending.
