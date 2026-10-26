#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$(id -u)" == '0' ]] || { echo 'Run as root' >&2; exit 1; }
base=/var/www/gu-pg
live="$base/gu-pg"
[[ -f "$live/package.json" && -f "$live/.env.local" && -s "$live/.next/BUILD_ID" ]] || {
  echo 'Existing GU app, .env.local or production build not found' >&2
  exit 1
}
id guapp >/dev/null

if ! id gu-deploy >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash gu-deploy
fi
install -d -m 700 -o gu-deploy -g gu-deploy /home/gu-deploy/.ssh
install -d -m 700 -o gu-deploy -g gu-deploy /home/gu-deploy/incoming
if [[ ! -f /home/gu-deploy/.ssh/authorized_keys ]]; then
  install -m 600 -o gu-deploy -g gu-deploy /dev/null /home/gu-deploy/.ssh/authorized_keys
fi
install -d -m 755 -o root -g root "$base/releases"
if [[ ! -L "$base/current" ]]; then
  if [[ -e "$base/current" ]]; then
    echo 'current is a real file/directory, refusing to overwrite' >&2
    exit 1
  fi
  ln -s "$live" "$base/current"
fi

# Override only WorkingDirectory; preserve the existing ExecStart on port 3200.
install -d -m 755 /etc/systemd/system/gu-pg.service.d
cat > /etc/systemd/system/gu-pg.service.d/10-release-working-dir.conf <<'EOT'
[Service]
WorkingDirectory=/var/www/gu-pg/current
EOT

install -m 755 "$(dirname "$0")/gu-release-deploy" /usr/local/sbin/gu-release-deploy
cat > /etc/sudoers.d/gu-deploy <<'EOT'
gu-deploy ALL=(root) NOPASSWD: /usr/local/sbin/gu-release-deploy
EOT
chmod 440 /etc/sudoers.d/gu-deploy
visudo -cf /etc/sudoers.d/gu-deploy
systemctl daemon-reload
systemctl restart gu-pg
sleep 3
curl --fail --silent --show-error http://127.0.0.1:3200/ -o /dev/null
printf '\nGU deployment prepared.\n'
printf 'Service workdir: %s\n' "$(systemctl show -p WorkingDirectory --value gu-pg)"
printf 'Now add the GitHub Actions public SSH key to /home/gu-deploy/.ssh/authorized_keys\n'
