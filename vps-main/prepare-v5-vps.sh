#!/usr/bin/env bash
# Idempotent staging setup. Does not change the existing guthuedo.io.vn Nginx site or GU 6.1.
set -Eeuo pipefail
[[ $(id -u) == 0 ]] || { echo 'Run as root'; exit 1; }
id guapp >/dev/null
id gu-deploy >/dev/null
for target in stage prod; do
  base="/var/www/gu-v546-${target}-deploy"
  install -d -m 755 -o root -g root "$base" "$base/releases"
  install -d -m 700 -o gu-deploy -g gu-deploy "/home/gu-deploy/v5-incoming" "/home/gu-deploy/v5-incoming/$target"
done
install -d -m 750 -o root -g guapp /etc/gu-v546
install -d -m 700 -o guapp -g guapp /var/lib/gu-v546/uploads /var/lib/gu-v546-prod/uploads
script_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
install -m 755 "$script_dir/gu-v5-release" /usr/local/sbin/gu-v5-release
install -m 644 "$script_dir/gu-v546-stage.service" /etc/systemd/system/gu-v546-stage.service
install -m 644 "$script_dir/gu-v546-prod.service" /etc/systemd/system/gu-v546-prod.service
cat > /etc/sudoers.d/gu-v5-deploy <<'EOT'
gu-deploy ALL=(root) NOPASSWD: /usr/local/sbin/gu-v5-release
EOT
chmod 440 /etc/sudoers.d/gu-v5-deploy
visudo -cf /etc/sudoers.d/gu-v5-deploy
systemctl daemon-reload
printf '\nV5 deployment system installed. Old GU on 3200 unchanged.\n'
printf 'Set /etc/gu-v546/stage.env and initialize gu_v546_stage before GitHub staging deploy.\n'
printf 'Do not create /etc/gu-v546/PRODUCTION_APPROVED until production cutover is tested.\n'
