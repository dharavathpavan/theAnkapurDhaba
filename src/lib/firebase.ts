import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type Auth,
  type ConfirmationResult,
} from "firebase/auth";
import {
  getMessaging,
  getToken,
  isSupported as isMessagingSupported,
  onMessage,
  type Messaging,
  type MessagePayload,
} from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAnCHV-N16e-Ok9bLPd0PN5lOrdJSXgZpg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "the-ankapur-dhaba.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "the-ankapur-dhaba",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "the-ankapur-dhaba.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "51078196561",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:51078196561:web:theankapurdhaba",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

export const firebaseApp: FirebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
export const firebaseAuth: Auth = getAuth(firebaseApp);
export const firebasePublicConfig = firebaseConfig;

let analyticsPromise: Promise<Analytics | null> | null = null;
let messagingPromise: Promise<Messaging | null> | null = null;
let recaptchaVerifier: RecaptchaVerifier | null = null;
let confirmationResult: ConfirmationResult | null = null;

export function getFirebaseAnalytics() {
  if (typeof window === "undefined" || !firebaseConfig.measurementId) return Promise.resolve(null);

  analyticsPromise ??= isSupported()
    .then((supported) => (supported ? getAnalytics(firebaseApp) : null))
    .catch(() => null);

  return analyticsPromise;
}

export function getFirebaseMessaging() {
  if (typeof window === "undefined") return Promise.resolve(null);

  messagingPromise ??= isMessagingSupported()
    .then((supported) => (supported ? getMessaging(firebaseApp) : null))
    .catch(() => null);

  return messagingPromise;
}

export async function getFirebasePushToken() {
  if (typeof window === "undefined") return null;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return null;

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    throw new Error("Firebase Web Push key is missing. Add VITE_FIREBASE_VAPID_KEY in Vercel.");
  }

  const messaging = await getFirebaseMessaging();
  if (!messaging) return null;

  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  registration.active?.postMessage({ type: "FIREBASE_CONFIG", config: firebaseConfig });
  registration.waiting?.postMessage({ type: "FIREBASE_CONFIG", config: firebaseConfig });
  registration.installing?.postMessage({ type: "FIREBASE_CONFIG", config: firebaseConfig });

  return getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
}

export async function onFirebaseForegroundMessage(callback: (payload: MessagePayload) => void) {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return () => undefined;
  return onMessage(messaging, callback);
}

function formatPhoneForFirebase(phone: string) {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return `+${digits}`;
}

export async function sendFirebasePhoneOtp(phone: string, containerId = "firebase-recaptcha") {
  if (typeof window === "undefined") throw new Error("OTP login is available only in the browser.");

  firebaseAuth.languageCode = "en";
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, containerId, {
      size: "invisible",
      callback: () => undefined,
    });
  }

  confirmationResult = await signInWithPhoneNumber(
    firebaseAuth,
    formatPhoneForFirebase(phone),
    recaptchaVerifier,
  );
}

export async function verifyFirebasePhoneOtp(code: string) {
  if (!confirmationResult) throw new Error("Please request a fresh OTP first.");
  const credential = await confirmationResult.confirm(code.trim());
  confirmationResult = null;
  return credential.user.getIdToken();
}

export function resetFirebaseOtp() {
  confirmationResult = null;
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
}
