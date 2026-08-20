import Dexie from "dexie";

// Database lokal (offline-first). Ini adalah "sumber kebenaran sementara"
// sebelum data berhasil disinkronkan ke server Django.
//
// Guard SSR: Dexie membutuhkan indexedDB yang hanya ada di browser.
// Saat dijalankan di sisi server (Next.js SSR/build), kita buat instance
// kosong agar import tidak crash.
let db;

if (typeof window !== "undefined") {
  db = new Dexie("jembatan_timbang_db");

  db.version(1).stores({
    weighing_transactions:
      "++localId, id, nomor_polisi, jenis_timbang, sync_status, created_at_local",
  });

  db.version(2).stores({
    weighing_transactions:
      "++localId, id, nomor_polisi, jenis_timbang, sync_status, created_at_local, warehouse_id",
    destinations: "++id, name",
    cargos: "++id, name",
  });

  db.version(3).stores({
    weighing_transactions:
      "++localId, id, nomor_polisi, jenis_timbang, sync_status, created_at_local, warehouse_id",
    destinations: "++id, name",
    cargos: "++id, name",
    units: "++id, name",
    customers: "++id, name",
    weighing_types: "++id, name",
  });

  db.version(4).stores({
    weighing_transactions:
      "++localId, id, nomor_polisi, jenis_timbang, sync_status, created_at_local, warehouse_id",
    destinations: "++id, name",
    cargos: "++id, name",
    units: "++id, name",
    customers: "++id, name",
    weighing_types: "++id, name",
    scales: "++id, name",
  });
} else {
  // Placeholder agar import di SSR tidak crash
  db = {
    weighing_transactions: { add: async () => {}, where: () => ({ equals: () => ({ toArray: async () => [] }), above: () => ({ reverse: () => ({ toArray: async () => [] }) }), between: () => ({ toArray: async () => [] }) }), put: async () => {}, delete: async () => {}, toArray: async () => [] },
    destinations: { toArray: async () => [], bulkPut: async () => {} },
    cargos: { toArray: async () => [], bulkPut: async () => {} },
    units: { toArray: async () => [], bulkPut: async () => {} },
    customers: { toArray: async () => [], bulkPut: async () => {} },
    weighing_types: { toArray: async () => [], bulkPut: async () => {} },
    scales: { toArray: async () => [], bulkPut: async () => {} },
  };
}

export { db };

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