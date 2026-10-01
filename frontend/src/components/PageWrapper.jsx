"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { startAutoSync } from "../services/syncService";
import { API_BASE_URL } from "../config/env";
import { db } from "../db/db";
import PrintReceipt from "./PrintReceipt";
import PrintKwitansi from "./PrintKwitansi";

export default function PageWrapper({ children, requireAdmin = false }) {
  const router = useRouter();
  const pathname = usePathname();
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [printTx, setPrintTx] = useState(null);
  const [printMode, setPrintMode] = useState("ticket"); // 'ticket' | 'kwitansi'
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAdminMenuExpanded, setIsAdminMenuExpanded] = useState(false);
  const [siteProfile, setSiteProfile] = useState(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("user_token");
    let savedUser = null;
    try {
      savedUser = JSON.parse(localStorage.getItem("user_info") || "null");
    } catch {
      savedUser = null;
    }

    if (!savedToken) {
      router.push("/login");
      return;
    }

    if (requireAdmin && !savedUser?.roles?.includes("Admin")) {
      router.push("/");
      return;
    }

    setToken(savedToken);
    setUser(savedUser);
    setLoading(false);
  }, [router, requireAdmin]);

  useEffect(() => {
    if (!token) return;
    const stopSync = startAutoSync();
    return stopSync;
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const loadProfile = async () => {
      try {
        if (typeof window !== "undefined" && db?.site_profile) {
          const cached = await db.site_profile.get(1);
          if (cached) setSiteProfile(cached);
        }
        const res = await fetch(`${API_BASE_URL}/site-profile/`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Token ${token}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          setSiteProfile(data);
          if (typeof window !== "undefined" && db?.site_profile) {
            await db.site_profile.put(data);
          }
        }
      } catch (e) {
        // Silently handle offline/error
      }
    };
    loadProfile();

    const handleProfileUpdate = () => {
      loadProfile();
    };
    window.addEventListener("site_profile_updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("site_profile_updated", handleProfileUpdate);
    };
  }, [token]);

  useEffect(() => {
    window.printTransaction = (tx) => {
      setPrintMode("ticket");
      setPrintTx(tx);
      if (typeof document !== "undefined") {
        document.body.classList.remove("print-mode-kwitansi");
        document.body.classList.add("print-mode-thermal");
      }
      setTimeout(() => {
        window.print();
      }, 100);
    };

    window.printKwitansi = (tx) => {
      setPrintMode("kwitansi");
      setPrintTx(tx);
      if (typeof document !== "undefined") {
        document.body.classList.remove("print-mode-thermal");
        document.body.classList.add("print-mode-kwitansi");
      }
      setTimeout(() => {
        window.print();
      }, 100);
    };

    const handleAfterPrint = () => {
      if (typeof document !== "undefined") {
        document.body.classList.remove("print-mode-thermal", "print-mode-kwitansi");
      }
    };
    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      delete window.printTransaction;
      delete window.printKwitansi;
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user_token");
    localStorage.removeItem("user_info");
    localStorage.removeItem("active_tab");
    router.push("/login");
  };

  const handleAdminSubTabClick = (subtab) => {
    localStorage.setItem("admin_active_subtab", subtab);
    window.dispatchEvent(new Event("admin_subtab_changed"));
    router.push("/admin");
    setIsSidebarOpen(false);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p className="text-muted" style={{ fontSize: "1.1rem", fontWeight: 600 }}>Memuat halaman...</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Header Bar */}
      <header className="mobile-header">
        <button
          type="button"
          className="mobile-header__menu-btn"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Buka Menu"
        >
          ☰
        </button>
        <div className="mobile-header__brand">
          <span style={{ marginRight: "0.4rem" }}>🚛</span>
          <span>Jembatan Timbang</span>
        </div>
        <div className="mobile-header__user-badge">
          {user?.username?.substring(0, 2).toUpperCase() || "OP"}
        </div>
      </header>

      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      <div className="app-container">
        {/* Sidebar Kiri */}
        <aside className={`sidebar ${isSidebarOpen ? "sidebar--open" : ""}`}>
          <div className="sidebar__top">
            <div className="sidebar__brand">
              <span className="sidebar__logo">🚛</span>
              <span className="sidebar__title">Jembatan Timbang</span>
              {/* Close button inside sidebar on mobile */}
              <button
                type="button"
                className="sidebar__close-btn"
                onClick={() => setIsSidebarOpen(false)}
              >
                ✕
              </button>
            </div>

            <nav className="sidebar__nav">
              <button
                type="button"
                className={`sidebar__link ${pathname === "/" ? "sidebar__link--active" : ""}`}
                onClick={() => {
                  router.push("/");
                  setIsSidebarOpen(false);
                }}
              >
                ⚖️ Penimbangan
              </button>
              <button
                type="button"
                className={`sidebar__link ${pathname === "/history" ? "sidebar__link--active" : ""}`}
                onClick={() => {
                  router.push("/history");
                  setIsSidebarOpen(false);
                }}
              >
                📋 Riwayat & Laporan
              </button>
              {user?.roles?.includes("Admin") && (
                <div className="sidebar__submenu-container" style={{ width: "100%" }}>
                  <button
                    type="button"
                    className={`sidebar__link ${pathname === "/admin" ? "sidebar__link--active" : ""}`}
                    onClick={() => {
                      if (typeof window !== "undefined" && window.innerWidth <= 992) {
                        setIsAdminMenuExpanded(!isAdminMenuExpanded);
                      } else {
                        router.push("/admin");
                      }
                    }}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>⚙️ Panel Admin</span>
                    <span className="sidebar__submenu-toggle-icon" style={{
                      fontSize: "0.75rem",
                      transform: isAdminMenuExpanded ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease"
                    }}>▼</span>
                  </button>
                  {isAdminMenuExpanded && (
                    <div className="sidebar__submenu" style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.15rem",
                      marginTop: "0.25rem",
                      paddingLeft: "1.25rem",
                      borderLeft: "2px solid rgba(255, 255, 255, 0.1)"
                    }}>
                      <button type="button" className="sidebar__submenu-link" onClick={() => handleAdminSubTabClick("users")}>👤 Kelola User</button>
                      <button type="button" className="sidebar__submenu-link" onClick={() => handleAdminSubTabClick("warehouses")}>🏭 Kelola Gudang</button>
                      <button type="button" className="sidebar__submenu-link" onClick={() => handleAdminSubTabClick("cargos")}>📦 Kelola Muatan</button>
                      <button type="button" className="sidebar__submenu-link" onClick={() => handleAdminSubTabClick("units")}>🚛 Kelola Unit</button>
                      <button type="button" className="sidebar__submenu-link" onClick={() => handleAdminSubTabClick("customers")}>🤝 Kelola Customer/Supplier</button>
                      <button type="button" className="sidebar__submenu-link" onClick={() => handleAdminSubTabClick("weighing-types")}>⚖️ Jenis Timbangan</button>
                      <button type="button" className="sidebar__submenu-link" onClick={() => handleAdminSubTabClick("scales")}>🔌 Alat Timbangan</button>
                      <button type="button" className="sidebar__submenu-link" onClick={() => handleAdminSubTabClick("profile")}>🏢 Profil Perusahaan</button>
                      <button type="button" className="sidebar__submenu-link" onClick={() => handleAdminSubTabClick("database")}>⚙️ Konfigurasi Database</button>
                    </div>

                  )}
                </div>
              )}
            </nav>
          </div>

          <div className="sidebar__footer">
            <div className="user-profile">
              <div className="user-profile__avatar">
                {user?.username?.substring(0, 2).toUpperCase() || "OP"}
              </div>
              <div className="user-profile__info">
                <span className="user-profile__name">{user?.username}</span>
                <span className="user-profile__role">{user?.roles?.join(", ") || "Operator"}</span>
                {user?.warehouse_name && (
                  <span className="user-profile__warehouse">🏭 {user?.warehouse_name}</span>
                )}
              </div>
            </div>
            <button type="button" onClick={handleLogout} className="btn-sidebar-logout">
              🚪 Keluar
            </button>
          </div>
        </aside>

        {/* Area Konten Utama */}
        <main className="main-content">{children}</main>
      </div>
      {printMode === "ticket" && (
        <PrintReceipt transaction={printTx} siteProfile={siteProfile} />
      )}
      {printMode === "kwitansi" && (
        <PrintKwitansi transaction={printTx} siteProfile={siteProfile} />
      )}
    </>

  );
}
