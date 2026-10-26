#!/usr/bin/env bash
# GU release upgrade from a ZIP. Run as root on the VPS only after a verified DB+media backup.
# Never modifies PostgreSQL schema or uploads. Retains old application folder for rollback.
set -Eeuo pipefail
umask 077
LIVE=/var/www/gu-pg/gu-pg
BASE=/var/www/gu-pg
PORT=3200
ZIP=${1:-}
[[ "$(id -u)" -eq 0 ]] || { echo 'Requires root on VPS' >&2; exit 1; }
[[ -f "$ZIP" ]] || { echo 'Usage: bash deploy/upgrade-vps.sh /tmp/GU_VPS_PostgreSQL_6.1_RC1_full.zip' >&2; exit 1; }
[[ -f "$LIVE/package.json" && -f "$LIVE/.env.local" && -s "$LIVE/.next/BUILD_ID" ]] || { echo 'Cannot verify current application/.env.local/build. Aborting.' >&2; exit 1; }
id guapp >/dev/null
ACTIVE_DIR=$(systemctl show gu-pg --property=WorkingDirectory --value)
[[ -n "$ACTIVE_DIR" && "$(realpath -e "$ACTIVE_DIR")" == "$(realpath -e "$LIVE")" ]] || {
  echo "gu-pg is using $ACTIVE_DIR, not $LIVE; use your existing release manager instead. Aborting." >&2
  exit 1
}
[[ "$(systemctl is-active gu-pg)" == active ]] || { echo 'gu-pg not active; refusing automated swap' >&2; exit 1; }
STAMP=$(date +%Y%m%d-%H%M%S)
STAGE="$BASE/stage-$STAMP"
ROLLBACK="$BASE/gu-pg-before-$STAMP"
mkdir -p "$STAGE"
unzip -q "$ZIP" -d "$STAGE"
NEXT="$STAGE/gu-pg"
[[ -f "$NEXT/package.json" ]] || { echo 'ZIP must contain gu-pg/package.json' >&2; exit 1; }
cp -p "$LIVE/.env.local" "$NEXT/.env.local"
chown -R guapp:guapp "$STAGE"
chmod 600 "$NEXT/.env.local"
cd "$NEXT"
# Build in a separate folder before touching the running application.
runuser -u guapp -- npm install --no-audit --no-fund
runuser -u guapp -- npm run typecheck
runuser -u guapp -- npm test
runuser -u guapp -- npm run build
[[ -s "$NEXT/.next/BUILD_ID" ]] || { echo 'Missing production build' >&2; exit 1; }
# No schema migration here. Changes requiring a migration must use a separately reviewed procedure.
echo 'Build and tests successful; switching GU application ...'
systemctl stop gu-pg
mv "$LIVE" "$ROLLBACK"
if ! mv "$NEXT" "$LIVE"; then
  mv "$ROLLBACK" "$LIVE"
  systemctl start gu-pg
  echo 'Cannot activate new release; old code restored' >&2
  exit 1
fi
if ! systemctl start gu-pg || ! curl --fail --silent --show-error --retry 8 --retry-connrefused --retry-delay 2 "http://127.0.0.1:$PORT/" -o /dev/null; then
  echo 'Health check failed; restoring prior release' >&2
  systemctl stop gu-pg || true
  FAILED="$BASE/gu-pg-failed-$STAMP"
  mv "$LIVE" "$FAILED"
  mv "$ROLLBACK" "$LIVE"
  systemctl start gu-pg
  curl --fail --silent --show-error "http://127.0.0.1:$PORT/" -o /dev/null || true
  echo "Rollback complete. Failed release: $FAILED" >&2
  exit 1
fi
echo "GU updated. Prior release retained at $ROLLBACK"
echo "Validate login/orders from https://guthuedo.io.vn before accepting this release."
