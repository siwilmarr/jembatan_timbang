import uuid
from django.db import models, transaction


class WeighingTransaction(models.Model):
    """
    Satu baris = satu transaksi timbang (bisa gross atau tare).
    UUID dibuat di FRONTEND (bukan backend) agar idempotent saat sync ulang.
    """

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("synced", "Synced"),
    ]

    JENIS_TIMBANG = [
        ("gross", "Timbangan Masuk (Gross)"),
        ("tare", "Timbangan Keluar (Tare)"),
    ]

    # UUID dari frontend jadi primary key -> mencegah duplikasi saat retry sync
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    nomor_polisi = models.CharField(max_length=20)
    nama_driver = models.CharField(max_length=100)
    jenis_muatan = models.CharField(max_length=100, blank=True)
    jenis_timbang = models.CharField(max_length=10, choices=JENIS_TIMBANG)

    berat_kg = models.DecimalField(max_digits=10, decimal_places=2)
    berat_bersih_kg = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )  # diisi kalau sudah ada pasangan gross/tare

    # Pasangan transaksi (gross <-> tare) untuk kendaraan yang sama
    pasangan = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    operator = models.CharField(max_length=100, blank=True)

    # Jejak waktu untuk audit selisih lokal vs server (lihat spesifikasi Bagian 3B)
    created_at_local = models.DateTimeField()
    created_at_server = models.DateTimeField(auto_now_add=True)

    sync_status = models.CharField(
        max_length=10, choices=STATUS_CHOICES, default="synced"
    )

    class Meta:
        ordering = ["-created_at_server"]
        indexes = [
            models.Index(fields=["nomor_polisi"]),
            models.Index(fields=["created_at_local"]),
        ]

    def __str__(self):
        return f"{self.nomor_polisi} - {self.jenis_timbang} - {self.berat_kg}kg"

    def try_pair(self):
        """
        Cari pasangan (gross<->tare) dengan nomor_polisi sama yang belum
        terhubung, lalu hitung berat_bersih_kg untuk KEDUA sisi.
        Dipanggil setelah transaksi ini disimpan (lihat serializers.py).

        Dibungkus transaction.atomic() + select_for_update() supaya kalau
        2 request sync datang hampir bersamaan (mis. 2 device sync di waktu
        yang sama), keduanya tidak bisa memasangkan kandidat yang sama secara
        ganda (race condition).

        Catatan: select_for_update() butuh backend yang mendukung row-locking
        sungguhan (PostgreSQL). Di SQLite (dev), Django tetap menjalankannya
        tapi lock efektif di level database file, bukan per-baris — cukup
        aman untuk development single-process, tapi validasi race condition
        yang sesungguhnya baru berarti di PostgreSQL produksi.
        """
        if self.pasangan_id is not None:
            return  # sudah punya pasangan, tidak perlu diproses lagi

        lawan_jenis = "tare" if self.jenis_timbang == "gross" else "gross"

        with transaction.atomic():
            pasangan = (
                WeighingTransaction.objects.select_for_update()
                .filter(
                    nomor_polisi=self.nomor_polisi,
                    jenis_timbang=lawan_jenis,
                    pasangan__isnull=True,
                )
                .exclude(pk=self.pk)
                # FIFO: pasangkan dengan trip yang PALING LAMA menunggu duluan,
                # bukan yang paling baru — supaya kendaraan yang bolak-balik
                # beberapa kali sehari tidak tertukar pasangan trip-nya.
                .order_by("created_at_local")
                .first()
            )

            if pasangan is None:
                return  # belum ada pasangannya, tunggu sync berikutnya

            # Kunci ulang diri sendiri di dalam transaksi yang sama, untuk jaga-jaga
            # kalau request paralel lain sudah keburu memasangkan `self` duluan
            # di antara pengecekan pasangan_id di atas dan titik ini.
            self_locked = WeighingTransaction.objects.select_for_update().get(pk=self.pk)
            if self_locked.pasangan_id is not None:
                return

            gross_tx = self if self.jenis_timbang == "gross" else pasangan
            tare_tx = self if self.jenis_timbang == "tare" else pasangan

            berat_bersih = abs(gross_tx.berat_kg - tare_tx.berat_kg)

            # Hubungkan dan simpan DUA-duanya
            WeighingTransaction.objects.filter(pk=gross_tx.pk).update(
                pasangan=tare_tx, berat_bersih_kg=berat_bersih
            )
            WeighingTransaction.objects.filter(pk=tare_tx.pk).update(
                pasangan=gross_tx, berat_bersih_kg=berat_bersih
            )