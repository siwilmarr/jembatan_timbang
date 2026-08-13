import os
from pathlib import Path
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent

# FIXED: sebelumnya ada default value "super-secret-key" yang predictable —
# kalau env var lupa di-set di server produksi, aplikasi tetap jalan dengan
# key yang bisa ditebak (bahaya untuk session & CSRF). Sekarang wajib di-set
# lewat env var; fallback hanya diperbolehkan saat DEBUG (development lokal).
DEBUG = config("DJANGO_DEBUG", default=False, cast=bool) # FIXED: default sekarang False (aman by default)

SECRET_KEY = config("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = "dev-only-insecure-key-do-not-use-in-production"
    else:
        raise RuntimeError(
            "DJANGO_SECRET_KEY belum di-set! Wajib diisi lewat environment "
            "variable saat DEBUG=False (produksi)."
        )

# FIXED: sebelumnya hardcode ["localhost", "127.0.0.1"] — domain produksi
# nanti tidak akan pernah bisa diakses tanpa edit source code. Sekarang
# dibaca dari env var (pisahkan dengan koma), contoh:
# DJANGO_ALLOWED_HOSTS=timbang.contoh-perusahaan.com,192.168.1.10
ALLOWED_HOSTS = config(
    "DJANGO_ALLOWED_HOSTS",
    default="localhost,127.0.0.1"
).split(",")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",  # ADDED: dibutuhkan untuk TokenAuthentication (lihat REST_FRAMEWORK di bawah)
    "corsheaders",
    "weighing",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "urls"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "core.wsgi.application"

# ADDED: dukungan DATABASE_URL (dipakai Neon/Vercel Postgres, format
# "postgresql://user:pass@host/dbname?sslmode=require"). Kalau env var ini
# ADA (kondisi di production/Vercel), dipakai langsung -- termasuk otomatis
# mewajibkan SSL (ssl_require=True), sesuai syarat Neon.
#
# Kalau TIDAK ada (kondisi development lokal Anda saat ini, yang masih pakai
# DB_NAME/DB_USER/dst terpisah di .env), fallback ke cara lama -- supaya
# .env lokal Anda TIDAK PERLU diubah sama sekali.
import dj_database_url

DATABASE_URL = config("DATABASE_URL", default="")

if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            ssl_require=True,
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": config(
                "DB_ENGINE",
                default="django.db.backends.postgresql"
            ),
            "NAME": config("DB_NAME"),
            "USER": config("DB_USER"),
            "PASSWORD": config("DB_PASSWORD"),
            "HOST": config("DB_HOST"),
            "PORT": config("DB_PORT"),
        }
    }

# Muat konfigurasi database kustom jika ada file database_config.json
import os
import json
config_path = os.path.join(BASE_DIR, "database_config.json")
if os.path.exists(config_path):
    try:
        with open(config_path, "r") as f:
            custom_db = json.load(f)
            DATABASES = {
                "default": custom_db
            }
    except Exception as e:
        print(f"Gagal memuat database_config.json saat startup: {e}")

# Pastikan file sqlite bisa dibuat (mengatasi error: unable to open database file)
if DATABASES["default"]["ENGINE"] == "django.db.backends.sqlite3":
    db_name = Path(DATABASES["default"]["NAME"])
    if not db_name.is_absolute():
        db_name = (BASE_DIR / db_name).resolve()
    db_name.parent.mkdir(parents=True, exist_ok=True)
    DATABASES["default"]["NAME"] = str(db_name)


if DATABASES["default"]["ENGINE"] == "django.db.backends.sqlite3":
    DATABASES["default"].pop("USER", None)
    DATABASES["default"].pop("PASSWORD", None)
    DATABASES["default"].pop("HOST", None)
    DATABASES["default"].pop("PORT", None)

AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "id"
TIME_ZONE = "Asia/Jakarta"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# FIXED: sebelumnya hardcode ke localhost:5173 saja — domain produksi frontend
# nanti tidak akan bisa akses API. Dibaca dari env var (pisahkan dengan koma).
CORS_ALLOWED_ORIGINS = config(
    "DJANGO_CORS_ALLOWED_ORIGINS",
    default="http://localhost:5173"
).split(",")

# FIXED: sebelumnya tidak ada DEFAULT_PERMISSION_CLASSES sama sekali, artinya
# DRF pakai default AllowAny — SIAPA SAJA yang bisa akses network backend bisa
# baca/ubah/hapus semua data transaksi tanpa autentikasi apa pun.
#
# Sekarang wajib pakai Token per-device: setiap laptop/kios di pos timbang
# diberi satu API token (dibuat manual lewat Django admin, lihat catatan di
# bawah), dikirim di header "Authorization: Token <nilai_token>" dari frontend
# (lihat syncService.js). Ini dipilih ketimbang login per-operator karena
# aplikasi ini sifatnya kios/perangkat tetap di pos timbang, bukan multi-user.
REST_FRAMEWORK = {
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",  # supaya admin/browsable API tetap bisa dipakai via login biasa
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

# ADDED: keamanan tambahan untuk HTTPS di produksi. Otomatis nonaktif saat
# DEBUG=True (development lokal) supaya tidak mengganggu development di
# localhost yang biasanya belum pakai HTTPS.
if not DEBUG:
    SECURE_SSL_REDIRECT = os.environ.get("DJANGO_SECURE_SSL_REDIRECT", "True") == "True"
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"

# Trigger reload to load new env vars for CORS