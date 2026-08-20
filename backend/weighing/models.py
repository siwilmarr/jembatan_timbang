import uuid
from django.db import models, transaction
from django.contrib.auth.models import User


class Warehouse(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=20, unique=True, blank=True)

    def __str__(self):
        return self.name


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    warehouse = models.ForeignKey(Warehouse, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} - {self.warehouse.name if self.warehouse else 'No Warehouse'}"


class Destination(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name


class Cargo(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name


class Unit(models.Model):
    """Master jenis/tipe kendaraan (contoh: Fuso, Tronton, Dump Truck)."""
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, default="")

    def __str__(self):
        return self.name


class CustomerSupplier(models.Model):
    """Master data pelanggan (customer) atau pemasok (supplier)."""
    TYPE_CHOICES = [
        ("customer", "Customer"),
        ("supplier", "Supplier"),
        ("both", "Customer & Supplier"),
    ]
    name = models.CharField(max_length=150, unique=True)
    type = models.CharField(max_length=10, choices=TYPE_CHOICES, default="customer")
    contact = models.CharField(max_length=100, blank=True, default="")
    address = models.TextField(blank=True, default="")

    def __str__(self):
        return f"{self.name} ({self.get_type_display()})"


class WeighingType(models.Model):
    """
    Master jenis timbangan beserta konfigurasi spesifik per tipe.
    Contoh: Kelapa Sawit (potongan 3%), Pupuk (tanpa potongan), dst.
    """
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, default="")
    # Potongan berat otomatis dalam persen (0-100). Misal: 3.5 = 3.5%
    deduction_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        help_text="Potongan berat otomatis dalam persen (0 = tidak ada potongan)"
    )
    # Validasi field wajib diisi oleh operator
    require_driver = models.BooleanField(default=True, help_text="Nama driver wajib diisi")
    require_destination = models.BooleanField(default=True, help_text="Tujuan wajib diisi")
    require_cargo = models.BooleanField(default=True, help_text="Jenis muatan wajib diisi")
    require_customer = models.BooleanField(default=False, help_text="Customer/Supplier wajib diisi")
    require_unit = models.BooleanField(default=False, help_text="Jenis unit kendaraan wajib diisi")
    # Batas berat kendaraan maksimal (0 = tidak dibatasi)
    max_weight_kg = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text="Batas berat kendaraan maksimal dalam kg (0 = tidak dibatasi)"
    )
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class WeighingScale(models.Model):
    """
    Master alat timbangan fisik (indikator) beserta spesifikasi protokol serial.
    Contoh: Timbangan 01 (CAS - 9600 baud), Timbangan 02 (GSC - 4800 baud), dst.
    """
    INDICATOR_CHOICES = [
        ("CAS", "CAS (Format Detail)"),
        ("GSC", "GSC (Format Sederhana)"),
    ]
    name = models.CharField(max_length=100, unique=True)
    indicator_type = models.CharField(max_length=10, choices=INDICATOR_CHOICES, default="CAS")
    baud_rate = models.IntegerField(default=9600)
    data_bits = models.IntegerField(default=8)
    stop_bits = models.IntegerField(default=1)
    parity = models.CharField(max_length=10, default="none")
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.get_indicator_type_display()})"


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
    tujuan = models.CharField(max_length=100, blank=True)
    jenis_timbang = models.CharField(max_length=10, choices=JENIS_TIMBANG)
    warehouse = models.ForeignKey(Warehouse, null=True, blank=True, on_delete=models.SET_NULL)

    # Fields added for new master configurations
    unit = models.CharField(max_length=100, blank=True, default="")
    customer_supplier = models.CharField(max_length=100, blank=True, default="")
    weighing_type = models.CharField(max_length=100, blank=True, default="")
    deduction_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0.00)
    berat_potongan_kg = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

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

            # Hitung berat bersih setelah potongan otomatis
            berat_bersih_sebelum_potongan = abs(gross_tx.berat_kg - tare_tx.berat_kg)
            deduction_percent = max(gross_tx.deduction_percent or 0, tare_tx.deduction_percent or 0)
            berat_potongan = berat_bersih_sebelum_potongan * (deduction_percent / 100)
            berat_bersih = berat_bersih_sebelum_potongan - berat_potongan

            # Hubungkan dan simpan DUA-duanya
            WeighingTransaction.objects.filter(pk=gross_tx.pk).update(
                pasangan=tare_tx,
                berat_potongan_kg=berat_potongan,
                berat_bersih_kg=berat_bersih
            )
            WeighingTransaction.objects.filter(pk=tare_tx.pk).update(
                pasangan=gross_tx,
                berat_potongan_kg=berat_potongan,
                berat_bersih_kg=berat_bersih
            )