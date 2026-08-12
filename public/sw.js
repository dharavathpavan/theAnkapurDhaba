importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAnCHV-N16e-Ok9bLPd0PN5lOrdJSXgZpg",
  authDomain: "the-ankapur-dhaba.firebaseapp.com",
  projectId: "the-ankapur-dhaba",
  storageBucket: "the-ankapur-dhaba.firebasestorage.app",
  messagingSenderId: "51078196561",
  appId: "1:51078196561:web:theankapurdhaba",
};

const CACHE_NAME = "ankapur-customer-v9";
const SHELL = ["/manifest.webmanifest", "/pwa-icon.svg"];

let messaging = null;

function offlineResponse() {
  return new Response(JSON.stringify({ error: "Network unavailable" }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });
}

function offlineDocument() {
  return new Response(
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The Ankapure Dhaba</title></head><body><main style="font-family:system-ui;padding:24px"><h1>You\'re offline</h1><p>Please check your internet connection and try again.</p></main></body></html>',
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

function startFirebaseMessaging(config) {
  try {
    if (!firebase.apps.length) firebase.initializeApp(config);
    messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const title = payload.notification.title || payload.data.title || "The Ankapure Dhaba";
      const options = {
        body: payload.notification.body || payload.data.body || "You have a new update.",
        icon: "/the-ankapure-dhaba-logo.png",
        badge: "/pwa-icon.svg",
        data: {
          url: payload.data.url || payload.fcmOptions.link || "/",
        },
      };
      self.registration.showNotification(title, options);
    });
  } catch (_error) {
    messaging = null;
  }
}

startFirebaseMessaging(DEFAULT_FIREBASE_CONFIG);

self.addEventListener("message", (event) => {
  if (event.data?.type === "FIREBASE_CONFIG" && event.data.config) {
    startFirebaseMessaging(event.data.config);
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("ankapur-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;

  if (
    url.origin === location.origin &&
    (event.request.destination === "document" || url.pathname.startsWith("/assets/"))
  ) {
    event.respondWith(
      networkFirst(
        event.request,
        event.request.destination === "document" ? offlineDocument : offlineResponse,
      ),
    );
    return;
  }

  if (
    url.pathname.startsWith("/api/customer/menu") ||
    url.pathname.startsWith("/api/customer/home")
  ) {
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

  if (url.origin === location.origin)
    event.respondWith(networkFirst(event.request, offlineResponse));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((client) => "focus" in client);
        if (existing) {
          existing.navigate(url);
          return existing.focus();
        }
        return self.clients.openWindow(url);
      }),
  );
});