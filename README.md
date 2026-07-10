# Aplikasi Jembatan Timbang — Panduan & Roadmap

## Struktur Proyek

```
jembatan-timbang/
├── backend/                    # Django + PostgreSQL
│   ├── weighing/
│   │   ├── models.py           # Model WeighingTransaction
│   │   ├── serializers.py      # Serializer + logic idempotent
│   │   ├── views.py            # Endpoint /api/weighing/sync/
│   │   └── urls.py
│   ├── core/
│   │   └── settings_snippet.py # Bagian settings.py yang perlu ditambahkan
│   └── requirements.txt
│
└── frontend/                   # React (Vite) + Dexie.js + Web Serial API
    ├── src/
    │   ├── db/db.js             # Skema IndexedDB (Dexie)
    │   ├── hooks/useSerial.js   # Koneksi & parsing data timbangan
    │   ├── services/syncService.js  # Auto-sync ke backend
    │   ├── components/
    │   │   ├── Dashboard.jsx
    │   │   ├── WeighingForm.jsx
    │   │   └── SyncStatus.jsx
    │   ├── serviceWorker/sw-notes.md  # Setup Workbox/PWA
    │   └── App.jsx
    └── package.json
```

**Prinsip pemisahan tanggung jawab:**
- `hooks/useSerial.js` → HANYA urusan hardware (Web Serial API). Tidak tahu apa-apa soal database/API.
- `db/db.js` → HANYA urusan penyimpanan lokal (Dexie/IndexedDB).
- `services/syncService.js` → HANYA urusan sinkronisasi lokal ↔ server.
- `components/` → HANYA urusan tampilan, memanggil hook/service di atas.
- Backend `weighing/` → satu Django app, isolasi dari app lain kalau nanti ditambah modul (misal auth, laporan, dsb).

---

## Roadmap Tahapan Pengerjaan (dari nol → selesai)

### Fase 0 — Persiapan Lingkungan (1 hari)
1. Install Node.js, Python 3.11+, PostgreSQL.
2. `npm create vite@latest frontend -- --template react` (atau pakai struktur `src/` yang sudah dibuat di atas).
3. `django-admin startproject core backend` lalu `python manage.py startapp weighing`.
4. Buat database PostgreSQL: `createdb jembatan_timbang`.
5. Install dependency: `pip install -r backend/requirements.txt` dan `npm install` di folder frontend.

### Fase 1 — Riset & Uji Coba Web Serial API (2–3 hari) — **paling berisiko, kerjakan duluan**
1. Kalau alat timbangan fisik belum ada, pakai serial emulator (mis. `com0com` di Windows, atau simulasi via Arduino/USB-to-serial loopback) untuk mengirim string angka berat secara periodik.
2. Uji `navigator.serial.requestPort()` di Chrome — pastikan browser & OS mendukung.
3. Sesuaikan parsing di `processBuffer()` (`useSerial.js`) dengan format string asli dari indikator timbangan Anda (biasanya beda-beda per merk: ada yang pakai STX/ETX, ada yang cuma `\r\n`).
4. Uji coba baud rate/parity sesuai manual alat (Avery, CAS, dll).

> Kenapa fase ini duluan? Karena ini bagian paling tidak pasti (tergantung hardware asli). Kalau ternyata sulit, Anda masih punya waktu untuk cari alternatif sebelum fase-fase lain bergantung padanya.

### Fase 2 — Local Storage & CRUD Offline (2 hari)
1. Finalisasi skema Dexie di `db.js`.
2. Buat form input (`WeighingForm.jsx`) yang menyimpan langsung ke IndexedDB — belum ke server sama sekali di tahap ini.
3. Uji: matikan wifi, pastikan data tetap tersimpan dan muncul di riwayat lokal.

### Fase 3 — Backend API Django (2 hari)
1. Terapkan `models.py`, `serializers.py`, `views.py`, `urls.py` yang sudah dibuat.
2. `python manage.py makemigrations && python manage.py migrate`.
3. Uji endpoint `POST /api/weighing/sync/` pakai Postman/curl, kirim payload list dan pastikan idempotent (kirim UUID yang sama dua kali → tidak duplikat).
4. Aktifkan `django-cors-headers` supaya frontend bisa akses.

### Fase 4 — Sinkronisasi Otomatis (2 hari)
1. Sambungkan `syncService.js` ke Dashboard.
2. Uji skenario: input data saat offline → nyalakan internet → pastikan status berubah dari "pending" (merah) ke "synced" (hijau) otomatis dalam beberapa detik.
3. (Opsional lanjutan) Setup `vite-plugin-pwa` + Workbox untuk caching aset statis (lihat `sw-notes.md`) agar app bisa dibuka sama sekali tanpa internet.

### Fase 5 — Fitur Tambahan & Polish (2–3 hari)
1. **Cetak tiket thermal**: buat komponen print-view + CSS `@media print` (lebar 58mm/80mm), sembunyikan navigasi saat print.
2. **Ekspor Excel/PDF**: tambahkan library seperti `xlsx` (SheetJS) atau `jspdf` di frontend, atau endpoint export di backend.
3. **Konfigurasi & kalibrasi**: halaman settings untuk baud rate/data bits/parity, simpan preferensi di localStorage/Dexie.
4. **Pairing gross/tare otomatis**: logika mencocokkan nomor polisi yang sama untuk menghitung `berat_bersih_kg`.

### Fase 6 — Testing & Deployment (2–3 hari)
1. Testing end-to-end: koneksi timbangan real → simpan → sync → cetak.
2. Deploy backend (mis. VPS + Gunicorn + Nginx + PostgreSQL) — **catatan: Web Serial API mewajibkan HTTPS di production**, jadi frontend wajib di-deploy dengan SSL (kecuali diakses via `localhost`).
3. Build frontend (`npm run build`) dan sajikan sebagai static files atau lewat Nginx terpisah.
4. Siapkan backup database berkala.

---

## Estimasi Total
Sekitar **3–4 minggu** kerja jika dikerjakan sendiri/part-time, atau **1.5–2 minggu** jika frontend & backend dikerjakan paralel oleh 2 orang (karena keduanya cukup independen — hanya bertemu di kontrak API `POST /api/weighing/sync/`).

## Langkah Selanjutnya yang Disarankan
Mulai dari **Fase 1 (Web Serial API)** dulu karena itu bagian paling tidak pasti dan semua fitur lain bergantung padanya.
