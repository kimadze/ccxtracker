const CACHE_NAME = "ccx-static-v3";
const STATIC_ASSETS = [
  "/icon.svg",
  "/icons/ccx-192-v3.png",
  "/icons/ccx-512-v3.png",
  "/icons/ccx-apple-180-v3.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});
