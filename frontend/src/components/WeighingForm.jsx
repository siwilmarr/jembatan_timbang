"use client";

import { useRef, useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { saveTransactionLocally, db } from "../db/db";
import { API_BASE_URL } from "../config/env";

function getLocalISOString() {
  const date = new Date();
  const tzOffset = -date.getTimezoneOffset();
  const diff = tzOffset >= 0 ? '+' : '-';
  const pad = (num) => String(num).padStart(2, '0');

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const ms = String(date.getMilliseconds()).padStart(3, '0');

  const timezoneHour = pad(Math.floor(Math.abs(tzOffset) / 60));
  const timezoneMinute = pad(Math.abs(tzOffset) % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}${diff}${timezoneHour}:${timezoneMinute}`;
}

// Format angka ke format ribuan bertitik Indonesia (misal: 2500 -> 2.500)
function formatNumberWithDots(val) {
  if (val === null || val === undefined || val === "") return "";
  let str = String(val).trim();
  if (typeof val === "number") {
    return val % 1 === 0
      ? val.toLocaleString("id-ID")
      : val.toLocaleString("id-ID", { maximumFractionDigits: 2 });
  }
  if (str.endsWith(".00")) str = str.slice(0, -3);

  const hasComma = str.includes(",");
  const parts = str.split(",");
  const integerDigits = parts[0].replace(/\D/g, "");
  if (!integerDigits && !hasComma) return "";
  const formattedInteger = integerDigits ? Number(integerDigits).toLocaleString("id-ID") : "0";
  if (hasComma) {
    const decimalDigits = (parts[1] || "").replace(/\D/g, "").slice(0, 2);
    return parts[1] !== undefined ? `${formattedInteger},${decimalDigits}` : `${formattedInteger},`;
  }
  return formattedInteger;
}

// Parse string bertitik Indonesia kembali menjadi angka numeric murni
function parseNumberFromDots(val) {
  if (!val) return 0;
  const str = String(val).trim();
  const parts = str.split(",");
  const integerDigits = parts[0].replace(/\D/g, "");
  const decimalDigits = parts.length > 1 ? parts[1].replace(/\D/g, "") : "";
  const numStr = decimalDigits ? `${integerDigits || "0"}.${decimalDigits}` : (integerDigits || "0");
  const num = parseFloat(numStr);
  return isNaN(num) ? 0 : num;
}

export default function WeighingForm({ lockedWeight, operatorUsername, onSaved, userWarehouse }) {
  const [form, setForm] = useState({
    nomor_polisi: "",
    nama_driver: "",
    jenis_muatan: "",
    tujuan: "",
    jenis_timbang: "gross",
    unit: "",
    customer_supplier: "",
    customer_address: "",
    harga_per_kg: "",
    weighing_type: "",
    deduction_percent: 0,
    site_profile_id: null,
    site_profile_name: "",
    site_profile_address: "",
    site_profile_phone: "",
    site_profile_npwp: "",
  });

  const [destinations, setDestinations] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [units, setUnits] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [siteProfiles, setSiteProfiles] = useState([]);
  const [weighingTypes, setWeighingTypes] = useState([]);
  const [selectedWeighingType, setSelectedWeighingType] = useState(null);
  const [priceLists, setPriceLists] = useState([]);
  const [activeCycle, setActiveCycle] = useState(null);

  const API_BASE = API_BASE_URL;
  const userToken = typeof window !== "undefined" ? localStorage.getItem("user_token") : "";

  // Ambil semua data master (offline-first via IndexedDB, lalu sync dari server)
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        // 1. Load dari IndexedDB (offline-first)
        const localDest = await db.destinations.toArray();
        const localCargo = await db.cargos.toArray();
        const localUnits = await db.units.toArray();
        const localCustomers = await db.customers.toArray();
        const localSiteProfiles = await db.site_profiles.toArray();
        const localWeighingTypes = await db.weighing_types.toArray();
        const localPrices = await db.price_lists?.toArray?.() || [];

        if (localDest.length > 0) setDestinations(localDest);
        if (localCargo.length > 0) setCargos(localCargo);
        if (localUnits.length > 0) setUnits(localUnits);
        if (localCustomers.length > 0) setCustomers(localCustomers);
        if (localSiteProfiles.length > 0) setSiteProfiles(localSiteProfiles);
        if (localWeighingTypes.length > 0) setWeighingTypes(localWeighingTypes);
        if (localPrices.length > 0) setPriceLists(localPrices);

        // 2. Jika online, update dari server
        if (navigator.onLine && userToken) {
          const [destRes, cargoRes, unitRes, custRes, wtRes, spRes, plRes] = await Promise.all([
            fetch(`${API_BASE}/destinations/`, { headers: { Authorization: `Token ${userToken}` } }),
            fetch(`${API_BASE}/cargos/`, { headers: { Authorization: `Token ${userToken}` } }),
            fetch(`${API_BASE}/units/`, { headers: { Authorization: `Token ${userToken}` } }),
            fetch(`${API_BASE}/customers/`, { headers: { Authorization: `Token ${userToken}` } }),
            fetch(`${API_BASE}/weighing-types/`, { headers: { Authorization: `Token ${userToken}` } }),
            fetch(`${API_BASE}/site-profiles/`, { headers: { Authorization: `Token ${userToken}` } }),
            fetch(`${API_BASE}/price-lists/`, { headers: { Authorization: `Token ${userToken}` } }),
          ]);

          if (destRes.ok) {
            const destList = await destRes.json();
            await db.destinations.clear();
            if (destList.length > 0) await db.destinations.bulkAdd(destList);
            setDestinations(destList);
          }
          if (cargoRes.ok) {
            const cargoList = await cargoRes.json();
            await db.cargos.clear();
            if (cargoList.length > 0) await db.cargos.bulkAdd(cargoList);
            setCargos(cargoList);
          }
          if (unitRes.ok) {
            const unitList = await unitRes.json();
            await db.units.clear();
            if (unitList.length > 0) await db.units.bulkAdd(unitList);
            setUnits(unitList);
          }
          if (custRes.ok) {
            const custList = await custRes.json();
            await db.customers.clear();
            if (custList.length > 0) await db.customers.bulkAdd(custList);
            setCustomers(custList);
          }
          if (spRes?.ok) {
            const rawSp = await spRes.json();
            const spList = Array.isArray(rawSp) ? rawSp : (rawSp?.results || []);
            await db.site_profiles.clear();
            if (spList.length > 0) await db.site_profiles.bulkAdd(spList);
            setSiteProfiles(spList);
          }
          if (wtRes.ok) {
            const wtList = await wtRes.json();
            await db.weighing_types.clear();
            if (wtList.length > 0) await db.weighing_types.bulkAdd(wtList);
            setWeighingTypes(wtList);
          }
          if (plRes?.ok) {
            const rawPl = await plRes.json();
            const plList = Array.isArray(rawPl) ? rawPl : (rawPl?.results || []);
            if (db.price_lists) {
              await db.price_lists.clear();
              if (plList.length > 0) await db.price_lists.bulkAdd(plList);
            }
            setPriceLists(plList);
          }
        }

      } catch (err) {
        console.error("Gagal memuat data master:", err);
      }
    };
    fetchMasterData();
  }, []);

  // Periksa secara aktif jika kendaraan memiliki transaksi menggantung (belum in/out)
  useEffect(() => {
    let active = true;
    const checkActiveCycle = async () => {
      const cleanPlate = form.nomor_polisi.trim().toUpperCase();
      if (!cleanPlate) {
        if (active) setActiveCycle(null);
        return;
      }

      try {
        const tx = await db.weighing_transactions
          .where("nomor_polisi")
          .equals(cleanPlate)
          .filter(t => t.berat_bersih_kg === null || t.berat_bersih_kg === undefined)
          .first();

        if (active) {
          if (tx) {
            setActiveCycle(tx);
            // Cari konfigurasi jenis timbangan sebelumnya
            const prevWT = weighingTypes.find(wt => wt.name === tx.weighing_type);
            if (prevWT) setSelectedWeighingType(prevWT);

            // Isi otomatis field input dari timbangan masuk sebelumnya
            setForm(prev => ({
              ...prev,
              nama_driver: prev.nama_driver || tx.nama_driver || "",
              jenis_muatan: prev.jenis_muatan || tx.jenis_muatan || "",
              tujuan: prev.tujuan || tx.tujuan || "",
              jenis_timbang: tx.jenis_timbang === "gross" ? "tare" : "gross",
              unit: prev.unit || tx.unit || "",
              customer_supplier: prev.customer_supplier || tx.customer_supplier || "",
              customer_address: prev.customer_address || tx.customer_address || "",
              harga_per_kg: formatNumberWithDots(prev.harga_per_kg || tx.harga_per_kg || ""),
              weighing_type: prev.weighing_type || tx.weighing_type || "",
              deduction_percent: tx.deduction_percent || 0,
              site_profile_id: prev.site_profile_id || tx.site_profile_id || null,
              site_profile_name: prev.site_profile_name || tx.site_profile_name || "",
              site_profile_address: prev.site_profile_address || tx.site_profile_address || "",
              site_profile_phone: prev.site_profile_phone || tx.site_profile_phone || "",
              site_profile_npwp: prev.site_profile_npwp || tx.site_profile_npwp || "",
            }));
          } else {
            setActiveCycle(null);
          }
        }
      } catch (err) {
        console.error("Gagal memeriksa transaksi aktif:", err);
      }
    };

    checkActiveCycle();

    return () => {
      active = false;
    };
  }, [form.nomor_polisi, weighingTypes]);

  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "warning") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const canSave = lockedWeight !== null && form.nomor_polisi.trim() !== "" && !isSubmitting;

  // Cari master harga yang aktif untuk jenis muatan tertentu pada tanggal hari ini
  const getActivePriceForCargo = (cargoName) => {
    if (!cargoName || !priceLists || priceLists.length === 0) return null;
    const todayStr = new Date().toISOString().split("T")[0];
    const matching = priceLists.filter(
      (pl) =>
        pl.cargo_name &&
        pl.cargo_name.trim().toLowerCase() === cargoName.trim().toLowerCase() &&
        pl.effective_date <= todayStr
    );
    if (matching.length === 0) return null;
    matching.sort((a, b) => b.effective_date.localeCompare(a.effective_date));
    return matching[0];
  };

  const handlePriceChange = (e) => {
    const formatted = formatNumberWithDots(e.target.value);
    setForm((prev) => ({
      ...prev,
      harga_per_kg: formatted,
    }));
  };

  const handleCargoChange = (e) => {
    const selectedCargo = e.target.value;
    const activePrice = getActivePriceForCargo(selectedCargo);
    setForm((prev) => ({
      ...prev,
      jenis_muatan: selectedCargo,
      // Auto-fill harga_per_kg jika ada di master harga, format bertitik ribuan
      harga_per_kg: activePrice ? formatNumberWithDots(activePrice.price_per_kg) : prev.harga_per_kg,
    }));
  };

  const handleChange = (e) => {
    const value = e.target.name === "nomor_polisi" ? e.target.value.toUpperCase() : e.target.value;
    setForm({ ...form, [e.target.name]: value });
  };

  const handleWeighingTypeChange = (e) => {
    const typeName = e.target.value;
    const matchedType = weighingTypes.find((wt) => wt.name === typeName);
    setSelectedWeighingType(matchedType || null);
    setForm((prev) => ({
      ...prev,
      weighing_type: typeName,
      deduction_percent: matchedType ? Number(matchedType.deduction_percent) : 0,
    }));
  };

  const handleCustomerChange = (e) => {
    const selectedName = e.target.value;
    const matchedCustomer = customers.find((c) => c.name === selectedName);
    setForm((prev) => ({
      ...prev,
      customer_supplier: selectedName,
      customer_address: matchedCustomer ? (matchedCustomer.address || "") : prev.customer_address,
    }));
  };

  const handleSiteProfileChange = (e) => {
    const selectedId = e.target.value ? Number(e.target.value) : null;
    const matched = siteProfiles.find((p) => p.id === selectedId);
    setForm((prev) => ({
      ...prev,
      site_profile_id: selectedId,
      site_profile_name: matched ? matched.company_name : "",
      site_profile_address: matched ? (matched.address || "") : "",
      site_profile_phone: matched ? (matched.phone || "") : "",
      site_profile_npwp: matched ? (matched.npwp || "") : "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave || isSubmittingRef.current) return;

    // Validasi Jenis Timbangan wajib dipilih
    if (!form.weighing_type) {
      showToast("Jenis Timbangan wajib dipilih.", "warning");
      return;
    }

    if (activeCycle && form.jenis_timbang === activeCycle.jenis_timbang) {
      showToast("Kendaraan ini sudah memiliki transaksi aktif dengan tipe yang sama. Harap selesaikan siklus timbangan terlebih dahulu.", "error");
      return;
    }

    // Validasi Konfigurasi Jenis Timbangan
    if (selectedWeighingType) {
      const { require_driver, require_destination, require_cargo, require_customer, require_unit, max_weight_kg } = selectedWeighingType;

      if (require_driver && !form.nama_driver.trim()) {
        showToast("Nama Driver wajib diisi untuk jenis timbangan ini.", "warning");
        return;
      }
      if (require_destination && !form.tujuan.trim()) {
        showToast("Tujuan wajib diisi untuk jenis timbangan ini.", "warning");
        return;
      }
      if (require_cargo && !form.jenis_muatan.trim()) {
        showToast("Jenis Muatan wajib diisi untuk jenis timbangan ini.", "warning");
        return;
      }
      if (require_customer && !form.customer_supplier.trim()) {
        showToast("Customer/Supplier wajib diisi untuk jenis timbangan ini.", "warning");
        return;
      }


      if (require_unit && !form.unit.trim()) {
        showToast("Unit Kendaraan wajib diisi untuk jenis timbangan ini.", "warning");
        return;
      }
      if (Number(max_weight_kg) > 0 && lockedWeight > Number(max_weight_kg)) {
        showToast(`Berat kendaraan (${lockedWeight} kg) melebihi batas maksimal kapasitas jenis timbangan ini (${max_weight_kg} kg).`, "error");
        return;
      }
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const hargaKgNum = parseNumberFromDots(form.harga_per_kg);
      let calculatedTotal = 0;
      if (activeCycle && lockedWeight) {
        const beratSebelum = Math.abs(lockedWeight - Number(activeCycle.berat_kg));
        const maxDeduct = Math.max(Number(form.deduction_percent) || 0, Number(activeCycle.deduction_percent) || 0);
        const pot = beratSebelum * (maxDeduct / 100);
        const netto = beratSebelum - pot;
        calculatedTotal = Math.round(netto * hargaKgNum * 100) / 100;
      }

      const newTx = {
        id: uuidv4(), ...form,
        harga_per_kg: hargaKgNum,
        total_harga: calculatedTotal,
        berat_kg: lockedWeight,
        operator: operatorUsername || "device",
        warehouse: userWarehouse?.id || null,
        warehouse_id: userWarehouse?.id || null,
        warehouse_name: userWarehouse?.name || null,
        created_at_local: getLocalISOString()
      };
      await saveTransactionLocally(newTx);

      setForm({
        nomor_polisi: "", nama_driver: "", jenis_muatan: "", tujuan: "", jenis_timbang: "gross",
        unit: "", customer_supplier: "", customer_address: "", harga_per_kg: "",
        weighing_type: "", deduction_percent: 0,
        site_profile_id: null, site_profile_name: "", site_profile_address: "",
        site_profile_phone: "", site_profile_npwp: "",
      });
      setSelectedWeighingType(null);
      setActiveCycle(null);
      onSaved?.(newTx);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const wtConfig = selectedWeighingType;

  return (
    <>
      {toast && (
        <div style={{
          position: "fixed",
          top: "1.5rem",
          right: "1.5rem",
          zIndex: 9999,
          minWidth: "320px",
          maxWidth: "460px",
          background: toast.type === "error" ? "#fef2f2" : toast.type === "warning" ? "#fff7ed" : "#eff6ff",
          border: `1.5px solid ${toast.type === "error" ? "#fca5a5" : toast.type === "warning" ? "#fdba74" : "#93c5fd"}`,
          borderRadius: "12px",
          padding: "1rem 1.2rem",
          boxShadow: "0 8px 32px rgba(37,99,235,0.15)",
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
          animation: "slideInRight 0.3s ease",
        }}>
          <span style={{ fontSize: "1.3rem", lineHeight: 1 }}>
            {toast.type === "error" ? "❌" : "⚠️"}
          </span>
          <div style={{ flex: 1 }}>
            <p style={{
              margin: 0,
              fontWeight: 700,
              fontSize: "0.88rem",
              color: toast.type === "error" ? "#991b1b" : "#9a3412",
            }}>
              {toast.type === "error" ? "Tidak Dapat Menyimpan" : "Validasi Diperlukan"}
            </p>
            <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.84rem", color: "#475569", lineHeight: 1.5 }}>
              {toast.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "1rem", padding: 0, lineHeight: 1 }}
          >✕</button>
        </div>
      )}
      <form className="weighing-form weighing-form--compact" onSubmit={handleSubmit} noValidate>
        {userWarehouse?.name && (
          <div className="weighing-form__warehouse-badge">
            Warehouse: <strong>{userWarehouse.name}</strong>
          </div>
        )}

        {/* Grid 2 Kartu Bersebelahan */}
        <div className="weighing-form__grid-sections">
          {/* KARTU KIRI: Data Timbangan & Muatan */}
          <div className="weighing-form__section-card">
            <div className="weighing-form__section-title">
              Timbangan & Muatan
            </div>

            {/* 1. Jenis Timbangan */}
            <div className="weighing-form__field">
              <div className="weighing-form__label-row">
                <span>Jenis Timbangan</span>
                {wtConfig && Number(wtConfig.deduction_percent) > 0 && (
                  <span className="weighing-form__badge weighing-form__badge--warning">
                    🍂 Potongan: {wtConfig.deduction_percent}%
                  </span>
                )}
              </div>
              <select name="weighing_type" value={form.weighing_type} onChange={handleWeighingTypeChange} required>
                <option value="">-- Pilih Jenis Timbangan --</option>
                {weighingTypes.filter(wt => wt.is_active).map((wt) => (
                  <option key={wt.id} value={wt.name}>{wt.name}</option>
                ))}
              </select>
            </div>

            {/* 2. Jenis Timbang (Masuk / Keluar) */}
            <div className="weighing-form__field">
              <div className="weighing-form__label-row">
                <span>Jenis Timbang</span>
                {activeCycle && (
                  <span className="weighing-form__badge weighing-form__badge--warning">
                    Keluar (Otomatis)
                  </span>
                )}
              </div>
              <select name="jenis_timbang" value={form.jenis_timbang} onChange={handleChange} disabled={activeCycle !== null}>
                <option value="gross">Masuk (Gross)</option>
                <option value="tare">Keluar (Tare)</option>
              </select>
            </div>

            {/* 3. Jenis Muatan */}
            <div className="weighing-form__field">
              <div className="weighing-form__label-row">
                <span>Jenis Muatan {wtConfig?.require_cargo && <span style={{ color: "#dc2626" }}>*</span>}</span>
              </div>
              {cargos.length > 0 ? (
                <select name="jenis_muatan" value={form.jenis_muatan} onChange={handleCargoChange} required={wtConfig?.require_cargo}>
                  <option value="">-- Pilih Muatan --</option>
                  {cargos.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <input name="jenis_muatan" value={form.jenis_muatan} onChange={handleCargoChange} required={wtConfig?.require_cargo} placeholder="Ketik jenis muatan" />
              )}
            </div>

            {/* 4. Harga per Kg */}
            <div className="weighing-form__field">
              <div className="weighing-form__label-row">
                <span>Harga per Kg (Rp)</span>
                {(() => {
                  const activeMasterPrice = getActivePriceForCargo(form.jenis_muatan);
                  if (activeMasterPrice) {
                    const isCustom = form.harga_per_kg && parseNumberFromDots(form.harga_per_kg) !== Number(activeMasterPrice.price_per_kg);
                    return (
                      <span className={`weighing-form__badge ${isCustom ? "weighing-form__badge--custom" : "weighing-form__badge--success"}`}>
                        {isCustom ? "✏️ Manual" : `✓ Master: Rp ${Number(activeMasterPrice.price_per_kg).toLocaleString("id-ID")}`}
                      </span>
                    );
                  } else if (form.jenis_muatan) {
                    return (
                      <span className="weighing-form__badge weighing-form__badge--muted">
                        Manual
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
              <input
                type="text"
                inputMode="numeric"
                name="harga_per_kg"
                value={form.harga_per_kg}
                onChange={handlePriceChange}
                placeholder="misal: 2.500"
              />
            </div>

            {/* 5. Tujuan */}
            <div className="weighing-form__field">
              <div className="weighing-form__label-row">
                <span>Tujuan {wtConfig?.require_destination && <span style={{ color: "#dc2626" }}>*</span>}</span>
              </div>
              {destinations.length > 0 ? (
                <select name="tujuan" value={form.tujuan} onChange={handleChange} required={wtConfig?.require_destination}>
                  <option value="">-- Pilih Tujuan --</option>
                  {destinations.map((d) => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              ) : (
                <input name="tujuan" value={form.tujuan} onChange={handleChange} required={wtConfig?.require_destination} placeholder="Ketik tujuan" />
              )}
            </div>
          </div>

          {/* KARTU KANAN: Data Armada & Pihak Terkait */}
          <div className="weighing-form__section-card">
            <div className="weighing-form__section-title">
              Armada & Relasi
            </div>

            {/* 1. Nomor Polisi */}
            <div className="weighing-form__field">
              <div className="weighing-form__label-row">
                <span>Nomor Polisi <span style={{ color: "#dc2626" }}>*</span></span>
              </div>
              <input name="nomor_polisi" value={form.nomor_polisi} onChange={handleChange} required placeholder="Contoh: B 1234 CD" />
              {!activeCycle ? (
                <span style={{
                  fontSize: "0.76rem",
                  color: "#64748b",
                  lineHeight: 1.5,
                  display: "block",
                }}>
                  Untuk timbang <strong>Keluar (Tare)</strong>, masukkan nomor polisi yang <strong>sama</strong> seperti saat timbang <strong>Masuk (Gross)</strong>.
                </span>
              ) : (
                <span style={{
                  fontSize: "0.76rem",
                  color: "#15803d",
                  lineHeight: 1.5,
                  display: "block",
                  background: "#dcfce7",
                  borderRadius: "6px",
                  padding: "0.25rem 0.5rem",
                }}>
                  ✅ Siklus Gross terdeteksi! Simpan untuk menyelesaikan timbang Keluar (Tare).
                </span>
              )}
            </div>


            {/* 2. Unit Kendaraan */}
            <div className="weighing-form__field">
              <div className="weighing-form__label-row">
                <span>Unit Kendaraan {wtConfig?.require_unit && <span style={{ color: "#dc2626" }}>*</span>}</span>
              </div>
              {units.length > 0 ? (
                <select name="unit" value={form.unit} onChange={handleChange} required={wtConfig?.require_unit}>
                  <option value="">-- Pilih Unit --</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </select>
              ) : (
                <input name="unit" value={form.unit} onChange={handleChange} required={wtConfig?.require_unit} placeholder="Ketik jenis unit" />
              )}
            </div>

            {/* 3. Nama Driver */}
            <div className="weighing-form__field">
              <div className="weighing-form__label-row">
                <span>Nama Driver {wtConfig?.require_driver && <span style={{ color: "#dc2626" }}>*</span>}</span>
              </div>
              <input name="nama_driver" value={form.nama_driver} onChange={handleChange} required={wtConfig?.require_driver} placeholder="Ketik nama supir" />
            </div>

            {/* 4. Customer / Supplier */}
            <div className="weighing-form__field">
              <div className="weighing-form__label-row">
                <span>Customer / Supplier {wtConfig?.require_customer && <span style={{ color: "#dc2626" }}>*</span>}</span>
              </div>
              {customers.length > 0 ? (
                <select name="customer_supplier" value={form.customer_supplier} onChange={handleCustomerChange} required={wtConfig?.require_customer}>
                  <option value="">-- Pilih Customer/Supplier --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.name}>{c.name} ({c.type === "customer" ? "Customer" : c.type === "supplier" ? "Supplier" : "Keduanya"})</option>
                  ))}
                </select>
              ) : (
                <input name="customer_supplier" value={form.customer_supplier} onChange={handleChange} required={wtConfig?.require_customer} placeholder="Ketik nama customer/supplier" />
              )}
            </div>

            {/* 5. Profil Perusahaan (Kop Kwitansi) */}
            <div className="weighing-form__field">
              <div className="weighing-form__label-row">
                <span>Profil Perusahaan (Kop Kwitansi)</span>
              </div>
              {siteProfiles.length > 0 ? (
                <select
                  value={form.site_profile_id || ""}
                  onChange={handleSiteProfileChange}
                >
                  <option value="">-- Default (Profil Perusahaan) --</option>
                  {siteProfiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.company_name}</option>
                  ))}
                </select>
              ) : (
                <select disabled>
                  <option>Default (Profil Perusahaan)</option>
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Info Siklus Aktif */}
        {activeCycle && (
          <span className="weighing-form__info-msg" style={{ display: "block", fontSize: "0.82rem", padding: "0.45rem 0.8rem", borderRadius: "8px", margin: 0 }}>
            ℹ️ Kendaraan terdeteksi sedang menimbang keluar (menyelesaikan siklus timbangan masuk <strong>{activeCycle.jenis_timbang === "gross" ? "Gross" : "Tare"}</strong> pada {new Date(activeCycle.created_at_local).toLocaleString("id-ID")}).
          </span>
        )}

        {/* Estimasi Netto & Total */}
        {activeCycle && lockedWeight && parseNumberFromDots(form.harga_per_kg) > 0 && (
          <div style={{
            background: "#ecfdf5",
            border: "1px solid #6ee7b7",
            padding: "0.5rem 0.9rem",
            borderRadius: "10px",
            color: "#065f46",
            fontSize: "0.86rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}>
            <div><strong>💰 Estimasi Netto:</strong> {(Math.abs(lockedWeight - Number(activeCycle.berat_kg)) * (1 - (Math.max(Number(form.deduction_percent) || 0, Number(activeCycle.deduction_percent) || 0) / 100))).toFixed(2)} kg</div>
            <div><strong>💵 Estimasi Total:</strong> Rp {Math.round(Math.abs(lockedWeight - Number(activeCycle.berat_kg)) * (1 - (Math.max(Number(form.deduction_percent) || 0, Number(activeCycle.deduction_percent) || 0) / 100)) * parseNumberFromDots(form.harga_per_kg)).toLocaleString("id-ID")}</div>
          </div>
        )}

        {/* Footer Kompak */}
        <div className="weighing-form__footer">
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "0.86rem", color: "#64748b", fontWeight: 600 }}>Berat Terkunci:</span>
            <span style={{
              fontSize: "1.15rem",
              fontWeight: 800,
              color: lockedWeight !== null ? "#0f172a" : "#94a3b8",
              background: lockedWeight !== null ? "#e2e8f0" : "#f1f5f9",
              padding: "0.25rem 0.75rem",
              borderRadius: "8px",
              letterSpacing: "0.02em",
            }}>
              {lockedWeight !== null ? `${lockedWeight.toFixed(2)} kg` : "Belum di-lock"}
            </span>
          </div>

          <button type="submit" disabled={!canSave} style={{ fontWeight: 700 }}>
            {isSubmitting ? "Menyimpan..." : "💾 Simpan Transaksi"}
          </button>
        </div>
      </form>
    </>
  );
}