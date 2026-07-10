# Tempel bagian ini ke dalam core/settings.py hasil `django-admin startproject core .`

INSTALLED_APPS = [
    # ...default django apps...
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third party
    "rest_framework",
    "corsheaders",
    # local apps
    "weighing",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # taruh paling atas
    "django.middleware.security.SecurityMiddleware",
    # ...sisanya default...
]

# Izinkan frontend React (Vite biasanya port 5173) mengakses API saat development
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "jembatan_timbang",
        "USER": "postgres",
        "PASSWORD": "postgres",
        "HOST": "localhost",
        "PORT": "5432",
    }
}

REST_FRAMEWORK = {
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
}

# core/urls.py:
# from django.urls import path, include
# urlpatterns = [
#     path("admin/", admin.site.urls),
#     path("api/", include("weighing.urls")),
# ]
