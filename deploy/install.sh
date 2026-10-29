#!/usr/bin/env bash
# Встановлення client-ops на чистий Ubuntu/Debian сервер. Запуск один раз:
#   curl -fsSL https://raw.githubusercontent.com/Alex-ux-droid/client-ops/main/deploy/install.sh | sudo bash
# Без питань (для cloud-init): ... | APP_PASSWORD='пароль' bash
# Ставить Node 22, Caddy (HTTPS), сервіс, автооновлення з main кожні 2 хв, щоденний бекап бази.
set -euo pipefail

REPO="https://github.com/Alex-ux-droid/client-ops.git"
APP_DIR=/opt/client-ops
DATA_DIR=/var/lib/client-ops
APP_USER=clientops

say() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mПомилка: %s\033[0m\n' "$*"; exit 1; }

[ "$(id -u)" = 0 ] || die "запусти через sudo"
. /etc/os-release
case "$ID" in ubuntu|debian) ;; *) die "підтримується тільки Ubuntu/Debian (тут $ID)";; esac

# Порти 80/443 мають бути вільні (або вже зайняті нашим Caddy)
busy=$(ss -ltnpH '( sport = :80 or sport = :443 )' | grep -v caddy || true)
if [ -n "$busy" ]; then
  echo "$busy"
  die "порти 80/443 зайняті іншою програмою (старий проєкт?). Зупини її і запусти скрипт ще раз."
fi

say "Пакети"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -yq git curl ca-certificates gnupg build-essential python3 openssl sudo

if ! node -v 2>/dev/null | grep -qE '^v(2[2-9]|[3-9][0-9])\.'; then
  say "Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -yq nodejs
fi

if ! command -v caddy >/dev/null; then
  say "Caddy (HTTPS)"
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt -o /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -yq caddy
fi

say "Користувач і папки"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$DATA_DIR"
if [ -d "$APP_DIR/.git" ]; then
  sudo -u "$APP_USER" git -C "$APP_DIR" fetch -q origin main
  sudo -u "$APP_USER" git -C "$APP_DIR" reset -q --hard origin/main
else
  rm -rf "$APP_DIR"
  git clone -q --branch main "$REPO" "$APP_DIR"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR" "$DATA_DIR"
chmod 700 "$DATA_DIR"

if [ ! -f "$APP_DIR/.env" ]; then
  say "Пароль для входу в систему"
  p1="${APP_PASSWORD:-}"
  [ -n "$p1" ] && [ ${#p1} -lt 10 ] && die "APP_PASSWORD коротший за 10 символів"
  [ "$p1" = "ZAMINY_NA_SVIY_PAROL" ] && die "заміни пароль у cloud-config на свій"
  while [ -z "$p1" ]; do
    read -rsp "Придумай пароль (мін. 10 символів): " p1 </dev/tty; echo
    read -rsp "Повтори пароль: " p2 </dev/tty; echo
    [ "$p1" = "$p2" ] && [ ${#p1} -ge 10 ] && break
    echo "Не збігається або коротший за 10 символів, ще раз."
    p1=""
  done
  umask 077
  cat > "$APP_DIR/.env" <<ENV
APP_PASSWORD=$p1
SESSION_SECRET=$(openssl rand -hex 32)
DATABASE_PATH=$DATA_DIR/app.db
ANTHROPIC_API_KEY=
AGENT_MODEL=
ENV
  unset p1 p2 APP_PASSWORD
  chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
fi

say "Збірка (кілька хвилин)"
sudo -u "$APP_USER" -H bash -c "cd $APP_DIR && npm ci --no-audit --no-fund && npm run build"

say "Сервіси"
cp "$APP_DIR/deploy/systemd/"*.service "$APP_DIR/deploy/systemd/"*.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now client-ops.service client-ops-update.timer client-ops-backup.timer
systemctl restart client-ops.service

IP=$(curl -4 -fsS https://api.ipify.org || hostname -I | awk '{print $1}')
DOMAIN="${DOMAIN:-$(echo "$IP" | tr . -).sslip.io}"
say "HTTPS для $DOMAIN"
[ -f /etc/caddy/Caddyfile ] && cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.bak.$(date +%s)"
cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
	encode gzip
	reverse_proxy 127.0.0.1:3000
}
CADDY
systemctl enable caddy >/dev/null
systemctl reload caddy || systemctl restart caddy

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
fi

say "Готово"
echo "Відкривай: https://$DOMAIN"
echo "Якщо не відкривається: у Hetzner → Firewalls дозволь вхідні порти 80 і 443."
