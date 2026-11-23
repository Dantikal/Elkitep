КУТ БИЛИМ — деплой на https://elkitep.gps.gov.kg
================================================

Содержимое папки
  backend/     Django (код + текущая база db.sqlite3 + фото в media/)
  web/         собранный сайт
  downloads/   kutbilim.apk — Android-приложение для скачивания с сайта
  ssl/         сертификат и ключ *.gps.gov.kg (действует до 16.03.2027). КЛЮЧ СЕКРЕТНЫЙ.
  config/      kutbilim.env (секреты Django), kutbilim.service (systemd), nginx-elkitep.conf
  install.sh   установка / обновление одной командой

Требования к серверу
  Ubuntu/Debian, Python 3.10+, открыты порты 80 и 443,
  DNS-запись elkitep.gps.gov.kg указывает на IP сервера.

Первая установка
  1) С Mac:     scp -r elkitep  user@SERVER:~/
  2) На сервере: cd ~/elkitep && sudo bash install.sh
  3) Открыть https://elkitep.gps.gov.kg

  Админка Django: адрес выведет install.sh в конце
  (путь задан в config/kutbilim.env -> DJANGO_ADMIN_PATH; /admin/ отдаёт 404).

Куда всё ставится на сервере
  /srv/kutbilim/backend     код, .venv, db.sqlite3, media/
  /srv/kutbilim/web         сайт
  /srv/kutbilim/downloads   APK
  /etc/kutbilim/kutbilim.env  секреты (ставится только при первой установке)
  /etc/ssl/elkitep/         сертификат
  Сервис:  systemctl status kutbilim     Логи:  journalctl -u kutbilim -f

Обновление
  Залейте новую папку elkitep и снова: sudo bash install.sh
  База и загруженные фото на сервере при этом НЕ перезаписываются.
  Новый APK: просто замените /srv/kutbilim/downloads/kutbilim.apk
  (в app.json перед сборкой увеличьте version и android.versionCode).

Резервная копия (делайте регулярно)
  /srv/kutbilim/backend/db.sqlite3 и /srv/kutbilim/backend/media/

iOS
  iPhone-приложение нельзя раздавать файлом с сайта — только через
  App Store / TestFlight. Кнопка iOS на сайте пока показывает «Жакында».
