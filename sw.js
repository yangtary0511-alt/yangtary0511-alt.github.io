const CACHE_NAME = "learning-hub-shell-v18";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/manifest-v5.webmanifest",
  "/learning-hub-icon-v5-180.png",
  "/learning-hub-icon-v5-192.png",
  "/learning-hub-icon-v5-256.png",
  "/learning-hub-icon-v5-512.png",
  "/additional-questions.js",
  "/choice-translations.js",
  "/word-bank.js",
  "/sentence-forest-vocab.js",
  "/학습허브-설치.zip"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") return caches.match("/index.html");
        return new Response("오프라인 상태입니다.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      })
  );
});
