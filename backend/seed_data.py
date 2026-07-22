import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth.models import User
from weighing.models import Warehouse, Destination, Cargo, UserProfile

def seed():
    # 1. Buat Warehouses
    wh1, _ = Warehouse.objects.get_or_create(name="Warehouse Utara", code="WH-UTRA")
    wh2, _ = Warehouse.objects.get_or_create(name="Warehouse Selatan", code="WH-SLTN")
    wh3, _ = Warehouse.objects.get_or_create(name="Warehouse Barat", code="WH-BRT")
    print("Warehouses seeded!")

    # 2. Buat Destinations
    dest_names = ["Pabrik Cilegon", "Pelabuhan Merak", "Gudang Jakarta", "Depo Surabaya"]
    for name in dest_names:
        Destination.objects.get_or_create(name=name)
    print("Destinations seeded!")

    # 3. Buat Cargos
    cargo_names = ["Batu Bara", "Pasir Silika", "Kelapa Sawit (TBS)", "Semen Curah", "Biji Besi"]
    for name in cargo_names:
        Cargo.objects.get_or_create(name=name)
    print("Cargos seeded!")

    # 4. Hubungkan operator1 ke Warehouse Utara
    try:
        op1 = User.objects.get(username="operator1")
        profile, _ = UserProfile.objects.get_or_create(user=op1)
        profile.warehouse = wh1
        profile.save()
        print(f"User operator1 linked to {wh1.name}!")
    except User.DoesNotExist:
        print("User operator1 not found, skip linking.")

    # 5. Hubungkan admin ke Warehouse Selatan
    try:
        admin_user = User.objects.get(username="admin")
        profile, _ = UserProfile.objects.get_or_create(user=admin_user)
        profile.warehouse = wh2
        profile.save()
        print(f"User admin linked to {wh2.name}!")
    except User.DoesNotExist:
        print("User admin not found, skip linking.")

if __name__ == "__main__":
    seed()
