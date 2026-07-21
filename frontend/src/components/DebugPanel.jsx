import { useEffect, useRef, useState } from "react";

const LOG_COLOR = {
    raw: "#94a3b8", // abu-abu -- data mentah apa adanya
    frame: "#38bdf8", // biru -- satu baris data sudah dipisah
    success: "#22c55e", // hijau -- berhasil dibaca sebagai berat
    warn: "#eab308", // kuning -- data masuk tapi format tidak cocok
    error: "#ef4444", // merah -- error koneksi/port
    info: "#e2e8f0", // putih -- info umum (buka port, dst)
};

/**
 * Panel Debug + Toggle Testing.
 *
 * - Toggle "Mode Alat Asli / Mode Simulasi": pindah sumber data kapan saja
 *   TANPA perlu ubah VITE_APP_MODE + redeploy. Cocok dipakai teknisi di
 *   lapangan untuk tes cepat.
 * - Log debug: menampilkan apa saja yang benar-benar diterima dari port
 *   serial, supaya kelihatan jelas di tahap mana masalah terjadi kalau
 *   berat tidak berubah:
 *     - Tidak ada log "raw" sama sekali -> alat tidak mengirim data sama
 *       sekali (cek menu F-6 di alat, kabel TX/RX, atau port yang dipilih).
 *     - Ada log "raw" tapi isinya karakter aneh/tidak terbaca -> baud rate
 *       di aplikasi tidak cocok dengan setting alat (cek menu F-5).
 *     - Ada log "frame" & "warn" (bukan "success") -> data bersih diterima,
 *       tapi formatnya tidak cocok dengan regex yang diharapkan aplikasi.
 */
export default function DebugPanel({
    isTestingMode,
    onToggleTestingMode,
    debugLog,
    clearDebugLog,
    isConnected,
}) {
    const [open, setOpen] = useState(false);
    const logEndRef = useRef(null);

    useEffect(() => {
        if (open) logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [debugLog, open]);

    return (
        <section className="debug-panel">
            <div className="debug-panel__toolbar">
                <button type="button" onClick={() => setOpen((v) => !v)}>
                    {open ? "Sembunyikan" : "Tampilkan"} Debug
                </button>

                <label className="debug-panel__toggle-mode" title="Pindah sumber data kapan saja, tanpa perlu ubah pengaturan/redeploy">
                    <span>Mode Alat Asli</span>
                    <input
                        type="checkbox"
                        checked={isTestingMode}
                        disabled={isConnected}
                        onChange={(e) => onToggleTestingMode(e.target.checked)}
                    />
                    <span>Mode Simulasi (Testing)</span>
                </label>
            </div>

            {isConnected && (
                <p className="debug-panel__hint">
                    Putuskan koneksi dulu untuk pindah mode.
                </p>
            )}

            {open && (
                <div className="debug-panel__log">
                    <div className="debug-panel__log-header">
                        <span>{debugLog.length} baris log</span>
                        <button type="button" onClick={clearDebugLog}>
                            Bersihkan log
                        </button>
                    </div>
                    <div className="debug-panel__log-body">
                        {debugLog.length === 0 && (
                            <p className="debug-panel__empty">
                                Belum ada data. Klik "Hubungkan Timbangan" lalu perhatikan
                                apakah baris log mulai muncul di sini.
                            </p>
                        )}
                        {debugLog.map((entry, i) => (
                            <div key={i} style={{ color: LOG_COLOR[entry.type] || "#e2e8f0" }}>
                                <span className="debug-panel__log-time">[{entry.time}]</span> {entry.text}
                            </div>
                        ))}
                        <div ref={logEndRef} />
                    </div>
                </div>
            )}
        </section>
    );
}