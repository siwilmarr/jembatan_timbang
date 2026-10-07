"use client";

import { useEffect } from "react";

const SERIAL_CONNECTION_EVENT = "serial-connection-state";

export default function ClientRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let registration = null;
    let serialConnected = false;
    let reloadPending = false;
    let reloading = false;
    let updatePromise = null;

    const reloadWhenSafe = () => {
      if (serialConnected) {
        reloadPending = true;
        return;
      }
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    const checkForUpdates = () => {
      if (!registration || !navigator.onLine || updatePromise) return;
      updatePromise = registration.update()
        .catch((err) => console.warn("Service Worker update check failed:", err))
        .finally(() => { updatePromise = null; });
    };

    const handleSerialConnection = (event) => {
      serialConnected = Boolean(event.detail?.connected);
      checkForUpdates();

      if (!serialConnected) {
        if (registration?.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        if (reloadPending) reloadWhenSafe();
      }
    };

    const handleControllerChange = () => reloadWhenSafe();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") checkForUpdates();
    };

    window.addEventListener(SERIAL_CONNECTION_EVENT, handleSerialConnection);
    window.addEventListener("online", checkForUpdates);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        registration = reg;
        console.log("Service Worker registered successfully:", reg.scope);

        if (reg.waiting && !serialConnected) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              if (!serialConnected) {
                newWorker.postMessage({ type: "SKIP_WAITING" });
              }
            }
          });
        });

        checkForUpdates();
      })
      .catch((err) => console.error("Service Worker registration failed:", err));

    return () => {
      window.removeEventListener(SERIAL_CONNECTION_EVENT, handleSerialConnection);
      window.removeEventListener("online", checkForUpdates);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  return null;
}
