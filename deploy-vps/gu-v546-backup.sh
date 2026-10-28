#!/usr/bin/env bash
# Deprecated backup for GU legacy database; NEVER use for V5 production.
set -euo pipefail
echo 'GU Fix20 safety: legacy backup disabled. Enable gu-fix20-prod-backup.timer after configuring GPG + offsite remote.' >&2
exit 3
