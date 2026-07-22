from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token

from .models import WeighingTransaction, Warehouse, Destination, Cargo, UserProfile
from .serializers import (
    WeighingTransactionSerializer,
    WarehouseSerializer,
    DestinationSerializer,
    CargoSerializer,
)
from .permissions import IsAdminOrReadOnly


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


class WarehouseViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None


class DestinationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Destination.objects.all()
    serializer_class = DestinationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None


class CargoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Cargo.objects.all()
    serializer_class = CargoSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None