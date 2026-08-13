"use client";

import { useEffect, useState } from "react";
import { db } from "../db/db";
import { exportTransactionsToExcel } from "../utils/exportExcel";
import { API_BASE_URL } from "../config/env";

export default function HistoryDashboard({ userRole, userWarehouse }) {
  const [history, setHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingTx, setEditingTx] = useState(null);
  const [editForm, setEditForm] = useState({
    nomor_polisi: "",
    nama_driver: "",
    jenis_muatan: "",
    tujuan: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Filter states
  const [warehouses, setWarehouses] = useState([]);
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return today.toISOString().split("T")[0];
  });
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [activeTabType, setActiveTabType] = useState("detail"); // "detail" atau "summary"
  const [groupByField, setGroupByField] = useState("warehouse_name"); // "warehouse_name", "jenis_muatan", "tujuan", "operator"

  // Reset states
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetFilters, setResetFilters] = useState({
    startDate: "",
    endDate: "",
    warehouseId: "",
  });

  const isAdmin = userRole?.includes("Admin");
  const API_BASE = API_BASE_URL;
  const userToken = typeof window !== "undefined" ? localStorage.getItem("user_token") : "";

  // Load warehouses list
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        if (navigator.onLine && userToken) {
          const res = await fetch(`${API_BASE}/warehouses/`, {
            headers: {
              Authorization: `Token ${userToken}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            setWarehouses(data);
          }
        }
      } catch (err) {
        console.error("Gagal mengambil data gudang:", err);
      }
    };
    fetchWarehouses();
  }, []);

  const loadHistory = async () => {
    try {
      // Helper: buat ISO string menggunakan offset timezone lokal
      // agar konsisten dengan format created_at_local yang tersimpan
      const padZ = (n, len = 2) => String(n).padStart(len, "0");
      const getLocalISO = (date) => {
        const off = -date.getTimezoneOffset();
        const sign = off >= 0 ? "+" : "-";
        const hh = padZ(Math.floor(Math.abs(off) / 60));
        const mm = padZ(Math.abs(off) % 60);
        return (
          date.getFullYear() +
          "-" + padZ(date.getMonth() + 1) +
          "-" + padZ(date.getDate()) +
          "T" + padZ(date.getHours()) +
          ":" + padZ(date.getMinutes()) +
          ":" + padZ(date.getSeconds()) +
          "." + padZ(date.getMilliseconds(), 3) +
          sign + hh + ":" + mm
        );
      };

      const startOfDay = new Date(startDate);
      startOfDay.setHours(0, 0, 0, 0);
      const startIso = getLocalISO(startOfDay);

      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      const endIso = getLocalISO(endOfDay);

      // 1. Ambil data lokal dari IndexedDB (offline-first)
      let localRows = await db.weighing_transactions
        .where("created_at_local")
        .between(startIso, endIso, true, true)
        .toArray();

      if (selectedWarehouse) {
        localRows = localRows.filter(
          (tx) => tx.warehouse_id == selectedWarehouse || tx.warehouse == selectedWarehouse
        );
      }

      localRows.sort((a, b) => new Date(b.created_at_local) - new Date(a.created_at_local));
      setHistory(localRows);

      // 2. Jika online, lakukan sinkronisasi dua arah dengan server
      if (navigator.onLine && userToken) {
        let url = `${API_BASE}/weighing/?created_at_local_gte=${startIso}&created_at_local_lte=${endIso}`;
        if (selectedWarehouse) {
          url += `&warehouse_id=${selectedWarehouse}`;
        }

        const res = await fetch(url, {
          headers: {
            Authorization: `Token ${userToken}`,
          },
        });

        if (res.ok) {
          const responseData = await res.json();
          const serverTxs = Array.isArray(responseData) ? responseData : (responseData.results || []);
          const serverIds = new Set(serverTxs.map((tx) => tx.id));
          const serverMap = new Map(serverTxs.map((tx) => [tx.id, tx]));

          // Ambil ulang data lokal yang paling baru di range & filter yang sama
          let currentLocals = await db.weighing_transactions
            .where("created_at_local")
            .between(startIso, endIso, true, true)
            .toArray();

          if (selectedWarehouse) {
            currentLocals = currentLocals.filter(
              (tx) => tx.warehouse_id == selectedWarehouse || tx.warehouse == selectedWarehouse
            );
          }

          // A. Proses transaksi lokal
          for (const localTx of currentLocals) {
            // Jika sudah tersinkron ke server, tetapi ID-nya tidak ada di server,
            // berarti data tersebut telah dihapus secara manual dari database server
            if (localTx.sync_status === "synced" && !serverIds.has(localTx.id)) {
              await db.weighing_transactions.delete(localTx.localId);
            }
            // Jika ID-nya ada di server, perbarui data lokal dengan data server terbaru
            else if (serverIds.has(localTx.id)) {
              const serverTx = serverMap.get(localTx.id);
              await db.weighing_transactions.update(localTx.localId, {
                nomor_polisi: serverTx.nomor_polisi,
                nama_driver: serverTx.nama_driver,
                jenis_muatan: serverTx.jenis_muatan,
                tujuan: serverTx.tujuan,
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
              await db.weighing_transactions.put({
                id: serverTx.id,
                nomor_polisi: serverTx.nomor_polisi,
                nama_driver: serverTx.nama_driver,
                jenis_muatan: serverTx.jenis_muatan,
                tujuan: serverTx.tujuan,
                jenis_timbang: serverTx.jenis_timbang,
                berat_kg: Number(serverTx.berat_kg),
                berat_bersih_kg: serverTx.berat_bersih_kg ? Number(serverTx.berat_bersih_kg) : null,
                operator: serverTx.operator,
                warehouse_id: serverTx.warehouse,
                warehouse_name: serverTx.warehouse_name,
                created_at_local: serverTx.created_at_local,
                sync_status: "synced",
              });
            }
          }

          // C. Muat ulang data terbaru dari IndexedDB setelah sinkronisasi selesai
          let updatedRows = await db.weighing_transactions
            .where("created_at_local")
            .between(startIso, endIso, true, true)
            .toArray();

          if (selectedWarehouse) {
            updatedRows = updatedRows.filter(
              (tx) => tx.warehouse_id == selectedWarehouse || tx.warehouse == selectedWarehouse
            );
          }

          updatedRows.sort((a, b) => new Date(b.created_at_local) - new Date(a.created_at_local));
          setHistory(updatedRows);
        }
      }
    } catch (err) {
      console.error("Gagal melakukan sinkronisasi dua arah riwayat:", err);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [startDate, endDate, selectedWarehouse]);

  // Hitung statistik berdasarkan data terpilih
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
      (tx.jenis_muatan && tx.jenis_muatan.toLowerCase().includes(term)) ||
      (tx.tujuan && tx.tujuan.toLowerCase().includes(term)) ||
      (tx.warehouse_name && tx.warehouse_name.toLowerCase().includes(term))
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

      // 204 No Content = berhasil dihapus
      // 404 Not Found  = data sudah tidak ada di server (tetap anggap sukses)
      if (!res.ok && res.status !== 404) {
        throw new Error(`Gagal menghapus data di server: ${res.status}`);
      }

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
      tujuan: tx.tujuan || "",
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

      await db.weighing_transactions.update(editingTx.localId, {
        nomor_polisi: updatedData.nomor_polisi,
        nama_driver: updatedData.nama_driver,
        jenis_muatan: updatedData.jenis_muatan,
        tujuan: updatedData.tujuan,
      });

      setSuccess("Transaksi berhasil diperbarui.");
      setEditingTx(null);
      loadHistory();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResetDataClick = () => {
    setResetFilters({
      startDate: startDate,
      endDate: endDate,
      warehouseId: selectedWarehouse,
    });
    setShowResetModal(true);
  };

  const executeReset = async () => {
    if (!navigator.onLine) {
      setError("Reset data hanya dapat dilakukan saat online.");
      setShowResetModal(false);
      return;
    }

    if (!resetFilters.startDate || !resetFilters.endDate) {
      setError("Tanggal mulai dan tanggal selesai wajib diisi untuk reset.");
      return;
    }

    setError("");
    setSuccess("");
    setIsResetting(true);

    try {
      // Gunakan helper getLocalISO yang sama dengan loadHistory
      // agar format timezone konsisten dengan created_at_local di DB
      const padZ = (n, len = 2) => String(n).padStart(len, "0");
      const getLocalISO = (date) => {
        const off = -date.getTimezoneOffset();
        const sign = off >= 0 ? "+" : "-";
        const hh = padZ(Math.floor(Math.abs(off) / 60));
        const mm = padZ(Math.abs(off) % 60);
        return (
          date.getFullYear() +
          "-" + padZ(date.getMonth() + 1) +
          "-" + padZ(date.getDate()) +
          "T" + padZ(date.getHours()) +
          ":" + padZ(date.getMinutes()) +
          ":" + padZ(date.getSeconds()) +
          "." + padZ(date.getMilliseconds(), 3) +
          sign + hh + ":" + mm
        );
      };

      const start = new Date(resetFilters.startDate);
      start.setHours(0, 0, 0, 0);
      const startIso = getLocalISO(start);

      const end = new Date(resetFilters.endDate);
      end.setHours(23, 59, 59, 999);
      const endIso = getLocalISO(end);

      const res = await fetch(`${API_BASE}/weighing/reset/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${userToken}`,
        },
        body: JSON.stringify({
          created_at_local_gte: startIso,
          created_at_local_lte: endIso,
          warehouse_id: resetFilters.warehouseId || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || `Gagal me-reset data: ${res.status}`);
      }

      const resData = await res.json();

      // Hapus di IndexedDB (gunakan format lokal yang sama)
      let localTxs = await db.weighing_transactions
        .where("created_at_local")
        .between(startIso, endIso, true, true)
        .toArray();

      if (resetFilters.warehouseId) {
        localTxs = localTxs.filter(
          (tx) => tx.warehouse_id == resetFilters.warehouseId || tx.warehouse == resetFilters.warehouseId
        );
      }

      for (const tx of localTxs) {
        await db.weighing_transactions.delete(tx.localId);
      }

      setSuccess(`Berhasil me-reset data. Total ${resData.deleted_count} transaksi dihapus.`);
      setShowResetModal(false);
      loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsResetting(false);
    }
  };

  const getSummaryData = () => {
    const summaryMap = {};
    history.forEach((tx) => {
      let key = "";
      if (groupByField === "warehouse_name") {
        key = tx.warehouse_name || "Tanpa Gudang";
      } else if (groupByField === "jenis_muatan") {
        key = tx.jenis_muatan || "Tanpa Muatan";
      } else if (groupByField === "tujuan") {
        key = tx.tujuan || "Tanpa Tujuan";
      } else if (groupByField === "operator") {
        key = tx.operator || "device";
      }

      if (!summaryMap[key]) {
        summaryMap[key] = {
          category: key,
          count: 0,
          gross: 0,
          tare: 0,
          netto: 0,
        };
      }

      summaryMap[key].count += 1;
      const berat = parseFloat(tx.berat_kg || 0);
      if (tx.jenis_timbang === "gross") {
        summaryMap[key].gross += berat;
      } else if (tx.jenis_timbang === "tare") {
        summaryMap[key].tare += berat;
      }

      if (tx.berat_bersih_kg) {
        summaryMap[key].netto += parseFloat(tx.berat_bersih_kg);
      }
    });
    return Object.values(summaryMap);
  };

  return (
    <div className="history-dashboard">
      <header className="history-dashboard__header">
        <h2>Laporan & Riwayat Penimbangan</h2>
        <p>Ringkasan dan data transaksi timbang terfilter</p>
      </header>

      {/* Sub Tab Laporan */}
      <div className="navbar__tabs" style={{ marginBottom: "1.5rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.5rem" }}>
        <button
          type="button"
          className={`navbar__tab ${activeTabType === "detail" ? "navbar__tab--active" : ""}`}
          onClick={() => setActiveTabType("detail")}
        >
          📋 Detail Transaksi
        </button>
        <button
          type="button"
          className={`navbar__tab ${activeTabType === "summary" ? "navbar__tab--active" : ""}`}
          onClick={() => setActiveTabType("summary")}
        >
          📊 Ringkasan (Summary)
        </button>
      </div>

      {/* Filter Laporan */}
      <section className="history-dashboard__filters">
        <label>
          Dari Tanggal
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label>
          Sampai Tanggal
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
        <label>
          Warehouse
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
          >
            <option value="">-- Semua Warehouse --</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        {activeTabType === "summary" && (
          <label>
            Kelompokkan Berdasarkan
            <select
              value={groupByField}
              onChange={(e) => setGroupByField(e.target.value)}
            >
              <option value="warehouse_name">Warehouse (Gudang)</option>
              <option value="jenis_muatan">Jenis Muatan</option>
              <option value="tujuan">Tujuan</option>
              <option value="operator">Operator</option>
            </select>
          </label>
        )}
        {isAdmin && (
          <button
            type="button"
            className="btn-reset-data"
            onClick={handleResetDataClick}
            style={{ alignSelf: "flex-end", height: "46px" }}
          >
            ⚠️ Reset Data Timbangan
          </button>
        )}
      </section>

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

      {error && <div className="alert alert--error">{error}</div>}
      {success && <div className="alert alert--success">{success}</div>}

      {activeTabType === "summary" ? (
        /* Tabel Summary (Agregasi) */
        <section className="history-dashboard__table-container">
          <table className="history-table">
            <thead>
              <tr>
                <th>Kategori ({groupByField === "warehouse_name" ? "Warehouse" : groupByField === "jenis_muatan" ? "Jenis Muatan" : groupByField === "tujuan" ? "Tujuan" : "Operator"})</th>
                <th>Jumlah Transaksi</th>
                <th>Total Gross</th>
                <th>Total Tare</th>
                <th>Total Netto</th>
                <th style={{ width: "200px" }}>Proporsi Netto</th>
              </tr>
            </thead>
            <tbody>
              {getSummaryData().length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted">
                    Tidak ada data ringkasan untuk filter yang dipilih.
                  </td>
                </tr>
              ) : (
                (() => {
                  const summaryList = getSummaryData();
                  const grandTotalNetto = summaryList.reduce((sum, item) => sum + item.netto, 0);
                  
                  return summaryList.map((item, idx) => {
                    const percentage = grandTotalNetto > 0 ? ((item.netto / grandTotalNetto) * 100).toFixed(1) : 0;
                    return (
                      <tr key={idx}>
                        <td className="font-semibold">{item.category}</td>
                        <td>{item.count} timbangan</td>
                        <td>{item.gross.toLocaleString("id-ID")} kg</td>
                        <td>{item.tare.toLocaleString("id-ID")} kg</td>
                        <td className="font-semibold">{item.netto.toLocaleString("id-ID")} kg</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ flex: 1, height: "8px", background: "#e2e8f0", borderRadius: "999px", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${percentage}%`, background: "#2563eb", borderRadius: "999px" }}></div>
                            </div>
                            <span style={{ fontSize: "0.8rem", fontWeight: "600", color: "#475569", minWidth: "40px" }}>{percentage}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })()
              )}
            </tbody>
          </table>
        </section>
      ) : (
        /* Tabel Detail (Transaksi Per Baris) */
        <>
          {/* Kontrol Pencarian & Ekspor */}
          <section className="history-dashboard__controls">
            <input
              type="text"
              placeholder="Cari berdasarkan No. Polisi, Driver, Muatan, Tujuan, atau Warehouse..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <button type="button" onClick={handleExport} className="btn-export">
              📁 Ekspor ke Excel
            </button>
          </section>

          <section className="history-dashboard__table-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Warehouse</th>
                  <th>No. Polisi</th>
                  <th>Nama Driver</th>
                  <th>Jenis Timbang</th>
                  <th>Berat (kg)</th>
                  <th>Netto (kg)</th>
                  <th>Muatan</th>
                  <th>Tujuan</th>
                  <th>Operator</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center text-muted">
                      Tidak ada data penimbangan yang cocok dengan kriteria filter.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((tx) => (
                    <tr key={tx.id}>
                      <td>{new Date(tx.created_at_local).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td className="font-semibold">{tx.warehouse_name || "-"}</td>
                      <td className="font-semibold">{tx.nomor_polisi}</td>
                      <td>{tx.nama_driver}</td>
                      <td>
                        <span className={`badge-type badge-type--${tx.jenis_timbang}`}>
                          {tx.jenis_timbang === "gross" ? "Gross" : "Tare"}
                        </span>
                      </td>
                      <td className="font-semibold">{tx.berat_kg} kg</td>
                      <td>{tx.berat_bersih_kg ? `${tx.berat_bersih_kg} kg` : "-"}</td>
                      <td>{tx.jenis_muatan || "-"}</td>
                      <td>{tx.tujuan || "-"}</td>
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
        </>
      )}

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

              <label>
                Tujuan
                <input
                  type="text"
                  value={editForm.tujuan}
                  onChange={(e) => setEditForm({ ...editForm, tujuan: e.target.value })}
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

      {/* Modal Reset Data */}
      {showResetModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content">
            <h3>⚠️ Reset Data Timbangan</h3>
            <p style={{ color: "#ef4444", fontSize: "0.9rem", margin: "0.5rem 0 1.5rem 0", lineHeight: "1.4" }}>
              Tindakan ini akan menghapus semua data transaksi timbang secara permanen di database lokal (IndexedDB) dan database server untuk kriteria filter di bawah.
            </p>
            <div className="modal-form">
              <label>
                Dari Tanggal
                <input
                  type="date"
                  value={resetFilters.startDate}
                  onChange={(e) => setResetFilters({ ...resetFilters, startDate: e.target.value })}
                  required
                />
              </label>
              <label>
                Sampai Tanggal
                <input
                  type="date"
                  value={resetFilters.endDate}
                  onChange={(e) => setResetFilters({ ...resetFilters, endDate: e.target.value })}
                  required
                />
              </label>
              <label>
                Warehouse
                <select
                  value={resetFilters.warehouseId}
                  onChange={(e) => setResetFilters({ ...resetFilters, warehouseId: e.target.value })}
                >
                  <option value="">-- Semua Warehouse --</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="modal-actions" style={{ marginTop: "1rem" }}>
                <button type="button" onClick={() => setShowResetModal(false)} className="btn-secondary" disabled={isResetting}>
                  Batal
                </button>
                <button type="button" onClick={executeReset} className="btn-danger" disabled={isResetting}>
                  {isResetting ? "Mengahapus..." : "Ya, Hapus Permanen"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Kustom */}
      {confirmDialog && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
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
