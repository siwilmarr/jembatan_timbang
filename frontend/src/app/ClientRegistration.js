"use client";

import { useEffect } from "react";

// Definisikan versi Service Worker untuk memaksa upgrade jika tersangkut di browser
const SW_VERSION = "5";

export default function ClientRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // FORCE MIGRATION: Jika Service Worker versi lama tersangkut di multi-tab browser,
    // bersihkan registrasi SW lama dan cache secara otomatis lalu muat ulang halaman.
    const currentVersion = localStorage.getItem("sw_version");
    if (currentVersion !== SW_VERSION) {
      console.log("Detecting old service worker version. Performing clean reset...");
      
      // Hapus registrasi Service Worker
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (let registration of registrations) {
            registration.unregister();
            console.log("Unregistered stuck service worker.");
          }
        });
      }
      
      // Hapus seluruh cache storage browser
      if ("caches" in window) {
        caches.keys().then((names) => {
          for (let name of names) {
            caches.delete(name);
            console.log("Cleared cache storage:", name);
          }
        });
      }

      // Catat versi baru dan muat ulang halaman agar bersih
      localStorage.setItem("sw_version", SW_VERSION);
      setTimeout(() => {
        window.location.reload();
      }, 500);
      return;
    }

    // Registrasi Service Worker baru yang aman dan teruji
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("Service Worker registered successfully:", reg.scope);

          // Jika ada SW baru yang menunggu, paksa langsung aktif
          if (reg.waiting) {
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          }

          // Deteksi ketika ada update SW baru di-download
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;

            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // SW baru sudah terinstall tapi yang lama masih aktif — paksa ganti
                newWorker.postMessage({ type: "SKIP_WAITING" });
              }
            });
          });
        })
        .catch((err) => console.error("Service Worker registration failed:", err));

      // Ketika SW baru mengambil alih kontrol, reload halaman sekali agar CSS terbaru termuat
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, []);

  return null;
}
