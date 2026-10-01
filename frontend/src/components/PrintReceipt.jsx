"use client";

// frontend/src/components/PrintReceipt.jsx
// Cetak Tiket Timbang (Format Setengah Kertas A4 / A5 Landscape 210mm x 148mm)

function formatTanggalIndo(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const bulan = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agt", "Sep", "Okt", "Nov", "Des"
  ];
  const jam = String(d.getHours()).padStart(2, "0");
  const menit = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()} ${jam}:${menit} WIB`;
}

export default function PrintReceipt({ transaction, siteProfile }) {
  if (!transaction) return null;

  const {
    id,
    nomor_polisi,
    nama_driver,
    jenis_muatan,
    tujuan,
    unit,
    jenis_timbang,
    berat_kg,
    berat_bersih_kg,
    deduction_percent,
    harga_per_kg,
    total_harga,
    created_at_local,
    operator,
    customer_supplier,
    warehouse_name,
    site_profile_name,
    site_profile_address,
    site_profile_phone,
  } = transaction;

  const companyName = site_profile_name || siteProfile?.company_name || "JEMBATAN TIMBANG";
  const companyAddress = site_profile_address || siteProfile?.address || "";
  const companyPhone = site_profile_phone || siteProfile?.phone || "";

  const numGross = jenis_timbang === "gross" ? Number(berat_kg || 0) : (berat_bersih_kg != null ? Number(berat_kg || 0) + Number(berat_bersih_kg || 0) : Number(berat_kg || 0));
  const numTare = jenis_timbang === "tare" ? Number(berat_kg || 0) : null;
  const numNetto = berat_bersih_kg != null ? Number(berat_bersih_kg) : null;
  const numPotongan = Number(deduction_percent) || 0;
  const numHarga = Number(harga_per_kg) || 0;
  const numTotal = Number(total_harga) || 0;

  const formattedDate = formatTanggalIndo(created_at_local);
  const ticketNo = id ? `TKB-${String(id).slice(-4).padStart(4, "0")}` : "TKB-0001";

  return (
    <div className="receipt-print receipt-ticket-half-a4">
      <div className="ticket-border-box">
        {/* Header Tiket */}
        <div className="ticket-header">
          <div className="ticket-header__company">
            <h2 className="ticket-company-name">{companyName}</h2>
            {companyAddress && <p className="ticket-company-address">{companyAddress}</p>}
            {companyPhone && <p className="ticket-company-phone">Telp: {companyPhone}</p>}
          </div>

          <div className="ticket-header__title-box">
            <h1 className="ticket-title">TIKET TIMBANGAN</h1>
            <div className="ticket-meta">
              <div>
                <strong>No. Tiket:</strong> <span>{ticketNo}</span>
              </div>
              <div>
                <strong>Waktu:</strong> <span>{formattedDate}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="ticket-divider" />

        {/* Informasi Utama Transaksi */}
        <div className="ticket-info-grid">
          <div className="ticket-info-col">
            <div className="ticket-info-row">
              <span className="ticket-info-label">No. Polisi</span>
              <span className="ticket-info-colon">:</span>
              <span className="ticket-info-val ticket-info-val--highlight">{nomor_polisi || "-"}</span>
            </div>
            <div className="ticket-info-row">
              <span className="ticket-info-label">Nama Driver</span>
              <span className="ticket-info-colon">:</span>
              <span className="ticket-info-val">{nama_driver || "-"}</span>
            </div>
            <div className="ticket-info-row">
              <span className="ticket-info-label">Cust / Supp</span>
              <span className="ticket-info-colon">:</span>
              <span className="ticket-info-val">{customer_supplier || "-"}</span>
            </div>
            <div className="ticket-info-row">
              <span className="ticket-info-label">Unit Kendaraan</span>
              <span className="ticket-info-colon">:</span>
              <span className="ticket-info-val">{unit || "-"}</span>
            </div>
          </div>

          <div className="ticket-info-col">
            <div className="ticket-info-row">
              <span className="ticket-info-label">Jenis Muatan</span>
              <span className="ticket-info-colon">:</span>
              <span className="ticket-info-val">{jenis_muatan || "-"}</span>
            </div>
            <div className="ticket-info-row">
              <span className="ticket-info-label">Tujuan</span>
              <span className="ticket-info-colon">:</span>
              <span className="ticket-info-val">{tujuan || "-"}</span>
            </div>
            <div className="ticket-info-row">
              <span className="ticket-info-label">Jenis Timbang</span>
              <span className="ticket-info-colon">:</span>
              <span className="ticket-info-val">
                {jenis_timbang === "gross" ? "MASUK (GROSS)" : "KELUAR (TARE & NETTO)"}
              </span>
            </div>
            <div className="ticket-info-row">
              <span className="ticket-info-label">Operator / Pos</span>
              <span className="ticket-info-colon">:</span>
              <span className="ticket-info-val">
                {operator || "Operator"} {warehouse_name ? `(${warehouse_name})` : ""}
              </span>
            </div>
          </div>
        </div>

        {/* Tabel / Kotak Hasil Berat Timbangan */}
        <div className="ticket-weight-box">
          <div className="weight-cell">
            <span className="weight-cell__label">Berat Gross (Masuk)</span>
            <span className="weight-cell__val">
              {numGross > 0 ? `${numGross.toFixed(2)} kg` : `${Number(berat_kg || 0).toFixed(2)} kg`}
            </span>
          </div>

          <div className="weight-cell">
            <span className="weight-cell__label">Berat Tare (Keluar)</span>
            <span className="weight-cell__val">
              {numTare != null ? `${numTare.toFixed(2)} kg` : "-"}
            </span>
          </div>

          {numPotongan > 0 && (
            <div className="weight-cell">
              <span className="weight-cell__label">Potongan</span>
              <span className="weight-cell__val">{numPotongan}%</span>
            </div>
          )}

          <div className="weight-cell weight-cell--netto">
            <span className="weight-cell__label">BERAT BERSIH (NETTO)</span>
            <span className="weight-cell__val weight-cell__val--big">
              {numNetto != null ? `${numNetto.toFixed(2)} kg` : `${Number(berat_kg || 0).toFixed(2)} kg`}
            </span>
            {numNetto != null && (
              <span className="weight-cell__ton">({(numNetto / 1000).toFixed(3)} Ton)</span>
            )}
          </div>

          {numTotal > 0 && (
            <div className="weight-cell weight-cell--total">
              <span className="weight-cell__label">Total Biaya (Rp)</span>
              <span className="weight-cell__val weight-cell__val--total">
                Rp {numTotal.toLocaleString("id-ID")}
              </span>
              {numHarga > 0 && (
                <span className="weight-cell__sub">(@ Rp {numHarga.toLocaleString("id-ID")}/kg)</span>
              )}
            </div>
          )}
        </div>


      </div>
    </div>
  );
}