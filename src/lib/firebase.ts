import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";

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

let analyticsPromise: Promise<Analytics | null> | null = null;

export function getFirebaseAnalytics() {
  if (typeof window === "undefined") return Promise.resolve(null);

  analyticsPromise ??= isSupported()
    .then((supported) => (supported ? getAnalytics(firebaseApp) : null))
    .catch(() => null);

  return analyticsPromise;
}
