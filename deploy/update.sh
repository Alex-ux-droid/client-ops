#!/usr/bin/env bash
# Автооновлення: якщо в main є новий код — збирає і перезапускає. Якщо збірка впала — відкат.
set -euo pipefail
APP_DIR=/opt/client-ops
LOG=/var/lib/client-ops/update.log
# Все, що пише скрипт, — також у лог, який видно через /api/status
exec > >(tee -a "$LOG") 2>&1
chown clientops:clientops "$LOG" 2>/dev/null || true
APP_USER=clientops
cd "$APP_DIR"

run() { sudo -u "$APP_USER" -H bash -c "cd $APP_DIR && $*"; }

run "git fetch -q origin main"
old=$(run "git rev-parse HEAD")
new=$(run "git rev-parse origin/main")
[ "$old" = "$new" ] && exit 0

echo "$(date -Is) Оновлення $old -> $new"
run "git reset -q --hard origin/main"
if run "npm ci --no-audit --no-fund && npm run build"; then
  cp deploy/systemd/*.service deploy/systemd/*.timer /etc/systemd/system/
  systemctl daemon-reload
  systemctl restart client-ops.service
  echo "Оновлено до $new"
else
  echo "Збірка впала, відкат на $old"
  run "git reset -q --hard $old && npm ci --no-audit --no-fund && npm run build"
  systemctl restart client-ops.service
  exit 1
fi
