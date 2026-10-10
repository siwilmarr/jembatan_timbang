"use client";

import { useEffect, useRef, useState } from "react";
import { useSerial } from "../hooks/useSerial";
import { cacheSyncedTransactionLocally, db, getPendingTransactions } from "../db/db";
import { syncPendingTransactions } from "../services/syncService";
import { APP_MODE, API_BASE_URL } from "../config/env";
import WeighingForm from "./WeighingForm";
import SyncStatus from "./SyncStatus";
import SettingsPanel, { loadSerialConfig } from "./Settingspanel";
import DebugPanel from "./DebugPanel";

export default function Dashboard({ userRole, operatorUsername, userWarehouse, assignedScale }) {
  const {
    connect,
    connectSimulated,
    disconnect,
    testConnection,
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
  const [pendingSecondWeigh, setPendingSecondWeigh] = useState([]);
  const [pendingSecondWeighError, setPendingSecondWeighError] = useState("");
  const [selectedPendingTransaction, setSelectedPendingTransaction] = useState(null);
  const [isTestingMode, setIsTestingMode] = useState(false);
  const pendingSecondWeighRequestRef = useRef(false);
  const pendingSecondWeighRetryAfterRef = useRef(0);

  // Master Alat Timbangan
  const [scales, setScales] = useState([]);
  const [selectedScaleId, setSelectedScaleId] = useState(assignedScale?.id ? String(assignedScale.id) : "");

  const userToken = typeof window !== "undefined" ? localStorage.getItem("user_token") : "";
  const headers = { "Content-Type": "application/json", Authorization: `Token ${userToken}` };

  const refreshPendingSecondWeigh = async (forceServerRefresh = false) => {
    if (pendingSecondWeighRequestRef.current) return;

    try {
      if (
        navigator.onLine &&
        userToken &&
        (forceServerRefresh || Date.now() >= pendingSecondWeighRetryAfterRef.current)
      ) {
        pendingSecondWeighRequestRef.current = true;
        const response = await fetch(`${API_BASE_URL}/weighing/pending-second-weigh/`, {
          headers: { Authorization: `Token ${userToken}` },
        });
        if (!response.ok) {
          pendingSecondWeighRetryAfterRef.current = Date.now() + 60000;
          setPendingSecondWeighError(`Server gagal memuat daftar timbang kedua (HTTP ${response.status}). Data lokal tetap tersedia.`);
        } else {
          const payload = await response.json();
          const serverRows = Array.isArray(payload) ? payload : (payload.results || []);
          await Promise.all(serverRows.map((transaction) => cacheSyncedTransactionLocally(transaction)));
          pendingSecondWeighRetryAfterRef.current = 0;
          setPendingSecondWeighError("");
        }
      }

      const localRows = await db.weighing_transactions.toArray();
      const pendingRows = localRows.filter((transaction) =>
        transaction.jenis_timbang === "gross" &&
        transaction.berat_tara_kg == null &&
        transaction.berat_bersih_kg == null &&
        transaction.pasangan == null
      );
      pendingRows.sort((a, b) => new Date(a.created_at_local) - new Date(b.created_at_local));
      setPendingSecondWeigh(pendingRows);
    } catch (error) {
      pendingSecondWeighRetryAfterRef.current = Date.now() + 60000;
      setPendingSecondWeighError("Gagal menghubungi server untuk daftar timbang kedua. Data lokal tetap tersedia.");
      console.error("Gagal memuat kendaraan yang menunggu timbang kedua:", error);
    } finally {
      pendingSecondWeighRequestRef.current = false;
    }
  };

  // Fetch daftar alat timbangan aktif dari backend
  useEffect(() => {
    const fetchScales = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/scales/?active_only=1`, { headers });
        if (res.ok) {
          const data = await res.json();
          setScales(data);
          if (assignedScale?.id) {
            setSelectedScaleId(String(assignedScale.id));
          } else if (data.length === 1) {
            setSelectedScaleId(String(data[0].id));
          }
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
  const effectiveScale = selectedScale || assignedScale || null;
  const effectiveSerialConfig = effectiveScale
    ? {
        baudRate: effectiveScale.baud_rate,
        dataBits: effectiveScale.data_bits,
        stopBits: effectiveScale.stop_bits,
        parity: effectiveScale.parity,
        indicator_type: effectiveScale.indicator_type,
      }
    : { ...serialConfig, indicator_type: "CAS" };
  const isAdmin = userRole?.includes("Admin");

  useEffect(() => {
    const refreshPending = () => getPendingTransactions().then((rows) => setPendingCount(rows.length));
    refreshPending();
    refreshPendingSecondWeigh();
    const interval = setInterval(() => {
      refreshPending();
      refreshPendingSecondWeigh();
    }, 5000);
    const handleOnline = () => {
      setIsOnline(true);
      refreshPendingSecondWeigh(true);
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

  // Auto-connect dinonaktifkan: port serial tidak aman untuk dibuka otomatis
  // setelah hard reload karena browser bisa masih menyimpan state port lama.
  // Semua koneksi serial harus dipicu secara eksplisit oleh user untuk
  // mencegah race condition dan error "Port is already open".
  const handleLock = () => {
    if (isStable) setLockedWeight(tareWeight !== 0 ? netWeight : weight);
  };

  return (
    <>
      <div id="dashboard-root" className="dashboard dashboard--compact">
        <header className="dashboard__header">
          <h1>Jembatan Timbang</h1>
          <SyncStatus pendingCount={pendingCount} />
        </header>

        {isAdmin && (
          <SettingsPanel
            config={serialConfig}
            onChange={setSerialConfig}
            isConnected={isConnected}
            onTestConnection={() => testConnection(serialConfig)}
          />
        )}

        {pendingSecondWeighError && (
          <div className="pending-second-weigh-error" role="status">
            <span>{pendingSecondWeighError}</span>
            <button type="button" className="btn-secondary" onClick={() => refreshPendingSecondWeigh(true)}>
              Coba lagi
            </button>
          </div>
        )}

        {pendingSecondWeigh.length > 0 && (
          <details className="pending-second-weigh">
            <summary>Menunggu timbang kedua <strong>{pendingSecondWeigh.length}</strong></summary>
            <div className="pending-second-weigh__list">
              {pendingSecondWeigh.map((transaction) => (
                <button
                  key={transaction.id}
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSelectedPendingTransaction(transaction)}
                >
                  <strong>{transaction.nomor_polisi}</strong>
                  <span>{Number(transaction.berat_kg || 0).toLocaleString("id-ID")} kg</span>
                  <span>Timbang ke-2</span>
                </button>
              ))}
            </div>
          </details>
        )}

        {userRole?.includes("Admin") && (
          <DebugPanel
            isTestingMode={isTestingMode}
            onToggleTestingMode={setIsTestingMode}
            debugLog={debugLog}
            clearDebugLog={clearDebugLog}
            isConnected={isConnected}
          />
        )}

        {APP_MODE !== "demo" && (scales.length > 0 || assignedScale) && (
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
              🔌 {isAdmin ? "Alat Timbangan:" : "Timbangan Operator:"}
            </span>
            {isAdmin ? (
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
            ) : (
              <strong>{assignedScale?.name || "Belum ditugaskan"}</strong>
            )}
            {effectiveScale && (
              <span style={{
                background: effectiveScale.indicator_type === "CAS" ? "#eff6ff" : "#fef3c7",
                color: effectiveScale.indicator_type === "CAS" ? "#1e40af" : "#d97706",
                padding: "3px 10px",
                borderRadius: "99px",
                fontSize: "0.78rem",
                fontWeight: 700,
              }}>
                {effectiveScale.baud_rate} baud · {effectiveScale.data_bits}N{effectiveScale.stop_bits} · parity={effectiveScale.parity}
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
                  disabled={!isTestingMode && APP_MODE !== "demo" && !effectiveScale}
                  title={!effectiveScale ? "Admin perlu menetapkan alat timbang untuk akun ini" : ""}
                >
                  🔌 Hubungkan Timbangan
                </button>
                {isAdmin && !isTestingMode && (
                  <button
                    className="btn-secondary"
                    onClick={() => connect(effectiveSerialConfig, true)}
                    title="Pilih port baru secara manual"
                    disabled={APP_MODE !== "demo" && !effectiveScale}
                  >
                    🔍 Pilih Port Baru
                  </button>
                )}
              </>
            ) : (
              <>
                <button className="btn-disconnect" onClick={disconnect}>Putuskan Koneksi</button>
                {isAdmin && !isTestingMode && (
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
          selectedPendingTransaction={selectedPendingTransaction}
          onSaved={(savedTx) => {
            setLockedWeight(null);
            setLastSaved(savedTx);
            setSelectedPendingTransaction(null);
            refreshPendingSecondWeigh();
          }}
        />

        <div className="dashboard__actions" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {lastSaved && (
            <>
              <button
                type="button"
                className="btn-print-ticket"
                onClick={() => window.printTransaction?.(lastSaved)}
              >
                🖨️ Cetak Tiket Timbang
              </button>
              <button
                type="button"
                className="btn-print-kwitansi"
                onClick={() => window.printKwitansi?.(lastSaved)}
              >
                🧾 Cetak Kuitansi
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}