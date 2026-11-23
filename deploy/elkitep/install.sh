#!/usr/bin/env bash
# Установка / обновление КУТ БИЛИМ на сервере (Ubuntu/Debian).
# Запуск из этой папки:  sudo bash install.sh
set -euo pipefail
cd "$(dirname "$0")"
SRC="$(pwd)"
APP=/srv/kutbilim
ENV_FILE=/etc/kutbilim/kutbilim.env

[ "$(id -u)" -eq 0 ] || { echo "Запустите через sudo"; exit 1; }

echo "==> Пакеты"
if command -v apt-get >/dev/null && ! { command -v nginx && command -v rsync && python3 -c "import venv,ensurepip"; } >/dev/null 2>&1; then
  while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do echo "   жду, пока завершатся автообновления Ubuntu..."; sleep 5; done
  apt-get update -qq
  apt-get install -y -qq python3 python3-venv python3-pip nginx rsync
fi
python3 -c 'import sys; assert sys.version_info >= (3,10), "Нужен Python 3.10+"'

echo "==> Файлы"
mkdir -p "$APP"/{backend,web,downloads} /etc/kutbilim /etc/ssl/elkitep
if [ -f "$APP/backend/db.sqlite3" ]; then
  # Обновление: база и загруженные фото на сервере не перезаписываются
  rsync -a --exclude db.sqlite3 --exclude media --exclude .venv --exclude staticfiles "$SRC/backend/" "$APP/backend/"
else
  rsync -a "$SRC/backend/" "$APP/backend/"
fi
rsync -a --delete "$SRC/web/" "$APP/web/"
rsync -a "$SRC/downloads/" "$APP/downloads/"
install -m 644 "$SRC/ssl/elkitep.gps.gov.kg.crt" /etc/ssl/elkitep/
install -m 600 "$SRC/ssl/elkitep.gps.gov.kg.key" /etc/ssl/elkitep/
# .env ставится только один раз, чтобы секретный ключ не менялся при обновлениях
[ -f "$ENV_FILE" ] || install -m 600 "$SRC/config/kutbilim.env" "$ENV_FILE"
mkdir -p "$APP/backend/media"

echo "==> Python-окружение"
[ -d "$APP/backend/.venv" ] || python3 -m venv "$APP/backend/.venv"
"$APP/backend/.venv/bin/pip" install -q --upgrade pip
"$APP/backend/.venv/bin/pip" install -q -r "$APP/backend/requirements.txt"

chown -R www-data:www-data "$APP/backend"
chmod 750 "$APP/backend/media"

echo "==> Миграции и статика"
run_django() { sudo -u www-data env $(grep -v '^#' "$ENV_FILE" | xargs) "$APP/backend/.venv/bin/python" "$APP/backend/manage.py" "$@"; }
run_django migrate --noinput
run_django collectstatic --noinput -v 0
run_django check --deploy --fail-level ERROR

echo "==> Сервис backend"
install -m 644 "$SRC/config/kutbilim.service" /etc/systemd/system/kutbilim.service
systemctl daemon-reload
systemctl enable -q kutbilim
systemctl restart kutbilim

echo "==> Nginx"
if [ -d /etc/nginx/sites-available ]; then
  install -m 644 "$SRC/config/nginx-elkitep.conf" /etc/nginx/sites-available/elkitep.conf
  ln -sf /etc/nginx/sites-available/elkitep.conf /etc/nginx/sites-enabled/elkitep.conf
else
  install -m 644 "$SRC/config/nginx-elkitep.conf" /etc/nginx/conf.d/elkitep.conf
fi
nginx -t
systemctl enable -q nginx
systemctl reload nginx || systemctl restart nginx

sleep 2
systemctl is-active --quiet kutbilim && echo "Backend: работает" || { echo "Backend НЕ запустился:"; journalctl -u kutbilim -n 30 --no-pager; exit 1; }
[ -f "$APP/downloads/kutbilim.apk" ] && echo "APK: есть" || echo "ВНИМАНИЕ: нет $APP/downloads/kutbilim.apk"
echo "Готово: https://elkitep.gps.gov.kg"
echo "Админка: https://elkitep.gps.gov.kg/$(grep DJANGO_ADMIN_PATH "$ENV_FILE" | cut -d= -f2)/"
