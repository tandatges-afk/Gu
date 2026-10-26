# GU v6.0 VPS Pilot — TypeScript TS7022 hotfix

This patch fixes `src/app/page.tsx` lines around 309–315:
- Explicit `string` for the catalog query path.
- Explicit typed API response for the catalog page.
- Explicit `string | null` for the next cursor.

No modifications to loading strategy, filters, Firebase, storage, or business logic.

## Apply to current VS Code working tree (preferred)

1. Extract `GU-v6.0-VPS-PILOT-TS7022-FIX.patch` into Downloads.
2. In PowerShell at repo root:

    git apply --check "$HOME\Downloads\GU-v6.0-VPS-PILOT-TS7022-FIX.patch"
    git apply "$HOME\Downloads\GU-v6.0-VPS-PILOT-TS7022-FIX.patch"
    npm.cmd run typecheck
    npm.cmd run build

If git apply --check fails because your working tree differs from the original ZIP, manually replace only the 3 variable declarations using the diff. Do not overwrite the entire `page.tsx` if you have other local edits.

## Alternative

Use the ZIP `src/app/page.tsx` to replace the file only if you are using the original GU v6.0 VPS Pilot sources unchanged.

Do not push before typecheck/build succeeds. If further errors are reported, supply the new error logs.
