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
  });

  const [destinations, setDestinations] = useState([]);
  const [cargos, setCargos] = useState([]);

  const API_BASE = API_BASE_URL;
  const userToken = typeof window !== "undefined" ? localStorage.getItem("user_token") : "";

  // Ambil data master Tujuan dan Muatan (offline-first via IndexedDB, lalu sync dari server)
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        // 1. Load dari IndexedDB dulu (offline-first)
        const localDest = await db.destinations.toArray();
        const localCargo = await db.cargos.toArray();
        if (localDest.length > 0) setDestinations(localDest);
        if (localCargo.length > 0) setCargos(localCargo);

        // 2. Jika online, update dari server
        if (navigator.onLine && userToken) {
          const [destRes, cargoRes] = await Promise.all([
            fetch(`${API_BASE}/destinations/`, { headers: { Authorization: `Token ${userToken}` } }),
            fetch(`${API_BASE}/cargos/`, { headers: { Authorization: `Token ${userToken}` } }),
          ]);

          if (destRes.ok) {
            const destData = await destRes.json();
            const destList = Array.isArray(destData) ? destData : (destData.results || []);
            await db.destinations.clear();
            if (destList.length > 0) await db.destinations.bulkAdd(destList);
            setDestinations(destList);
          }

          if (cargoRes.ok) {
            const cargoData = await cargoRes.json();
            const cargoList = Array.isArray(cargoData) ? cargoData : (cargoData.results || []);
            await db.cargos.clear();
            if (cargoList.length > 0) await db.cargos.bulkAdd(cargoList);
            setCargos(cargoList);
          }
        }
      } catch (err) {
        console.error("Gagal memuat data master:", err);
      }
    };
    fetchMasterData();
  }, []);

  const isSubmittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSave = lockedWeight !== null && form.nomor_polisi.trim() !== "" && !isSubmitting;

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave || isSubmittingRef.current) return;

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

      setForm({ nomor_polisi: "", nama_driver: "", jenis_muatan: "", tujuan: "", jenis_timbang: "gross" });
      onSaved?.(newTx);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <form className="weighing-form" onSubmit={handleSubmit}>
      {userWarehouse?.name && (
        <div className="weighing-form__warehouse-badge">
          🏭 Warehouse: <strong>{userWarehouse.name}</strong>
        </div>
      )}

      <label>
        Nomor Polisi
        <input name="nomor_polisi" value={form.nomor_polisi} onChange={handleChange} required />
      </label>

      <label>
        Nama Driver
        <input name="nama_driver" value={form.nama_driver} onChange={handleChange} />
      </label>

      <label>
        Jenis Muatan
        {cargos.length > 0 ? (
          <select name="jenis_muatan" value={form.jenis_muatan} onChange={handleChange}>
            <option value="">-- Pilih Muatan --</option>
            {cargos.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        ) : (
          <input name="jenis_muatan" value={form.jenis_muatan} onChange={handleChange} placeholder="Ketik jenis muatan" />
        )}
      </label>

      <label>
        Tujuan
        {destinations.length > 0 ? (
          <select name="tujuan" value={form.tujuan} onChange={handleChange}>
            <option value="">-- Pilih Tujuan --</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.name}>{d.name}</option>
            ))}
          </select>
        ) : (
          <input name="tujuan" value={form.tujuan} onChange={handleChange} placeholder="Ketik tujuan" />
        )}
      </label>

      <label>
        Jenis Timbang
        <select name="jenis_timbang" value={form.jenis_timbang} onChange={handleChange}>
          <option value="gross">Masuk (Gross)</option>
          <option value="tare">Keluar (Tare)</option>
        </select>
      </label>

      <p>Berat terkunci: {lockedWeight !== null ? `${lockedWeight.toFixed(2)} kg` : "-"}</p>

      <button type="submit" disabled={!canSave}>
        {isSubmitting ? "Menyimpan..." : "Simpan"}
      </button>
    </form>
  );
}