#!/usr/bin/env bash
set -euo pipefail
umask 077
D=/var/backups/gu-v546
install -d -m 0700 "$D"
STAMP=$(date +%Y%m%d-%H%M%S)
# Database name on the PG cluster; uses postgres Unix user with local auth.
runuser -u postgres -- pg_dump -Fc gu_db > "$D/gu-${STAMP}.dump"
tar -czf "$D/media-${STAMP}.tgz" -C /var/lib/gu-v546 uploads
find "$D" -type f \( -name '*.dump' -o -name '*.tgz' \) -mtime +14 -delete
printf 'Backup: %s\n' "$STAMP"
