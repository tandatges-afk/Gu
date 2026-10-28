#!/usr/bin/env bash
# Read-only status. Emits an error to journald if a critical check fails.
set -Eeuo pipefail
umask 077
status=0
fail(){ echo "GU_FIX20_MONITOR_FAIL: $*" >&2; status=1; }
[[ -d /var/www/gu-v546-prod-deploy/current ]] || fail 'No production release directory'
systemctl -q is-active gu-v546-prod.service || fail 'App service inactive'
systemctl -q is-active gu-fix20-prod-backup.timer || fail 'Offsite backup timer not active'
systemctl -q is-active postgresql.service || fail 'PostgreSQL service inactive'
health="$(curl --silent --fail --max-time 8 http://127.0.0.1:3302/api/version)" || fail 'HTTP health failed'
[[ "$health" == *'5.4.6-fix20.0'* ]] || fail 'Unexpected version on production'
# Production uploads and encrypted local backups must be present.
[[ -d /var/lib/gu-v546-prod/uploads ]] || fail 'Upload directory missing'
D=/var/backups/gu-fix20-prod
latest="$(find "$D" -maxdepth 1 -type f -name '*.tar.gpg' -mmin -2160 -print -quit 2>/dev/null || true)"
[[ -n "$latest" ]] || fail 'No encrypted backup in the last 36 hours'
free="$(df -P /var/lib/gu-v546-prod | awk 'NR==2 {gsub(/%/,"",$5);print 100-$5}')"
[[ "${free:-0}" =~ ^[0-9]+$ && "$free" -ge 15 ]] || fail 'Disk free space below 15 percent'
if [[ "$status" == 0 ]]; then echo 'GU_FIX20_MONITOR_OK: app, backup timer, recent encrypted backup and storage are healthy';fi
exit "$status"
