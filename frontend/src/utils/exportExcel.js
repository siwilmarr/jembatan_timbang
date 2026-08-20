import * as XLSX from "xlsx";

// ADDED: kalau field teks bebas (nomor_polisi, nama_driver, jenis_muatan)
// kebetulan diawali karakter =, +, -, atau @, Excel bisa menganggapnya
// FORMULA saat file dibuka (formula injection). Prefix dengan tanda kutip
// supaya Excel selalu memperlakukannya sebagai teks biasa.
function sanitizeCell(value) {
  if (typeof value === "string" && /^[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

export function exportTransactionsToExcel(transactions, filename = "riwayat-timbang") {
  const rows = transactions.map((tx) => ({
    "Jenis Timbangan": sanitizeCell(tx.weighing_type || "-"),
    "No. Polisi": sanitizeCell(tx.nomor_polisi),
    "Driver": sanitizeCell(tx.nama_driver),
    "Unit": sanitizeCell(tx.unit || "-"),
    "Customer/Supplier": sanitizeCell(tx.customer_supplier || "-"),
    "Muatan": sanitizeCell(tx.jenis_muatan),
    "Jenis": tx.jenis_timbang === "gross" ? "Masuk (Gross)" : "Keluar (Tare)",
    "Berat (kg)": tx.berat_kg,
    "Potongan (kg)": tx.berat_potongan_kg ?? "-",
    "Berat Bersih (kg)": tx.berat_bersih_kg ?? "-",
    "Waktu Lokal": new Date(tx.created_at_local).toLocaleString("id-ID"),
    "Status": tx.sync_status === "synced" ? "Tersinkron" : "Pending",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Riwayat Timbang");

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filename}-${today}.xlsx`);
}