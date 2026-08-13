const CACHE_NAME = "jembatan-timbang-v5"; // Bump version to v5 to clear v4 cache
const ASSETS_TO_CACHE = [
  "/"
];

// Install: pre-cache the App Shell "/"
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn("Assets caching failed at install: ", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("Removing old cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Message listener to trigger immediate skip waiting from client
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Fetch Interceptor
self.addEventListener("fetch", (event) => {
  // BANYAK TAB / ONLINE MODE SECURITY GUARD:
  // Jika browser sedang ONLINE, BYPASS Service Worker sepenuhnya (jangan intercept fetch).
  // Ini menjamin browser menggunakan routing asli server Next.js secara langsung dan alami,
  // sehingga halaman admin dan operator TIDAK AKAN PERNAH tertukar saat online.
  if (self.navigator.onLine) {
    return;
  }

  // LOGIKA OFFLINE MODE:
  // Hanya berjalan jika koneksi internet terputus (offline).
  if (event.request.method !== "GET") return;

  // Skip API calls completely
  if (event.request.url.includes("/api/")) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      // Jika offline dan merupakan request navigasi halaman HTML, berikan App Shell "/"
      if (event.request.mode === "navigate") {
        return caches.match("/");
      }
    })
  );
});
