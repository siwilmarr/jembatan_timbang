from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import WeighingTransaction
from .serializers import WeighingTransactionSerializer


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

    queryset = WeighingTransaction.objects.all()
    serializer_class = WeighingTransactionSerializer
    permission_classes = [IsAuthenticated]

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