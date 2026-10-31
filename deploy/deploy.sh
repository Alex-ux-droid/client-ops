#!/usr/bin/env bash
# Автооновлення без простою: нова версія збирається в .next-new, поки стара працює,
# потім папки міняються місцями і сервіс перезапускається (кілька секунд).
# Збірка впала — стара версія просто працює далі, нічого не ламається.
# Увесь скрипт у функції: bash читає його цілком до запуску, тож git reset посеред роботи не зіб'є виконання.
main() {
  set -euo pipefail
  local APP_DIR=/opt/client-ops LOG=/var/lib/client-ops/update.log APP_USER=clientops
  exec > >(tee -a "$LOG") 2>&1
  chown clientops:clientops "$LOG" 2>/dev/null || true
  cd "$APP_DIR"
  run() { sudo -u "$APP_USER" -H bash -c "cd $APP_DIR && $*"; }

  # Адреси (Caddy) — з репозиторію, перевіряється щоразу
  if [ -f deploy/Caddyfile ] && ! cmp -s deploy/Caddyfile /etc/caddy/Caddyfile; then
    cp deploy/Caddyfile /etc/caddy/Caddyfile
    if systemctl reload caddy; then echo "$(date -Is) Caddy: оновлено адреси"; else echo "$(date -Is) Caddy: не вдалось перезавантажити конфіг"; fi
  fi

  run "git fetch -q origin main"
  local old new
  old=$(run "git rev-parse HEAD")
  new=$(run "git rev-parse origin/main")
  [ "$old" = "$new" ] && exit 0

  echo "$(date -Is) Оновлення $old -> $new"
  # Залежності ставимо тільки коли змінились (npm ci стирає node_modules — це єдиний момент ризику)
  local deps=0
  run "git diff --quiet $old $new -- package.json package-lock.json" || deps=1
  run "git reset -q --hard origin/main"
  if [ "$deps" = 1 ]; then
    echo "Залежності змінились — npm ci"
    run "npm ci --no-audit --no-fund"
  fi
  if run "rm -rf .next-new && NEXT_DIST_DIR=.next-new npm run build"; then
    run "rm -rf .next-old && { [ -d .next ] && mv .next .next-old || true; } && mv .next-new .next"
    cp deploy/systemd/*.service deploy/systemd/*.timer /etc/systemd/system/
    systemctl daemon-reload
    systemctl restart client-ops.service
    run "rm -rf .next-old"
    echo "$(date -Is) Оновлено до $new"
  else
    echo "$(date -Is) Збірка впала — працює стара версія $old"
    run "rm -rf .next-new && git reset -q --hard $old"
    if [ "$deps" = 1 ]; then run "npm ci --no-audit --no-fund"; systemctl restart client-ops.service; fi
    exit 1
  fi
}
main "$@"
exit
