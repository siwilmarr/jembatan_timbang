import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Jembatan Timbang",
        short_name: "Timbang",
        description: "Aplikasi hybrid PWA untuk input dan sinkronisasi timbangan.",
        theme_color: "#0f4c81",
        background_color: "#ffffff",
        display: "standalone",
        icons: [],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\.(?:js|css|html|json|png|svg)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
