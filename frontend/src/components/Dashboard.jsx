import { useEffect, useState } from "react";
import { useSerial } from "../hooks/useSerial";
import { getPendingTransactions, getTodayHistory } from "../db/db";
import { syncPendingTransactions } from "../services/syncService";
import { exportTransactionsToExcel } from "../utils/exportExcel";
import WeighingForm from "./WeighingForm";
import SyncStatus from "./SyncStatus";
import PrintReceipt from "./PrintReceipt";

export default function Dashboard() {
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
  } = useSerial();
  const [pendingCount, setPendingCount] = useState(0);
  const [lockedWeight, setLockedWeight] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSaved, setLastSaved] = useState(null);

  const handleExport = async () => {
    const history = await getTodayHistory();
    exportTransactionsToExcel(history);
  };

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

      <section className="dashboard__scale-panel">
        {!isConnected ? (
          <>
            <button onClick={() => connect({ baudRate: 9600 })}>Hubungkan Timbangan</button>
          </>
        ) : (
          <button onClick={disconnect}>Putuskan Koneksi</button>
        )}

        <div className={`weight-display ${isStable ? "weight-display--stable" : ""}`}>
          {weight.toFixed(2)} kg
        </div>
        <span>{isStable ? "Stabil" : "Belum stabil..."}</span>
        <p>
        Mode :
        {import.meta.env.VITE_APP_MODE === "demo"
        ? " Demo"
        : " Production"}
        </p>
        <span>{isOnline ? "Online" : "Offline"}</span>

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
          <>
            <span>Tara: {tareWeight.toFixed(2)} kg</span>
            <div className="weight-display weight-display--net">
              Neto: {netWeight.toFixed(2)} kg
            </div>
            <button onClick={clearTare}>Hapus Tare</button>
          </>
        )}

        <button type="button" onClick={() => syncPendingTransactions().catch(console.error)}>
          Sinkronkan Sekarang
        </button>

        {error && <p className="error">{error}</p>}
      </section>

      <WeighingForm
        lockedWeight={lockedWeight}
        onSaved={(savedTx) => {
          setLockedWeight(null);
          setLastSaved(savedTx);
        }}
      />

      <div className="dashboard__actions">
        {lastSaved && (
          <button onClick={() => window.print()}>Cetak Tiket Timbang</button>
        )}
        <button onClick={handleExport}>Ekspor ke Excel</button>
      </div>
      <PrintReceipt transaction={lastSaved} />
    </div>
    <PrintReceipt transaction={lastSaved} />
    </>
  );
}