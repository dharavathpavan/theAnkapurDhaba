import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type Auth,
  type ConfirmationResult,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC5bRRKh_8cE2yU5WPhC60kdCMVxl7zI68",
  authDomain: "idea-makers-263ea.firebaseapp.com",
  projectId: "idea-makers-263ea",
  storageBucket: "idea-makers-263ea.firebasestorage.app",
  messagingSenderId: "857979552512",
  appId: "1:857979552512:web:3bf4b37becaa038b63a9e5",
  measurementId: "G-RM0QSZLN17",
};

export const firebaseApp: FirebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
export const firebaseAuth: Auth = getAuth(firebaseApp);

let analyticsPromise: Promise<Analytics | null> | null = null;
let recaptchaVerifier: RecaptchaVerifier | null = null;
let confirmationResult: ConfirmationResult | null = null;

export function getFirebaseAnalytics() {
  if (typeof window === "undefined") return Promise.resolve(null);

  analyticsPromise ??= isSupported()
    .then((supported) => (supported ? getAnalytics(firebaseApp) : null))
    .catch(() => null);

  return analyticsPromise;
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
