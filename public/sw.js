const CACHE_NAME = "ankapur-customer-v5";
const SHELL = ["/manifest.webmanifest", "/pwa-icon.svg"];

function offlineResponse() {
  return new Response(JSON.stringify({ error: "Network unavailable" }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;

  if (url.pathname.startsWith("/api/customer/menu") || url.pathname.startsWith("/api/customer/home")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(async () => (await caches.match(event.request)) || offlineResponse()),
    );
    return;
  }

  if (url.origin === location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (event.request.destination && event.request.destination !== "document") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(event.request)) || (event.request.destination === "document" ? Response.redirect("/", 302) : offlineResponse())),
    );
  }
});
