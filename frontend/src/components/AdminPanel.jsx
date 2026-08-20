"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config/env";

export default function AdminPanel() {
  const [activeSubTab, setActiveSubTab] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("admin_active_subtab") || "users";
    }
    return "users";
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const val = localStorage.getItem("admin_active_subtab");
      if (val && val !== activeSubTab) {
        setActiveSubTab(val);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("admin_subtab_changed", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("admin_subtab_changed", handleStorageChange);
    };
  }, [activeSubTab]);

  useEffect(() => {
    localStorage.setItem("admin_active_subtab", activeSubTab);
  }, [activeSubTab]);
  const [users, setUsers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [units, setUnits] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [weighingTypes, setWeighingTypes] = useState([]);
  const [scales, setScales] = useState([]);

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

  // Toast notification state
  const [toast, setToast] = useState(null); // { message, type: 'info' | 'warning' | 'error' | 'success' }

  const showToast = (message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

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

  const [unitForm, setUnitForm] = useState({ id: null, name: "", description: "" });
  const [customerForm, setCustomerForm] = useState({ id: null, name: "", type: "customer", contact: "", address: "" });
  const [weighingTypeForm, setWeighingTypeForm] = useState({
    id: null, name: "", description: "",
    deduction_percent: 0, require_driver: true, require_destination: true,
    require_cargo: true, require_customer: false, require_unit: false,
    max_weight_kg: 0, is_active: true,
  });

  const [scaleForm, setScaleForm] = useState({
    id: null, name: "", indicator_type: "CAS", baud_rate: 9600,
    data_bits: 8, stop_bits: 1, parity: "none", description: "", is_active: true
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
      } else if (activeSubTab === "units") {
        const res = await fetch(`${API_BASE}/units/`, { headers });
        if (res.ok) setUnits(await res.json());
      } else if (activeSubTab === "customers") {
        const res = await fetch(`${API_BASE}/customers/`, { headers });
        if (res.ok) setCustomers(await res.json());
      } else if (activeSubTab === "weighing-types") {
        const res = await fetch(`${API_BASE}/weighing-types/`, { headers });
        if (res.ok) setWeighingTypes(await res.json());
      } else if (activeSubTab === "scales") {
        const res = await fetch(`${API_BASE}/scales/`, { headers });
        if (res.ok) setScales(await res.json());
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

  // Handle CRUD untuk Unit
  const handleUnitSubmit = async (e) => {
    e.preventDefault(); setError(""); setSuccess("");
    try {
      const isEdit = !!unitForm.id;
      const url = isEdit ? `${API_BASE}/units/${unitForm.id}/` : `${API_BASE}/units/`;
      const res = await fetch(url, { method: isEdit ? "PUT" : "POST", headers, body: JSON.stringify({ name: unitForm.name, description: unitForm.description }) });
      if (!res.ok) throw new Error("Gagal menyimpan unit.");
      setSuccess(isEdit ? "Unit diperbarui." : "Unit ditambahkan.");
      setUnitForm({ id: null, name: "", description: "" });
      fetchData();
    } catch (err) { setError(err.message); }
  };

  const handleUnitDelete = async (id) => {
    if (!confirm("Hapus unit ini?")) return;
    setError(""); setSuccess("");
    try {
      await fetch(`${API_BASE}/units/${id}/`, { method: "DELETE", headers });
      setSuccess("Unit dihapus."); fetchData();
    } catch (err) { setError(err.message); }
  };

  // Handle CRUD untuk Customer/Supplier
  const handleCustomerSubmit = async (e) => {
    e.preventDefault(); setError(""); setSuccess("");
    try {
      const isEdit = !!customerForm.id;
      const url = isEdit ? `${API_BASE}/customers/${customerForm.id}/` : `${API_BASE}/customers/`;
      const res = await fetch(url, { method: isEdit ? "PUT" : "POST", headers, body: JSON.stringify(customerForm) });
      if (!res.ok) throw new Error("Gagal menyimpan customer/supplier.");
      setSuccess(isEdit ? "Customer/Supplier diperbarui." : "Customer/Supplier ditambahkan.");
      setCustomerForm({ id: null, name: "", type: "customer", contact: "", address: "" });
      fetchData();
    } catch (err) { setError(err.message); }
  };

  const handleCustomerDelete = async (id) => {
    if (!confirm("Hapus customer/supplier ini?")) return;
    setError(""); setSuccess("");
    try {
      await fetch(`${API_BASE}/customers/${id}/`, { method: "DELETE", headers });
      setSuccess("Customer/Supplier dihapus."); fetchData();
    } catch (err) { setError(err.message); }
  };

  // Handle CRUD untuk Jenis Timbangan
  const handleWeighingTypeSubmit = async (e) => {
    e.preventDefault(); setError(""); setSuccess("");
    try {
      const isEdit = !!weighingTypeForm.id;
      const url = isEdit ? `${API_BASE}/weighing-types/${weighingTypeForm.id}/` : `${API_BASE}/weighing-types/`;
      const payload = { ...weighingTypeForm };
      delete payload.id;
      const res = await fetch(url, { method: isEdit ? "PUT" : "POST", headers, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Gagal menyimpan jenis timbangan.");
      setSuccess(isEdit ? "Jenis Timbangan diperbarui." : "Jenis Timbangan ditambahkan.");
      setWeighingTypeForm({ id: null, name: "", description: "", deduction_percent: 0, require_driver: true, require_destination: true, require_cargo: true, require_customer: false, require_unit: false, max_weight_kg: 0, is_active: true });
      fetchData();
    } catch (err) { setError(err.message); }
  };

  const handleWeighingTypeDelete = async (id) => {
    if (!confirm("Hapus jenis timbangan ini?")) return;
    setError(""); setSuccess("");
    try {
      await fetch(`${API_BASE}/weighing-types/${id}/`, { method: "DELETE", headers });
      setSuccess("Jenis Timbangan dihapus."); fetchData();
    } catch (err) { setError(err.message); }
  };

  // Handle CRUD untuk Alat Timbangan
  const handleScaleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const isEdit = !!scaleForm.id;
      const url = isEdit ? `${API_BASE}/scales/${scaleForm.id}/` : `${API_BASE}/scales/`;
      const payload = { ...scaleForm };
      delete payload.id;

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers,
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Gagal menyimpan data alat timbangan.");

      showToast(isEdit ? "Alat Timbangan diperbarui." : "Alat Timbangan ditambahkan.", "success");
      setSuccess(isEdit ? "Alat Timbangan diperbarui." : "Alat Timbangan ditambahkan.");
      setScaleForm({
        id: null, name: "", indicator_type: "CAS", baud_rate: 9600,
        data_bits: 8, stop_bits: 1, parity: "none", description: "", is_active: true
      });
      fetchData();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  };

  const handleScaleDelete = async (id) => {
    if (!confirm("Hapus alat timbangan ini?")) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`${API_BASE}/scales/${id}/`, { method: "DELETE", headers });
      if (!res.ok) throw new Error("Gagal menghapus alat timbangan.");
      showToast("Alat Timbangan berhasil dihapus.", "success");
      setSuccess("Alat Timbangan dihapus.");
      fetchData();
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
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
          className={`navbar__tab ${activeSubTab === "units" ? "navbar__tab--active" : ""}`}
          onClick={() => setActiveSubTab("units")}
        >
          🚛 Kelola Unit
        </button>
        <button
          type="button"
          className={`navbar__tab ${activeSubTab === "customers" ? "navbar__tab--active" : ""}`}
          onClick={() => setActiveSubTab("customers")}
        >
          🤝 Kelola Customer/Supplier
        </button>
        <button
          type="button"
          className={`navbar__tab ${activeSubTab === "weighing-types" ? "navbar__tab--active" : ""}`}
          onClick={() => setActiveSubTab("weighing-types")}
        >
          ⚖️ Jenis Timbangan
        </button>
        <button
          type="button"
          className={`navbar__tab ${activeSubTab === "scales" ? "navbar__tab--active" : ""}`}
          onClick={() => setActiveSubTab("scales")}
        >
          🔌 Alat Timbangan
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

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div style={{
          position: "fixed",
          top: "1.5rem",
          right: "1.5rem",
          zIndex: 9999,
          minWidth: "320px",
          maxWidth: "460px",
          background: toast.type === "error" ? "#fef2f2" : toast.type === "warning" ? "#fff7ed" : toast.type === "success" ? "#f0fdf4" : "#eff6ff",
          border: `1.5px solid ${toast.type === "error" ? "#fca5a5" : toast.type === "warning" ? "#fdba74" : toast.type === "success" ? "#86efac" : "#93c5fd"}`,
          borderRadius: "12px",
          padding: "1rem 1.2rem",
          boxShadow: "0 8px 32px rgba(37,99,235,0.13)",
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
          animation: "slideInRight 0.3s ease",
        }}>
          <span style={{ fontSize: "1.3rem", lineHeight: 1 }}>
            {toast.type === "error" ? "❌" : toast.type === "warning" ? "⚠️" : toast.type === "success" ? "✅" : "ℹ️"}
          </span>
          <div style={{ flex: 1 }}>
            <p style={{
              margin: 0,
              fontWeight: 600,
              fontSize: "0.9rem",
              color: toast.type === "error" ? "#991b1b" : toast.type === "warning" ? "#9a3412" : toast.type === "success" ? "#166534" : "#1e40af",
            }}>
              {toast.type === "error" ? "Terjadi Kesalahan" : toast.type === "warning" ? "Validasi Gagal" : toast.type === "success" ? "Berhasil" : "Informasi"}
            </p>
            <p style={{ margin: "0.2rem 0 0 0", fontSize: "0.85rem", color: "#475569", lineHeight: 1.4 }}>{toast.message}</p>
          </div>
          <button onClick={() => setToast(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "1rem", padding: 0, lineHeight: 1 }}>✕</button>
        </div>
      )}

      {/* SECTION UNIT */}
      {!loading && activeSubTab === "units" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "2rem" }}>
          {/* Form */}
          <form onSubmit={handleUnitSubmit} className="weighing-form" style={{ background: "#f8fafc", padding: "1.5rem", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <h3>{unitForm.id ? "✏️ Edit Unit" : "➕ Tambah Unit Kendaraan"}</h3>
            <label>
              Nama Unit
              <input value={unitForm.name} onChange={e => setUnitForm({ ...unitForm, name: e.target.value })} required placeholder="misal: Fuso, Tronton" />
            </label>
            <label>
              Keterangan <span style={{ fontSize: "0.8rem", color: "#64748b" }}>(opsional)</span>
              <input value={unitForm.description} onChange={e => setUnitForm({ ...unitForm, description: e.target.value })} placeholder="Deskripsi singkat" />
            </label>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>Simpan</button>
              {unitForm.id && (
                <button type="button" className="btn-secondary" onClick={() => setUnitForm({ id: null, name: "", description: "" })}>Batal</button>
              )}
            </div>
          </form>

          {/* Table */}
          <div className="history-dashboard__table-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Nama Unit</th>
                  <th>Keterangan</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {units.length === 0 ? (
                  <tr><td colSpan={3} className="text-center text-muted" style={{ padding: "2rem" }}>Belum ada data unit. Tambahkan unit kendaraan baru di form sebelah.</td></tr>
                ) : (
                  units.map(u => (
                    <tr key={u.id}>
                      <td className="font-semibold">{u.name}</td>
                      <td><span className="text-muted">{u.description || "-"}</span></td>
                      <td>
                        <div className="table-actions">
                          <button type="button" className="btn-table-edit" onClick={() => setUnitForm({ id: u.id, name: u.name, description: u.description || "" })}>Edit</button>
                          <button type="button" className="btn-table-delete" onClick={() => handleUnitDelete(u.id)}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION CUSTOMER/SUPPLIER */}
      {!loading && activeSubTab === "customers" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "2rem" }}>
          {/* Form */}
          <form onSubmit={handleCustomerSubmit} className="weighing-form" style={{ background: "#f8fafc", padding: "1.5rem", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <h3>{customerForm.id ? "✏️ Edit Customer/Supplier" : "➕ Tambah Customer/Supplier"}</h3>
            <label>
              Nama
              <input value={customerForm.name} onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })} required placeholder="Nama perusahaan/perorangan" />
            </label>
            <label>
              Tipe
              <select value={customerForm.type} onChange={e => setCustomerForm({ ...customerForm, type: e.target.value })}>
                <option value="customer">Customer</option>
                <option value="supplier">Supplier</option>
                <option value="both">Customer &amp; Supplier</option>
              </select>
            </label>
            <label>
              Kontak
              <input value={customerForm.contact} onChange={e => setCustomerForm({ ...customerForm, contact: e.target.value })} placeholder="No. telp / email" />
            </label>
            <label>
              Alamat
              <input value={customerForm.address} onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })} placeholder="Alamat lengkap" />
            </label>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>Simpan</button>
              {customerForm.id && (
                <button type="button" className="btn-secondary" onClick={() => setCustomerForm({ id: null, name: "", type: "customer", contact: "", address: "" })}>Batal</button>
              )}
            </div>
          </form>

          {/* Table */}
          <div className="history-dashboard__table-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Tipe</th>
                  <th>Kontak</th>
                  <th>Alamat</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-muted" style={{ padding: "2rem" }}>Belum ada data. Tambahkan customer/supplier baru di form sebelah.</td></tr>
                ) : (
                  customers.map(c => (
                    <tr key={c.id}>
                      <td className="font-semibold">{c.name}</td>
                      <td>
                        <span className={`badge-type badge-type--${c.type === "customer" ? "tare" : c.type === "supplier" ? "gross" : "tare"}`} style={{
                          background: c.type === "customer" ? "#dbeafe" : c.type === "supplier" ? "#dcfce7" : "#fef9c3",
                          color: c.type === "customer" ? "#1e40af" : c.type === "supplier" ? "#166534" : "#854d0e",
                        }}>
                          {c.type === "customer" ? "Customer" : c.type === "supplier" ? "Supplier" : "Keduanya"}
                        </span>
                      </td>
                      <td><span className="text-muted">{c.contact || "-"}</span></td>
                      <td><span className="text-muted">{c.address || "-"}</span></td>
                      <td>
                        <div className="table-actions">
                          <button type="button" className="btn-table-edit" onClick={() => setCustomerForm({ id: c.id, name: c.name, type: c.type, contact: c.contact || "", address: c.address || "" })}>Edit</button>
                          <button type="button" className="btn-table-delete" onClick={() => handleCustomerDelete(c.id)}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION JENIS TIMBANGAN */}
      {!loading && activeSubTab === "weighing-types" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "2rem" }}>
          {/* Form */}
          <form onSubmit={handleWeighingTypeSubmit} className="weighing-form" style={{ background: "#f8fafc", padding: "1.5rem", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <h3>{weighingTypeForm.id ? "✏️ Edit Jenis Timbangan" : "➕ Tambah Jenis Timbangan"}</h3>
            <label>
              Nama Jenis Timbangan
              <input value={weighingTypeForm.name} onChange={e => setWeighingTypeForm({ ...weighingTypeForm, name: e.target.value })} required placeholder="misal: Kelapa Sawit, Pupuk" />
            </label>
            <label>
              Deskripsi <span style={{ fontSize: "0.8rem", color: "#64748b" }}>(opsional)</span>
              <input value={weighingTypeForm.description} onChange={e => setWeighingTypeForm({ ...weighingTypeForm, description: e.target.value })} placeholder="Keterangan singkat" />
            </label>
            <label>
              Potongan Berat Otomatis (%)
              <input type="number" min="0" max="100" step="0.01" value={weighingTypeForm.deduction_percent} onChange={e => setWeighingTypeForm({ ...weighingTypeForm, deduction_percent: e.target.value })} placeholder="0 = tidak ada potongan" />
              <small style={{ color: "#64748b", fontSize: "0.78rem" }}>Netto Final = Selisih Gross-Tare × (1 - %/100)</small>
            </label>
            <label>
              Batas Berat Maks (kg)
              <input type="number" min="0" step="1" value={weighingTypeForm.max_weight_kg} onChange={e => setWeighingTypeForm({ ...weighingTypeForm, max_weight_kg: e.target.value })} placeholder="0 = tidak dibatasi" />
            </label>

            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "1rem", marginTop: "0.5rem" }}>
              <p style={{ fontWeight: 600, marginBottom: "0.6rem", fontSize: "0.88rem", color: "#1e40af" }}>🔒 Field Wajib Diisi Operator</p>
              {[
                ["require_driver", "Nama Driver"],
                ["require_destination", "Tujuan"],
                ["require_cargo", "Jenis Muatan"],
                ["require_customer", "Customer/Supplier"],
                ["require_unit", "Jenis Unit Kendaraan"],
              ].map(([key, label]) => (
                <label key={key} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "0.5rem", fontWeight: 400, marginBottom: "0.35rem", fontSize: "0.88rem" }}>
                  <input type="checkbox" checked={weighingTypeForm[key]} onChange={e => setWeighingTypeForm({ ...weighingTypeForm, [key]: e.target.checked })} style={{ width: "auto", accentColor: "#2563eb" }} />
                  {label}
                </label>
              ))}
            </div>

            <label style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "0.5rem", fontWeight: 400, marginTop: "0.75rem", fontSize: "0.88rem" }}>
              <input type="checkbox" checked={weighingTypeForm.is_active} onChange={e => setWeighingTypeForm({ ...weighingTypeForm, is_active: e.target.checked })} style={{ width: "auto", accentColor: "#2563eb" }} />
              <span>Aktif <span style={{ color: "#64748b", fontWeight: 400 }}>(tampil di form timbang operator)</span></span>
            </label>

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>💾 Simpan</button>
              {weighingTypeForm.id && (
                <button type="button" className="btn-secondary" onClick={() => setWeighingTypeForm({ id: null, name: "", description: "", deduction_percent: 0, require_driver: true, require_destination: true, require_cargo: true, require_customer: false, require_unit: false, max_weight_kg: 0, is_active: true })}>Batal</button>
              )}
            </div>
          </form>

          {/* Table */}
          <div className="history-dashboard__table-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Nama Jenis Timbangan</th>
                  <th>Potongan</th>
                  <th>Maks (kg)</th>
                  <th>Field Wajib</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {weighingTypes.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-muted" style={{ padding: "2rem" }}>Belum ada jenis timbangan. Tambahkan di form sebelah.</td></tr>
                ) : (
                  weighingTypes.map(wt => (
                    <tr key={wt.id}>
                      <td>
                        <span className="font-semibold">{wt.name}</span>
                        {wt.description && <div className="text-muted" style={{ fontSize: "0.78rem", marginTop: "2px" }}>{wt.description}</div>}
                      </td>
                      <td>
                        {Number(wt.deduction_percent) > 0
                          ? <span style={{ background: "#fff7ed", color: "#b45309", padding: "2px 8px", borderRadius: "99px", fontSize: "0.78rem", fontWeight: 700 }}>{wt.deduction_percent}%</span>
                          : <span className="text-muted">-</span>}
                      </td>
                      <td className="text-muted">
                        {Number(wt.max_weight_kg) > 0 ? `${Number(wt.max_weight_kg).toLocaleString("id-ID")} kg` : "-"}
                      </td>
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
                          {wt.require_driver && <span style={{ background: "#eff6ff", color: "#1d4ed8", padding: "1px 6px", borderRadius: "99px", fontSize: "0.72rem", fontWeight: 600 }}>Driver</span>}
                          {wt.require_destination && <span style={{ background: "#eff6ff", color: "#1d4ed8", padding: "1px 6px", borderRadius: "99px", fontSize: "0.72rem", fontWeight: 600 }}>Tujuan</span>}
                          {wt.require_cargo && <span style={{ background: "#eff6ff", color: "#1d4ed8", padding: "1px 6px", borderRadius: "99px", fontSize: "0.72rem", fontWeight: 600 }}>Muatan</span>}
                          {wt.require_customer && <span style={{ background: "#eff6ff", color: "#1d4ed8", padding: "1px 6px", borderRadius: "99px", fontSize: "0.72rem", fontWeight: 600 }}>Customer</span>}
                          {wt.require_unit && <span style={{ background: "#eff6ff", color: "#1d4ed8", padding: "1px 6px", borderRadius: "99px", fontSize: "0.72rem", fontWeight: 600 }}>Unit</span>}
                          {!wt.require_driver && !wt.require_destination && !wt.require_cargo && !wt.require_customer && !wt.require_unit && <span className="text-muted">-</span>}
                        </div>
                      </td>
                      <td>
                        <span style={{
                          background: wt.is_active ? "#dcfce7" : "#f1f5f9",
                          color: wt.is_active ? "#166534" : "#64748b",
                          padding: "2px 10px", borderRadius: "99px", fontSize: "0.78rem", fontWeight: 700
                        }}>
                          {wt.is_active ? "✓ Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button type="button" className="btn-table-edit" onClick={() => setWeighingTypeForm({ id: wt.id, name: wt.name, description: wt.description || "", deduction_percent: wt.deduction_percent, require_driver: wt.require_driver, require_destination: wt.require_destination, require_cargo: wt.require_cargo, require_customer: wt.require_customer, require_unit: wt.require_unit, max_weight_kg: wt.max_weight_kg, is_active: wt.is_active })}>Edit</button>
                          <button type="button" className="btn-table-delete" onClick={() => handleWeighingTypeDelete(wt.id)}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION ALAT TIMBANGAN */}
      {!loading && activeSubTab === "scales" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "2rem" }}>
          {/* Form */}
          <form onSubmit={handleScaleSubmit} className="weighing-form" style={{ background: "#f8fafc", padding: "1.5rem", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <h3>{scaleForm.id ? "✏️ Edit Alat Timbangan" : "➕ Tambah Alat Timbangan"}</h3>
            <label>
              Nama Alat Timbangan
              <input value={scaleForm.name} onChange={e => setScaleForm({ ...scaleForm, name: e.target.value })} required placeholder="misal: Jembatan Timbang 01" />
            </label>
            <label>
              Tipe Indikator (Protokol Serial)
              <select value={scaleForm.indicator_type} onChange={e => setScaleForm({ ...scaleForm, indicator_type: e.target.value })}>
                <option value="CAS">CAS (Format Detail)</option>
                <option value="GSC">GSC (Format Sederhana)</option>
              </select>
            </label>
            <label>
              Baud Rate
              <select value={scaleForm.baud_rate} onChange={e => setScaleForm({ ...scaleForm, baud_rate: Number(e.target.value) })}>
                {[1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200].map(rate => (
                  <option key={rate} value={rate}>{rate}</option>
                ))}
              </select>
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <label>
                Data Bits
                <select value={scaleForm.data_bits} onChange={e => setScaleForm({ ...scaleForm, data_bits: Number(e.target.value) })}>
                  <option value={7}>7</option>
                  <option value={8}>8</option>
                </select>
              </label>
              <label>
                Stop Bits
                <select value={scaleForm.stop_bits} onChange={e => setScaleForm({ ...scaleForm, stop_bits: Number(e.target.value) })}>
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                </select>
              </label>
            </div>
            <label>
              Parity
              <select value={scaleForm.parity} onChange={e => setScaleForm({ ...scaleForm, parity: e.target.value })}>
                <option value="none">None</option>
                <option value="even">Even</option>
                <option value="odd">Odd</option>
              </select>
            </label>
            <label>
              Keterangan <span style={{ fontSize: "0.8rem", color: "#64748b" }}>(opsional)</span>
              <input value={scaleForm.description} onChange={e => setScaleForm({ ...scaleForm, description: e.target.value })} placeholder="Keterangan singkat" />
            </label>
            <label style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "0.5rem", fontWeight: 400, marginTop: "0.5rem", fontSize: "0.88rem" }}>
              <input type="checkbox" checked={scaleForm.is_active} onChange={e => setScaleForm({ ...scaleForm, is_active: e.target.checked })} style={{ width: "auto", accentColor: "#2563eb" }} />
              <span>Aktif <span style={{ color: "#64748b", fontWeight: 400 }}>(bisa digunakan operator)</span></span>
            </label>

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>💾 Simpan</button>
              {scaleForm.id && (
                <button type="button" className="btn-secondary" onClick={() => setScaleForm({ id: null, name: "", indicator_type: "CAS", baud_rate: 9600, data_bits: 8, stop_bits: 1, parity: "none", description: "", is_active: true })}>Batal</button>
              )}
            </div>
          </form>

          {/* Table */}
          <div className="history-dashboard__table-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Nama Alat Timbangan</th>
                  <th>Protokol</th>
                  <th>Spesifikasi Serial</th>
                  <th>Keterangan</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {scales.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-muted" style={{ padding: "2rem" }}>Belum ada alat timbangan. Daftarkan di form sebelah.</td></tr>
                ) : (
                  scales.map(sc => (
                    <tr key={sc.id}>
                      <td className="font-semibold">{sc.name}</td>
                      <td>
                        <span className={`badge-type badge-type--${sc.indicator_type === "CAS" ? "gross" : "tare"}`} style={{
                          background: sc.indicator_type === "CAS" ? "#eff6ff" : "#fef3c7",
                          color: sc.indicator_type === "CAS" ? "#1e40af" : "#d97706"
                        }}>
                          {sc.indicator_type === "CAS" ? "CAS (Detail)" : "GSC (Sederhana)"}
                        </span>
                      </td>
                      <td>
                        <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", fontSize: "0.82rem" }}>
                          {sc.baud_rate} baud, {sc.data_bits}N{sc.stop_bits}, parity={sc.parity}
                        </code>
                      </td>
                      <td><span className="text-muted" style={{ fontSize: "0.85rem" }}>{sc.description || "-"}</span></td>
                      <td>
                        <span style={{
                          background: sc.is_active ? "#dcfce7" : "#f1f5f9",
                          color: sc.is_active ? "#166534" : "#64748b",
                          padding: "2px 10px", borderRadius: "99px", fontSize: "0.78rem", fontWeight: 700
                        }}>
                          {sc.is_active ? "✓ Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button type="button" className="btn-table-edit" onClick={() => setScaleForm({ id: sc.id, name: sc.name, indicator_type: sc.indicator_type, baud_rate: sc.baud_rate, data_bits: sc.data_bits, stop_bits: sc.stop_bits, parity: sc.parity, description: sc.description || "", is_active: sc.is_active })}>Edit</button>
                          <button type="button" className="btn-table-delete" onClick={() => handleScaleDelete(sc.id)}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
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
