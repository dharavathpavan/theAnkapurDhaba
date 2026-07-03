import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/stores/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import {
  Bike,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  Phone,
  RefreshCcw,
  UserRound,
} from "lucide-react";
import {
  listOrders,
  updateOrderDelivery,
  type Order,
  type OrderStatus,
} from "@/services/api";
import { useOrderRealtime } from "@/hooks/use-order-realtime";
import { DeliveryMap, googleMapsDirectionsUrl } from "@/components/site/DeliveryMap";
import { toast } from "sonner";

export const Route = createFileRoute("/delivery")({
  head: () => ({
    meta: [{ title: "Delivery Portal · Ankapur Dhaba" }, { name: "robots", content: "noindex" }],
  }),
  component: DeliveryPortal,
});

function DeliveryPortal() {
  const { hasRole, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated() || !hasRole('ADMIN', 'DELIVERY')) navigate({ to: '/login' });
  }, [mounted, isAuthenticated, hasRole, navigate]);
  if (!mounted || !isAuthenticated() || !hasRole('ADMIN', 'DELIVERY')) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><p className="text-muted-foreground font-display tracking-widest">REDIRECTING...</p></div>;
  }

  useOrderRealtime();
  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: listOrders,
    refetchInterval: 1500,
  });

  const deliveryOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.type === "delivery" &&
          ["ready", "out_for_delivery", "delivered"].includes(order.status),
      ),
    [orders],
  );

  const active = deliveryOrders.filter((order) => order.status !== "delivered");
  const completedToday = deliveryOrders.filter(
    (order) =>
      order.status === "delivered" &&
      new Date(order.updatedAt).toDateString() === new Date().toDateString(),
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-sm bg-primary text-primary-foreground">
              <Bike className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-3xl tracking-widest">DELIVERY PORTAL</h1>
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                live assignments · GPS updates
              </p>
            </div>
          </div>
          <div className="hidden text-right font-display text-xs tracking-widest text-muted-foreground sm:block">
            <div>{active.length} ACTIVE</div>
            <div className="text-veg">{completedToday.length} DELIVERED TODAY</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        {active.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface p-16 text-center">
            <Bike className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 font-display text-2xl tracking-wide text-muted-foreground">
              No delivery orders ready
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Orders marked Ready by kitchen appear here instantly.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {active.map((order) => (
              <DeliveryOrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function DeliveryOrderCard({ order }: { order: Order }) {
  const queryClient = useQueryClient();
  const [partnerName, setPartnerName] = useState(order.delivery?.partnerName ?? "");
  const [partnerPhone, setPartnerPhone] = useState(order.delivery?.partnerPhone ?? "");
  const [vehicleNumber, setVehicleNumber] = useState(order.delivery?.vehicleNumber ?? "");
  const [etaMinutes, setEtaMinutes] = useState(order.delivery?.etaMinutes?.toString() ?? "25");
  const [manualLat, setManualLat] = useState(order.delivery?.currentLocation?.lat.toString() ?? "");
  const [manualLng, setManualLng] = useState(order.delivery?.currentLocation?.lng.toString() ?? "");
  const [watching, setWatching] = useState(false);
  const [busy, setBusy] = useState(false);
  const watchRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);

  useEffect(() => {
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["orders"] });
    await queryClient.invalidateQueries({ queryKey: ["order", order.id] });
  }

  async function saveDetails() {
    await updateOrderDelivery(order.id, {
      partnerName: partnerName.trim() || undefined,
      partnerPhone: partnerPhone.trim() || undefined,
      vehicleNumber: vehicleNumber.trim() || undefined,
      etaMinutes: Number(etaMinutes) || undefined,
    });
  }

  async function pushGps(position: GeolocationPosition, nextStatus?: OrderStatus) {
    const now = Date.now();
    if (!nextStatus && now - lastSentRef.current < 7000) return;
    lastSentRef.current = now;
    const progress = estimateProgress(order.status, order.delivery?.routeProgress);
    await saveDetails();
    await updateOrderDelivery(order.id, {
      pickedUpAt: nextStatus === "out_for_delivery" ? (order.delivery?.pickedUpAt || new Date().toISOString()) : order.delivery?.pickedUpAt,
      currentLocation: {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        label: "Rider live GPS",
        updatedAt: new Date().toISOString(),
      },
      lastLocationAt: new Date().toISOString(),
      gpsAccuracy: position.coords.accuracy,
      routeProgress: progress,
      trackingPaused: false,
    });
    await refresh();
  }

  function startWatch(nextStatus?: OrderStatus) {
    if (!navigator.geolocation) {
      toast.error("GPS is not available on this device");
      return;
    }
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    setWatching(true);
    watchRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        try {
          await pushGps(position, nextStatus);
          nextStatus = undefined;
          toast.success("Live GPS tracking active");
        } catch {
          toast.error("Couldn't send GPS update");
        }
      },
      () => {
        setWatching(false);
        toast.error("Allow location permission or enter coordinates manually");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
  }

  async function pauseWatch() {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    setWatching(false);
    await updateOrderDelivery(order.id, { trackingPaused: true });
    await refresh();
    toast.success("Live GPS paused");
  }

  async function updateLocationFromBrowser(nextStatus?: OrderStatus) {
    if (!navigator.geolocation) {
      toast.error("GPS is not available on this device");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await pushGps(position, nextStatus);
          await refresh();
          toast.success(nextStatus ? "Delivery started with live GPS" : "GPS location updated");
        } catch {
          toast.error("Couldn't update delivery location");
        } finally {
          setBusy(false);
        }
      },
      () => {
        setBusy(false);
        toast.error("Allow location permission or enter coordinates manually");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function updateManualLocation(nextStatus?: OrderStatus) {
    const lat = Number(manualLat);
    const lng = Number(manualLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.error("Enter valid latitude and longitude");
      return;
    }
    setBusy(true);
    try {
      await saveDetails();
      await updateOrderDelivery(order.id, {
        currentLocation: { lat, lng, label: "Manual admin/rider update", updatedAt: new Date().toISOString() },
        lastLocationAt: new Date().toISOString(),
        routeProgress: estimateProgress(nextStatus || order.status, order.delivery?.routeProgress),
        trackingPaused: false,
      });
      await refresh();
      toast.success(nextStatus ? "Delivery started" : "Manual location updated");
    } catch {
      toast.error("Couldn't save location");
    } finally {
      setBusy(false);
    }
  }

  async function markDelivered() {
    setBusy(true);
    try {
      await saveDetails();
      await updateOrderDelivery(order.id, {
        deliveredAt: new Date().toISOString(),
        routeProgress: 1,
        trackingPaused: true,
      });
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      setWatching(false);
      await refresh();
      toast.success(`#${order.id} delivered`);
    } catch {
      toast.error("Couldn't mark delivered");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-xl border border-border bg-surface p-5">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="font-display text-3xl tracking-wide text-primary">#{order.id}</div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <span>{order.items.reduce((sum, item) => sum + item.qty, 0)} items</span>
            <span>· ₹{order.total}</span>
            <span>· {order.paymentMethod}</span>
          </div>
        </div>
        <span className="rounded-full border border-primary/40 px-3 py-1 font-display text-xs tracking-widest text-primary">
          {order.status.replace(/_/g, " ").toUpperCase()}
        </span>
      </header>

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-border bg-background p-3 text-sm">
          <div className="font-display text-xs tracking-widest text-muted-foreground">CUSTOMER</div>
          <div className="mt-1 font-display text-lg">{order.customer.name}</div>
          <a href={`tel:${order.customer.phone}`} className="mt-1 inline-flex items-center gap-1 text-primary">
            <Phone className="h-3.5 w-3.5" /> {order.customer.phone}
          </a>
          <div className="mt-2 flex gap-2 text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>
              {order.customer.address}
              {order.customer.landmark && <span className="block italic">↳ {order.customer.landmark}</span>}
            </span>
          </div>
        </div>

        <div className="rounded-md border border-border bg-background p-3 text-sm">
          <div className="font-display text-xs tracking-widest text-muted-foreground">RIDER</div>
          <div className="mt-2 grid gap-2">
            <Input icon={UserRound} value={partnerName} onChange={setPartnerName} placeholder="Partner name" />
            <Input icon={Phone} value={partnerPhone} onChange={setPartnerPhone} placeholder="Partner phone" />
            <Input icon={Bike} value={vehicleNumber} onChange={setVehicleNumber} placeholder="Vehicle number" />
            <Input icon={Clock} value={etaMinutes} onChange={setEtaMinutes} placeholder="ETA minutes" inputMode="numeric" />
          </div>
        </div>
      </section>

      <section className="mt-4">
          <DeliveryMap order={order} compact premium />
      </section>

      <section className="mt-4 grid gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-[1fr_1fr_auto]">
        <input
          value={manualLat}
          onChange={(event) => setManualLat(event.target.value)}
          placeholder="Latitude"
          inputMode="decimal"
          className="rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <input
          value={manualLng}
          onChange={(event) => setManualLng(event.target.value)}
          placeholder="Longitude"
          inputMode="decimal"
          className="rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          disabled={busy}
          onClick={() => updateManualLocation(order.status === "ready" ? "out_for_delivery" : undefined)}
          className="rounded-md border border-border px-3 py-2 font-display text-xs tracking-widest text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          SAVE GPS
        </button>
      </section>

      <footer className="mt-4 flex flex-wrap gap-2">
        <a
          href={googleMapsDirectionsUrl(order)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 font-display text-xs tracking-widest text-foreground hover:border-primary/40"
        >
          <Navigation className="h-4 w-4" /> DIRECTIONS
        </a>
        {order.status === "ready" && (
          <button
            disabled={busy}
            onClick={() => startWatch("out_for_delivery")}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-display text-xs tracking-widest text-primary-foreground hover:bg-primary-glow disabled:opacity-50"
          >
            <Bike className="h-4 w-4" /> PICK UP & START
          </button>
        )}
        {order.status === "out_for_delivery" && (
          <>
            <button
              disabled={busy}
              onClick={() => (watching ? pauseWatch() : startWatch())}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-display text-xs tracking-widest text-primary-foreground hover:bg-primary-glow disabled:opacity-50"
            >
              <Navigation className="h-4 w-4" /> {watching ? "PAUSE GPS" : "START LIVE GPS"}
            </button>
            <button
              disabled={busy}
              onClick={() => updateLocationFromBrowser()}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 font-display text-xs tracking-widest text-foreground hover:border-primary/40 disabled:opacity-50"
            >
              <RefreshCcw className="h-4 w-4" /> UPDATE GPS
            </button>
            <button
              disabled={busy}
              onClick={markDelivered}
              className="inline-flex items-center gap-2 rounded-md bg-veg px-4 py-2 font-display text-xs tracking-widest text-background hover:opacity-90 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" /> DELIVERED
            </button>
          </>
        )}
      </footer>
    </article>
  );
}

function Input({
  icon: Icon,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  icon: React.ElementType;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: "numeric";
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-input bg-surface px-3 py-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
      />
    </label>
  );
}

function estimateProgress(status: OrderStatus, current = 0) {
  if (status === "delivered") return 1;
  if (status === "out_for_delivery") return Math.min(0.95, Math.max(0.45, current + 0.08));
  if (status === "ready") return Math.max(0.35, current);
  return Math.max(0.1, current);
}
