"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CasSimulator from "../simulator/CasSimulator";

import { APP_MODE } from "../config/env";
const MAX_DEBUG_ENTRIES = 50;
const SERIAL_CONNECTION_EVENT = "serial-connection-state";

function notifySerialConnectionState(connected) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SERIAL_CONNECTION_EVENT, { detail: { connected } }));
}

/**
 * Hook untuk membaca data berat dari indikator timbangan via Web Serial API
 * (RS232/USB). Mendukung konfigurasi baud rate, data bits, parity agar
 * cocok dengan berbagai merk timbangan (Avery, CAS, GSC, dll).
 *
 * Catatan: Web Serial API hanya berjalan di Chrome/Edge, harus HTTPS
 * (atau localhost), dan wajib dipicu oleh interaksi user (klik tombol).
 */
export function useSerial() {
  const [isConnected, setIsConnected] = useState(false);
  const [weight, setWeight] = useState(0);
  const [isStable, setIsStable] = useState(false);
  const [error, setError] = useState(null);

  const [debugLog, setDebugLog] = useState([]);

  const pushDebugLog = useCallback((type, text) => {
    setDebugLog((prev) => {
      const entry = { time: new Date().toLocaleTimeString("id-ID"), type, text };
      const next = [...prev, entry];
      return next.length > MAX_DEBUG_ENTRIES ? next.slice(-MAX_DEBUG_ENTRIES) : next;
    });
  }, []);

  const clearDebugLog = useCallback(() => setDebugLog([]), []);

  const portRef = useRef(null);
  const readerRef = useRef(null);
  const simulatorRef = useRef(null);
  const bufferRef = useRef("");
  const stableTimerRef = useRef(null);
  const lastWeightRef = useRef(null);
  const simulateTimerRef = useRef(null);
  const indicatorTypeRef = useRef("CAS"); // default CAS
  const isConnectingRef = useRef(false);

  // FORMAT 1 -- "detail" sesuai dokumentasi CAS/GSC tertulis:
  //   ST,GS,+001234kg   atau   ST,NT,+025430kg\r\n
  // Dicoba lebih dulu, kalau-kalau ada unit/firmware yang memang kirim
  // format lengkap ini dengan status stabil & mode eksplisit.
  const DETAILED_REGEX =
    /(ST|US|OL)\D{0,3}(GS|NT|TR|OL|G|N|T)\D{0,3}([+-]?\s*\d+\.?\d*)\s*(kg|lb|t)?/i;

  // FORMAT 2 -- "sederhana", TERBUKTI cocok dengan data mentah asli yang
  // terekam dari alat GSC SGW-3015PS fisik Anda lewat panel debug:
  //   \x02   00 kg \r\n   (STX, spasi, angka, spasi, "kg", CRLF)
  // Tidak ada kode status stabil / mode di format ini -- karena itu status
  // stabil dihitung otomatis oleh aplikasi sendiri (timer 2 detik yang
  // sudah ada di updateWeight(), lihat parameter stable=null di bawah).
  const SIMPLE_REGEX = /\x02?\s*([+-]?\d+\.?\d*)\s*(kg|lb|t)?/i;

  const rawWeightRef = useRef(0);
  const zeroOffsetRef = useRef(0);
  const [tareWeight, setTareWeight] = useState(0);

  const connectSimulated = useCallback(() => {
    setError(null);
    pushDebugLog("info", "Mode Simulasi diaktifkan (data dari CasSimulator, bukan alat asli).");

    simulatorRef.current?.stop();

    setIsConnected(true);
    setIsStable(false);

    zeroOffsetRef.current = 0;
    setWeight(0);
    setTareWeight(0);

    simulatorRef.current = new CasSimulator((frame) => {
      pushDebugLog("raw", `(simulator) ${JSON.stringify(frame)}`);
      parseFrame(frame);
    });

    simulatorRef.current.start();
  }, [pushDebugLog]);

  const connect = useCallback(async (options = {}, forceChoose = false) => {
    const { baudRate = 9600, dataBits = 8, stopBits = 1, parity = "none", indicator_type = "CAS" } = options;
    indicatorTypeRef.current = indicator_type;

    if (APP_MODE === "demo") {
      connectSimulated();
      return;
    }
    if (!("serial" in navigator)) {
      setError("Browser tidak mendukung Web Serial API. Gunakan Chrome/Edge.");
      return;
    }

    if (isConnectingRef.current) {
      return;
    }

    if (portRef.current) {
      const alreadyOpen = !!portRef.current.readable || !!portRef.current.writable;
      if (alreadyOpen) {
        setIsConnected(true);
        setError(null);
        notifySerialConnectionState(true);
        return;
      }

      setError("Sudah terhubung ke timbangan. Putuskan koneksi terlebih dahulu.");
      return;
    }

    isConnectingRef.current = true;

    try {
      let port = null;

      if (!forceChoose) {
        const approvedPorts = await navigator.serial.getPorts();
        if (approvedPorts && approvedPorts.length > 0) {
          port = approvedPorts[0];
          const alreadyOpen = !!port.readable || !!port.writable;

          if (alreadyOpen) {
            portRef.current = port;
            setIsConnected(true);
            setError(null);
            notifySerialConnectionState(true);
            pushDebugLog("info", "Port serial sudah aktif. Menggunakan koneksi yang ada.");
            readLoop(port);
            return;
          }

          pushDebugLog("info", "Menemukan port serial yang sudah pernah diotorisasi. Menghubungkan secara otomatis...");
        }
      }

      if (!port) {
        pushDebugLog(
          "info",
          `Membuka dialog pilih port... (target setting: ${baudRate} baud, ${dataBits}N${stopBits}, parity=${parity})`
        );
        port = await navigator.serial.requestPort();
      }

      const info = port.getInfo?.() || {};
      pushDebugLog(
        "info",
        `Port dipilih (usbVendorId=${info.usbVendorId ?? "?"}, usbProductId=${info.usbProductId ?? "?"}). Membuka koneksi...`
      );
      await port.open({ baudRate, dataBits, stopBits, parity });
      portRef.current = port;
      setIsConnected(true);
      setError(null);
      notifySerialConnectionState(true);
      zeroOffsetRef.current = 0;
      setTareWeight(0);
      pushDebugLog("info", "Port terbuka. Menunggu data masuk dari alat...");
      readLoop(port);
    } catch (err) {
      pushDebugLog("error", `Gagal membuka port: ${err.message}`);
      setError(err.message);
      if (portRef.current) {
        portRef.current = null;
      }
    } finally {
      isConnectingRef.current = false;
    }
  }, [connectSimulated, pushDebugLog]);

  const testConnection = useCallback(async (options = {}) => {
    const { baudRate = 9600, dataBits = 8, stopBits = 1, parity = "none" } = options;

    if (APP_MODE === "demo") {
      connectSimulated();
      return { ok: true, mode: "demo" };
    }

    if (!("serial" in navigator)) {
      const msg = "Browser tidak mendukung Web Serial API.";
      setError(msg);
      pushDebugLog("error", msg);
      return { ok: false, reason: msg };
    }

    if (isConnectingRef.current || portRef.current) {
      const msg = "Port sedang aktif. Putuskan koneksi dulu sebelum testing.";
      setError(msg);
      pushDebugLog("warn", msg);
      return { ok: false, reason: msg };
    }

    let testPort = null;
    try {
      pushDebugLog("info", `Menguji koneksi serial dengan konfig: ${baudRate} baud, ${dataBits}N${stopBits}, parity=${parity}`);

      testPort = await navigator.serial.getPorts().then((ports) => ports[0] || null);
      if (!testPort) {
        testPort = await navigator.serial.requestPort();
      }

      if (!testPort) {
        const msg = "Port tidak ditemukan.";
        setError(msg);
        pushDebugLog("error", msg);
        return { ok: false, reason: msg };
      }

      await testPort.open({ baudRate, dataBits, stopBits, parity });
      notifySerialConnectionState(true);

      const decoder = new TextDecoder();
      const reader = testPort.readable.getReader();
      let received = "";
      let sawData = false;

      try {
        const start = Date.now();
        while (Date.now() - start < 1500) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            const text = decoder.decode(value, { stream: true });
            received += text;
            if (text.trim()) {
              sawData = true;
              break;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      await testPort.close();
      testPort = null;
      notifySerialConnectionState(false);

      if (sawData && received.trim()) {
        setError(null);
        pushDebugLog("success", `Tes koneksi berhasil. Data diterima: ${JSON.stringify(received)}`);
        return { ok: true, data: received };
      }

      const msg = "Tes koneksi gagal: tidak ada data valid yang diterima dari alat.";
      setError(msg);
      pushDebugLog("error", msg);
      return { ok: false, reason: msg, data: received };
    } catch (err) {
      const msg = err?.message || "Gagal menguji koneksi serial.";
      setError(msg);
      pushDebugLog("error", `Tes koneksi gagal: ${msg}`);
      if (testPort?.readable || testPort?.writable) {
        try {
          await testPort.close();
        } catch {
          // Port mungkin masih dibersihkan browser setelah read error.
        }
      }
      notifySerialConnectionState(false);
      return { ok: false, reason: msg };
    }
  }, [connectSimulated, pushDebugLog]);

  const handlePhysicalDisconnect = useCallback((event) => {
    if (event.target !== portRef.current) return;

    setIsConnected(false);
    setIsStable(false);
    setError("Timbangan terputus (kabel/port tidak terdeteksi).");
    pushDebugLog("error", "Perangkat fisik terputus (kabel/USB tercabut).");
    notifySerialConnectionState(false);

    readerRef.current = null;
    portRef.current = null;
    isConnectingRef.current = false;
  }, [pushDebugLog]);

  useEffect(() => {
    if (!("serial" in navigator)) return;

    const handlePageHide = () => {
      try {
        if (readerRef.current) readerRef.current.cancel();
        if (portRef.current && portRef.current.readable) {
          portRef.current.close().catch(() => {});
        }
      } catch (error) {
        // ignore cleanup error on page unload
      }
      readerRef.current = null;
      portRef.current = null;
      isConnectingRef.current = false;
    };

    navigator.serial.addEventListener("disconnect", handlePhysicalDisconnect);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);

    return () => {
      navigator.serial.removeEventListener("disconnect", handlePhysicalDisconnect);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
    };
  }, [handlePhysicalDisconnect]);

  const readLoop = async (port) => {
    const decoder = new TextDecoder();
    const reader = port.readable.getReader();
    let readFailed = false;
    readerRef.current = reader;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          const chunkText = decoder.decode(value, { stream: true });
          pushDebugLog("raw", JSON.stringify(chunkText));
          bufferRef.current += chunkText;
          processBuffer();
        }
      }
    } catch (err) {
      readFailed = true;
      pushDebugLog("error", `Error saat membaca port: ${err.message}`);
      setError(err.message);
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // Reader may already have been released during port teardown.
      }

      if (readerRef.current === reader) readerRef.current = null;

      if (portRef.current === port && readFailed) {
        try {
          if (port.readable || port.writable) await port.close();
        } catch (closeError) {
          pushDebugLog("warn", `Port gagal ditutup setelah read error: ${closeError.message}`);
        } finally {
          portRef.current = null;
          setIsConnected(false);
          setIsStable(false);
          notifySerialConnectionState(false);
        }
      }
    }
  };

  function parseFrame(frame) {
    // Hanya coba format detail jika tipe indikator CAS
    if (indicatorTypeRef.current === "CAS") {
      let match = frame.match(DETAILED_REGEX);
      if (match) {
        const [, stability, type, rawWeight] = match;
        const parsedWeight = parseFloat(rawWeight.replace(/\s/g, ""));
        if (isNaN(parsedWeight)) {
          pushDebugLog("warn", `Angka berat gagal di-parse dari: "${rawWeight}"`);
          return;
        }
        pushDebugLog(
          "success",
          `✅ (format detail CAS) stabil=${stability.toUpperCase()} mode=${type.toUpperCase()} berat=${parsedWeight}`
        );
        if (stability.toUpperCase() === "OL") {
          setError("Alat timbangan overload (beban melebihi kapasitas).");
        }
        updateWeight(parsedWeight, stability.toUpperCase() === "ST", type.toUpperCase());
        return;
      }
    }

    // Hanya coba format sederhana jika tipe indikator GSC
    if (indicatorTypeRef.current === "GSC") {
      let match = frame.match(SIMPLE_REGEX);
      if (match) {
        const [, rawWeight] = match;
        const parsedWeight = parseFloat(rawWeight.replace(/\s/g, ""));
        if (isNaN(parsedWeight)) {
          pushDebugLog("warn", `Angka berat gagal di-parse dari: "${rawWeight}"`);
          return;
        }
        pushDebugLog(
          "success",
          `✅ (format sederhana GSC) berat=${parsedWeight} (status stabil dihitung otomatis oleh app)`
        );
        updateWeight(parsedWeight, null, "GS");
        return;
      }
    }

    pushDebugLog("warn", `Frame diterima tapi TIDAK COCOK format apa pun: ${JSON.stringify(frame)}`);
  }

  function processBuffer() {
    const endIndex = bufferRef.current.indexOf("\n");

    if (endIndex === -1) return;

    const frame = bufferRef.current.slice(0, endIndex + 1);
    bufferRef.current = bufferRef.current.slice(endIndex + 1);

    pushDebugLog("frame", `Frame terpisah: ${JSON.stringify(frame)}`);

    parseFrame(frame);
  }

  const STABLE_DURATION_MS = 2000;

  const updateWeight = (value, stable = null, mode = "GS") => {
    rawWeightRef.current = value;

    setWeight(value - zeroOffsetRef.current);

    if (stable !== null) {
      setIsStable(stable);
      lastWeightRef.current = value;
      return;
    }

    if (lastWeightRef.current !== value) {
      lastWeightRef.current = value;
      setIsStable(false);
      clearTimeout(stableTimerRef.current);
      stableTimerRef.current = setTimeout(() => {
        setIsStable(true);
      }, STABLE_DURATION_MS);
    }
  };

  const zero = useCallback(() => {
    if (!isStable) {
      setError("Tidak bisa zero: angka belum stabil.");
      return;
    }
    zeroOffsetRef.current = rawWeightRef.current;
    setTareWeight(0);
    setWeight(0);
    setError(null);
  }, [isStable]);

  const tare = useCallback(() => {
    if (!isStable) {
      setError("Tidak bisa tare: angka belum stabil.");
      return;
    }
    setTareWeight(rawWeightRef.current - zeroOffsetRef.current);
    setError(null);
  }, [isStable]);

  const clearTare = useCallback(() => {
    setTareWeight(0);
  }, []);

  const disconnect = useCallback(async () => {
    simulatorRef.current?.stop();
    simulatorRef.current = null;

    clearInterval(simulateTimerRef.current);
    isConnectingRef.current = false;

    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
      }
      if (portRef.current && portRef.current.readable) {
        await portRef.current.close();
      }
    } catch (err) {
      // abaikan error saat menutup
    } finally {
      readerRef.current = null;
      portRef.current = null;

      setIsConnected(false);
      setIsStable(false);
      setError(null);
      notifySerialConnectionState(false);
      pushDebugLog("info", "Koneksi diputuskan.");
    }
  }, [pushDebugLog]);

  return {
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
    netWeight: weight - tareWeight,
    debugLog,
    clearDebugLog,
  };
}