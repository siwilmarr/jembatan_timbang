from rest_framework import serializers
from django.contrib.auth.models import User, Group
from .models import (
    WeighingTransaction,
    Warehouse,
    Destination,
    Cargo,
    UserProfile,
    Unit,
    CustomerSupplier,
    WeighingType,
    WeighingScale,
    SiteProfile,
    PriceList,
)


from django.utils.html import strip_tags


class WeighingScaleSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeighingScale
        fields = [
            "id",
            "name",
            "indicator_type",
            "baud_rate",
            "data_bits",
            "stop_bits",
            "parity",
            "description",
            "is_active",
        ]

    def validate_name(self, value):
        return strip_tags(value).strip() if value else value


class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = ["id", "name", "code"]

    def validate_name(self, value):
        return strip_tags(value).strip() if value else value

    def validate_code(self, value):
        return strip_tags(value).strip() if value else value


class DestinationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Destination
        fields = ["id", "name"]

    def validate_name(self, value):
        return strip_tags(value).strip() if value else value


class CargoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cargo
        fields = ["id", "name"]

    def validate_name(self, value):
        return strip_tags(value).strip() if value else value


class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = ["id", "name", "description"]

    def validate_name(self, value):
        return strip_tags(value).strip() if value else value


class CustomerSupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerSupplier
        fields = ["id", "name", "type", "contact", "address"]

    def validate_name(self, value):
        return strip_tags(value).strip() if value else value


class WeighingTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeighingType
        fields = [
            "id",
            "name",
            "description",
            "deduction_percent",
            "require_driver",
            "require_destination",
            "require_cargo",
            "require_customer",
            "require_unit",
            "max_weight_kg",
            "is_active",
        ]

    def validate_name(self, value):
        return strip_tags(value).strip() if value else value


class WeighingTransactionSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField()
    warehouse_name = serializers.ReadOnlyField(source="warehouse.name", default=None)
    site_profile_id = serializers.PrimaryKeyRelatedField(
        source="site_profile",
        queryset=SiteProfile.objects.all(),
        required=False,
        allow_null=True,
    )

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
            "berat_tara_kg",
            "berat_bersih_kg",
            "pasangan",
            "operator",
            "warehouse",
            "warehouse_name",
            "created_at_local",
            "created_at_server",
            "sync_status",
            "unit",
            "customer_supplier",
            "customer_address",
            "harga_per_kg",
            "total_harga",
            "weighing_type",
            "deduction_percent",
            "berat_potongan_kg",
            "site_profile_id",
            "site_profile_name",
            "site_profile_address",
            "site_profile_phone",
            "site_profile_npwp",
        ]
        read_only_fields = [
            "created_at_server",
            "sync_status",
            "berat_bersih_kg",
            "pasangan",
            "berat_potongan_kg",
        ]

    def validate(self, attrs):
        # Sanitize all incoming string input fields from potential XSS injection
        string_fields = [
            "nomor_polisi",
            "nama_driver",
            "jenis_muatan",
            "tujuan",
            "operator",
            "unit",
            "customer_supplier",
            "customer_address",
            "weighing_type",
        ]
        for field in string_fields:
            if field in attrs and isinstance(attrs[field], str):
                attrs[field] = strip_tags(attrs[field]).strip()

        # Validation for IN/OUT cycle
        nomor_polisi = attrs.get("nomor_polisi")
        jenis_timbang = attrs.get("jenis_timbang")
        tx_id = attrs.get("id")

        if nomor_polisi and jenis_timbang:
            unpaired_txs = WeighingTransaction.objects.filter(
                nomor_polisi=nomor_polisi, pasangan__isnull=True
            )
            if tx_id:
                unpaired_txs = unpaired_txs.exclude(id=tx_id)

            if unpaired_txs.exists():
                active_tx = unpaired_txs.first()
                if active_tx.jenis_timbang == jenis_timbang:
                    raise serializers.ValidationError(
                        f"Kendaraan {nomor_polisi} sudah memiliki transaksi timbangan "
                        f"{'Masuk (Gross)' if jenis_timbang == 'gross' else 'Keluar (Tare)'} "
                        "aktif yang belum diselesaikan (belum in/out)."
                    )

        return attrs

    def create(self, validated_data):
        berat_tara = validated_data.get("berat_tara_kg")
        if berat_tara is not None:
            from decimal import Decimal

            bruto = validated_data["berat_kg"]
            selisih = abs(bruto - berat_tara)
            potongan_persen = validated_data.get("deduction_percent") or Decimal("0")
            potongan = selisih * potongan_persen / Decimal("100")
            netto = selisih - potongan
            harga = validated_data.get("harga_per_kg") or Decimal("0")
            validated_data["berat_bersih_kg"] = netto
            validated_data["berat_potongan_kg"] = potongan
            validated_data["total_harga"] = netto * harga

        obj, _created = WeighingTransaction.objects.update_or_create(
            id=validated_data["id"],
            defaults={**validated_data, "sync_status": "synced"},
        )
        if obj.berat_tara_kg is None:
            obj.try_pair()
        obj.refresh_from_db()
        return obj


class UserProfileSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.ReadOnlyField(source="warehouse.name", default=None)

    class Meta:
        model = UserProfile
        fields = ["warehouse", "warehouse_name"]


class UserSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()
    roles_write = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False
    )
    profile = UserProfileSerializer(required=False)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "password",
            "email",
            "first_name",
            "last_name",
            "roles",
            "roles_write",
            "profile",
        ]
        extra_kwargs = {"password": {"write_only": True, "required": False}}

    def get_roles(self, obj):
        roles = list(obj.groups.values_list("name", flat=True))
        if obj.is_superuser and "Admin" not in roles:
            roles.append("Admin")
        return roles

    def create(self, validated_data):
        profile_data = validated_data.pop("profile", None)
        roles_data = validated_data.pop("roles_write", None)
        password = validated_data.pop("password", None)

        user = User.objects.create(**validated_data)
        if password:
            user.set_password(password)
            user.save()

        if roles_data is not None:
            user.groups.clear()
            for role_name in roles_data:
                group, _ = Group.objects.get_or_create(name=role_name)
                user.groups.add(group)

        if profile_data:
            UserProfile.objects.create(user=user, **profile_data)
        else:
            UserProfile.objects.create(user=user)
        return user

    def update(self, instance, validated_data):
        profile_data = validated_data.pop("profile", None)
        roles_data = validated_data.pop("roles_write", None)
        password = validated_data.pop("password", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)
        instance.save()

        if roles_data is not None:
            instance.groups.clear()
            for role_name in roles_data:
                group, _ = Group.objects.get_or_create(name=role_name)
                instance.groups.add(group)

        if profile_data is not None:
            profile = getattr(instance, "profile", None)
            if not profile:
                profile = UserProfile.objects.create(user=instance)
            profile.warehouse = profile_data.get("warehouse", profile.warehouse)
            profile.save()

        return instance


class SiteProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteProfile
        fields = [
            "id",
            "company_name",
            "address",
            "phone",
            "email",
            "website",
            "npwp",
        ]


class PriceListSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceList
        fields = [
            "id",
            "cargo_name",
            "price_per_kg",
            "effective_date",
            "note",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
