"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "jembatan_timbang_serial_config";

const DEFAULT_CONFIG = {
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
};

export function loadSerialConfig() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;
    } catch {
        return DEFAULT_CONFIG;
    }
}

function saveSerialConfig(config) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
        // localStorage tidak tersedia (mis. private browsing) -- abaikan,
        // config tetap jalan untuk sesi ini saja
    }
}

/**
 * Panel Konfigurasi & Kalibrasi: Baud Rate, Data Bits, Stop Bits, Parity
 * -- supaya operator/teknisi bisa menyesuaikan dengan merk timbangan
 * (Avery, CAS, dll) langsung dari UI, tanpa perlu edit kode.
 *
 * `config` & `onChange` dikontrol dari Dashboard.jsx (controlled component),
 * supaya Dashboard bisa langsung pakai `config` saat memanggil connect().
 */
export default function SettingsPanel({ config, onChange, isConnected }) {
    const [open, setOpen] = useState(false);

    // Saat pertama kali mount, baca config tersimpan dari localStorage
    // dan kirim ke parent (Dashboard) supaya connect() pakai nilai ini.
    useEffect(() => {
        onChange?.(loadSerialConfig());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleField = (field) => (e) => {
        const raw = e.target.value;
        const value = field === "parity" ? raw : Number(raw);
        const next = { ...config, [field]: value };
        saveSerialConfig(next);
        onChange?.(next);
    };

    return (
        <section className="settings-panel">
            <button
                type="button"
                className="settings-panel__toggle"
                onClick={() => setOpen((v) => !v)}
            >
                Konfigurasi & Kalibrasi
            </button>

            {open && (
                <div className="settings-panel__body">
                    <label>
                        Baud Rate
                        <select
                            value={config.baudRate}
                            onChange={handleField("baudRate")}
                            disabled={isConnected}
                        >
                            {[1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200].map((rate) => (
                                <option key={rate} value={rate}>
                                    {rate}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        Data Bits
                        <select
                            value={config.dataBits}
                            onChange={handleField("dataBits")}
                            disabled={isConnected}
                        >
                            <option value={7}>7</option>
                            <option value={8}>8</option>
                        </select>
                    </label>

                    <label>
                        Stop Bits
                        <select
                            value={config.stopBits}
                            onChange={handleField("stopBits")}
                            disabled={isConnected}
                        >
                            <option value={1}>1</option>
                            <option value={2}>2</option>
                        </select>
                    </label>

                    <label>
                        Parity
                        <select
                            value={config.parity}
                            onChange={handleField("parity")}
                            disabled={isConnected}
                        >
                            <option value="none">None</option>
                            <option value="even">Even</option>
                            <option value="odd">Odd</option>
                        </select>
                    </label>

                    {isConnected && (
                        <p className="settings-panel__hint">
                            Putuskan koneksi timbangan dulu untuk mengubah pengaturan port.
                        </p>
                    )}
                </div>
            )}
        </section>
    );
}