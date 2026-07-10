from django.contrib import admin
from .models import WeighingTransaction


@admin.register(WeighingTransaction)
class WeighingTransactionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "nomor_polisi",
        "nama_driver",
        "jenis_timbang",
        "berat_kg",
        "sync_status",
        "created_at_local",
        "created_at_server",
    )
    list_filter = ("jenis_timbang", "sync_status")
    search_fields = ("nomor_polisi", "nama_driver")
