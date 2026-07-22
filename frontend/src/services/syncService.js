import { getPendingTransactions, markAsSynced } from "../db/db";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

// ADDED: token per-device untuk autentikasi ke backend (lihat settings.py:
// REST_FRAMEWORK DEFAULT_AUTHENTICATION_CLASSES = TokenAuthentication).
// Nilainya WAJIB diisi di file .env masing-masing device/kios lewat:
//   VITE_DEVICE_API_TOKEN=<token yang dibuat lewat Django admin>
// Cara membuat token: lihat catatan setup di akhir pesan.
const API_TOKEN = import.meta.env.VITE_DEVICE_API_TOKEN;

// ADDED: mutex sederhana untuk cegah beberapa sync berjalan bersamaan.
// syncPendingTransactions() bisa dipicu dari banyak sumber di saat yang
// hampir bersamaan (interval polling, event 'online', tombol manual
// "Sinkronkan Sekarang"). Tanpa lock ini, dua request bisa membaca
// `pending` yang sama sebelum salah satunya sempat markAsSynced,
// menyebabkan data terkirim dobel ke server (dan boros bandwidth/kuota).
let isSyncing = false;

export async function syncPendingTransactions() {
  if (isSyncing) {
    return { synced: 0, skipped: true, reason: "already_syncing" };
  }
  isSyncing = true;

  try {
    return await runSync();
  } finally {
    isSyncing = false;
  }
}

async function runSync() {
  if (!navigator.onLine) return { synced: 0, skipped: true };

  const userToken = localStorage.getItem("user_token");
  if (!userToken) {
    return { synced: 0, skipped: true, reason: "not_logged_in" };
  }

  const pending = await getPendingTransactions();
  if (pending.length === 0) return { synced: 0, skipped: false };

  const payload = pending.map(({ localId, ...rest }) => rest);

  const res = await fetch(`${API_BASE}/weighing/sync/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${userToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Sync gagal: ${res.status}`);

  const result = await res.json();

  // FIXED: sebelumnya SEMUA `pending` langsung ditandai synced setelah
  // response 200 OK, dengan asumsi all-or-nothing. Sekarang backend bisa
  // sync SEBAGIAN saja (lihat views.py) — jadi cuma tandai localId yang
  // ID-nya benar-benar muncul di `result.synced`. Yang gagal TETAP
  // berstatus "pending" di IndexedDB supaya dicoba lagi di siklus
  // berikutnya, tanpa memblokir yang lain.
  const syncedIds = new Set((result.synced || []).map((tx) => tx.id));
  const localsToMark = pending.filter((tx) => syncedIds.has(tx.id));

  await Promise.all(localsToMark.map((tx) => markAsSynced(tx.localId)));

  if (result.failed && result.failed.length > 0) {
    // Data ini akan TERUS gagal setiap 15 detik sampai diperbaiki manual
    // (mis. field wajib kosong) — layak ditampilkan ke UI, bukan cuma console.
    console.error("Sebagian data gagal sync (butuh pengecekan manual):", result.failed);
  }

  return {
    synced: localsToMark.length,
    failed: result.failed_count || 0,
    skipped: false,
  };
}

/**
 * Dipanggil dari App.jsx: polling ringan + listener saat koneksi kembali online.
 * (Alternatif lebih canggih: background sync via Service Worker/Workbox.)
 */
export function startAutoSync(intervalMs = 15000) {
  const timer = setInterval(() => {
    syncPendingTransactions().catch(console.error);
  }, intervalMs);

  const handleOnline = () => {
    syncPendingTransactions().catch(console.error);
  };
  window.addEventListener("online", handleOnline);

  return () => {
    clearInterval(timer);
    window.removeEventListener("online", handleOnline);
  };
}