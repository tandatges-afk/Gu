#!/usr/bin/env bash
# GU Production: atomic root-only local snapshot before deployments / nightly timer.
# This is NOT an offsite copy. Export encrypted snapshots to a separate Windows PC regularly.
set -Eeuo pipefail
umask 077
[[ $(id -u) == 0 ]] || { echo 'Root required' >&2; exit 2; }
[[ "${GU_BACKUP_TARGET:-}" == prod ]] || { echo 'GU_BACKUP_TARGET must be prod' >&2; exit 2; }
[[ -n "${DATABASE_URL:-}" && "${GU_UPLOAD_DIR:-}" == /var/lib/gu-v546-prod/uploads ]] || { echo 'Production DB/media env missing or incorrect' >&2; exit 2; }
node -e 'const u=new URL(process.env.DATABASE_URL);if(u.pathname!=="/gu_v546_prod"||!["127.0.0.1","localhost"].includes(u.hostname))process.exit(2)' || { echo 'Wrong database, refusing backup' >&2; exit 2; }
[[ -d "$GU_UPLOAD_DIR" && ! -L "$GU_UPLOAD_DIR" ]] || { echo 'Production upload directory missing/symlink' >&2; exit 2; }
for cmd in pg_dump pg_restore runuser tar sha256sum df; do command -v "$cmd" >/dev/null || { echo "Missing $cmd" >&2; exit 2; }; done
ROOT=/var/backups/gu-fix20-prod
[[ ! -L "$ROOT" ]] || { echo 'Refusing symlink backup root' >&2; exit 2; }
install -d -o root -g root -m 0700 "$ROOT"
# Minimum free space check; further writes must still succeed for a valid backup.
FREE_KB="$(df -Pk "$ROOT" | awk 'NR==2 {print $4}')"
[[ "$FREE_KB" =~ ^[0-9]+$ ]] && (( FREE_KB >= 524288 )) || { echo 'Under 512 MiB free; backup blocked' >&2; exit 1; }
TMP="$(mktemp -d "$ROOT/.tmp.XXXXXXXX")"
trap 'rm -rf -- "$TMP"' EXIT
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$ROOT/gu-prod-$STAMP-$$"
[[ ! -e "$OUT" ]] || { echo 'Snapshot path collision' >&2; exit 1; }
runuser -u postgres -- pg_dump -Fc -d gu_v546_prod > "$TMP/database.dump"
test -s "$TMP/database.dump"
pg_restore --list "$TMP/database.dump" >/dev/null
tar -czf "$TMP/uploads.tar.gz" -C /var/lib/gu-v546-prod uploads
tar -tzf "$TMP/uploads.tar.gz" >/dev/null
(cd "$TMP" && sha256sum database.dump uploads.tar.gz > SHA256SUMS && sha256sum -c SHA256SUMS)
chmod 0700 "$TMP"
chmod 0600 "$TMP"/*
mv -- "$TMP" "$OUT"
trap - EXIT
printf 'GU_LOCAL_BACKUP_OK target=prod folder=%s offsite=0
' "$OUT"
