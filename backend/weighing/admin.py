from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from .models import WeighingTransaction, Warehouse, UserProfile, Destination, Cargo


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'Profile'


class UserAdmin(BaseUserAdmin):
    inlines = (UserProfileInline,)


admin.site.unregister(User)
admin.site.register(User, UserAdmin)

@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "code")
    search_fields = ("name", "code")


@admin.register(Destination)
class DestinationAdmin(admin.ModelAdmin):
    list_display = ("id", "name")
    search_fields = ("name",)


@admin.register(Cargo)
class CargoAdmin(admin.ModelAdmin):
    list_display = ("id", "name")
    search_fields = ("name",)


@admin.register(WeighingTransaction)
class WeighingTransactionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "nomor_polisi",
        "nama_driver",
        "jenis_timbang",
        "berat_kg",
        "warehouse",
        "tujuan",
        "sync_status",
        "created_at_local",
        "created_at_server",
    )
    list_filter = ("jenis_timbang", "sync_status", "warehouse")
    search_fields = ("nomor_polisi", "nama_driver", "tujuan")
