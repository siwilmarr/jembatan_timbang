from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token

from .models import WeighingTransaction
from .serializers import WeighingTransactionSerializer
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
        return Response({
            'token': token.key,
            'user_id': user.pk,
            'username': user.username,
            'roles': roles
        })


class WeighingTransactionViewSet(viewsets.ModelViewSet):
    """
    Endpoint utama:
      GET    /api/weighing/            -> riwayat penimbangan
      POST   /api/weighing/sync/       -> terima satu ATAU banyak (list) transaksi

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
        if gte:
            queryset = queryset.filter(created_at_local__gte=gte)
        return queryset

    @action(detail=False, methods=["post"], url_path="sync")
    def sync(self, request):
        data = request.data
        items = data if isinstance(data, list) else [data]

        # FIXED: sebelumnya pakai serializer many=True dengan
        # is_valid(raise_exception=True) — SATU record tidak valid membuat
        # SELURUH batch gagal, termasuk record lain yang sebenarnya valid.
        # Karena frontend mengulang payload yang sama tiap 15 detik
        # (lihat syncService.js/startAutoSync), satu data korup akan
        # mengunci seluruh antrian offline selamanya.
        #
        # Sekarang tiap item diproses SATU-SATU dan independen: yang valid
        # tetap ke-sync, yang gagal dilaporkan terpisah di response supaya
        # bisa ditindaklanjuti manual tanpa memblokir yang lain.
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