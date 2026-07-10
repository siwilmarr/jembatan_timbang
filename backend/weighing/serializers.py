from rest_framework import serializers
from .models import WeighingTransaction


class WeighingTransactionSerializer(serializers.ModelSerializer):
    # Override: id dari frontend HARUS writable, meski PK & editable=False di model
    id = serializers.UUIDField()

    class Meta:
        model = WeighingTransaction
        fields = [
            "id",
            "nomor_polisi",
            "nama_driver",
            "jenis_muatan",
            "jenis_timbang",
            "berat_kg",
            "berat_bersih_kg",
            "pasangan",
            "operator",
            "created_at_local",
            "created_at_server",
            "sync_status",
        ]
        read_only_fields = ["created_at_server", "sync_status", "berat_bersih_kg", "pasangan"]

    def create(self, validated_data):
        obj, _created = WeighingTransaction.objects.update_or_create(
            id=validated_data["id"],
            defaults={**validated_data, "sync_status": "synced"},
        )
        obj.try_pair()   # <-- tambahan: coba cari & hubungkan pasangan
        obj.refresh_from_db()  # supaya response ke frontend sudah termasuk berat_bersih_kg terbaru
        return obj