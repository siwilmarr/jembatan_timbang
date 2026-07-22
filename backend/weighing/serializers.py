from rest_framework import serializers
from .models import WeighingTransaction, Warehouse, Destination, Cargo


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = ["id", "name", "code"]


class DestinationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Destination
        fields = ["id", "name"]


class CargoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cargo
        fields = ["id", "name"]


class WeighingTransactionSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField()
    warehouse_name = serializers.ReadOnlyField(source="warehouse.name", default=None)

    class Meta:
        model = WeighingTransaction
        fields = [
            "id",
            "nomor_polisi",
            "nama_driver",
            "jenis_muatan",
            "tujuan",
            "jenis_timbang",
            "berat_kg",
            "berat_bersih_kg",
            "pasangan",
            "operator",
            "warehouse",
            "warehouse_name",
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
        obj.try_pair()
        obj.refresh_from_db()
        return obj