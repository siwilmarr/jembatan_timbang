import Dexie from "dexie";

// Database lokal (offline-first). Ini adalah "sumber kebenaran sementara"
// sebelum data berhasil disinkronkan ke server Django.
export const db = new Dexie("jembatan_timbang_db");

db.version(1).stores({
  // ++localId = auto increment key lokal (bukan dikirim ke server)
  // id = uuid, dipakai sebagai primary key di server juga (idempotency)
  weighing_transactions:
    "++localId, id, nomor_polisi, jenis_timbang, sync_status, created_at_local",
});

/**
 * Simpan transaksi baru ke IndexedDB terlebih dahulu.
 * JANGAN pernah langsung memanggil API di sini — biarkan sync worker
 * yang bertanggung jawab mengirim ke server (lihat services/syncService.js).
 */
export async function saveTransactionLocally(transaction) {

  return db.weighing_transactions.add({
    ...transaction,
    sync_status: "pending",
  });
}

export function getPendingTransactions() {
  return db.weighing_transactions.where("sync_status").equals("pending").toArray();
}

export async function markAsSynced(localId) {
  return db.weighing_transactions.update(localId, { sync_status: "synced" });
}

export function getTodayHistory() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return db.weighing_transactions
    .where("created_at_local")
    .above(startOfDay.toISOString())
    .reverse()
    .toArray();
}