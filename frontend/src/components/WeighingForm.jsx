import { useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { saveTransactionLocally } from "../db/db";

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

export default function WeighingForm({ lockedWeight, operatorUsername, onSaved }) {
  const [form, setForm] = useState({
    nomor_polisi: "",
    nama_driver: "",
    jenis_muatan: "",
    jenis_timbang: "gross",
  });

  // ADDED: guard double-submit. `isSubmitting` (state) dipakai untuk
  // disable tombol secara visual, tapi state React di-batch/asinkron --
  // dua klik yang sangat cepat bisa saja SAMA-SAMA lolos sebelum re-render
  // sempat terjadi. `isSubmittingRef` adalah penjaga SINKRON: nilainya
  // langsung berubah di baris kode yang sama, jadi klik kedua yang masuk
  // sepersekian detik setelah klik pertama akan pasti tertolak, walau
  // tombol di layar belum sempat terlihat disabled.
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
        created_at_local: getLocalISOString()
      };
      await saveTransactionLocally(newTx);

      setForm({ nomor_polisi: "", nama_driver: "", jenis_muatan: "", jenis_timbang: "gross" });
      onSaved?.(newTx);
    } finally {
      // Reset guard SETELAH selesai (bukan sebelum), supaya tidak ada
      // celah waktu di mana klik berikutnya bisa nyelip masuk lagi.
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };



  return (
    <form className="weighing-form" onSubmit={handleSubmit}>
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
        <input name="jenis_muatan" value={form.jenis_muatan} onChange={handleChange} />
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