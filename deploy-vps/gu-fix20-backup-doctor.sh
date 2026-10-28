#!/usr/bin/env bash
# Safe, read-only check for mandatory local pre-deploy PostgreSQL + uploads snapshot.
set -Eeuo pipefail
mode="${1:---host}"
[[ "$mode" == --host || "$mode" == --service ]] || { echo 'Usage: backup-doctor --host|--service' >&2; exit 2; }
fail=0
bad(){ printf 'GU_BACKUP_BLOCKED: %s\n' "$*" >&2; fail=1; }
[[ $(id -u) == 0 ]] || bad 'Requires root'
[[ -r /etc/gu-v546/prod.env && ! -L /etc/gu-v546/prod.env ]] || bad 'Production environment missing or symlink'
[[ -d /var/lib/gu-v546-prod/uploads && ! -L /var/lib/gu-v546-prod/uploads ]] || bad 'Production media directory missing or symlink'
for cmd in node pg_dump pg_restore tar sha256sum runuser df systemctl; do
 command -v "$cmd" >/dev/null 2>&1 || bad "Missing command $cmd"
done
if [[ "$mode" == --host ]]; then
 systemctl cat gu-fix20-prod-backup.service >/dev/null 2>&1 || bad 'Backup service not installed'
 if command -v node >/dev/null 2>&1 && [[ -r /etc/gu-v546/prod.env ]]; then
   node --env-file=/etc/gu-v546/prod.env -e 'const e=process.env,u=new URL(e.DATABASE_URL);if(u.pathname!=="/gu_v546_prod"||!["127.0.0.1","localhost"].includes(u.hostname)||e.GU_UPLOAD_DIR!=="/var/lib/gu-v546-prod/uploads")process.exit(1)' >/dev/null 2>&1 || bad 'Production DATABASE_URL / GU_UPLOAD_DIR mismatch'
 fi
else
 [[ "${GU_BACKUP_TARGET:-}" == prod ]] || bad 'Wrong GU_BACKUP_TARGET'
 [[ "${GU_UPLOAD_DIR:-}" == /var/lib/gu-v546-prod/uploads ]] || bad 'Wrong GU_UPLOAD_DIR'
 if [[ -n "${DATABASE_URL:-}" ]]; then
   node -e 'const u=new URL(process.env.DATABASE_URL);if(u.pathname!=="/gu_v546_prod"||!["127.0.0.1","localhost"].includes(u.hostname))process.exit(1)' >/dev/null 2>&1 || bad 'Wrong DATABASE_URL'
 else bad 'Missing DATABASE_URL'; fi
fi
if (( fail )); then echo 'GU_BACKUP_PREFLIGHT_FAILED; Production unchanged' >&2; exit 1; fi
echo 'GU_BACKUP_PREFLIGHT_OK mode=local snapshot; offsite export remains separate'
