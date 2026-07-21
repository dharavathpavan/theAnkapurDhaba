const CACHE_NAME = "ankapur-customer-v9";
const SHELL = ["/manifest.webmanifest", "/pwa-icon.svg"];

function offlineResponse() {
  return new Response(JSON.stringify({ error: "Network unavailable" }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });
}

function offlineDocument() {
  return new Response(
    "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>The Ankapure Dhaba</title></head><body><main style=\"font-family:system-ui;padding:24px\"><h1>You're offline</h1><p>Please check your internet connection and try again.</p></main></body></html>",
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

async function networkFirst(request, fallback) {
  try {
    return await fetch(request, { cache: "no-store" });
  } catch (_error) {
    return (await caches.match(request)) || fallback();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("ankapur-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;

  if (url.origin === location.origin && (event.request.destination === "document" || url.pathname.startsWith("/assets/"))) {
    event.respondWith(networkFirst(event.request, event.request.destination === "document" ? offlineDocument : offlineResponse));
    return;
  }

  if (url.pathname.startsWith("/api/customer/menu") || url.pathname.startsWith("/api/customer/home")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(event.request)) || offlineResponse()),
    );
    return;
  }

  if (url.origin === location.origin) event.respondWith(networkFirst(event.request, offlineResponse));
});
