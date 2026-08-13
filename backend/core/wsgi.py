import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

# Run collectstatic on Vercel startup to collect files to the writable /tmp directory
if os.environ.get("VERCEL"):
    import django
    django.setup()
    from django.core.management import call_command
    try:
        call_command("collectstatic", "--noinput", "--clear")
    except Exception as e:
        print("Error running collectstatic:", e)

application = get_wsgi_application()
