import { useEffect, useState } from "react";
import { db } from "../db/db";
import { exportTransactionsToExcel } from "../utils/exportExcel";

export default function HistoryDashboard({ userRole }) {
  const [history, setHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingTx, setEditingTx] = useState(null);
  const [editForm, setEditForm] = useState({
    nomor_polisi: "",
    nama_driver: "",
    jenis_muatan: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmDialog, setConfirmDialog] = useState(null);

  const isAdmin = userRole?.includes("Admin");
  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
  const userToken = localStorage.getItem("user_token");

  const loadHistory = async () => {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const startIso = startOfDay.toISOString();

      // 1. Ambil data lokal terlebih dahulu dari IndexedDB untuk render cepat (offline-first)
      const localRows = await db.weighing_transactions
        .where("created_at_local")
        .above(startIso)
        .reverse()
        .toArray();
      setHistory(localRows);

      // 2. Jika online, lakukan sinkronisasi dua arah dengan server
      if (navigator.onLine && userToken) {
        const res = await fetch(`${API_BASE}/weighing/?created_at_local_gte=${startIso}`, {
          headers: {
            Authorization: `Token ${userToken}`,
          },
        });

        if (res.ok) {
          const responseData = await res.json();
          const serverTxs = Array.isArray(responseData) ? responseData : (responseData.results || []);
          const serverIds = new Set(serverTxs.map((tx) => tx.id));
          const serverMap = new Map(serverTxs.map((tx) => [tx.id, tx]));

          // Ambil ulang data lokal yang paling baru
          const currentLocals = await db.weighing_transactions
            .where("created_at_local")
            .above(startIso)
            .toArray();

          // A. Proses transaksi lokal
          for (const localTx of currentLocals) {
            // Jika sudah tersinkron ke server, tetapi ID-nya tidak ada di server,
            // berarti data tersebut telah dihapus secara manual dari database server
            if (localTx.sync_status === "synced" && !serverIds.has(localTx.id)) {
              await db.weighing_transactions.delete(localTx.localId);
            }
            // Jika ID-nya ada di server, perbarui data lokal dengan data server terbaru (misal jika diedit di server)
            else if (serverIds.has(localTx.id)) {
              const serverTx = serverMap.get(localTx.id);
              await db.weighing_transactions.update(localTx.localId, {
                nomor_polisi: serverTx.nomor_polisi,
                nama_driver: serverTx.nama_driver,
                jenis_muatan: serverTx.jenis_muatan,
                berat_kg: Number(serverTx.berat_kg),
                berat_bersih_kg: serverTx.berat_bersih_kg ? Number(serverTx.berat_bersih_kg) : null,
                sync_status: "synced",
              });
            }
          }

          // B. Proses transaksi dari server yang belum ada di lokal
          const localIds = new Set(currentLocals.map((tx) => tx.id));
          for (const serverTx of serverTxs) {
            if (!localIds.has(serverTx.id)) {
              await db.weighing_transactions.add({
                id: serverTx.id,
                nomor_polisi: serverTx.nomor_polisi,
                nama_driver: serverTx.nama_driver,
                jenis_muatan: serverTx.jenis_muatan,
                jenis_timbang: serverTx.jenis_timbang,
                berat_kg: Number(serverTx.berat_kg),
                berat_bersih_kg: serverTx.berat_bersih_kg ? Number(serverTx.berat_bersih_kg) : null,
                operator: serverTx.operator,
                created_at_local: serverTx.created_at_local,
                sync_status: "synced",
              });
            }
          }

          // C. Muat ulang data terbaru dari IndexedDB setelah sinkronisasi selesai
          const updatedRows = await db.weighing_transactions
            .where("created_at_local")
            .above(startIso)
            .reverse()
            .toArray();
          setHistory(updatedRows);
        }
      }
    } catch (err) {
      console.error("Gagal melakukan sinkronisasi dua arah riwayat:", err);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Hitung statistik harian
  const totalCount = history.length;
  const totalGross = history
    .filter((tx) => tx.jenis_timbang === "gross")
    .reduce((sum, tx) => sum + parseFloat(tx.berat_kg || 0), 0);
  const totalTare = history
    .filter((tx) => tx.jenis_timbang === "tare")
    .reduce((sum, tx) => sum + parseFloat(tx.berat_kg || 0), 0);
  const totalNetto = history
    .filter((tx) => tx.jenis_timbang === "tare" && tx.berat_bersih_kg)
    .reduce((sum, tx) => sum + parseFloat(tx.berat_bersih_kg || 0), 0);

  const filteredHistory = history.filter((tx) => {
    const term = searchTerm.toLowerCase();
    return (
      tx.nomor_polisi.toLowerCase().includes(term) ||
      tx.nama_driver.toLowerCase().includes(term) ||
      (tx.jenis_muatan && tx.jenis_muatan.toLowerCase().includes(term))
    );
  });

  const handleExport = () => {
    exportTransactionsToExcel(history);
  };

  const handleDelete = (tx) => {
    setConfirmDialog({
      type: "delete",
      title: "Konfirmasi Hapus Data",
      message: `Apakah Anda yakin ingin menghapus data timbangan untuk kendaraan ${tx.nomor_polisi}? Tindakan ini akan menghapus data secara permanen di database lokal maupun server pusat.`,
      onConfirm: () => executeDelete(tx),
    });
  };

  const executeDelete = async (tx) => {
    setConfirmDialog(null);
    if (!navigator.onLine) {
      setError("Hapus transaksi hanya dapat dilakukan saat online.");
      return;
    }

    setError("");
    setSuccess("");

    try {
      const res = await fetch(`${API_BASE}/weighing/${tx.id}/`, {
        method: "DELETE",
        headers: {
          Authorization: `Token ${userToken}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Gagal menghapus data di server: ${res.status}`);
      }

      // Hapus di IndexedDB lokal
      await db.weighing_transactions.delete(tx.localId);
      setSuccess("Transaksi berhasil dihapus.");
      loadHistory();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditClick = (tx) => {
    setEditingTx(tx);
    setEditForm({
      nomor_polisi: tx.nomor_polisi,
      nama_driver: tx.nama_driver,
      jenis_muatan: tx.jenis_muatan || "",
    });
  };

  const handleEditSubmitClick = (e) => {
    e.preventDefault();
    setConfirmDialog({
      type: "edit",
      title: "Konfirmasi Simpan Perubahan",
      message: `Apakah Anda yakin ingin menyimpan perubahan data untuk kendaraan ${editForm.nomor_polisi}?`,
      onConfirm: () => executeEdit(),
    });
  };

  const executeEdit = async () => {
    setConfirmDialog(null);
    if (!navigator.onLine) {
      setError("Edit transaksi hanya dapat dilakukan saat online.");
      return;
    }

    setError("");
    setSuccess("");

    try {
      const res = await fetch(`${API_BASE}/weighing/${editingTx.id}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${userToken}`,
        },
        body: JSON.stringify(editForm),
      });

      if (!res.ok) {
        throw new Error(`Gagal mengubah data di server: ${res.status}`);
      }

      const updatedData = await res.json();

      // Update di IndexedDB lokal
      await db.weighing_transactions.update(editingTx.localId, {
        nomor_polisi: updatedData.nomor_polisi,
        nama_driver: updatedData.nama_driver,
        jenis_muatan: updatedData.jenis_muatan,
      });

      setSuccess("Transaksi berhasil diperbarui.");
      setEditingTx(null);
      loadHistory();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="history-dashboard">
      <header className="history-dashboard__header">
        <h2>Dashboard Riwayat Harian</h2>
        <p>Ringkasan dan data penimbangan hari ini</p>
      </header>

      {/* Ringkasan Statistik */}
      <section className="history-dashboard__stats">
        <div className="stat-card">
          <span className="stat-card__title">Total Timbangan</span>
          <span className="stat-card__value">{totalCount}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__title">Total Gross (Masuk)</span>
          <span className="stat-card__value">{totalGross.toFixed(2)} kg</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__title">Total Tare (Keluar)</span>
          <span className="stat-card__value">{totalTare.toFixed(2)} kg</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__title">Total Netto (Bersih)</span>
          <span className="stat-card__value">{totalNetto.toFixed(2)} kg</span>
        </div>
      </section>

      {/* Kontrol Pencarian & Aksi Halaman */}
      <section className="history-dashboard__controls">
        <input
          type="text"
          placeholder="Cari berdasarkan No. Polisi, Driver, atau Muatan..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <button
          type="button"
          onClick={handleExport}
          className="btn-export"
        >
          📁 Ekspor ke Excel
        </button>
      </section>

      {error && <div className="alert alert--error">{error}</div>}
      {success && <div className="alert alert--success">{success}</div>}

      {/* Tabel Data */}
      <section className="history-dashboard__table-container">
        <table className="history-table">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>No. Polisi</th>
              <th>Nama Driver</th>
              <th>Jenis Timbang</th>
              <th>Berat (kg)</th>
              <th>Netto (kg)</th>
              <th>Muatan</th>
              <th>Operator</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center text-muted">
                  Tidak ada data penimbangan untuk hari ini yang cocok.
                </td>
              </tr>
            ) : (
              filteredHistory.map((tx) => (
                <tr key={tx.id}>
                  <td>{new Date(tx.created_at_local).toLocaleTimeString("id-ID")}</td>
                  <td className="font-semibold">{tx.nomor_polisi}</td>
                  <td>{tx.nama_driver}</td>
                  <td>
                    <span className={`badge-type badge-type--${tx.jenis_timbang}`}>
                      {tx.jenis_timbang === "gross" ? "Gross" : "Tare"}
                    </span>
                  </td>
                  <td className="font-semibold">{tx.berat_kg} kg</td>
                  <td>
                    {tx.berat_bersih_kg ? `${tx.berat_bersih_kg} kg` : "-"}
                  </td>
                  <td>{tx.jenis_muatan || "-"}</td>
                  <td><span className="text-muted">{tx.operator || "device"}</span></td>
                  <td>
                    <span className={`sync-status-dot sync-status-dot--${tx.sync_status}`}>
                      {tx.sync_status === "synced" ? "Tersinkron" : "Lokal"}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        type="button"
                        onClick={() => window.printTransaction?.(tx)}
                        className="btn-table-print"
                      >
                        Cetak
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEditClick(tx)}
                            className="btn-table-edit"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(tx)}
                            className="btn-table-delete"
                          >
                            Hapus
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Modal Edit */}
      {editingTx && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Ubah Transaksi Timbang</h3>
            <p className="text-muted">Mengubah data untuk transaksi {editingTx.nomor_polisi}</p>
            <form onSubmit={handleEditSubmitClick} className="modal-form">
              <label>
                Nomor Polisi
                <input
                  type="text"
                  value={editForm.nomor_polisi}
                  onChange={(e) => setEditForm({ ...editForm, nomor_polisi: e.target.value })}
                  required
                />
              </label>

              <label>
                Nama Driver
                <input
                  type="text"
                  value={editForm.nama_driver}
                  onChange={(e) => setEditForm({ ...editForm, nama_driver: e.target.value })}
                />
              </label>

              <label>
                Jenis Muatan
                <input
                  type="text"
                  value={editForm.jenis_muatan}
                  onChange={(e) => setEditForm({ ...editForm, jenis_muatan: e.target.value })}
                />
              </label>

              <div className="modal-actions">
                <button type="button" onClick={() => setEditingTx(null)} className="btn-secondary">
                  Batal
                </button>
                <button type="submit" className="btn-primary">
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Kustom */}
      {confirmDialog && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content text-center">
            <h3>{confirmDialog.title}</h3>
            <p style={{ margin: "1rem 0", color: "#475569", lineHeight: "1.5" }}>
              {confirmDialog.message}
            </p>
            <div className="modal-actions" style={{ justifyContent: "center" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirmDialog(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className={confirmDialog.type === "delete" ? "btn-danger" : "btn-primary"}
                onClick={confirmDialog.onConfirm}
              >
                {confirmDialog.type === "delete" ? "Ya, Hapus" : "Ya, Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
