#!/usr/bin/env bash
# One-time safe bootstrap of local backup and release tools, no Production restart.
set -Eeuo pipefail
umask 077
[[ $(id -u) == 0 ]] || { echo 'Run as root' >&2; exit 2; }
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
for f in deploy-vps/gu-fix20-backup-doctor.sh deploy-vps/gu-fix20-local-prod-backup.sh vps-main/gu-v5-release; do
  test -s "$root/$f" && bash -n "$root/$f" || { echo "Invalid: $f" >&2; exit 1; }
done
if [[ -f /usr/local/sbin/gu-v5-release ]]; then
  cp -a /usr/local/sbin/gu-v5-release "/root/gu-v5-release.before-rev75.$(date -u +%Y%m%dT%H%M%SZ)"
fi
if [[ -f /etc/systemd/system/gu-fix20-prod-backup.service ]]; then
  cp -a /etc/systemd/system/gu-fix20-prod-backup.service "/root/gu-fix20-prod-backup.service.before-rev75.$(date -u +%Y%m%dT%H%M%SZ)"
fi
install -o root -g root -m 0755 "$root/vps-main/gu-v5-release" /usr/local/sbin/gu-v5-release
install -o root -g root -m 0755 "$root/deploy-vps/gu-fix20-backup-doctor.sh" /usr/local/sbin/gu-fix20-backup-doctor
install -o root -g root -m 0750 "$root/deploy-vps/gu-fix20-local-prod-backup.sh" /usr/local/sbin/gu-fix20-local-prod-backup
install -o root -g root -m 0644 "$root/deploy-vps/gu-fix20-prod-backup.service" /etc/systemd/system/gu-fix20-prod-backup.service
install -o root -g root -m 0644 "$root/deploy-vps/gu-fix20-prod-backup.timer" /etc/systemd/system/gu-fix20-prod-backup.timer
systemctl daemon-reload
systemd-analyze verify /etc/systemd/system/gu-fix20-prod-backup.service
printf 'GU Rev7.5 LOCAL backup tools INSTALLED. Site untouched; no backup run; no auto deploy enabled.\n'
