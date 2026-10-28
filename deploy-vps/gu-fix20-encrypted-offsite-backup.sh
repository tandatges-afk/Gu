#!/usr/bin/env bash
# Fix20: encrypted, per-environment PostgreSQL + media backup, copied OFF the VPS.
# Run as root via the corresponding systemd service (which injects env).
set -Eeuo pipefail
umask 077
[[ "$(id -u)" == 0 ]] || { echo 'Root required for postgres peer auth' >&2; exit 2; }
: "${GU_BACKUP_TARGET:?Must be stage or prod}"
: "${DATABASE_URL:?Missing DATABASE_URL}"
: "${GU_UPLOAD_DIR:?Missing GU_UPLOAD_DIR}"
: "${GU_BACKUP_GPG_RECIPIENT:?Specify installed GPG public key fingerprint}"
: "${GU_BACKUP_RCLONE_DEST:?Specify remote like offsite:gu-fix20/prod}"
[[ "${GU_BACKUP_TARGET}" == stage || "${GU_BACKUP_TARGET}" == prod ]] || exit 2
case "$GU_BACKUP_TARGET" in
 prod) DB=gu_v546_prod; EXPECTED_MEDIA=/var/lib/gu-v546-prod/uploads ;;
 stage) DB=gu_v546_stage; EXPECTED_MEDIA=/var/lib/gu-v546/uploads ;;
esac
ACTUAL_DB="$(node -e 'const u=new URL(process.env.DATABASE_URL); if(!["127.0.0.1","localhost"].includes(u.hostname))process.exit(2);process.stdout.write(decodeURIComponent(u.pathname.slice(1)))')"
[[ "$ACTUAL_DB" == "$DB" && "$GU_UPLOAD_DIR" == "$EXPECTED_MEDIA" ]] || { echo 'DB/upload paths mismatch; aborting to avoid backing up the wrong instance.' >&2; exit 2; }
[[ -d "$GU_UPLOAD_DIR" && ! -L "$GU_UPLOAD_DIR" ]] || { echo 'Missing/symlink media directory; abort.' >&2; exit 2; }
command -v pg_dump >/dev/null;command -v gpg >/dev/null;command -v rclone >/dev/null
[[ "$GU_BACKUP_RCLONE_DEST" == *:* && "$GU_BACKUP_RCLONE_DEST" != /* ]] || { echo 'Destination must be a configured rclone remote' >&2; exit 2; }
gpg --batch --list-keys "$GU_BACKUP_GPG_RECIPIENT" >/dev/null
ROOT="/var/backups/gu-fix20-$GU_BACKUP_TARGET"
install -d -m 0700 "$ROOT"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TMP="$(mktemp -d "$ROOT/.tmp-XXXXXXXX")"
trap 'rm -rf -- "$TMP"' EXIT
runuser -u postgres -- pg_dump -Fc --dbname="$DB" > "$TMP/database.dump"
test -s "$TMP/database.dump"
# --no-recursion/--exclude not used: include exactly the media folder configured in GU env.
tar -czf "$TMP/media.tgz" -C "$(dirname "$GU_UPLOAD_DIR")" "$(basename "$GU_UPLOAD_DIR")"
pg_restore --list "$TMP/database.dump" >/dev/null
(cd "$TMP" && sha256sum database.dump media.tgz > SHA256SUMS)
TAR="$TMP/gu-fix20-$GU_BACKUP_TARGET-$STAMP.tar"
tar -cf "$TAR" -C "$TMP" database.dump media.tgz SHA256SUMS
gpg --batch --yes --trust-model always --encrypt --recipient "$GU_BACKUP_GPG_RECIPIENT" --output "$TAR.gpg" "$TAR"
[[ -s "$TAR.gpg" ]] || exit 1
OUT="$ROOT/gu-fix20-$GU_BACKUP_TARGET-$STAMP.tar.gpg"
mv -n "$TAR.gpg" "$OUT"
chmod 0600 "$OUT"
# Offsite transfer must succeed; unencrypted intermediate files vanish on exit.
rclone copyto "$OUT" "${GU_BACKUP_RCLONE_DEST%/}/$(basename "$OUT")" --retries 3 --checkers 2
rclone lsjson "${GU_BACKUP_RCLONE_DEST%/}/$(basename "$OUT")" --stat | node -e 'let s="";process.stdin.on("data",x=>s+=x).on("end",()=>{let d=JSON.parse(s);if(!(d.Size>0))process.exit(1)})'
# Retain local encrypted snapshots only. NEVER delete the offsite copies automatically.
find "$ROOT" -maxdepth 1 -type f -name 'gu-fix20-*.tar.gpg' -mtime +14 -delete
printf 'GU_FIX20_BACKUP_OK target=%s timestamp=%s encrypted=1 offsite=1\n' "$GU_BACKUP_TARGET" "$STAMP"
