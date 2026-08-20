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

export default function WeighingForm({ lockedWeight, operatorUsername, onSaved, userWarehouse }) {
  const [form, setForm] = useState({
    nomor_polisi: "",
    nama_driver: "",
    jenis_muatan: "",
    tujuan: "",
    jenis_timbang: "gross",
    unit: "",
    customer_supplier: "",
    weighing_type: "",
    deduction_percent: 0,
  });

  const [destinations, setDestinations] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [units, setUnits] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [weighingTypes, setWeighingTypes] = useState([]);
  const [selectedWeighingType, setSelectedWeighingType] = useState(null);
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
        const localWeighingTypes = await db.weighing_types.toArray();

        if (localDest.length > 0) setDestinations(localDest);
        if (localCargo.length > 0) setCargos(localCargo);
        if (localUnits.length > 0) setUnits(localUnits);
        if (localCustomers.length > 0) setCustomers(localCustomers);
        if (localWeighingTypes.length > 0) setWeighingTypes(localWeighingTypes);

        // 2. Jika online, update dari server
        if (navigator.onLine && userToken) {
          const [destRes, cargoRes, unitRes, custRes, wtRes] = await Promise.all([
            fetch(`${API_BASE}/destinations/`, { headers: { Authorization: `Token ${userToken}` } }),
            fetch(`${API_BASE}/cargos/`, { headers: { Authorization: `Token ${userToken}` } }),
            fetch(`${API_BASE}/units/`, { headers: { Authorization: `Token ${userToken}` } }),
            fetch(`${API_BASE}/customers/`, { headers: { Authorization: `Token ${userToken}` } }),
            fetch(`${API_BASE}/weighing-types/`, { headers: { Authorization: `Token ${userToken}` } }),
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
          if (wtRes.ok) {
            const wtList = await wtRes.json();
            await db.weighing_types.clear();
            if (wtList.length > 0) await db.weighing_types.bulkAdd(wtList);
            setWeighingTypes(wtList);
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
              weighing_type: prev.weighing_type || tx.weighing_type || "",
              deduction_percent: tx.deduction_percent || 0,
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
      const newTx = {
        id: uuidv4(), ...form,
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
        unit: "", customer_supplier: "", weighing_type: "", deduction_percent: 0
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
    <form className="weighing-form" onSubmit={handleSubmit} noValidate>
      {userWarehouse?.name && (
        <div className="weighing-form__warehouse-badge">
          🏭 Warehouse: <strong>{userWarehouse.name}</strong>
        </div>
      )}

      {/* Jenis Timbangan Dropdown */}
      <label>
        Jenis Timbangan
        <select name="weighing_type" value={form.weighing_type} onChange={handleWeighingTypeChange} required>
          <option value="">-- Pilih Jenis Timbangan --</option>
          {weighingTypes.filter(wt => wt.is_active).map((wt) => (
            <option key={wt.id} value={wt.name}>{wt.name}</option>
          ))}
        </select>
        {wtConfig && Number(wtConfig.deduction_percent) > 0 && (
          <span style={{ fontSize: "0.8rem", color: "#b45309", fontWeight: 500, marginTop: "-0.2rem", display: "block" }}>
            🍂 Memiliki potongan otomatis: <strong>{wtConfig.deduction_percent}%</strong>
          </span>
        )}
      </label>

      <label>
        Nomor Polisi
        <input name="nomor_polisi" value={form.nomor_polisi} onChange={handleChange} required placeholder="Contoh: B 1234 CD" />
      </label>

      <label>
        Nama Driver {wtConfig?.require_driver && <span style={{ color: "red" }}>*</span>}
        <input name="nama_driver" value={form.nama_driver} onChange={handleChange} required={wtConfig?.require_driver} />
      </label>

      {/* Unit Kendaraan Dropdown */}
      <label>
        Unit Kendaraan {wtConfig?.require_unit && <span style={{ color: "red" }}>*</span>}
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
      </label>

      {/* Customer / Supplier Dropdown */}
      <label>
        Customer/Supplier {wtConfig?.require_customer && <span style={{ color: "red" }}>*</span>}
        {customers.length > 0 ? (
          <select name="customer_supplier" value={form.customer_supplier} onChange={handleChange} required={wtConfig?.require_customer}>
            <option value="">-- Pilih Customer/Supplier --</option>
            {customers.map((c) => (
              <option key={c.id} value={c.name}>{c.name} ({c.type === "customer" ? "Customer" : c.type === "supplier" ? "Supplier" : "Keduanya"})</option>
            ))}
          </select>
        ) : (
          <input name="customer_supplier" value={form.customer_supplier} onChange={handleChange} required={wtConfig?.require_customer} placeholder="Ketik nama customer/supplier" />
        )}
      </label>

      <label>
        Jenis Muatan {wtConfig?.require_cargo && <span style={{ color: "red" }}>*</span>}
        {cargos.length > 0 ? (
          <select name="jenis_muatan" value={form.jenis_muatan} onChange={handleChange} required={wtConfig?.require_cargo}>
            <option value="">-- Pilih Muatan --</option>
            {cargos.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        ) : (
          <input name="jenis_muatan" value={form.jenis_muatan} onChange={handleChange} required={wtConfig?.require_cargo} placeholder="Ketik jenis muatan" />
        )}
      </label>

      <label>
        Tujuan {wtConfig?.require_destination && <span style={{ color: "red" }}>*</span>}
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
      </label>

      <label>
        Jenis Timbang
        <select name="jenis_timbang" value={form.jenis_timbang} onChange={handleChange} disabled={activeCycle !== null}>
          <option value="gross">Masuk (Gross)</option>
          <option value="tare">Keluar (Tare)</option>
        </select>
        {activeCycle && (
          <span className="weighing-form__info-msg">
            ℹ️ Kendaraan terdeteksi sedang menimbang keluar (menyelesaikan siklus timbangan masuk <strong>{activeCycle.jenis_timbang === "gross" ? "Gross" : "Tare"}</strong> pada {new Date(activeCycle.created_at_local).toLocaleString("id-ID")}).
          </span>
        )}
      </label>

      <p>Berat terkunci: {lockedWeight !== null ? `${lockedWeight.toFixed(2)} kg` : "-"}</p>

      <button type="submit" disabled={!canSave}>
        {isSubmitting ? "Menyimpan..." : "Simpan"}
      </button>
    </form>
    </>
  );
}