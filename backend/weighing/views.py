from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token

from .models import WeighingTransaction, Warehouse, Destination, Cargo, UserProfile, Unit, CustomerSupplier, WeighingType, WeighingScale
from django.contrib.auth.models import User
from .serializers import (
    WeighingTransactionSerializer,
    WarehouseSerializer,
    DestinationSerializer,
    CargoSerializer,
    UserSerializer,
    UnitSerializer,
    CustomerSupplierSerializer,
    WeighingTypeSerializer,
    WeighingScaleSerializer,
)
from .permissions import IsAdminOrReadOnly, IsAdminOrReadOnlyMaster, IsAdminUserOnly


class CustomObtainAuthToken(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data,
                                           context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, created = Token.objects.get_or_create(user=user)
        roles = list(user.groups.values_list('name', flat=True))
        if user.is_superuser and "Admin" not in roles:
            roles.append("Admin")

        # Ambil info warehouse dari UserProfile (jika ada)
        warehouse_id = None
        warehouse_name = None
        try:
            profile = user.profile
            if profile.warehouse:
                warehouse_id = profile.warehouse.id
                warehouse_name = profile.warehouse.name
        except UserProfile.DoesNotExist:
            pass

        return Response({
            'token': token.key,
            'user_id': user.pk,
            'username': user.username,
            'roles': roles,
            'warehouse_id': warehouse_id,
            'warehouse_name': warehouse_name,
        })


class WeighingTransactionViewSet(viewsets.ModelViewSet):
    """
    Endpoint utama:
      GET    /api/weighing/            -> riwayat penimbangan
      POST   /api/weighing/sync/       -> terima satu ATAU banyak (list) transaksi
      POST   /api/weighing/reset/      -> hapus massal berdasarkan filter (Admin only)

    FIXED: permission_classes sebenarnya sudah diwajibkan lewat
    DEFAULT_PERMISSION_CLASSES di settings.py, tapi dicantumkan eksplisit di
    sini juga supaya jelas kalau dibaca langsung dari file ini bahwa endpoint
    ini WAJIB pakai token (lihat header Authorization di syncService.js).
    """

    serializer_class = WeighingTransactionSerializer
    permission_classes = [IsAuthenticated, IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = WeighingTransaction.objects.all()
        gte = self.request.query_params.get("created_at_local_gte", None)
        lte = self.request.query_params.get("created_at_local_lte", None)
        wh = self.request.query_params.get("warehouse_id", None)
        if gte:
            queryset = queryset.filter(created_at_local__gte=gte)
        if lte:
            queryset = queryset.filter(created_at_local__lte=lte)
        if wh:
            queryset = queryset.filter(warehouse_id=wh)
        return queryset

    @action(detail=False, methods=["post"], url_path="sync")
    def sync(self, request):
        data = request.data
        items = data if isinstance(data, list) else [data]

        synced = []
        failed = []

        for item in items:
            serializer = self.get_serializer(data=item)
            if serializer.is_valid():
                serializer.save()
                synced.append(serializer.data)
            else:
                failed.append({"id": item.get("id"), "errors": serializer.errors})

        return Response(
            {
                "synced_count": len(synced),
                "failed_count": len(failed),
                "synced": synced,
                "failed": failed,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="reset")
    def reset(self, request):
        """Hapus massal transaksi berdasarkan filter tanggal & warehouse. Admin only."""
        user = request.user
        is_admin = user.is_superuser or user.groups.filter(name="Admin").exists()
        if not is_admin:
            return Response(
                {"detail": "Hanya Admin yang dapat melakukan reset data."},
                status=status.HTTP_403_FORBIDDEN,
            )

        gte = request.data.get("created_at_local_gte")
        lte = request.data.get("created_at_local_lte")
        wh = request.data.get("warehouse_id")

        if not gte or not lte:
            return Response(
                {"detail": "Parameter created_at_local_gte dan created_at_local_lte wajib diisi."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = WeighingTransaction.objects.filter(
            created_at_local__gte=gte,
            created_at_local__lte=lte,
        )
        if wh:
            qs = qs.filter(warehouse_id=wh)

        count, _ = qs.delete()
        return Response({"deleted_count": count}, status=status.HTTP_200_OK)


class WarehouseViewSet(viewsets.ModelViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    permission_classes = [IsAdminOrReadOnlyMaster]
    pagination_class = None


class DestinationViewSet(viewsets.ModelViewSet):
    queryset = Destination.objects.all()
    serializer_class = DestinationSerializer
    permission_classes = [IsAdminOrReadOnlyMaster]
    pagination_class = None


class CargoViewSet(viewsets.ModelViewSet):
    queryset = Cargo.objects.all()
    serializer_class = CargoSerializer
    permission_classes = [IsAdminOrReadOnlyMaster]
    pagination_class = None


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("id")
    serializer_class = UserSerializer
    permission_classes = [IsAdminUserOnly]
    pagination_class = None

    def destroy(self, request, *args, **kwargs):
        # Mencegah user menghapus akun dirinya sendiri secara tidak sengaja
        user_to_delete = self.get_object()
        if user_to_delete == request.user:
            return Response(
                {"detail": "Anda tidak dapat menghapus akun Anda sendiri."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class UnitViewSet(viewsets.ModelViewSet):
    queryset = Unit.objects.all().order_by("name")
    serializer_class = UnitSerializer
    permission_classes = [IsAdminOrReadOnlyMaster]
    pagination_class = None


class CustomerSupplierViewSet(viewsets.ModelViewSet):
    queryset = CustomerSupplier.objects.all().order_by("name")
    serializer_class = CustomerSupplierSerializer
    permission_classes = [IsAdminOrReadOnlyMaster]
    pagination_class = None


class WeighingTypeViewSet(viewsets.ModelViewSet):
    queryset = WeighingType.objects.all().order_by("name")
    serializer_class = WeighingTypeSerializer
    permission_classes = [IsAdminOrReadOnlyMaster]
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        active_only = self.request.query_params.get("active_only")
        if active_only == "1":
            qs = qs.filter(is_active=True)
        return qs


class WeighingScaleViewSet(viewsets.ModelViewSet):
    queryset = WeighingScale.objects.all()
    serializer_class = WeighingScaleSerializer
    permission_classes = [IsAdminOrReadOnlyMaster]
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        active_only = self.request.query_params.get("active_only")
        if active_only == "1":
            qs = qs.filter(is_active=True)
        return qs


import os
import json
from rest_framework.views import APIView
from django.conf import settings
from django.db import connections

class DatabaseConfigView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUserOnly]

    def get(self, request):
        config_path = os.path.join(settings.BASE_DIR, "database_config.json")
        data = {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": "",
            "USER": "",
            "PASSWORD": "",
            "HOST": "",
            "PORT": "",
        }
        # Fallback to current active default DB settings
        default_db = settings.DATABASES.get("default", {})
        data["ENGINE"] = default_db.get("ENGINE", data["ENGINE"])
        data["NAME"] = default_db.get("NAME", data["NAME"])
        data["USER"] = default_db.get("USER", data["USER"])
        data["HOST"] = default_db.get("HOST", data["HOST"])
        data["PORT"] = default_db.get("PORT", data["PORT"])

        if os.path.exists(config_path):
            try:
                with open(config_path, "r") as f:
                    file_data = json.load(f)
                    for k in data:
                        if k in file_data:
                            data[k] = file_data[k]
            except Exception:
                pass

        if data["PASSWORD"]:
            data["PASSWORD"] = "********"

        return Response(data, status=status.HTTP_200_OK)

    def post(self, request):
        config_path = os.path.join(settings.BASE_DIR, "database_config.json")
        req_data = request.data

        required = ["ENGINE", "NAME"]
        for field in required:
            if not req_data.get(field):
                return Response(
                    {"detail": f"Field '{field}' wajib diisi."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Retrieve old password if current password is empty or masked
        old_password = ""
        if os.path.exists(config_path):
            try:
                with open(config_path, "r") as f:
                    old_data = json.load(f)
                    old_password = old_data.get("PASSWORD", "")
            except:
                pass
        if not old_password:
            old_password = settings.DATABASES.get("default", {}).get("PASSWORD", "")

        new_password = req_data.get("PASSWORD", "")
        if new_password == "********" or not new_password:
            new_password = old_password

        new_config = {
            "ENGINE": req_data.get("ENGINE"),
            "NAME": req_data.get("NAME"),
            "USER": req_data.get("USER", ""),
            "PASSWORD": new_password,
            "HOST": req_data.get("HOST", ""),
            "PORT": req_data.get("PORT", ""),
        }

        # Validate engine choices
        valid_engines = [
            "django.db.backends.postgresql",
            "django.db.backends.mysql",
            "django.db.backends.sqlite3",
            "django.db.backends.oracle"
        ]
        if new_config["ENGINE"] not in valid_engines:
            return Response(
                {"detail": "Engine database tidak valid."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Test database connection dynamically
        from django.db.utils import ConnectionHandler
        from django.db import DEFAULT_DB_ALIAS

        test_config = dict(new_config)
        if test_config["ENGINE"] == "django.db.backends.sqlite3":
            from pathlib import Path
            db_path = Path(test_config["NAME"])
            if not db_path.is_absolute():
                db_path = (settings.BASE_DIR / db_path).resolve()
            db_path.parent.mkdir(parents=True, exist_ok=True)
            test_config["NAME"] = str(db_path)

        test_databases = {
            DEFAULT_DB_ALIAS: test_config
        }
        test_connections = ConnectionHandler(test_databases)

        try:
            conn = test_connections[DEFAULT_DB_ALIAS]
            conn.ensure_connection()
            conn.close()
        except Exception as e:
            return Response(
                {
                    "detail": f"Koneksi gagal: {str(e)}",
                    "success": False
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Save config files
        try:
            with open(config_path, "w") as f:
                json.dump(new_config, f, indent=4)
        except Exception as e:
            return Response(
                {"detail": f"Gagal menulis file konfigurasi: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Apply settings dynamically to current process
        settings.DATABASES[DEFAULT_DB_ALIAS] = test_config
        connections[DEFAULT_DB_ALIAS].close()

        return Response(
            {
                "detail": "Konfigurasi database berhasil disimpan dan diterapkan.",
                "success": True
            },
            status=status.HTTP_200_OK
        )