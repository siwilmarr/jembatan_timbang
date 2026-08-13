"use client";

// frontend/src/components/PrintReceipt.jsx
export default function PrintReceipt({ transaction }) {
  if (!transaction) return null;

  const {
    nomor_polisi, nama_driver, jenis_muatan, jenis_timbang,
    berat_kg, berat_bersih_kg, created_at_local, operator,
  } = transaction;

  return (
    <div className="receipt-print">
      <h2>JEMBATAN TIMBANG</h2>
      <p className="receipt-print__divider">--------------------------------</p>

      <div className="receipt-print__row">
        <span>No. Polisi</span>
        <span>{nomor_polisi}</span>
      </div>
      <div className="receipt-print__row">
        <span>Driver</span>
        <span>{nama_driver || "-"}</span>
      </div>
      <div className="receipt-print__row">
        <span>Muatan</span>
        <span>{jenis_muatan || "-"}</span>
      </div>
      <div className="receipt-print__row">
        <span>Jenis</span>
        <span>{jenis_timbang === "gross" ? "MASUK (Gross)" : "KELUAR (Tare)"}</span>
      </div>

      <p className="receipt-print__divider">--------------------------------</p>

      <div className="receipt-print__row receipt-print__row--big">
        <span>Berat</span>
        <span>{Number(berat_kg).toFixed(2)} kg</span>
      </div>
      {berat_bersih_kg != null && (
        <div className="receipt-print__row receipt-print__row--big">
          <span>Berat Bersih</span>
          <span>{Number(berat_bersih_kg).toFixed(2)} kg</span>
        </div>
      )}

      <p className="receipt-print__divider">--------------------------------</p>

      <div className="receipt-print__row">
        <span>Waktu</span>
        <span>{new Date(created_at_local).toLocaleString("id-ID")}</span>
      </div>
      <div className="receipt-print__row">
        <span>Operator</span>
        <span>{operator || "-"}</span>
      </div>

      <p className="receipt-print__footer">Terima kasih</p>
    </div>
  );
}