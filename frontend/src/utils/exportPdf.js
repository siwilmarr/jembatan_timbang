import jsPDF from "jspdf";
import "jspdf-autotable";

export function exportTransactionsToPdf(transactions, filename = "riwayat-timbang") {
  const doc = new jsPDF("landscape", "mm", "a4");

  // Title
  doc.setFontSize(16);
  doc.text("Laporan Riwayat Transaksi Jembatan Timbang", 14, 15);
  doc.setFontSize(10);
  doc.text(`Tanggal Cetak: ${new Date().toLocaleString("id-ID")}`, 14, 20);

  const columns = [
    { title: "Waktu Lokal", dataKey: "waktu" },
    { title: "Warehouse", dataKey: "warehouse" },
    { title: "No. Polisi", dataKey: "nomor_polisi" },
    { title: "Nama Driver", dataKey: "nama_driver" },
    { title: "Jenis Timbang", dataKey: "jenis" },
    { title: "Berat (kg)", dataKey: "berat" },
    { title: "Netto (kg)", dataKey: "netto" },
    { title: "Muatan", dataKey: "muatan" },
    { title: "Tujuan", dataKey: "tujuan" },
    { title: "Operator", dataKey: "operator" }
  ];

  const rows = transactions.map((tx) => ({
    waktu: new Date(tx.created_at_local).toLocaleString("id-ID"),
    warehouse: tx.warehouse_name || "-",
    nomor_polisi: tx.nomor_polisi,
    nama_driver: tx.nama_driver,
    jenis: tx.jenis_timbang === "gross" ? "Masuk (Gross)" : "Keluar (Tare)",
    berat: `${parseFloat(tx.berat_kg).toLocaleString("id-ID")} kg`,
    netto: tx.berat_bersih_kg ? `${parseFloat(tx.berat_bersih_kg).toLocaleString("id-ID")} kg` : "-",
    muatan: tx.jenis_muatan || "-",
    tujuan: tx.tujuan || "-",
    operator: tx.operator || "-"
  }));

  doc.autoTable({
    columns: columns,
    body: rows,
    startY: 25,
    margin: { horizontal: 14 },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    theme: "striped"
  });

  const today = new Date().toISOString().slice(0, 10);
  doc.save(`${filename}-${today}.pdf`);
}
