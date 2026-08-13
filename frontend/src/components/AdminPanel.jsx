"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config/env";

export default function AdminPanel() {
  const [activeSubTab, setActiveSubTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [cargos, setCargos] = useState([]);

  // Database Config State
  const [dbForm, setDbForm] = useState({
    ENGINE: "django.db.backends.postgresql",
    NAME: "",
    USER: "",
    PASSWORD: "",
    HOST: "",
    PORT: "",
  });
  const [showDbPassword, setShowDbPassword] = useState(false);

  // Loading & Error States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showUserPassword, setShowUserPassword] = useState(false);

  // CRUD Forms State
  const [userForm, setUserForm] = useState({
    id: null,
    username: "",
    password: "",
    email: "",
    roles_write: ["Operator"],
    warehouse: "",
  });

  const [warehouseForm, setWarehouseForm] = useState({
    id: null,
    name: "",
    code: "",
  });

  const [destinationForm, setDestinationForm] = useState({
    id: null,
    name: "",
  });

  const [cargoForm, setCargoForm] = useState({
    id: null,
    name: "",
  });

  const API_BASE = API_BASE_URL;
  const userToken = typeof window !== "undefined" ? localStorage.getItem("user_token") : "";

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Token ${userToken}`,
  };

  // Fetch Data
  const fetchData = async () => {
    if (!navigator.onLine) {
      setError("Anda sedang offline. Tidak dapat memuat data panel admin.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (activeSubTab === "users") {
        const [uRes, wRes] = await Promise.all([
          fetch(`${API_BASE}/users/`, { headers }),
          fetch(`${API_BASE}/warehouses/`, { headers }),
        ]);
        if (uRes.ok) setUsers(await uRes.json());
        if (wRes.ok) setWarehouses(await wRes.json());
      } else if (activeSubTab === "warehouses") {
        const res = await fetch(`${API_BASE}/warehouses/`, { headers });
        if (res.ok) setWarehouses(await res.json());
      } else if (activeSubTab === "destinations") {
        const res = await fetch(`${API_BASE}/destinations/`, { headers });
        if (res.ok) setDestinations(await res.json());
      } else if (activeSubTab === "cargos") {
        const res = await fetch(`${API_BASE}/cargos/`, { headers });
        if (res.ok) setCargos(await res.json());
      } else if (activeSubTab === "database") {
        const res = await fetch(`${API_BASE}/db-config/`, { headers });
        if (res.ok) setDbForm(await res.json());
      }
    } catch (err) {
      setError("Gagal memuat data master.");
    } finally {
      setLoading(false);
    }
  };

  const handleDatabaseSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/db-config/`, {
        method: "POST",
        headers,
        body: JSON.stringify(dbForm),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.detail || "Gagal menyimpan konfigurasi database.");
      }

      setSuccess(resData.detail || "Konfigurasi database berhasil disimpan dan diterapkan.");
      
      // Reload database config
      const getRes = await fetch(`${API_BASE}/db-config/`, { headers });
      if (getRes.ok) setDbForm(await getRes.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeSubTab]);

  // Handle CRUD untuk User
  const handleUserSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const isEdit = !!userForm.id;
      const url = isEdit ? `${API_BASE}/users/${userForm.id}/` : `${API_BASE}/users/`;
      const method = isEdit ? "PATCH" : "POST";

      const payload = {
        username: userForm.username,
        email: userForm.email,
        roles_write: userForm.roles_write,
        profile: userForm.warehouse ? { warehouse: Number(userForm.warehouse) } : null,
      };
      if (userForm.password) {
        payload.password = userForm.password;
      }

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || errData.username?.[0] || "Gagal menyimpan user.");
      }

      setSuccess(isEdit ? "User berhasil diperbarui." : "User berhasil ditambahkan.");
      setUserForm({ id: null, username: "", password: "", email: "", roles_write: ["Operator"], warehouse: "" });
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUserDelete = async (id) => {
    if (!confirm("Apakah Anda yakin ingin menghapus user ini?")) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/users/${id}/`, { method: "DELETE", headers });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Gagal menghapus user.");
      }
      setSuccess("User berhasil dihapus.");
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle CRUD untuk Warehouse
  const handleWarehouseSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const isEdit = !!warehouseForm.id;
      const url = isEdit ? `${API_BASE}/warehouses/${warehouseForm.id}/` : `${API_BASE}/warehouses/`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({ name: warehouseForm.name, code: warehouseForm.code }),
      });

      if (!res.ok) throw new Error("Gagal menyimpan data warehouse.");

      setSuccess(isEdit ? "Warehouse berhasil diperbarui." : "Warehouse berhasil ditambahkan.");
      setWarehouseForm({ id: null, name: "", code: "" });
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleWarehouseDelete = async (id) => {
    if (!confirm("Apakah Anda yakin ingin menghapus warehouse ini?")) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/warehouses/${id}/`, { method: "DELETE", headers });
      if (!res.ok) throw new Error("Gagal menghapus warehouse.");
      setSuccess("Warehouse berhasil dihapus.");
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle CRUD untuk Destination
  const handleDestinationSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const isEdit = !!destinationForm.id;
      const url = isEdit ? `${API_BASE}/destinations/${destinationForm.id}/` : `${API_BASE}/destinations/`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({ name: destinationForm.name }),
      });

      if (!res.ok) throw new Error("Gagal menyimpan tujuan.");

      setSuccess(isEdit ? "Tujuan berhasil diperbarui." : "Tujuan berhasil ditambahkan.");
      setDestinationForm({ id: null, name: "" });
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDestinationDelete = async (id) => {
    if (!confirm("Apakah Anda yakin ingin menghapus tujuan ini?")) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/destinations/${id}/`, { method: "DELETE", headers });
      if (!res.ok) throw new Error("Gagal menghapus tujuan.");
      setSuccess("Tujuan berhasil dihapus.");
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle CRUD untuk Cargo
  const handleCargoSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const isEdit = !!cargoForm.id;
      const url = isEdit ? `${API_BASE}/cargos/${cargoForm.id}/` : `${API_BASE}/cargos/`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers,
        body: JSON.stringify({ name: cargoForm.name }),
      });

      if (!res.ok) throw new Error("Gagal menyimpan muatan.");

      setSuccess(isEdit ? "Muatan berhasil diperbarui." : "Muatan berhasil ditambahkan.");
      setCargoForm({ id: null, name: "" });
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCargoDelete = async (id) => {
    if (!confirm("Apakah Anda yakin ingin menghapus muatan ini?")) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/cargos/${id}/`, { method: "DELETE", headers });
      if (!res.ok) throw new Error("Gagal menghapus muatan.");
      setSuccess("Muatan berhasil dihapus.");
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="admin-panel" style={{ padding: "1.5rem" }}>
      <header className="history-dashboard__header">
        <h2>Panel Administrasi Master Data</h2>
        <p>Kelola semua modul administrasi, user, dan data master jembatan timbang</p>
      </header>

      {/* Sub Tab Menu */}
      <div className="navbar__tabs" style={{ marginBottom: "1.5rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.5rem" }}>
        <button
          type="button"
          className={`navbar__tab ${activeSubTab === "users" ? "navbar__tab--active" : ""}`}
          onClick={() => setActiveSubTab("users")}
        >
          👤 Kelola User
        </button>
        <button
          type="button"
          className={`navbar__tab ${activeSubTab === "warehouses" ? "navbar__tab--active" : ""}`}
          onClick={() => setActiveSubTab("warehouses")}
        >
          🏭 Kelola Gudang (Warehouse)
        </button>
        <button
          type="button"
          className={`navbar__tab ${activeSubTab === "destinations" ? "navbar__tab--active" : ""}`}
          onClick={() => setActiveSubTab("destinations")}
        >
          📍 Kelola Tujuan
        </button>
        <button
          type="button"
          className={`navbar__tab ${activeSubTab === "cargos" ? "navbar__tab--active" : ""}`}
          onClick={() => setActiveSubTab("cargos")}
        >
          📦 Kelola Muatan
        </button>
        <button
          type="button"
          className={`navbar__tab ${activeSubTab === "database" ? "navbar__tab--active" : ""}`}
          onClick={() => setActiveSubTab("database")}
        >
          ⚙️ Konfigurasi Database
        </button>
      </div>

      {error && <div className="alert alert--error" style={{ marginBottom: "1rem" }}>{error}</div>}
      {success && <div className="alert alert--success" style={{ marginBottom: "1rem" }}>{success}</div>}

      {loading && <p className="text-muted">Sedang memproses data...</p>}

      {/* SECTION KELOLA USER */}
      {!loading && activeSubTab === "users" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "2rem" }}>
          {/* Form Create/Edit User */}
          <form onSubmit={handleUserSubmit} className="weighing-form" style={{ background: "#f8fafc", padding: "1.5rem", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <h3>{userForm.id ? "✏️ Edit User" : "➕ Tambah User Baru"}</h3>
            
            <label>
              Username
              <input
                type="text"
                value={userForm.username}
                onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                required
              />
            </label>

            <label>
              Password {userForm.id && <span style={{ fontSize: "0.8rem", color: "#64748b" }}>(kosongkan jika tidak ingin diubah)</span>}
              <div style={{ position: "relative" }}>
                <input
                  type={showUserPassword ? "text" : "password"}
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  required={!userForm.id}
                  style={{ paddingRight: "45px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowUserPassword(!showUserPassword)}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    padding: 0,
                    fontSize: "1.2rem",
                    cursor: "pointer",
                  }}
                >
                  {showUserPassword ? "👁️" : "🙈"}
                </button>
              </div>
            </label>

            <label>
              Email
              <input
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              />
            </label>

            <label>
              Role / Peran
              <select
                value={userForm.roles_write[0]}
                onChange={(e) => setUserForm({ ...userForm, roles_write: [e.target.value] })}
              >
                <option value="Operator">Operator</option>
                <option value="Admin">Admin</option>
              </select>
            </label>

            <label>
              Penugasan Warehouse
              <select
                value={userForm.warehouse}
                onChange={(e) => setUserForm({ ...userForm, warehouse: e.target.value })}
              >
                <option value="">-- Tanpa Gudang --</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </label>

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>Simpan</button>
              {userForm.id && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setUserForm({ id: null, username: "", password: "", email: "", roles_write: ["Operator"], warehouse: "" })}
                >
                  Batal
                </button>
              )}
            </div>
          </form>

          {/* List User */}
          <div className="history-dashboard__table-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Warehouse</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="font-semibold">{u.username}</td>
                    <td>{u.email || "-"}</td>
                    <td>
                      <span className={`badge-type badge-type--${u.roles?.includes("Admin") ? "gross" : "tare"}`}>
                        {u.roles?.join(", ")}
                      </span>
                    </td>
                    <td>{u.profile?.warehouse_name || "-"}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn-table-edit"
                          onClick={() => setUserForm({
                            id: u.id,
                            username: u.username,
                            password: "",
                            email: u.email || "",
                            roles_write: u.roles || ["Operator"],
                            warehouse: u.profile?.warehouse || "",
                          })}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-table-delete"
                          onClick={() => handleUserDelete(u.id)}
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION KELOLA WAREHOUSE */}
      {!loading && activeSubTab === "warehouses" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "2rem" }}>
          {/* Form */}
          <form onSubmit={handleWarehouseSubmit} className="weighing-form" style={{ background: "#f8fafc", padding: "1.5rem", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <h3>{warehouseForm.id ? "✏️ Edit Gudang" : "➕ Tambah Gudang baru"}</h3>
            <label>
              Nama Gudang
              <input
                type="text"
                value={warehouseForm.name}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                required
              />
            </label>
            <label>
              Kode Gudang
              <input
                type="text"
                value={warehouseForm.code}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value })}
                placeholder="misal: WH-UTARA"
              />
            </label>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>Simpan</button>
              {warehouseForm.id && (
                <button type="button" className="btn-secondary" onClick={() => setWarehouseForm({ id: null, name: "", code: "" })}>
                  Batal
                </button>
              )}
            </div>
          </form>

          {/* List */}
          <div className="history-dashboard__table-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Nama Gudang</th>
                  <th>Kode Gudang</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.map((w) => (
                  <tr key={w.id}>
                    <td className="font-semibold">{w.name}</td>
                    <td>{w.code || "-"}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn-table-edit"
                          onClick={() => setWarehouseForm({ id: w.id, name: w.name, code: w.code || "" })}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-table-delete"
                          onClick={() => handleWarehouseDelete(w.id)}
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION KELOLA TUJUAN */}
      {!loading && activeSubTab === "destinations" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "2rem" }}>
          {/* Form */}
          <form onSubmit={handleDestinationSubmit} className="weighing-form" style={{ background: "#f8fafc", padding: "1.5rem", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <h3>{destinationForm.id ? "✏️ Edit Tujuan" : "➕ Tambah Tujuan Baru"}</h3>
            <label>
              Nama Lokasi Tujuan
              <input
                type="text"
                value={destinationForm.name}
                onChange={(e) => setDestinationForm({ ...destinationForm, name: e.target.value })}
                required
              />
            </label>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>Simpan</button>
              {destinationForm.id && (
                <button type="button" className="btn-secondary" onClick={() => setDestinationForm({ id: null, name: "" })}>
                  Batal
                </button>
              )}
            </div>
          </form>

          {/* List */}
          <div className="history-dashboard__table-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Nama Lokasi Tujuan</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {destinations.map((d) => (
                  <tr key={d.id}>
                    <td className="font-semibold">{d.name}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn-table-edit"
                          onClick={() => setDestinationForm({ id: d.id, name: d.name })}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-table-delete"
                          onClick={() => handleDestinationDelete(d.id)}
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION KELOLA MUATAN */}
      {!loading && activeSubTab === "cargos" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "2rem" }}>
          {/* Form */}
          <form onSubmit={handleCargoSubmit} className="weighing-form" style={{ background: "#f8fafc", padding: "1.5rem", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <h3>{cargoForm.id ? "✏️ Edit Muatan" : "➕ Tambah Muatan Baru"}</h3>
            <label>
              Nama Jenis Muatan
              <input
                type="text"
                value={cargoForm.name}
                onChange={(e) => setCargoForm({ ...cargoForm, name: e.target.value })}
                required
              />
            </label>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>Simpan</button>
              {cargoForm.id && (
                <button type="button" className="btn-secondary" onClick={() => setCargoForm({ id: null, name: "" })}>
                  Batal
                </button>
              )}
            </div>
          </form>

          {/* List */}
          <div className="history-dashboard__table-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Nama Jenis Muatan</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {cargos.map((c) => (
                  <tr key={c.id}>
                    <td className="font-semibold">{c.name}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn-table-edit"
                          onClick={() => setCargoForm({ id: c.id, name: c.name })}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-table-delete"
                          onClick={() => handleCargoDelete(c.id)}
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION KONFIGURASI DATABASE */}
      {!loading && activeSubTab === "database" && (
        <div style={{ maxWidth: "600px", margin: "0 auto", background: "#f8fafc", padding: "2rem", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
          <h3 style={{ marginBottom: "1.5rem" }}>⚙️ Konfigurasi Database Utama</h3>
          
          <form onSubmit={handleDatabaseSubmit} className="weighing-form">
            <label>
              Engine Database
              <select
                value={dbForm.ENGINE}
                onChange={(e) => setDbForm({ ...dbForm, ENGINE: e.target.value })}
                required
              >
                <option value="django.db.backends.postgresql">PostgreSQL (Recomended)</option>
                <option value="django.db.backends.sqlite3">SQLite (Development)</option>
                <option value="django.db.backends.mysql">MySQL</option>
                <option value="django.db.backends.oracle">Oracle</option>
              </select>
            </label>

            <label>
              Nama Database / Path File (SQLite)
              <input
                type="text"
                value={dbForm.NAME}
                onChange={(e) => setDbForm({ ...dbForm, NAME: e.target.value })}
                placeholder="misal: jembatan_timbang / db.sqlite3"
                required
              />
            </label>

            {dbForm.ENGINE !== "django.db.backends.sqlite3" && (
              <>
                <label>
                  Username Database
                  <input
                    type="text"
                    value={dbForm.USER}
                    onChange={(e) => setDbForm({ ...dbForm, USER: e.target.value })}
                    placeholder="misal: postgres"
                  />
                </label>

                <label>
                  Password Database
                  <div style={{ position: "relative" }}>
                    <input
                      type={showDbPassword ? "text" : "password"}
                      value={dbForm.PASSWORD}
                      onChange={(e) => setDbForm({ ...dbForm, PASSWORD: e.target.value })}
                      placeholder="Masukkan password database"
                      style={{ paddingRight: "45px" }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowDbPassword(!showDbPassword)}
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: "#64748b",
                        padding: 0,
                        fontSize: "1.2rem",
                        cursor: "pointer",
                      }}
                    >
                      {showDbPassword ? "👁️" : "🙈"}
                    </button>
                  </div>
                </label>

                <label>
                  Host Database
                  <input
                    type="text"
                    value={dbForm.HOST}
                    onChange={(e) => setDbForm({ ...dbForm, HOST: e.target.value })}
                    placeholder="misal: localhost / 127.0.0.1"
                  />
                </label>

                <label>
                  Port Database
                  <input
                    type="text"
                    value={dbForm.PORT}
                    onChange={(e) => setDbForm({ ...dbForm, PORT: e.target.value })}
                    placeholder="misal: 5432"
                  />
                </label>
              </>
            )}

            <div style={{ marginTop: "1.5rem" }}>
              <button type="submit" className="btn-primary" style={{ width: "100%", height: "46px" }}>
                💾 Tes Koneksi & Simpan Konfigurasi
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
