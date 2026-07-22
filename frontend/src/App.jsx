import { useEffect, useState } from "react";
import Dashboard from "./components/Dashboard";
import HistoryDashboard from "./components/HistoryDashboard";
import Login from "./components/Login";
import PrintReceipt from "./components/PrintReceipt";
import { startAutoSync } from "./services/syncService";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("user_token"));
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user_info") || "null");
    } catch {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("active_tab") || "penimbangan";
  });
  const [printTx, setPrintTx] = useState(null);

  useEffect(() => {
    // Jalankan auto sync hanya jika user sudah login (memiliki token)
    if (!token) return;
    const stopSync = startAutoSync();
    return stopSync;
  }, [token]);

  useEffect(() => {
    window.printTransaction = (tx) => {
      setPrintTx(tx);
      setTimeout(() => {
        window.print();
      }, 100);
    };
    return () => {
      delete window.printTransaction;
    };
  }, []);

  const handleLoginSuccess = (newToken, userData) => {
    setToken(newToken);
    setUser({
      username: userData.username,
      roles: userData.roles,
      user_id: userData.user_id,
      warehouse_id: userData.warehouse_id,
      warehouse_name: userData.warehouse_name,
    });
    setActiveTab("penimbangan");
    localStorage.setItem("active_tab", "penimbangan");
  };

  const handleLogout = () => {
    localStorage.removeItem("user_token");
    localStorage.removeItem("user_info");
    localStorage.removeItem("active_tab");
    setToken(null);
    setUser(null);
  };

  if (!token) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <>
      <div className="app-container">
        {/* Top Navbar */}
        <nav className="navbar">
          <div className="navbar__brand">
            <span className="navbar__logo">🚛</span>
            <span className="navbar__title">Jembatan Timbang</span>
          </div>

          <div className="navbar__tabs">
            <button
              type="button"
              className={`navbar__tab ${activeTab === "penimbangan" ? "navbar__tab--active" : ""}`}
              onClick={() => {
                setActiveTab("penimbangan");
                localStorage.setItem("active_tab", "penimbangan");
              }}
            >
              Penimbangan
            </button>
            <button
              type="button"
              className={`navbar__tab ${activeTab === "riwayat" ? "navbar__tab--active" : ""}`}
              onClick={() => {
                setActiveTab("riwayat");
                localStorage.setItem("active_tab", "riwayat");
              }}
            >
              Riwayat Harian
            </button>
          </div>

          <div className="navbar__user">
            <span className="navbar__user-info">
              Halo, <strong>{user?.username}</strong> ({user?.roles?.join(", ") || "Operator"})
            </span>
            <button type="button" onClick={handleLogout} className="btn-logout">
              Keluar
            </button>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="main-content">
          {activeTab === "penimbangan" ? (
            <Dashboard userRole={user?.roles} operatorUsername={user?.username} userWarehouse={{ id: user?.warehouse_id, name: user?.warehouse_name }} />
          ) : (
            <HistoryDashboard userRole={user?.roles} userWarehouse={{ id: user?.warehouse_id, name: user?.warehouse_name }} />
          )}
        </main>
      </div>
      <PrintReceipt transaction={printTx} />
    </>
  );
}