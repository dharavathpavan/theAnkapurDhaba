import { useEffect, useState } from "react";
import { AlertTriangle, WifiOff } from "lucide-react";
import { getStore, subscribeStore, type StoreConfig } from "@/services/store";

export function StoreStatusBanner() {
  const [mounted, setMounted] = useState(false);
  const [store, setStore] = useState<StoreConfig | null>(null);

  useEffect(() => {
    setMounted(true);
    setStore(getStore());
    return subscribeStore(() => setStore(getStore()));
  }, []);

  if (!mounted || !store) return null;

  if (store.status === "online" && !store.statusMessage) return null;

  if (store.status === "offline") {
    return (
      <div className="border-b border-primary/40 bg-primary/10 text-primary">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 font-display text-xs tracking-widest md:px-6">
          <WifiOff className="h-4 w-4" />
          <span>STORE CLOSED · {store.statusMessage || "Not accepting orders right now."}</span>
        </div>
      </div>
    );
  }
  if (store.status === "busy") {
    return (
      <div className="border-b border-accent/40 bg-accent/10 text-accent">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 font-display text-xs tracking-widest md:px-6">
          <AlertTriangle className="h-4 w-4" />
          <span>
            HIGH DEMAND · {store.statusMessage || "Wait times slightly longer than usual."}
          </span>
        </div>
      </div>
    );
  }
  return null;
}
