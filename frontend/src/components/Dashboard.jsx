"use client";

import { useEffect, useState } from "react";
import { useSerial } from "../hooks/useSerial";
import { getPendingTransactions } from "../db/db";
import { syncPendingTransactions } from "../services/syncService";
import { APP_MODE } from "../config/env";
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



  useEffect(() => {
    const refreshPending = () => getPendingTransactions().then((rows) => setPendingCount(rows.length));
    refreshPending();
    const interval = setInterval(refreshPending, 5000);
    const handleOnline = () => {
      setIsOnline(true);
      // NOTE: sync saat kembali online sudah ditangani oleh startAutoSync()
      // di App.jsx (lihat services/syncService.js). Memanggil sync lagi di
      // sini dulu menyebabkan 2 request sync jalan bersamaan setiap kali
      // koneksi balik -- sekarang cukup update status UI saja di sini.
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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

        <section className="dashboard__scale-panel">
          <div className="scale-panel__connection">
            {!isConnected ? (
              <button onClick={() => (isTestingMode ? connectSimulated() : connect({ baudRate: 9600 }))}>
                Hubungkan Timbangan
              </button>
            ) : (
              <button className="btn-disconnect" onClick={disconnect}>Putuskan Koneksi</button>
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