import os
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = os.getenv("DJANGO_DEBUG", "1") == "1"
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "development-only-change-before-deployment")
# Секреттүү жол: Django админкасы ушул дарек боюнча гана ачылат (/admin/ эмес).
ADMIN_URL_PATH = os.getenv("DJANGO_ADMIN_PATH", "u8f93hiuvfbviug7f8g584gifoeugf9re7gfugieurfg87").strip("/")
if not DEBUG and SECRET_KEY == "development-only-change-before-deployment":
    raise RuntimeError("Set DJANGO_SECRET_KEY in production")
ALLOWED_HOSTS = os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,10.0.2.2").split(",")
INSTALLED_APPS = ["django.contrib.admin", "django.contrib.auth", "django.contrib.contenttypes", "django.contrib.sessions", "django.contrib.messages", "django.contrib.staticfiles", "rest_framework", "rest_framework.authtoken", "accounts", "administration"]
MIDDLEWARE = ["django.middleware.security.SecurityMiddleware", "django.contrib.sessions.middleware.SessionMiddleware", "django.middleware.common.CommonMiddleware", "django.middleware.csrf.CsrfViewMiddleware", "django.contrib.auth.middleware.AuthenticationMiddleware", "django.contrib.messages.middleware.MessageMiddleware", "django.middleware.clickjacking.XFrameOptionsMiddleware"]
ROOT_URLCONF = "config.urls"
TEMPLATES = [{"BACKEND": "django.template.backends.django.DjangoTemplates", "DIRS": [], "APP_DIRS": True, "OPTIONS": {"context_processors": ["django.template.context_processors.request", "django.contrib.auth.context_processors.auth", "django.contrib.messages.context_processors.messages"]}}]
WSGI_APPLICATION = "config.wsgi.application"
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}
AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [{"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"}, {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"}, {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"}, {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"}]
LANGUAGE_CODE = "ru"
TIME_ZONE = "Asia/Bishkek"
USE_TZ = True
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_ROOT = BASE_DIR / "media"
# Production: Django стоит за Nginx, который принимает HTTPS.
CSRF_TRUSTED_ORIGINS = [o for o in os.getenv("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if o]
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
REST_FRAMEWORK = {"DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.TokenAuthentication"], "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"], "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.AnonRateThrottle"], "DEFAULT_THROTTLE_RATES": {"anon": "30/hour"}}
if not DEBUG:
    # За Nginx: реальный IP клиента берётся из X-Forwarded-For (для лимитов запросов).
    REST_FRAMEWORK["NUM_PROXIES"] = 1
