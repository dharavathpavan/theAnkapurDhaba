const RELOAD_KEY = "ankapur_chunk_recovery_reloaded";

export function isMissingChunkError(value: unknown) {
  const message = value instanceof Error ? value.message : String(value || "");
  return /failed to fetch dynamically imported module|loading chunk|importing a module script failed|\/assets\/.+\.js/i.test(
    message,
  );
}

async function clearAppCaches() {
  if (typeof window === "undefined") return;
  await Promise.allSettled([
    "serviceWorker" in navigator
      ? navigator.serviceWorker
          .getRegistrations()
          .then((registrations) =>
            Promise.all(registrations.map((registration) => registration.unregister())),
          )
      : Promise.resolve(),
    "caches" in window
      ? caches
          .keys()
          .then((keys) =>
            Promise.all(
              keys.filter((key) => key.startsWith("ankapur-")).map((key) => caches.delete(key)),
            ),
          )
      : Promise.resolve(),
  ]);
}

export async function recoverFromMissingChunk() {
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem(RELOAD_KEY) === "1") return;
  sessionStorage.setItem(RELOAD_KEY, "1");
  await clearAppCaches();
  window.location.reload();
}

export function installChunkRecovery() {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (event) => {
    if (isMissingChunkError(event.error) || isMissingChunkError(event.message)) {
      void recoverFromMissingChunk();
    }
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (isMissingChunkError(event.reason)) {
      void recoverFromMissingChunk();
    }
  });
  window.addEventListener("load", () => {
    sessionStorage.removeItem(RELOAD_KEY);
  });
}
