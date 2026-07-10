import { useCallback, useEffect, useRef, useState } from "react";
import CasSimulator from "../simulator/CasSimulator";

const APP_MODE = import.meta.env.VITE_APP_MODE || "demo";

/**
 * Hook untuk membaca data berat dari indikator timbangan via Web Serial API
 * (RS232/USB). Mendukung konfigurasi baud rate, data bits, parity agar
 * cocok dengan berbagai merk timbangan (Avery, CAS, dll).
 *
 * Catatan: Web Serial API hanya berjalan di Chrome/Edge, harus HTTPS
 * (atau localhost), dan wajib dipicu oleh interaksi user (klik tombol).
 */
export function useSerial() {
  const [isConnected, setIsConnected] = useState(false);
  const [weight, setWeight] = useState(0);
  const [isStable, setIsStable] = useState(false);
  const [error, setError] = useState(null);

  const portRef = useRef(null);
  const readerRef = useRef(null);
  const simulatorRef = useRef(null);
  const bufferRef = useRef("");
  const stableTimerRef = useRef(null);
  const lastWeightRef = useRef(null);
  const simulateTimerRef = useRef(null);
  const CAS_CI2001A_REGEX = /(ST|US)\D{0,3}(GS|NT|OL)\D{0,3}([+-]?\s*\d+\.?\d*)\s*(kg|t)?/i;

  // Raw weight = angka mentah dari alat/simulasi, SEBELUM dikurangi zero offset.
  // weight (state) = raw - zeroOffset -> inilah yang ditampilkan ke user.
  const rawWeightRef = useRef(0);
  const zeroOffsetRef = useRef(0);
  const [tareWeight, setTareWeight] = useState(0);

/**
 * CAS CI-2001A Emulator
 * Menjalankan simulator tanpa membutuhkan alat fisik.
 */
  const connectSimulated = useCallback(() => {

  setError(null);

  // jika simulator sebelumnya masih berjalan
  simulatorRef.current?.stop();

  // reset kondisi timbangan
  setIsConnected(true);
  setIsStable(false);

  zeroOffsetRef.current = 0;
  setWeight(0);
  setTareWeight(0);

  // buat simulator baru
  simulatorRef.current = new CasSimulator((frame) => {

    // frame dikirim seperti alat CAS asli
    parseFrame(frame);

  });

  // mulai simulasi
  simulatorRef.current.start();

}, []);

  const connect = useCallback(async (options = {}) => {
  const { baudRate = 9600, dataBits = 8, stopBits = 1, parity = "none" } = options;
    // Mode Demo
  if (APP_MODE === "demo") {
    connectSimulated();
    return;
    }
    if (!("serial" in navigator)) {
      setError("Browser tidak mendukung Web Serial API. Gunakan Chrome/Edge.");
      return;
    }

    // Cegah membuka koneksi baru kalau sudah ada port yang terbuka.
    if (portRef.current) {
      setError("Sudah terhubung ke timbangan. Putuskan koneksi terlebih dahulu.");
      return;
    }

    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate, dataBits, stopBits, parity });
      portRef.current = port;
      setIsConnected(true);
      setError(null);
      zeroOffsetRef.current = 0;
      setTareWeight(0);
      readLoop(port);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  /**
   * Menangani pencabutan fisik perangkat (misalnya kabel USB tercabut).
   * Tanpa ini, UI bisa saja masih menampilkan status "Online" padahal
   * alat sudah putus koneksi.
   */
  const handlePhysicalDisconnect = useCallback((event) => {
    if (event.target !== portRef.current) return; // bukan port yang sedang kita pakai

    setIsConnected(false);
    setIsStable(false);
    setError("Timbangan terputus (kabel/port tidak terdeteksi).");

    readerRef.current = null;
    portRef.current = null;
  }, []);

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
          bufferRef.current += decoder.decode(value, { stream: true });
          processBuffer();
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      reader.releaseLock();
    }
  };

  function parseFrame(frame) {

    const match = frame.match(CAS_CI2001A_REGEX);

    if (!match) return;

    const [, stability, type, rawWeight] = match;

    const parsedWeight = parseFloat(
        rawWeight.replace(/\s/g, "")
    );

    if (isNaN(parsedWeight)) return;

    updateWeight(
        parsedWeight,
        stability.toUpperCase() === "ST",
        type.toUpperCase()
    );

}

function processBuffer() {

    const endIndex = bufferRef.current.indexOf("\n");

    if (endIndex === -1) return;

    const frame =
        bufferRef.current.slice(0, endIndex + 1);

    bufferRef.current =
        bufferRef.current.slice(endIndex + 1);

    parseFrame(frame);

}

  const STABLE_DURATION_MS = 2000; // sesuai spesifikasi: stabil beberapa detik

/**
 * Dipakai baik oleh:
 * - Serial Port (alat asli)
 * - CAS Simulator
 */
  const updateWeight = (
  value,
  stable = null,
  mode = "GS"
) => {

  rawWeightRef.current = value;

  setWeight(value - zeroOffsetRef.current);

  // Jika simulator/alat sudah memberi tahu status stabil,
  // gunakan status tersebut.
  if (stable !== null) {
    setIsStable(stable);
    lastWeightRef.current = value;
    return;
  }

  // Jika status stabil tidak dikirim (misalnya mode simulasi lama),
  // gunakan logika timer seperti sebelumnya.
  if (lastWeightRef.current !== value) {

    lastWeightRef.current = value;

    setIsStable(false);

    clearTimeout(stableTimerRef.current);

    stableTimerRef.current = setTimeout(() => {

      setIsStable(true);

    }, STABLE_DURATION_MS);

  }

};

  /**
   * ZEROING — menjadikan berat saat ini sebagai titik nol baru (mengoreksi
   * drift alat, misal ada sisa kotoran di platform timbangan).
   * Software-side offset: TIDAK mengirim command ke alat, jadi aman dipakai
   * untuk merk/model apa pun tanpa perlu tahu command byte spesifiknya.
   * Hanya boleh dipanggil saat angka sudah stabil, sama seperti alat asli.
   */
  const zero = useCallback(() => {
    if (!isStable) {
      setError("Tidak bisa zero: angka belum stabil.");
      return;
    }
    zeroOffsetRef.current = rawWeightRef.current;
    setTareWeight(0); // zero ulang juga menghapus tara aktif, sama seperti perilaku alat fisik
    setWeight(0);
    setError(null);
  }, [isStable]);

  /**
   * TARE — simpan berat saat ini (setelah zero) sebagai berat tara
   * (misal berat kendaraan kosong), supaya netWeight = weight - tareWeight
   * bisa dipakai untuk timbangan keluar (Tare).
   */
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

  // hentikan CAS Emulator jika sedang berjalan
  simulatorRef.current?.stop();
  simulatorRef.current = null;

  // hentikan simulasi lama (kalau masih ada)
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

  }

}, []);

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
  };
}