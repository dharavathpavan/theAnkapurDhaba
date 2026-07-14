import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  Clock3,
  IndianRupee,
  LogOut,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
  Star,
  Timer,
  UserRound,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/stores/auth";
import { useOrderRealtime } from "@/hooks/use-order-realtime";
import { DeliveryMap, googleMapsDirectionsUrl, googleMapsRestaurantDirectionsUrl } from "@/components/site/DeliveryMap";
import { calculateDrivingRoute } from "@/lib/google-maps";
import {
  completeDeliveryOrder,
  getDeliveryProfile,
  listDeliveryHistory,
  listDeliveryOrders,
  pickDeliveryOrder,
  reserveDeliveryOrder,
  updateOrderDelivery,
  updateDeliveryLocation,
  updateDeliveryPortalStatus,
  verifyDeliveryPickup,
  type DeliveryLocation,
  type Order,
} from "@/services/api";

export const Route = createFileRoute("/restaurant/delivery")({
  head: () => ({
    meta: [{ title: "Delivery Partner Portal | Ankapur Dhaba" }, { name: "robots", content: "noindex" }],
  }),
  component: EnterpriseDeliveryPortal,
});

const tabs = ["Available Orders", "My Deliveries", "Completed", "History", "Earnings", "Profile"] as const;
type Tab = (typeof tabs)[number];

function EnterpriseDeliveryPortal() {
  const { user, hasRole, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [online, setOnline] = useState(() => localStorage.getItem("ankapur:delivery-online") === "true");
  const [tab, setTab] = useState<Tab>("Available Orders");
  const [gpsState, setGpsState] = useState<"idle" | "active" | "blocked">("idle");
  const [lastPosition, setLastPosition] = useState<DeliveryLocation | null>(null);
  const watchRef = useRef<number | null>(null);
  const lastGpsPushRef = useRef(0);
  const stageRef = useRef<Record<string, string>>({});

  useEffect(() => setMounted(true), []);
  useEffect(() => localStorage.setItem("ankapur:delivery-online", String(online)), [online]);
  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated()) navigate({ to: "/login" });
  }, [mounted, isAuthenticated, navigate]);

  useOrderRealtime();

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["delivery-orders"],
    queryFn: listDeliveryOrders,
    refetchInterval: 2500,
    enabled: mounted && isAuthenticated() && hasRole("ADMIN", "DELIVERY"),
  });
  const { data: history = [] } = useQuery({
    queryKey: ["delivery-history"],
    queryFn: listDeliveryHistory,
    refetchInterval: 5000,
    enabled: mounted && isAuthenticated() && hasRole("ADMIN", "DELIVERY"),
  });
  const { data: profile } = useQuery({
    queryKey: ["delivery-profile"],
    queryFn: getDeliveryProfile,
    refetchInterval: 5000,
    enabled: mounted && isAuthenticated() && hasRole("ADMIN", "DELIVERY"),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["delivery-orders"] }),
      queryClient.invalidateQueries({ queryKey: ["delivery-history"] }),
      queryClient.invalidateQueries({ queryKey: ["delivery-profile"] }),
      queryClient.invalidateQueries({ queryKey: ["orders"] }),
    ]);
  };

  const myOrders = useMemo(
    () => orders.filter((order) => isMine(order, user?.id, user?.phone)),
    [orders, user?.id, user?.phone],
  );
  const available = useMemo(
    () =>
      orders.filter((order) => {
        const delivery = order.delivery || {};
        return (order.status === "ready" || order.status === "out_for_delivery") && !delivery.assignedRiderId && (!delivery.reservedBy || reservationExpired(order));
      }),
    [orders],
  );
  const activeOrder = myOrders.find((order) => !["delivered", "cancelled"].includes(order.status));

  useEffect(() => {
    if (!online || !activeOrder || activeOrder.status === "delivered") {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
      if (!online) setGpsState("idle");
      return;
    }
    if (!navigator.geolocation) {
      setGpsState("blocked");
      return;
    }
    if (watchRef.current !== null) return;
    setGpsState("active");
    watchRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const now = Date.now();
        const currentLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: "Rider live GPS",
          updatedAt: new Date().toISOString(),
        };
        setLastPosition(currentLocation);
        if (now - lastGpsPushRef.current < 3000) return;
        lastGpsPushRef.current = now;
        const routeProgress = nextProgress(activeOrder, currentLocation);
        const routePatch = await liveRoutePatch(activeOrder, currentLocation);
        updateDeliveryLocation(activeOrder.id, {
          currentLocation,
          gpsAccuracy: position.coords.accuracy,
          speed: position.coords.speed || undefined,
          heading: position.coords.heading || undefined,
          routeProgress,
          distanceKm: routePatch.distanceKm ?? estimateDistanceKm(activeOrder, currentLocation),
          etaMinutes: routePatch.etaMinutes,
        })
          .then((updated) => {
            maybeUpdateGeofence(updated, currentLocation, stageRef.current).then(invalidate);
          })
          .catch(() => setGpsState("blocked"));
      },
      () => setGpsState("blocked"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 2500 },
    );
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    };
  }, [online, activeOrder?.id, activeOrder?.status]);

  if (!mounted || !isAuthenticated()) {
    return <DeliveryGate title="Loading delivery portal" />;
  }

  if (!hasRole("ADMIN", "DELIVERY")) {
    return <DeliveryGate title="403 Forbidden" subtitle="This portal is only for delivery partners." />;
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.18),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.14),transparent_34%)]" />
      <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-4 sm:px-6 lg:py-6">
        <header className="rounded-[28px] border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/25">
                <Bike className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-300">{greeting()}</p>
                <h1 className="text-2xl font-black tracking-tight md:text-4xl">{profile?.user.name || user?.name || "Delivery Partner"}</h1>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-200">{profile?.branch || "Main Branch"} - Delivery Partner</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <OnlineToggle online={online} onChange={setOnline} />
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Today Earnings</div>
                <div className="mt-1 flex items-center gap-1 text-2xl font-black text-emerald-300"><IndianRupee className="h-5 w-5" />{profile?.todayEarnings ?? 0}</div>
              </div>
              <button
                onClick={() => {
                  logout();
                  navigate({ to: "/login" });
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-slate-100"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <Metric icon={Bike} label="Deliveries" value={profile?.todayDeliveries ?? 0} />
          <Metric icon={WalletCards} label="Earnings" value={`₹${profile?.todayEarnings ?? 0}`} tone="green" />
          <Metric icon={Timer} label="Active" value={profile?.activeOrders ?? myOrders.length} />
          <Metric icon={CheckCircle2} label="Completed" value={profile?.completedOrders ?? history.length} tone="green" />
          <Metric icon={Clock3} label="Avg Time" value={`${profile?.averageDeliveryTime ?? 0}m`} />
          <Metric icon={Star} label="Rating" value={profile?.rating ?? 4.8} tone="yellow" />
          <Metric icon={ShieldCheck} label="Complete" value={`${profile?.completionRate ?? 100}%`} tone="green" />
          <Metric icon={Navigation} label="Distance" value={`${profile?.distanceTravelled ?? 0}km`} />
        </section>

        <section className="flex gap-2 overflow-x-auto rounded-[24px] border border-white/10 bg-slate-950/45 p-2">
          {tabs.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`shrink-0 rounded-2xl px-4 py-3 text-sm font-black transition ${tab === item ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-slate-300 hover:bg-white/10"}`}
            >
              {item}
            </button>
          ))}
        </section>

        {activeOrder && (
          <ActiveTrip order={activeOrder} online={online} gpsState={gpsState} lastPosition={lastPosition} onDone={invalidate} />
        )}

        {tab === "Available Orders" && (
          <OrderGrid empty={ordersLoading ? "Loading delivery orders..." : online ? "No ready or out-for-delivery orders right now" : "Go online to receive delivery orders"}>
            {available.map((order) => (
              <DeliveryOrderCard key={order.id} order={order} mode="available" online={online} onDone={invalidate} />
            ))}
          </OrderGrid>
        )}
        {tab === "My Deliveries" && (
          <OrderGrid empty="No active assigned deliveries">
            {myOrders.map((order) => (
              <DeliveryOrderCard key={order.id} order={order} mode="mine" online={online} onDone={invalidate} />
            ))}
          </OrderGrid>
        )}
        {(tab === "Completed" || tab === "History") && (
          <OrderGrid empty="No completed deliveries yet">
            {history.map((order) => (
              <DeliveryOrderCard key={order.id} order={order} mode="history" online={online} onDone={invalidate} />
            ))}
          </OrderGrid>
        )}
        {tab === "Earnings" && <EarningsPanel profile={profile} history={history} />}
        {tab === "Profile" && <ProfilePanel profile={profile} gpsState={gpsState} online={online} />}
      </main>
    </div>
  );
}

function ActiveTrip({ order, online, gpsState, lastPosition, onDone }: { order: Order; online: boolean; gpsState: string; lastPosition: DeliveryLocation | null; onDone: () => Promise<void> }) {
  return (
    <section className="grid gap-4 rounded-[28px] border border-orange-400/25 bg-orange-500/10 p-4 shadow-2xl shadow-orange-950/20 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-200">Active trip</p>
            <h2 className="mt-1 text-3xl font-black">#{order.id}</h2>
          </div>
          <StageBadge order={order} />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <DarkInfo icon={MapPin} label="Customer" value={order.customer.name} sub={order.customer.address || order.delivery?.destinationText || "Delivery address"} />
          <DarkInfo icon={Phone} label="Phone" value={order.customer.phone} sub={order.customer.landmark || "Call when needed"} href={`tel:${order.customer.phone}`} />
          <DarkInfo icon={Navigation} label="GPS" value={online ? gpsState.toUpperCase() : "OFFLINE"} sub={lastPosition ? `${lastPosition.lat.toFixed(5)}, ${lastPosition.lng.toFixed(5)}` : "Waiting for live location"} />
        </div>
      </div>
      <div className="min-w-0">
        <DeliveryMap order={order} compact premium />
      </div>
      <div className="flex flex-wrap gap-2 lg:col-span-2">
        <a href={googleMapsDirectionsUrl(order)} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-sm font-black text-slate-950 sm:flex-none">
          <Navigation className="h-4 w-4" /> Navigate customer
        </a>
        <a href={googleMapsRestaurantDirectionsUrl(order)} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-sm font-black text-white sm:flex-none">
          <MapPin className="h-4 w-4" /> Navigate restaurant
        </a>
        <PickupAndDeliverControls order={order} onDone={onDone} compact />
      </div>
    </section>
  );
}

function DeliveryOrderCard({ order, mode, online, onDone }: { order: Order; mode: "available" | "mine" | "history"; online: boolean; onDone: () => Promise<void> }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [pickupPin, setPickupPin] = useState("");
  const [deliveryOtp, setDeliveryOtp] = useState("");
  const [partnerName, setPartnerName] = useState(order.delivery?.partnerName || "");
  const [partnerPhone, setPartnerPhone] = useState(order.delivery?.partnerPhone || "");
  const [vehicleNumber, setVehicleNumber] = useState(order.delivery?.vehicleNumber || "");
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");

  const refresh = async () => {
    await onDone();
    await queryClient.invalidateQueries({ queryKey: ["order", order.id] });
  };

  const reserve = useMutation({
    mutationFn: () => reserveDeliveryOrder(order.id),
    onSuccess: async () => {
      toast.success(`Order #${order.id} reserved for 30 seconds`);
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Reservation failed"),
  });

  const pick = useMutation({
    mutationFn: () => {
      if (order.status === "out_for_delivery") {
        const now = new Date().toISOString();
        return updateOrderDelivery(order.id, {
          assignedRiderId: user?.id,
          assignedRiderName: user?.name || partnerName || "Delivery Partner",
          partnerName: partnerName || user?.name || "Delivery Partner",
          partnerPhone: partnerPhone || user?.phone,
          vehicleNumber: vehicleNumber || order.delivery?.vehicleNumber,
          pickedUpAt: order.delivery?.pickedUpAt || now,
          pickupVerifiedAt: order.delivery?.pickupVerifiedAt || now,
          deliveryStage: "on_the_way",
          deliveryOtp: order.delivery?.deliveryOtp || generateOtp(),
          routeProgress: Math.max(Number(order.delivery?.routeProgress || 0), 0.35),
          trackingPaused: false,
          currentLocation: manualLocation(manualLat, manualLng),
        });
      }
      return pickDeliveryOrder(order.id, { partnerName, partnerPhone, vehicleNumber, currentLocation: manualLocation(manualLat, manualLng) });
    },
    onSuccess: async () => {
      toast.success("Order assigned. Head to restaurant.");
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not pick order"),
  });

  const verifyPickup = useMutation({
    mutationFn: () => verifyDeliveryPickup(order.id, pickupPin),
    onSuccess: async () => {
      toast.success("Pickup verified. Delivery started.");
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Pickup verification failed"),
  });

  const deliver = useMutation({
    mutationFn: () => completeDeliveryOrder(order.id, deliveryOtp, { currentLocation: manualLocation(manualLat, manualLng) }),
    onSuccess: async () => {
      toast.success("Delivery completed");
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Delivery OTP failed"),
  });

  const reservedSeconds = reserveSeconds(order);
  const assigned = Boolean(order.delivery?.assignedRiderId);

  return (
    <article className="overflow-hidden rounded-[28px] border border-white/10 bg-[#1E293B] shadow-2xl shadow-slate-950/30">
      <header className="border-b border-white/10 bg-slate-950/30 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-black">Order #{order.id}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.15em]">
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-emerald-200">{order.paymentStatus}</span>
              <span className="rounded-full bg-blue-400/15 px-3 py-1 text-blue-200">{order.type}</span>
              <span className="rounded-full bg-orange-400/15 px-3 py-1 text-orange-200">{order.delivery?.priority || "normal"}</span>
            </div>
          </div>
          <StageBadge order={order} />
        </div>
      </header>

      <div className="grid gap-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <DarkInfo icon={MapPin} label="Customer" value={order.customer.name} sub={order.customer.address || "Address pending"} />
          <DarkInfo icon={Phone} label="Phone" value={order.customer.phone} sub={order.customer.landmark || "Tap to call"} href={`tel:${order.customer.phone}`} />
          <DarkInfo icon={Clock3} label="Pickup ETA" value={`${order.delivery?.etaMinutes || 25} min`} sub={new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} />
          <DarkInfo icon={IndianRupee} label="Earnings" value={`₹${order.deliveryFee + Number(order.delivery?.tip || 0)}`} sub={`Order value ₹${order.total}`} />
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-3">
          <div className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Items</div>
          <div className="grid gap-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2">
                <span className="font-bold">{item.qty}x {item.name}</span>
                <span className="font-black text-slate-300">₹{item.price * item.qty}</span>
              </div>
            ))}
          </div>
        </div>

        {mode !== "history" && (
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-3 sm:grid-cols-3">
            <Field value={partnerName} onChange={setPartnerName} placeholder="Rider name" />
            <Field value={partnerPhone} onChange={setPartnerPhone} placeholder="Rider phone" />
            <Field value={vehicleNumber} onChange={setVehicleNumber} placeholder="Vehicle number" />
            <Field value={manualLat} onChange={setManualLat} placeholder="Manual latitude" />
            <Field value={manualLng} onChange={setManualLng} placeholder="Manual longitude" />
            <a href={googleMapsDirectionsUrl(order)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white">
              <Navigation className="h-4 w-4" /> Navigate
            </a>
          </div>
        )}

        {mode === "available" && (
          <div className="grid gap-3">
            <button
              disabled={!online || reserve.isPending}
              onClick={() => reserve.mutate()}
              className="rounded-2xl border border-orange-300/20 bg-orange-400/10 px-4 py-4 text-sm font-black text-orange-100 disabled:opacity-50"
            >
              {reservedSeconds > 0 ? `Reserved for ${reservedSeconds}s` : "Reserve Order"}
            </button>
            <SwipeAction disabled={!online || pick.isPending} label="Swipe To Pick Order" onComplete={() => pick.mutate()} />
          </div>
        )}

        {assigned && order.status !== "delivered" && (
          <PickupAndDeliverControls
            order={order}
            pickupPin={pickupPin}
            deliveryOtp={deliveryOtp}
            onPickupPin={setPickupPin}
            onDeliveryOtp={setDeliveryOtp}
            onVerifyPickup={() => verifyPickup.mutate()}
            onDeliver={() => deliver.mutate()}
            busy={verifyPickup.isPending || deliver.isPending}
            onDone={refresh}
          />
        )}
      </div>
    </article>
  );
}

function PickupAndDeliverControls({
  order,
  pickupPin,
  deliveryOtp,
  onPickupPin,
  onDeliveryOtp,
  onVerifyPickup,
  onDeliver,
  busy,
  onDone,
  compact,
}: {
  order: Order;
  pickupPin?: string;
  deliveryOtp?: string;
  onPickupPin?: (value: string) => void;
  onDeliveryOtp?: (value: string) => void;
  onVerifyPickup?: () => void;
  onDeliver?: () => void;
  busy?: boolean;
  onDone: () => Promise<void>;
  compact?: boolean;
}) {
  const [localPickup, setLocalPickup] = useState("");
  const [localOtp, setLocalOtp] = useState("");
  const verifyPickup = useMutation({
    mutationFn: () => verifyDeliveryPickup(order.id, pickupPin ?? localPickup),
    onSuccess: async () => {
      toast.success("Pickup verified");
      await onDone();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Invalid pickup PIN"),
  });
  const deliver = useMutation({
    mutationFn: () => completeDeliveryOrder(order.id, deliveryOtp ?? localOtp),
    onSuccess: async () => {
      toast.success("Delivered");
      await onDone();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Invalid delivery OTP"),
  });
  const pickupValue = pickupPin ?? localPickup;
  const otpValue = deliveryOtp ?? localOtp;
  const setPickup = onPickupPin ?? setLocalPickup;
  const setOtp = onDeliveryOtp ?? setLocalOtp;
  const pickupAction = onVerifyPickup ?? (() => verifyPickup.mutate());
  const deliveryAction = onDeliver ?? (() => deliver.mutate());
  const isBusy = busy || verifyPickup.isPending || deliver.isPending;

  return (
    <div className={`grid gap-3 ${compact ? "flex-1 sm:grid-cols-2" : ""}`}>
      {order.status === "ready" && (
        <div className="grid gap-2 rounded-2xl border border-white/10 bg-slate-950/35 p-3">
          <div className="flex items-center justify-between gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Pickup PIN
            {order.delivery?.pickupPin && <span className="rounded-full bg-orange-400/20 px-2 py-1 text-orange-100">Kitchen {order.delivery.pickupPin}</span>}
          </div>
          <Field value={pickupValue} onChange={setPickup} placeholder="Enter 4 digit pickup PIN" />
          <button disabled={!pickupValue || isBusy} onClick={pickupAction} className="rounded-2xl bg-orange-500 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
            Verify Pickup
          </button>
        </div>
      )}
      {order.status === "out_for_delivery" && (
        <div className="grid gap-2 rounded-2xl border border-white/10 bg-slate-950/35 p-3">
          <div className="flex items-center justify-between gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            Delivery OTP
            {order.delivery?.deliveryOtp && <span className="rounded-full bg-emerald-400/20 px-2 py-1 text-emerald-100">Customer {order.delivery.deliveryOtp}</span>}
          </div>
          <Field value={otpValue} onChange={setOtp} placeholder="Enter delivery OTP" />
          <SwipeAction disabled={!otpValue || isBusy} label="Swipe To Complete Delivery" onComplete={deliveryAction} tone="green" />
        </div>
      )}
    </div>
  );
}

function SwipeAction({ label, onComplete, disabled, tone = "orange" }: { label: string; onComplete: () => void; disabled?: boolean; tone?: "orange" | "green" }) {
  const [drag, setDrag] = useState(0);
  const [active, setActive] = useState(false);
  const trackRef = useRef<HTMLButtonElement | null>(null);
  const color = tone === "green" ? "bg-emerald-500" : "bg-orange-500";

  const finish = () => {
    if (disabled) return;
    const width = trackRef.current?.clientWidth || 1;
    if (drag > width * 0.58) onComplete();
    setDrag(0);
    setActive(false);
  };

  return (
    <button
      ref={trackRef}
      type="button"
      disabled={disabled}
      onPointerDown={(event) => {
        if (disabled) return;
        setActive(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!active || disabled) return;
        const rect = event.currentTarget.getBoundingClientRect();
        setDrag(Math.max(0, Math.min(event.clientX - rect.left, rect.width - 56)));
      }}
      onPointerUp={finish}
      onClick={() => {
        if (!active && !disabled) onComplete();
      }}
      className="relative h-16 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-center text-sm font-black text-white disabled:opacity-50"
    >
      <span className={`absolute left-1 top-1 grid h-14 w-14 place-items-center rounded-2xl ${color} shadow-lg transition-transform`} style={{ transform: `translateX(${drag}px)` }}>
        <Bike className="h-5 w-5" />
      </span>
      <span className="pl-12">{label}</span>
    </button>
  );
}

function Metric({ icon: Icon, label, value, tone = "slate" }: { icon: React.ElementType; label: string; value: React.ReactNode; tone?: "slate" | "green" | "yellow" }) {
  const toneClass = tone === "green" ? "text-emerald-300" : tone === "yellow" ? "text-yellow-300" : "text-white";
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.06] p-3 shadow-xl backdrop-blur">
      <Icon className={`h-5 w-5 ${toneClass}`} />
      <div className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-black ${toneClass}`}>{value}</div>
    </div>
  );
}

function DarkInfo({ icon: Icon, label, value, sub, href }: { icon: React.ElementType; label: string; value: string; sub?: string; href?: string }) {
  const content = (
    <div className="flex min-w-0 gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3">
      <Icon className="mt-1 h-5 w-5 shrink-0 text-orange-300" />
      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
        <div className="truncate text-base font-black text-white">{value}</div>
        {sub && <div className="mt-1 line-clamp-2 text-xs font-semibold text-slate-300">{sub}</div>}
      </div>
    </div>
  );
  return href ? <a href={href}>{content}</a> : content;
}

function Field({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:border-orange-300"
    />
  );
}

function OnlineToggle({ online, onChange }: { online: boolean; onChange: (online: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!online)}
      className={`flex items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left shadow-lg ${online ? "bg-emerald-500 text-slate-950 shadow-emerald-500/20" : "bg-slate-800 text-slate-100 shadow-slate-950/30"}`}
    >
      <span>
        <span className="block text-[11px] font-black uppercase tracking-[0.18em] opacity-75">Status</span>
        <span className="block text-lg font-black">{online ? "ONLINE" : "OFFLINE"}</span>
      </span>
      <span className={`h-7 w-12 rounded-full p-1 ${online ? "bg-slate-950/20" : "bg-white/10"}`}>
        <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${online ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}

function StageBadge({ order }: { order: Order }) {
  const label = (order.delivery?.deliveryStage || order.status).replace(/_/g, " ");
  const color = order.status === "delivered" ? "bg-emerald-400/15 text-emerald-200" : order.status === "out_for_delivery" ? "bg-blue-400/15 text-blue-200" : "bg-orange-400/15 text-orange-200";
  return <span className={`rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.16em] ${color}`}>{label}</span>;
}

function OrderGrid({ children, empty }: { children: React.ReactNode; empty: string }) {
  const list = Array.isArray(children) ? children.filter(Boolean) : children;
  if (Array.isArray(list) && list.length === 0) {
    return (
      <div className="grid min-h-72 place-items-center rounded-[28px] border border-dashed border-white/15 bg-white/[0.04] p-8 text-center">
        <div>
          <Bike className="mx-auto h-10 w-10 text-slate-500" />
          <p className="mt-4 text-xl font-black text-slate-300">{empty}</p>
        </div>
      </div>
    );
  }
  return <section className="grid gap-4 lg:grid-cols-2">{children}</section>;
}

function EarningsPanel({ profile, history }: { profile?: any; history: Order[] }) {
  return (
    <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Earnings</p>
        <div className="mt-3 flex items-center gap-2 text-5xl font-black text-emerald-300"><IndianRupee className="h-8 w-8" />{profile?.todayEarnings ?? 0}</div>
        <p className="mt-2 text-sm font-semibold text-slate-300">Bonus earned ₹{profile?.bonusEarned ?? 0}</p>
      </div>
      <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Recent completed deliveries</p>
        <div className="mt-4 grid gap-2">
          {history.slice(0, 8).map((order) => (
            <div key={order.id} className="flex items-center justify-between rounded-2xl bg-slate-950/45 px-4 py-3">
              <span className="font-black">#{order.id}</span>
              <span className="text-sm font-bold text-slate-300">{order.customer.name}</span>
              <span className="font-black text-emerald-300">₹{order.deliveryFee + Number(order.delivery?.tip || 0)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProfilePanel({ profile, gpsState, online }: { profile?: any; gpsState: string; online: boolean }) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5">
      <div className="flex items-center gap-4">
        <div className="grid h-20 w-20 place-items-center rounded-3xl bg-orange-500 text-3xl font-black">{(profile?.user.name || "D").slice(0, 1)}</div>
        <div>
          <h2 className="text-3xl font-black">{profile?.user.name || "Delivery Partner"}</h2>
          <p className="font-bold text-slate-300">{profile?.user.phone}</p>
          <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-orange-200">{profile?.branch || "Main Branch"}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <DarkInfo icon={ShieldCheck} label="Access" value={profile?.user.role || "DELIVERY"} sub="Role based portal" />
        <DarkInfo icon={Navigation} label="GPS" value={gpsState.toUpperCase()} sub={online ? "Tracking starts with active trip" : "Offline"} />
        <DarkInfo icon={AlertTriangle} label="Emergency" value="Call Manager" sub="SOS hooks ready for provider setup" href="tel:+919000000000" />
      </div>
    </section>
  );
}

function DeliveryGate({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#0F172A] px-4 text-center text-white">
      <div>
        <Bike className="mx-auto h-12 w-12 text-orange-300" />
        <h1 className="mt-4 text-3xl font-black">{title}</h1>
        {subtitle && <p className="mt-2 text-slate-300">{subtitle}</p>}
      </div>
    </div>
  );
}

function isMine(order: Order, userId?: string, phone?: string) {
  const delivery = order.delivery || {};
  return delivery.assignedRiderId === userId || delivery.reservedBy === userId || delivery.partnerPhone === phone;
}

function reservationExpired(order: Order) {
  const expires = order.delivery?.reserveExpiresAt;
  return !expires || new Date(expires).getTime() <= Date.now();
}

function reserveSeconds(order: Order) {
  const expires = order.delivery?.reserveExpiresAt;
  if (!expires) return 0;
  return Math.max(0, Math.ceil((new Date(expires).getTime() - Date.now()) / 1000));
}

function generateOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function manualLocation(lat: string, lng: string): DeliveryLocation | undefined {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return undefined;
  return { lat: parsedLat, lng: parsedLng, label: "Manual rider location", updatedAt: new Date().toISOString() };
}

function nextProgress(order: Order, location: DeliveryLocation) {
  const current = Number(order.delivery?.routeProgress || 0);
  if (order.status === "ready") {
    const restaurantDistance = distanceMeters(location.lat, location.lng, order.delivery?.restaurantLat, order.delivery?.restaurantLng);
    if (restaurantDistance < 100) return Math.max(current, 0.28);
    return Math.max(current, 0.16);
  }
  const destinationDistance = distanceMeters(location.lat, location.lng, order.delivery?.destinationLat, order.delivery?.destinationLng);
  if (destinationDistance < 20) return 0.96;
  if (destinationDistance < 50) return 0.9;
  if (destinationDistance < 100) return 0.82;
  return Math.min(0.78, Math.max(current + 0.03, 0.4));
}

function estimateDistanceKm(order: Order, location: DeliveryLocation) {
  const meters = order.status === "ready"
    ? distanceMeters(location.lat, location.lng, order.delivery?.restaurantLat, order.delivery?.restaurantLng)
    : distanceMeters(location.lat, location.lng, order.delivery?.destinationLat, order.delivery?.destinationLng);
  return meters ? Number((meters / 1000).toFixed(2)) : order.delivery?.distanceKm;
}

async function liveRoutePatch(order: Order, location: DeliveryLocation) {
  const target = order.status === "ready"
    ? coordsFrom(order.delivery?.restaurantLat, order.delivery?.restaurantLng)
    : coordsFrom(order.delivery?.destinationLat, order.delivery?.destinationLng);
  if (!target) return {};
  try {
    return await calculateDrivingRoute({ lat: location.lat, lng: location.lng }, target);
  } catch {
    return {};
  }
}

async function maybeUpdateGeofence(order: Order, location: DeliveryLocation, stageRef: Record<string, string>) {
  const current = order.delivery?.deliveryStage || "";
  if (order.status === "ready") {
    const restaurantDistance = distanceMeters(location.lat, location.lng, order.delivery?.restaurantLat, order.delivery?.restaurantLng);
    if (restaurantDistance && restaurantDistance <= 100 && current !== "arrived_restaurant" && stageRef[order.id] !== "arrived_restaurant") {
      stageRef[order.id] = "arrived_restaurant";
      await updateDeliveryPortalStatus(order.id, { deliveryStage: "arrived_restaurant" });
    }
    return;
  }
  if (order.status !== "out_for_delivery") return;
  const destinationDistance = distanceMeters(location.lat, location.lng, order.delivery?.destinationLat, order.delivery?.destinationLng);
  let nextStage = "";
  if (destinationDistance && destinationDistance <= 20) nextStage = "outside";
  else if (destinationDistance && destinationDistance <= 50) nextStage = "almost_there";
  else if (destinationDistance && destinationDistance <= 100) nextStage = "nearby";
  if (nextStage && current !== nextStage && stageRef[order.id] !== nextStage) {
    stageRef[order.id] = nextStage;
    await updateDeliveryPortalStatus(order.id, { deliveryStage: nextStage });
  }
}

function distanceMeters(lat1?: number, lng1?: number, lat2?: number, lng2?: number) {
  if (![lat1, lng1, lat2, lng2].every((value) => typeof value === "number" && Number.isFinite(value))) return 0;
  const earth = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad((lat2 as number) - (lat1 as number));
  const dLng = toRad((lng2 as number) - (lng1 as number));
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1 as number)) * Math.cos(toRad(lat2 as number)) * Math.sin(dLng / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function coordsFrom(lat?: number, lng?: number) {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return { lat, lng };
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}
