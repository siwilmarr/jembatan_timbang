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

function formatJam(dateStr) {
  if (!dateStr) return "--:--:--";
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function formatTanggalCetak(dateStr) {
  if (!dateStr) return "MINGGU,---";
  const d = new Date(dateStr);
  const hari = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
  const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
  return `${hari[d.getDay()]},${String(d.getDate()).padStart(2, "0")}-${bulan[d.getMonth()]}-${d.getFullYear()}`;
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
    gross_berat_kg,
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

  const companyName = site_profile_name || siteProfile?.company_name || "PT. SARANA SUBUR AGRINDOTAMA";
  const companyAddress = site_profile_address || siteProfile?.address || "Jl. A. Yani KM 107 Jorong, Kec.Jorong Tanah Laut, Kalimantan Selatan";
  const companyPhone = site_profile_phone || siteProfile?.phone || "";

  let numGross, numTare;
  if (jenis_timbang === "gross") {
    numGross = Number(berat_kg || 0);
    numTare = null;
  } else {
    numTare = Number(berat_kg || 0);
    if (gross_berat_kg != null) {
      numGross = Number(gross_berat_kg);
    } else if (berat_bersih_kg != null) {
      numGross = numTare + Number(berat_bersih_kg);
    } else {
      numGross = numTare;
    }
  }
  const numNetto = berat_bersih_kg != null ? Number(berat_bersih_kg) : (jenis_timbang === "gross" ? 0 : Number(berat_kg || 0));
  const numPotongan = Number(deduction_percent) || 0;
  const numHarga = Number(harga_per_kg) || 0;
  const numTotal = Number(total_harga) || 0;

  const masukAt = created_at_local || new Date().toISOString();
  const keluarAt = created_at_local || new Date().toISOString();
  const shortRec = id ? String(id).slice(-4).padStart(4, "0") : "0000";
  const supplierLabel = customer_supplier || "UMUM";
  const materialLabel = jenis_muatan || "TIMBANG TBS";
  const unitLabel = unit || "TBS";
  const polLabel = nomor_polisi || "-";
  const noteValue = 1;

  const formattedDate = formatTanggalIndo(created_at_local);
  const ticketNo = id ? `TKB-${String(id).slice(-4).padStart(4, "0")}` : "TKB-0001";

  return (
    <div className="receipt-print receipt-ticket-half-a4">
      <div className="ticket-border-box ticket-formal-box">
        <div className="ticket-formal-header">
          <div className="ticket-formal-company">{companyName}</div>
          <div className="ticket-formal-address">{companyAddress}</div>
          <div className="ticket-formal-rule" />
          <div className="ticket-formal-title">BUKTI PENIMBANGAN</div>
        </div>

        <div className="ticket-formal-body">
          <div className="ticket-formal-section-title">PENERIMAAN DARI</div>

          <div className="ticket-formal-row ticket-formal-row--compact">
            <span className="ticket-formal-key">SUPPLIER</span>
            <span className="ticket-formal-colon">:</span>
            <span className="ticket-formal-value">{supplierLabel}</span>
            <span className="ticket-formal-space" />
            <span className="ticket-formal-code">{shortRec}</span>
            <span className="ticket-formal-right">No.Rec. : {shortRec} (2)</span>
          </div>

          <div className="ticket-formal-row ticket-formal-row--compact">
            <span className="ticket-formal-key">MATERIAL</span>
            <span className="ticket-formal-colon">:</span>
            <span className="ticket-formal-value">{materialLabel}</span>
            <span className="ticket-formal-space" />
            <span className="ticket-formal-unit">{unitLabel}</span>
            <span className="ticket-formal-right">No.Pol. : {polLabel}</span>
          </div>

          <div className="ticket-formal-weight-table">
            <div className="ticket-formal-weight-row">
              <span className="ticket-formal-label">Masuk</span>
              <span className="ticket-formal-colon">:</span>
              <span className="ticket-formal-time">{formatJam(masukAt)}</span>
              <span className="ticket-formal-date">{formatTanggalCetak(masukAt)}</span>
              <span className="ticket-formal-amount-label">BRUTO</span>
              <span className="ticket-formal-amount-value">{numGross.toFixed(2)} kg</span>
            </div>

            <div className="ticket-formal-weight-row">
              <span className="ticket-formal-label">Keluar</span>
              <span className="ticket-formal-colon">:</span>
              <span className="ticket-formal-time">{formatJam(keluarAt)}</span>
              <span className="ticket-formal-date">{formatTanggalCetak(keluarAt)}</span>
              <span className="ticket-formal-amount-label">TARA</span>
              <span className="ticket-formal-amount-value">{numTare != null ? `${numTare.toFixed(2)} kg` : "0.00 kg"}</span>
            </div>

            <div className="ticket-formal-weight-row ticket-formal-weight-row--netto">
              <span className="ticket-formal-label" />
              <span className="ticket-formal-colon" />
              <span className="ticket-formal-time" />
              <span className="ticket-formal-date" />
              <span className="ticket-formal-amount-label">NETTO</span>
              <span className="ticket-formal-amount-value">{numNetto.toFixed(2)} kg</span>
            </div>
          </div>

          <div className="ticket-formal-note">NOTE: {noteValue}</div>

          <div className="ticket-formal-signature-row">
            <div className="ticket-formal-signature-box">
              <span className="ticket-formal-signature-label">Petugas Timbang</span>
              <div className="ticket-formal-signature-line" />
              <span className="ticket-formal-signature-name">({operator || "OP1"})</span>
            </div>

            <div className="ticket-formal-signature-box">
              <span className="ticket-formal-signature-label">Sopir</span>
              <div className="ticket-formal-signature-line" />
              <span className="ticket-formal-signature-name">({nama_driver || "RISKI"})</span>
            </div>

            <div className="ticket-formal-signature-box">
              <span className="ticket-formal-signature-label">Cheker</span>
              <div className="ticket-formal-signature-line" />
              <span className="ticket-formal-signature-name">(DANAR)</span>
            </div>
          </div>
        </div>

        <div className="ticket-formal-footer-rule" />
        <div className="ticket-formal-warning">Hati-Hati...Patuhi Rambu Lalu Lintas...</div>
      </div>
    </div>
  );
}