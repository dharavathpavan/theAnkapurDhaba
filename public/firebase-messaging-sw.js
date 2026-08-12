/* global firebase */
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

let messaging = null;

function startFirebaseMessaging(config) {
  try {
    if (!firebase.apps.length) firebase.initializeApp(config);
    messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const title =
        payload.notification?.title || payload.data?.title || "The Ankapure Dhaba";
      const options = {
        body: payload.notification?.body || payload.data?.body || "You have a new update.",
        icon: "/the-ankapure-dhaba-logo.png",
        badge: "/pwa-icon.svg",
        data: {
          url: payload.data?.url || payload.fcmOptions?.link || "/",
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
  if (event.data?.type === "FIREBASE_CONFIG" && event.data.config && !messaging) {
    startFirebaseMessaging(event.data.config);
  }
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
