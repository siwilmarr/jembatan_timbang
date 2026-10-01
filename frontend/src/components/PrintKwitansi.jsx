"use client";

// frontend/src/components/PrintKwitansi.jsx
// Cetak Kuitansi Formal (Format Lanskap A4 Sesuai Desain Kwitansi Referensi)

function angkaTerbilang(angka) {
  const bilangan = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
  if (angka < 12) return bilangan[angka];
  if (angka < 20) return bilangan[angka - 10] + " belas";
  if (angka < 100) return bilangan[Math.floor(angka / 10)] + " puluh" + (angka % 10 !== 0 ? " " + bilangan[angka % 10] : "");
  if (angka < 200) return "seratus" + (angka % 100 !== 0 ? " " + angkaTerbilang(angka % 100) : "");
  if (angka < 1000) return bilangan[Math.floor(angka / 100)] + " ratus" + (angka % 100 !== 0 ? " " + angkaTerbilang(angka % 100) : "");
  if (angka < 2000) return "seribu" + (angka % 1000 !== 0 ? " " + angkaTerbilang(angka % 1000) : "");
  if (angka < 1000000) return angkaTerbilang(Math.floor(angka / 1000)) + " ribu" + (angka % 1000 !== 0 ? " " + angkaTerbilang(angka % 1000) : "");
  if (angka < 1000000000) return angkaTerbilang(Math.floor(angka / 1000000)) + " juta" + (angka % 1000000 !== 0 ? " " + angkaTerbilang(angka % 1000000) : "");
  if (angka < 1000000000000) return angkaTerbilang(Math.floor(angka / 1000000000)) + " miliar" + (angka % 1000000000 !== 0 ? " " + angkaTerbilang(angka % 1000000000) : "");
  return "";
}

function romawiBulan(bulanIdx) {
  const romawi = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return romawi[bulanIdx] || "I";
}

function formatTanggalIndo(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const bulan = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}

function generateNomorKwitansi(dateStr, txId) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const seq = txId ? String(txId).slice(-3).padStart(3, "0") : "001";
  return `${seq}/BBP/LRB-01/${romawiBulan(d.getMonth())}/${d.getFullYear()}`;
}

export default function PrintKwitansi({ transaction, siteProfile }) {
  if (!transaction) return null;

  const {
    nomor_polisi,
    nama_driver,
    jenis_muatan,
    jenis_timbang,
    berat_kg,
    berat_bersih_kg,
    created_at_local,
    operator,
    customer_supplier,
    harga_per_kg,
    total_harga,
    site_profile_name,
    site_profile_address,
    site_profile_phone,
    site_profile_npwp,
  } = transaction;

  const companyName = site_profile_name || siteProfile?.company_name || "CV. Berkah Bangun Property";
  const companyAddress = site_profile_address || siteProfile?.address || "Loading Ramp Berkah 01";

  const numHargaKg = Number(harga_per_kg) || 0;
  const numTotalHarga = Number(total_harga) || 0;
  const numNetto = Number(berat_bersih_kg) || 0;
  const numBerat = Number(berat_kg) || 0;
  const beratKg = (numNetto > 0 ? numNetto : numBerat).toFixed(2);

  // Total uang pada kuitansi: ambil total_harga atau hitung dari (netto * harga_per_kg)
  const finalTotal = numTotalHarga > 0
    ? numTotalHarga
    : (numHargaKg > 0 && Number(beratKg) > 0 ? Math.round(Number(beratKg) * numHargaKg) : 0);

  const terbilangStr = finalTotal > 0
    ? `${angkaTerbilang(Math.round(finalTotal))} rupiah`
    : "-";

  const nomorKwitansi = generateNomorKwitansi(created_at_local, transaction.id);
  const tanggalKwitansi = formatTanggalIndo(created_at_local);

  return (
    <div className="receipt-print receipt-kuitansi">
      <div className="kuitansi-border-box">
        {/* Header Kuitansi */}
        <div className="kuitansi-header">
          <div className="kuitansi-header__title">
            KUITANSI
          </div>

          <div className="kuitansi-header__meta">
            <div className="kuitansi-header__meta-row">
              <span className="kuitansi-header__meta-label">Nomor</span>
              <span className="kuitansi-header__meta-colon">:</span>
              <span className="kuitansi-header__meta-value">{nomorKwitansi}</span>
            </div>
            <div className="kuitansi-header__meta-row">
              <span className="kuitansi-header__meta-label">Tanggal</span>
              <span className="kuitansi-header__meta-colon">:</span>
              <span className="kuitansi-header__meta-value">{tanggalKwitansi}</span>
            </div>
          </div>

          <div className="kuitansi-header__company">
            <div className="kuitansi-header__company-name">{companyName}</div>
            {companyAddress && (
              <div className="kuitansi-header__company-sub">{companyAddress}</div>
            )}
          </div>
        </div>

        {/* Garis Pembatas Header */}
        <div className="kuitansi-divider" />

        {/* Tabel Isi Kuitansi */}
        <table className="kuitansi-body">
          <tbody>
            <tr>
              <td className="kuitansi-label">Telah diterima dari</td>
              <td className="kuitansi-colon">:</td>
              <td className="kuitansi-value kuitansi-value--bold">
                {customer_supplier || nomor_polisi || "-"}
              </td>
            </tr>

            <tr>
              <td className="kuitansi-label">Uang Sejumlah</td>
              <td className="kuitansi-colon">:</td>
              <td className="kuitansi-value kuitansi-value--big">
                <span className="kuitansi-currency">IDR</span>
                <span className="kuitansi-amount">
                  {finalTotal > 0 ? finalTotal.toLocaleString("id-ID") : "-"}
                </span>
              </td>
            </tr>

            <tr>
              <td className="kuitansi-label">Terbilang</td>
              <td className="kuitansi-colon">:</td>
              <td className="kuitansi-value kuitansi-value--terbilang">
                {terbilangStr}
              </td>
            </tr>

            <tr>
              <td className="kuitansi-label" style={{ whiteSpace: "nowrap", paddingTop: "0.5rem" }}>
                Untuk Pembayaran
              </td>
              <td className="kuitansi-colon" style={{ paddingTop: "0.5rem" }}>:</td>
              <td className="kuitansi-value" style={{ paddingTop: "0.5rem" }}>
                {jenis_muatan ? (
                  <span>
                    Pembelian {jenis_muatan}{customer_supplier ? ` ${customer_supplier}` : ""} sebanyak <strong>{beratKg} kg</strong>
                    {numHargaKg > 0 && (
                      <> x @ IDR <strong>{numHargaKg.toLocaleString("id-ID")}</strong>/kg</>
                    )}
                  </span>
                ) : (
                  <span>
                    Jasa penimbangan kendaraan {nomor_polisi} — {jenis_timbang === "gross" ? "Masuk (Gross)" : "Keluar (Tare)"}
                  </span>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Footer Tanda Tangan */}
        <div className="kuitansi-footer">
          <div className="kuitansi-ttd">
            <div className="kuitansi-ttd__label">Penerima</div>
            <div className="kuitansi-ttd__space" />
            <div className="kuitansi-ttd__line">(...........................................)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
