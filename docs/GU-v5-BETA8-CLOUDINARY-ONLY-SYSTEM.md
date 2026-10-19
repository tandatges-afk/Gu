# GU v5 Beta 8 — Cloudinary only, UI cleanup, diagnostic errors

## Changed

- **Admin → Hệ thống** only displays Cloudinary usage: credits, storage, bandwidth, transformations, resources. The server endpoint no longer queries Cloud Monitoring or aggregates Firestore collection counts. **This does not remove the Firestore database**; rental, inventory, accounts, and debt records remain intact.
- Removed extraneous hints in product angle configuration and image finder, and fixed the catalog pager that printed `undefined kết quả trong trang hiện tại` when data had not loaded.
- Known Firestore gRPC failures now respond with a safe category (`GU_DB_PERMISSION`, `GU_DB_LIMIT`, `GU_DB_PRECONDITION`, `GU_DB_UNAVAILABLE`, etc.) and an incident ID. Unknown failures remain `GU_SERVER_ERROR` with an incident ID. Secrets and raw error stacks are server-side only.

## About incident `b8cb8115`

**This is a correlation ID, not a diagnosis.** The prior error was generated on a Vercel server. Nothing in the client response identifies the cause. Open Vercel → GU project → Logs, select the Production deployment / date-time and search `b8cb8115` or `[GU_SERVER_ERROR]`. Copy the exception *name and message*, hiding passwords, API keys, tokens, customer data and private keys. If server logs are not retained, reproduce the failure and use its new correlation ID. Do not delete the Firestore database to troubleshoot this error.

## Install full source on Codespaces

```bash
cd /workspaces/Gu
git status
git switch main
git pull --ff-only origin main
git switch -c test/gu-v5-beta8
mkdir -p /tmp/gu-v5-beta8
unzip -oq GU-v5.0.0-beta.8-FULL-CLOUDINARY-UI-ERRORS.zip -d /tmp/gu-v5-beta8
SRC=/tmp/gu-v5-beta8/GU-v5.0.0-beta.8
test -f "$SRC/package.json" || exit 1
for dir in src public tests scripts docs; do mkdir -p "$dir"; rsync -a --delete "$SRC/$dir/" "$dir/"; done
for file in package.json tsconfig.json next.config.ts next-env.d.ts firebase.json firestore.rules vercel.json .gitignore .env.example README.md; do cp "$SRC/$file" .; done
nvm use 22
npm install
npm run verify:release
npm run test
npm run typecheck
npm run build
```

Do not overwrite `.env.local`. Do not deploy until typecheck, build, and a full rental flow with staging data pass.

## Release to Production after testing

```bash
cd /workspaces/Gu
rm -f GU-v5.0.0-beta.8-FULL-CLOUDINARY-UI-ERRORS.zip
git add -A
git diff --cached --check
git diff --cached --name-only
# Verify .env.local, private-backups and secrets are not included.
git commit -m "GU v5 Beta 8 Cloudinary only system and UI cleanup"
git switch main
git pull --ff-only origin main
git merge --no-ff test/gu-v5-beta8 -m "Release GU v5 Beta 8 to Production"
npm run typecheck
npm run build
git push origin main
```

If merge fails or a test fails, **stop** and resolve issues before pushing. If the `main` branch is protected, use a Pull Request. A git push to main triggers Vercel Production **only** if the project Production Branch is configured as `main`.
