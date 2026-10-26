#!/usr/bin/env bash
set -euo pipefail
# Requires root or permissions to read the DB/backup directory.
# Configure DATABASE_URL via an environment file accessible only to root.
: "${DATABASE_URL:?Specify DATABASE_URL without echoing it}"
: "${GU_UPLOAD_DIR:?Specify GU_UPLOAD_DIR}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/gu}"
install -d -m 700 "$BACKUP_ROOT"
STAMP="$(date +%Y%m%d-%H%M%S)"
pg_dump -Fc "$DATABASE_URL" > "$BACKUP_ROOT/gu-$STAMP.dump"
tar -czf "$BACKUP_ROOT/media-$STAMP.tar.gz" -C "$(dirname "$GU_UPLOAD_DIR")" "$(basename "$GU_UPLOAD_DIR")"
chmod 600 "$BACKUP_ROOT/gu-$STAMP.dump" "$BACKUP_ROOT/media-$STAMP.tar.gz"
echo "Backup created: $STAMP"
