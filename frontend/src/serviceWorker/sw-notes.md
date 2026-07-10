# Service Worker (Workbox) — Cache First untuk aset statis

Disarankan pakai plugin `vite-plugin-pwa` (berbasis Workbox) daripada menulis
service worker manual, karena lebih mudah dipadukan dengan Vite + React.

## Instalasi
```
npm install -D vite-plugin-pwa
```

## vite.config.js (contoh)
```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        // Cache First untuk HTML/JS/CSS agar app bisa dibuka tanpa internet
        runtimeCaching: [
          {
            urlPattern: ({ request }) =>
              ["style", "script", "document"].includes(request.destination),
            handler: "CacheFirst",
            options: { cacheName: "static-assets" },
          },
        ],
      },
    }),
  ],
});
```

## Catatan penting
- Web Serial API TIDAK bisa diakses dari dalam service worker — hanya dari
  halaman utama (main thread). Jadi service worker di sini hanya bertugas
  meng-cache aset, BUKAN membaca data timbangan.
- Untuk "Background Sync" sesungguhnya (event `sync`), dukungan browser masih
  terbatas (Chrome saja). Pendekatan yang lebih portable dan dipakai di
  `syncService.js`: polling interval + listener event `online` di halaman
  utama. Ini cukup untuk kebutuhan aplikasi ini.
