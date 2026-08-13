"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { startAutoSync } from "../services/syncService";
import PrintReceipt from "./PrintReceipt";

export default function PageWrapper({ children, requireAdmin = false }) {
  const router = useRouter();
  const pathname = usePathname();
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [printTx, setPrintTx] = useState(null);

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

  const handleLogout = () => {
    localStorage.removeItem("user_token");
    localStorage.removeItem("user_info");
    localStorage.removeItem("active_tab");
    router.push("/login");
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
      <div className="app-container">
        {/* Sidebar Kiri */}
        <aside className="sidebar">
          <div className="sidebar__top">
            <div className="sidebar__brand">
              <span className="sidebar__logo">🚛</span>
              <span className="sidebar__title">Jembatan Timbang</span>
            </div>

            <nav className="sidebar__nav">
              <button
                type="button"
                className={`sidebar__link ${pathname === "/" ? "sidebar__link--active" : ""}`}
                onClick={() => router.push("/")}
              >
                ⚖️ Penimbangan
              </button>
              <button
                type="button"
                className={`sidebar__link ${pathname === "/history" ? "sidebar__link--active" : ""}`}
                onClick={() => router.push("/history")}
              >
                📋 Riwayat & Laporan
              </button>
              {user?.roles?.includes("Admin") && (
                <button
                  type="button"
                  className={`sidebar__link ${pathname === "/admin" ? "sidebar__link--active" : ""}`}
                  onClick={() => router.push("/admin")}
                >
                  ⚙️ Panel Admin
                </button>
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
      <PrintReceipt transaction={printTx} />
    </>
  );
}
