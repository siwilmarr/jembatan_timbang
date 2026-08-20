"use client";

import { useEffect, useState } from "react";
import { useSerial } from "../hooks/useSerial";
import { getPendingTransactions } from "../db/db";
import { syncPendingTransactions } from "../services/syncService";
import { APP_MODE, API_BASE_URL } from "../config/env";
import WeighingForm from "./WeighingForm";
import SyncStatus from "./SyncStatus";
import SettingsPanel, { loadSerialConfig } from "./Settingspanel";
import DebugPanel from "./DebugPanel";

export default function Dashboard({ userRole, operatorUsername, userWarehouse }) {
  const {
    connect,
    connectSimulated,
    disconnect,
    isConnected,
    weight,
    isStable,
    error,
    zero,
    tare,
    clearTare,
    tareWeight,
    netWeight,
    debugLog,
    clearDebugLog,
  } = useSerial();

  const [pendingCount, setPendingCount] = useState(0);
  const [serialConfig, setSerialConfig] = useState(loadSerialConfig());
  const [lockedWeight, setLockedWeight] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSaved, setLastSaved] = useState(null);
  const [isTestingMode, setIsTestingMode] = useState(false);

  // Master Alat Timbangan
  const [scales, setScales] = useState([]);
  const [selectedScaleId, setSelectedScaleId] = useState("");

  const userToken = typeof window !== "undefined" ? localStorage.getItem("user_token") : "";
  const headers = { "Content-Type": "application/json", Authorization: `Token ${userToken}` };

  // Fetch daftar alat timbangan aktif dari backend
  useEffect(() => {
    const fetchScales = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/scales/?active_only=1`, { headers });
        if (res.ok) {
          const data = await res.json();
          setScales(data);
          // Auto-pilih jika hanya ada 1 alat timbangan aktif
          if (data.length === 1) setSelectedScaleId(String(data[0].id));
        }
      } catch (e) {
        console.warn("Gagal memuat daftar alat timbangan:", e);
      }
    };
    if (APP_MODE !== "demo") fetchScales();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Config serial & protokol yang efektif berdasarkan alat timbangan yang dipilih
  const selectedScale = scales.find(s => String(s.id) === selectedScaleId) || null;
  const effectiveSerialConfig = selectedScale
    ? {
        baudRate: selectedScale.baud_rate,
        dataBits: selectedScale.data_bits,
        stopBits: selectedScale.stop_bits,
        parity: selectedScale.parity,
        indicator_type: selectedScale.indicator_type,
      }
    : { ...serialConfig, indicator_type: "CAS" };

  useEffect(() => {
    const refreshPending = () => getPendingTransactions().then((rows) => setPendingCount(rows.length));
    refreshPending();
    const interval = setInterval(refreshPending, 5000);
    const handleOnline = () => { setIsOnline(true); };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Auto-connect ke port serial yang sudah pernah diotorisasi saat pertama kali mount
  useEffect(() => {
    const tryAutoConnect = async () => {
      if (APP_MODE === "demo" || isTestingMode) {
        connectSimulated();
      } else if ("serial" in navigator) {
        try {
          const approved = await navigator.serial.getPorts();
          if (approved && approved.length > 0) {
            connect(effectiveSerialConfig, false);
          }
        } catch (e) {
          console.warn("Serial auto-connect failed:", e);
        }
      }
    };
    tryAutoConnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTestingMode]);

  const handleLock = () => {
    if (isStable) setLockedWeight(tareWeight !== 0 ? netWeight : weight);
  };

  return (
    <>
      <div id="dashboard-root" className="dashboard">
        <header className="dashboard__header">
          <h1>Jembatan Timbang</h1>
          <SyncStatus pendingCount={pendingCount} />
        </header>

        <SettingsPanel
          config={serialConfig}
          onChange={setSerialConfig}
          isConnected={isConnected}
        />

        {userRole?.includes("Admin") && (
          <DebugPanel
            isTestingMode={isTestingMode}
            onToggleTestingMode={setIsTestingMode}
            debugLog={debugLog}
            clearDebugLog={clearDebugLog}
            isConnected={isConnected}
          />
        )}

        {/* Pilihan Alat Timbangan — hanya tampil di mode production */}
        {APP_MODE !== "demo" && scales.length > 0 && (
          <div style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}>
            <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#475569" }}>
              🔌 Alat Timbangan:
            </span>
            <select
              value={selectedScaleId}
              onChange={e => setSelectedScaleId(e.target.value)}
              disabled={isConnected}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "0.88rem",
                background: isConnected ? "#f1f5f9" : "#fff",
                color: "#334155",
                fontWeight: 500,
                cursor: isConnected ? "not-allowed" : "pointer",
                minWidth: "220px",
              }}
            >
              <option value="">-- Pilih Alat Timbangan --</option>
              {scales.map(sc => (
                <option key={sc.id} value={sc.id}>
                  {sc.name} ({sc.indicator_type === "CAS" ? "CAS - Detail" : "GSC - Sederhana"})
                </option>
              ))}
            </select>
            {selectedScale && (
              <span style={{
                background: selectedScale.indicator_type === "CAS" ? "#eff6ff" : "#fef3c7",
                color: selectedScale.indicator_type === "CAS" ? "#1e40af" : "#d97706",
                padding: "3px 10px",
                borderRadius: "99px",
                fontSize: "0.78rem",
                fontWeight: 700,
              }}>
                {selectedScale.baud_rate} baud · {selectedScale.data_bits}N{selectedScale.stop_bits} · parity={selectedScale.parity}
              </span>
            )}
            {isConnected && (
              <span style={{ fontSize: "0.8rem", color: "#64748b", fontStyle: "italic" }}>
                (Putuskan koneksi terlebih dahulu untuk mengganti alat timbangan)
              </span>
            )}
          </div>
        )}

        <section className="dashboard__scale-panel">
          <div className="scale-panel__connection" style={{ display: "flex", gap: "0.5rem" }}>
            {!isConnected ? (
              <>
                <button
                  onClick={() => isTestingMode ? connectSimulated() : connect(effectiveSerialConfig, false)}
                  disabled={!isTestingMode && APP_MODE !== "demo" && scales.length > 0 && !selectedScaleId}
                  title={!selectedScaleId && scales.length > 0 ? "Pilih alat timbangan terlebih dahulu" : ""}
                >
                  🔌 Hubungkan Timbangan
                </button>
                {!isTestingMode && (
                  <button
                    className="btn-secondary"
                    onClick={() => connect(effectiveSerialConfig, true)}
                    title="Pilih port baru secara manual"
                    disabled={APP_MODE !== "demo" && scales.length > 0 && !selectedScaleId}
                  >
                    🔍 Pilih Port Baru
                  </button>
                )}
              </>
            ) : (
              <>
                <button className="btn-disconnect" onClick={disconnect}>Putuskan Koneksi</button>
                {!isTestingMode && (
                  <button
                    className="btn-secondary"
                    onClick={() => connect(effectiveSerialConfig, true)}
                    title="Sambungkan ulang ke port lain"
                  >
                    🔄 Ganti Port / Reconnect
                  </button>
                )}
              </>
            )}
          </div>

          <div className="scale-panel__readouts">
            <div className={`weight-display ${isStable ? "weight-display--stable" : ""}`}>
              <span className="weight-display__label">Gross</span>
              <span className="weight-display__val">{weight.toFixed(2)} kg</span>
            </div>
            {tareWeight !== 0 && (
              <div className="weight-display weight-display--net">
                <span className="weight-display__label">Netto</span>
                <span className="weight-display__val">{netWeight.toFixed(2)} kg</span>
              </div>
            )}
          </div>

          <div className="scale-panel__status">
            <span className={`badge ${isStable ? "badge--success" : "badge--warning"}`}>
              {isStable ? "● Stabil" : "○ Mengukur..."}
            </span>
            <span className="badge badge--info">
              Mode: {APP_MODE === "demo" ? "Demo" : "Production"}
            </span>
            {selectedScale && (
              <span className="badge badge--info">
                {selectedScale.name}
              </span>
            )}
            <span className={`badge ${isOnline ? "badge--success" : "badge--danger"}`}>
              {isOnline ? "Online" : "Offline"}
            </span>
            {tareWeight !== 0 && (
              <span className="badge badge--secondary">
                Tara: {tareWeight.toFixed(2)} kg
              </span>
            )}
          </div>

          <div className="scale-panel__actions">
            <button disabled={!isStable} onClick={handleLock}>
              Stabilize / Lock
            </button>
            <button disabled={!isConnected || !isStable} onClick={zero} title="Reset titik nol (mis. platform belum benar-benar kosong)">
              Zero
            </button>
            {tareWeight === 0 ? (
              <button disabled={!isConnected || !isStable} onClick={tare} title="Simpan berat saat ini sebagai tara (mis. berat kendaraan kosong)">
                Tare
              </button>
            ) : (
              <button onClick={clearTare} className="btn-danger">
                Hapus Tare
              </button>
            )}
            <button type="button" onClick={() => syncPendingTransactions().catch(console.error)}>
              Sinkronkan Sekarang
            </button>
          </div>

          {error && <p className="error">{error}</p>}
        </section>

        <WeighingForm
          lockedWeight={lockedWeight}
          operatorUsername={operatorUsername}
          userWarehouse={userWarehouse}
          onSaved={(savedTx) => {
            setLockedWeight(null);
            setLastSaved(savedTx);
          }}
        />

        <div className="dashboard__actions">
          {lastSaved && (
            <button onClick={() => window.printTransaction?.(lastSaved)}>Cetak Tiket Timbang</button>
          )}
        </div>
      </div>
    </>
  );
}