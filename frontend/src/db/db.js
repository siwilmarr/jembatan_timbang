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

  db.version(6).stores({
    weighing_transactions:
      "++localId, id, nomor_polisi, jenis_timbang, sync_status, created_at_local, warehouse_id",
    destinations: "++id, name",
    cargos: "++id, name",
    units: "++id, name",
    customers: "++id, name",
    weighing_types: "++id, name",
    scales: "++id, name",
    site_profile: "id",
    site_profiles: "++id, company_name",
  });

  db.version(7).stores({
    weighing_transactions:
      "++localId, id, nomor_polisi, jenis_timbang, sync_status, created_at_local, warehouse_id",
    destinations: "++id, name",
    cargos: "++id, name",
    units: "++id, name",
    customers: "++id, name",
    weighing_types: "++id, name",
    scales: "++id, name",
    site_profile: "id",
    site_profiles: "++id, company_name",
    price_lists: "++id, cargo_name, effective_date",
  });
} else {
  // Placeholder agar import di SSR tidak crash
  db = {
    weighing_transactions: { add: async () => {}, where: () => ({ equals: () => ({ toArray: async () => [] }), above: () => ({ reverse: () => ({ toArray: async () => [] }) }), between: () => ({ toArray: async () => [] }) }), put: async () => {}, delete: async () => {}, toArray: async () => [] },
    destinations: { toArray: async () => [], bulkPut: async () => {}, clear: async () => {}, bulkAdd: async () => {} },
    cargos: { toArray: async () => [], bulkPut: async () => {}, clear: async () => {}, bulkAdd: async () => {} },
    units: { toArray: async () => [], bulkPut: async () => {}, clear: async () => {}, bulkAdd: async () => {} },
    customers: { toArray: async () => [], bulkPut: async () => {}, clear: async () => {}, bulkAdd: async () => {} },
    weighing_types: { toArray: async () => [], bulkPut: async () => {}, clear: async () => {}, bulkAdd: async () => {} },
    scales: { toArray: async () => [], bulkPut: async () => {}, clear: async () => {}, bulkAdd: async () => {} },
    site_profile: { toArray: async () => [], put: async () => {}, get: async () => null },
    site_profiles: { toArray: async () => [], bulkPut: async () => {}, clear: async () => {}, bulkAdd: async () => {}, delete: async () => {} },
    price_lists: { toArray: async () => [], bulkPut: async () => {}, clear: async () => {}, bulkAdd: async () => {}, delete: async () => {} },
  };
}

export { db };

/**
 * Simpan transaksi baru ke IndexedDB terlebih dahulu.
 * JANGAN pernah langsung memanggil API di sini — biarkan sync worker
 * yang bertanggung jawab mengirim ke server (lihat services/syncService.js).
 */
export async function saveTransactionLocally(transaction) {
  const existing = await db.weighing_transactions.where("id").equals(transaction.id).first();
  const updated = { ...existing, ...transaction, sync_status: "pending" };
  if (existing) {
    await db.weighing_transactions.update(existing.localId, updated);
    return { ...updated, localId: existing.localId };
  }
  await db.weighing_transactions.add(updated);
  return updated;
}

export async function cacheSyncedTransactionLocally(transaction) {
  const existing = await db.weighing_transactions.where("id").equals(transaction.id).first();
  if (existing?.sync_status === "pending") return existing;

  const updated = { ...existing, ...transaction, sync_status: "synced" };
  if (existing) {
    await db.weighing_transactions.update(existing.localId, updated);
    return { ...updated, localId: existing.localId };
  }
  await db.weighing_transactions.add(updated);
  return updated;
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