import { useCallback, useEffect, useRef, useState } from "react";
import CasSimulator from "../simulator/CasSimulator";

const APP_MODE = import.meta.env.VITE_APP_MODE || "demo";
const MAX_DEBUG_ENTRIES = 50;

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

  const connect = useCallback(async (options = {}) => {
    const { baudRate = 9600, dataBits = 8, stopBits = 1, parity = "none" } = options;

    if (APP_MODE === "demo") {
      connectSimulated();
      return;
    }
    if (!("serial" in navigator)) {
      setError("Browser tidak mendukung Web Serial API. Gunakan Chrome/Edge.");
      return;
    }

    if (portRef.current) {
      setError("Sudah terhubung ke timbangan. Putuskan koneksi terlebih dahulu.");
      return;
    }

    try {
      pushDebugLog(
        "info",
        `Membuka dialog pilih port... (target setting: ${baudRate} baud, ${dataBits}N${stopBits}, parity=${parity})`
      );
      const port = await navigator.serial.requestPort();
      const info = port.getInfo?.() || {};
      pushDebugLog(
        "info",
        `Port dipilih (usbVendorId=${info.usbVendorId ?? "?"}, usbProductId=${info.usbProductId ?? "?"}). Membuka koneksi...`
      );
      await port.open({ baudRate, dataBits, stopBits, parity });
      portRef.current = port;
      setIsConnected(true);
      setError(null);
      zeroOffsetRef.current = 0;
      setTareWeight(0);
      pushDebugLog("info", "Port terbuka. Menunggu data masuk dari alat...");
      readLoop(port);
    } catch (err) {
      pushDebugLog("error", `Gagal membuka port: ${err.message}`);
      setError(err.message);
    }
  }, [connectSimulated, pushDebugLog]);

  const handlePhysicalDisconnect = useCallback((event) => {
    if (event.target !== portRef.current) return;

    setIsConnected(false);
    setIsStable(false);
    setError("Timbangan terputus (kabel/port tidak terdeteksi).");
    pushDebugLog("error", "Perangkat fisik terputus (kabel/USB tercabut).");

    readerRef.current = null;
    portRef.current = null;
  }, [pushDebugLog]);

  useEffect(() => {
    if (!("serial" in navigator)) return;

    navigator.serial.addEventListener("disconnect", handlePhysicalDisconnect);
    return () => {
      navigator.serial.removeEventListener("disconnect", handlePhysicalDisconnect);
    };
  }, [handlePhysicalDisconnect]);

  const readLoop = async (port) => {
    const decoder = new TextDecoder();
    const reader = port.readable.getReader();
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
      pushDebugLog("error", `Error saat membaca port: ${err.message}`);
      setError(err.message);
    } finally {
      reader.releaseLock();
    }
  };

  function parseFrame(frame) {
    // Coba format detail dulu (ST/US,GS/NT,+angka)
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
        `✅ (format detail) stabil=${stability.toUpperCase()} mode=${type.toUpperCase()} berat=${parsedWeight}`
      );
      if (stability.toUpperCase() === "OL") {
        setError("Alat timbangan overload (beban melebihi kapasitas).");
      }
      updateWeight(parsedWeight, stability.toUpperCase() === "ST", type.toUpperCase());
      return;
    }

    // Fallback: format sederhana (STX + angka + kg), terbukti cocok
    // dengan data asli alat GSC SGW-3015PS Anda.
    match = frame.match(SIMPLE_REGEX);
    if (match) {
      const [, rawWeight] = match;
      const parsedWeight = parseFloat(rawWeight.replace(/\s/g, ""));
      if (isNaN(parsedWeight)) {
        pushDebugLog("warn", `Angka berat gagal di-parse dari: "${rawWeight}"`);
        return;
      }
      pushDebugLog(
        "success",
        `✅ (format sederhana) berat=${parsedWeight} (status stabil dihitung otomatis oleh app)`
      );
      // stable=null -> updateWeight() pakai timer 2 detik (angka tidak
      // berubah selama 2 detik = dianggap stabil), karena format ini tidak
      // mengirim status stabil secara eksplisit.
      updateWeight(parsedWeight, null, "GS");
      return;
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

    try {
      await readerRef.current?.cancel();
      await portRef.current?.close();
    } catch (err) {
      // abaikan error saat menutup
    } finally {
      readerRef.current = null;
      portRef.current = null;

      setIsConnected(false);
      setIsStable(false);
      pushDebugLog("info", "Koneksi diputuskan.");
    }
  }, [pushDebugLog]);

  return {
    connect,
    connectSimulated,
    disconnect,
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