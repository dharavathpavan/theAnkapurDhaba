/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeIndianRupee,
  BellRing,
  Bike,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Headphones,
  History,
  Home,
  IndianRupee,
  LocateFixed,
  LogOut,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Star,
  Timer,
  UserRound,
  WalletCards,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/stores/auth";
import { useOrderRealtime } from "@/hooks/use-order-realtime";
import {
  DeliveryMap,
  googleMapsDirectionsUrl,
  googleMapsRestaurantDirectionsUrl,
} from "@/components/site/DeliveryMap";
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
  type DeliveryProfile,
  type Order,
} from "@/services/api";

export const Route = createFileRoute("/restaurant/delivery")({
  head: () => ({
    meta: [
      { title: "Delivery Partner Portal | The Ankapure Dhaba" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EnterpriseDeliveryPortal,
});

const mobileTabs = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "orders", label: "Orders", icon: BellRing },
  { id: "trip", label: "Trip", icon: Navigation },
  { id: "wallet", label: "Wallet", icon: WalletCards },
  { id: "profile", label: "Profile", icon: UserRound },
] as const;

type TabId = (typeof mobileTabs)[number]["id"];

function EnterpriseDeliveryPortal() {
  const { user, hasRole, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [online, setOnline] = useState(
    () => localStorage.getItem("ankapur:delivery-online") === "true",
  );
  const [tab, setTab] = useState<TabId>("dashboard");
  const [gpsState, setGpsState] = useState<"idle" | "active" | "blocked">("idle");
  const [lastPosition, setLastPosition] = useState<DeliveryLocation | null>(null);
  const [incomingOrderId, setIncomingOrderId] = useState<string | null>(null);
  const [dismissedIncoming, setDismissedIncoming] = useState<Record<string, boolean>>({});
  const watchRef = useRef<number | null>(null);
  const lastGpsPushRef = useRef(0);
  const notifiedOrderRef = useRef<string | null>(null);
  const stageRef = useRef<Record<string, string>>({});

  useEffect(() => setMounted(true), []);
  useEffect(() => localStorage.setItem("ankapur:delivery-online", String(online)), [online]);
  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated()) navigate({ to: "/login" });
  }, [mounted, isAuthenticated, navigate]);

  useOrderRealtime();

  const queryEnabled = mounted && isAuthenticated() && hasRole("ADMIN", "DELIVERY");
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["delivery-orders"],
    queryFn: listDeliveryOrders,
    refetchInterval: 2500,
    enabled: queryEnabled,
  });
  const { data: history = [] } = useQuery({
    queryKey: ["delivery-history"],
    queryFn: listDeliveryHistory,
    refetchInterval: 5000,
    enabled: queryEnabled,
  });
  const { data: profile } = useQuery({
    queryKey: ["delivery-profile"],
    queryFn: getDeliveryProfile,
    refetchInterval: 5000,
    enabled: queryEnabled,
  });

  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["delivery-orders"] }),
      queryClient.invalidateQueries({ queryKey: ["delivery-history"] }),
      queryClient.invalidateQueries({ queryKey: ["delivery-profile"] }),
      queryClient.invalidateQueries({ queryKey: ["orders"] }),
    ]);
  }, [queryClient]);

  const myOrders = useMemo(
    () => orders.filter((order) => isMine(order, user?.id, user?.phone)),
    [orders, user?.id, user?.phone],
  );
  const available = useMemo(
    () =>
      orders.filter((order) => {
        const delivery = order.delivery || {};
        return (
          order.status === "ready" &&
          !delivery.assignedRiderId &&
          (!delivery.reservedBy || reservationExpired(order))
        );
      }),
    [orders],
  );
  const activeOrder = myOrders.find((order) => !["delivered", "cancelled"].includes(order.status));
  const visibleIncoming = online
    ? available.find((order) => !dismissedIncoming[order.id]) || null
    : null;

  useEffect(() => {
    if (!visibleIncoming) {
      setIncomingOrderId(null);
      return;
    }
    setIncomingOrderId(visibleIncoming.id);
    if (notifiedOrderRef.current === visibleIncoming.id) return;
    notifiedOrderRef.current = visibleIncoming.id;
    notifyNewOrder(visibleIncoming);
  }, [visibleIncoming]);

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
        const routePatch = await liveRoutePatch(activeOrder, currentLocation);
        updateDeliveryLocation(activeOrder.id, {
          currentLocation,
          gpsAccuracy: position.coords.accuracy,
          speed: position.coords.speed || undefined,
          heading: position.coords.heading || undefined,
          routeProgress: nextProgress(activeOrder, currentLocation),
          distanceKm: routePatch.distanceKm ?? estimateDistanceKm(activeOrder, currentLocation),
          etaMinutes: routePatch.etaMinutes,
          batteryLevel: undefined,
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
  }, [online, activeOrder, invalidate]);

  if (!mounted || !isAuthenticated()) return <DeliveryGate title="Loading delivery portal" />;
  if (!hasRole("ADMIN", "DELIVERY")) {
    return (
      <DeliveryGate title="403 Forbidden" subtitle="This portal is only for delivery partners." />
    );
  }

  const incomingOrder = incomingOrderId ? available.find((order) => order.id === incomingOrderId) : null;

  return (
    <div className="min-h-screen bg-[#0F172A] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.14),transparent_36%)]" />
      <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-4 px-3 pb-28 pt-3 sm:px-5 lg:grid lg:grid-cols-[23rem_1fr] lg:gap-5 lg:pb-6 lg:pt-5">
        <aside className="flex flex-col gap-4">
          <RiderHero
            profile={profile}
            online={online}
            gpsState={gpsState}
            lastPosition={lastPosition}
            onOnlineChange={setOnline}
            onLogout={() => {
              logout();
              navigate({ to: "/login" });
            }}
          />
          <DashboardMetrics profile={profile} myOrders={myOrders} history={history} />
          <DesktopNav active={tab} onChange={setTab} />
        </aside>

        <section className="min-w-0">
          <div className="hidden lg:block">
            <CommandHeader online={online} available={available.length} activeOrder={activeOrder} />
          </div>

          <div className="mt-0 space-y-4 lg:mt-4">
            {(tab === "dashboard" || tab === "trip") && (
              <ActiveTripPanel
                order={activeOrder}
                online={online}
                gpsState={gpsState}
                lastPosition={lastPosition}
                onDone={invalidate}
              />
            )}

            {(tab === "dashboard" || tab === "orders") && (
              <OrdersPanel
                online={online}
                ordersLoading={ordersLoading}
                available={available}
                myOrders={myOrders}
                onDone={invalidate}
              />
            )}

            {tab === "wallet" && <WalletPanel profile={profile} history={history} />}
            {tab === "profile" && (
              <ProfilePanel profile={profile} gpsState={gpsState} online={online} lastPosition={lastPosition} />
            )}
          </div>
        </section>
      </main>

      <MobileNav active={tab} onChange={setTab} />

      {incomingOrder && (
        <IncomingOrderModal
          order={incomingOrder}
          onClose={() => setDismissedIncoming((current) => ({ ...current, [incomingOrder.id]: true }))}
          onDone={async () => {
            setIncomingOrderId(null);
            await invalidate();
            setTab("trip");
          }}
        />
      )}
    </div>
  );
}

function RiderHero({
  profile,
  online,
  gpsState,
  lastPosition,
  onOnlineChange,
  onLogout,
}: {
  profile?: DeliveryProfile;
  online: boolean;
  gpsState: string;
  lastPosition: DeliveryLocation | null;
  onOnlineChange: (value: boolean) => void;
  onLogout: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-[30px] border border-white/10 bg-white/[0.07] p-4 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg shadow-orange-950/40">
            <Bike className="h-8 w-8" />
            <span className={`absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-[#0F172A] ${online ? "bg-emerald-400" : "bg-slate-500"}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-200">{greeting()}</p>
            <h1 className="truncate text-2xl font-black">{profile?.user.name || "Delivery Partner"}</h1>
            <p className="truncate text-xs font-bold text-slate-300">{profile?.branch || "Main Branch"} - Delivery Partner</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/10 text-slate-100"
          aria-label="Logout"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>

      <button
        onClick={() => onOnlineChange(!online)}
        className={`mt-5 flex w-full items-center justify-between rounded-[26px] p-4 text-left transition ${
          online
            ? "bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-950/20"
            : "bg-slate-900 text-slate-100"
        }`}
      >
        <span>
          <span className="block text-xs font-black uppercase tracking-[0.2em]">
            {online ? "Online" : "Offline"}
          </span>
          <span className="mt-1 block text-lg font-black">
            {online ? "Receiving orders" : "Tap to start shift"}
          </span>
        </span>
        <span className={`relative h-9 w-16 rounded-full ${online ? "bg-emerald-950/20" : "bg-white/10"}`}>
          <span className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow transition ${online ? "left-8" : "left-1"}`} />
        </span>
      </button>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniStat icon={BadgeIndianRupee} label="Today" value={`Rs ${profile?.todayEarnings ?? 0}`} />
        <MiniStat icon={Star} label="Rating" value={String(profile?.rating ?? 4.8)} />
        <MiniStat icon={LocateFixed} label="GPS" value={gpsState.toUpperCase()} />
        <MiniStat
          icon={CircleDot}
          label="Live"
          value={lastPosition ? `${lastPosition.lat.toFixed(3)}, ${lastPosition.lng.toFixed(3)}` : "Waiting"}
        />
      </div>
    </section>
  );
}

function DashboardMetrics({
  profile,
  myOrders,
  history,
}: {
  profile?: DeliveryProfile;
  myOrders: Order[];
  history: Order[];
}) {
  const cards = [
    { icon: Bike, label: "Orders", value: profile?.todayDeliveries ?? 0, tone: "orange" },
    { icon: IndianRupee, label: "Earnings", value: `Rs ${profile?.todayEarnings ?? 0}`, tone: "green" },
    { icon: Timer, label: "Active", value: profile?.activeOrders ?? myOrders.length, tone: "blue" },
    { icon: CheckCircle2, label: "Done", value: profile?.completedOrders ?? history.length, tone: "green" },
    { icon: Clock3, label: "Avg ETA", value: `${profile?.averageDeliveryTime ?? 0}m`, tone: "orange" },
    { icon: ShieldCheck, label: "Complete", value: `${profile?.completionRate ?? 100}%`, tone: "green" },
  ];
  return (
    <section className="grid grid-cols-2 gap-2">
      {cards.map((card) => (
        <MetricCard key={card.label} {...card} />
      ))}
    </section>
  );
}

function DesktopNav({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  return (
    <nav className="hidden rounded-[28px] border border-white/10 bg-slate-950/45 p-2 lg:block">
      {mobileTabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`mb-1 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-black transition last:mb-0 ${
              active === tab.id ? "bg-orange-500 text-white shadow-lg shadow-orange-950/30" : "text-slate-300 hover:bg-white/10"
            }`}
          >
            <span className="flex items-center gap-3">
              <Icon className="h-5 w-5" />
              {tab.label}
            </span>
            <ChevronRight className="h-4 w-4" />
          </button>
        );
      })}
    </nav>
  );
}

function CommandHeader({
  online,
  available,
  activeOrder,
}: {
  online: boolean;
  available: number;
  activeOrder?: Order;
}) {
  return (
    <header className="rounded-[30px] border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-200">The Ankapure Dhaba</p>
          <h2 className="mt-1 text-3xl font-black">Delivery Command Center</h2>
          <p className="mt-1 text-sm text-slate-300">
            {online ? `${available} ready order${available === 1 ? "" : "s"} in queue` : "Go online to receive orders"}
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-950/50 px-5 py-4 text-right">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Active Trip</p>
          <p className="mt-1 text-2xl font-black">{activeOrder ? `#${activeOrder.id}` : "None"}</p>
        </div>
      </div>
    </header>
  );
}

function OrdersPanel({
  online,
  ordersLoading,
  available,
  myOrders,
  onDone,
}: {
  online: boolean;
  ordersLoading: boolean;
  available: Order[];
  myOrders: Order[];
  onDone: () => Promise<void>;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-200">Order assignment</p>
          <h2 className="text-2xl font-black">Available Orders</h2>
        </div>
        <StatusPill tone={online ? "green" : "slate"}>{online ? "Online" : "Offline"}</StatusPill>
      </div>
      {!online ? (
        <EmptyState icon={WifiOff} title="You are offline" text="Go online to receive ready delivery orders." />
      ) : ordersLoading ? (
        <EmptyState icon={Timer} title="Loading orders" text="Checking ready orders and assignments." />
      ) : available.length === 0 ? (
        <EmptyState icon={PackageCheck} title="No ready orders" text="New ready orders will appear here instantly." />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {available.map((order) => (
            <DeliveryOrderCard key={order.id} order={order} mode="available" onDone={onDone} />
          ))}
        </div>
      )}

      <div className="pt-2">
        <h3 className="mb-3 text-lg font-black">My Deliveries</h3>
        {myOrders.length === 0 ? (
          <EmptyState icon={Navigation} title="No assigned deliveries" text="Accept an order to begin a trip." />
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {myOrders.map((order) => (
              <DeliveryOrderCard key={order.id} order={order} mode="mine" onDone={onDone} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function DeliveryOrderCard({
  order,
  mode,
  onDone,
}: {
  order: Order;
  mode: "available" | "mine";
  onDone: () => Promise<void>;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [partnerName, setPartnerName] = useState(order.delivery?.partnerName || user?.name || "");
  const [partnerPhone, setPartnerPhone] = useState(order.delivery?.partnerPhone || user?.phone || "");
  const [vehicleNumber, setVehicleNumber] = useState(order.delivery?.vehicleNumber || "");

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
    onError: showMutationError("Reservation failed"),
  });
  const accept = useMutation({
    mutationFn: () =>
      pickDeliveryOrder(order.id, {
        partnerName,
        partnerPhone,
        vehicleNumber,
      }),
    onSuccess: async () => {
      toast.success("Order accepted. Head to restaurant.");
      await refresh();
    },
    onError: showMutationError("Could not accept order"),
  });

  return (
    <article className="overflow-hidden rounded-[30px] border border-white/10 bg-[#1E293B] shadow-2xl shadow-slate-950/30">
      <header className="border-b border-white/10 bg-slate-950/35 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-200">Order Assignment</p>
            <h3 className="mt-1 text-2xl font-black">#{order.id}</h3>
            <p className="mt-1 text-sm text-slate-300">{itemCount(order)} items - {order.paymentStatus.toUpperCase()} - {order.paymentMethod.toUpperCase()}</p>
          </div>
          <StageBadge order={order} />
        </div>
      </header>
      <div className="space-y-4 p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <DarkInfo icon={MapPin} label="Customer" value={order.customer.name} sub={order.customer.address || "Delivery address"} />
          <DarkInfo icon={Phone} label="Phone" value={order.customer.phone} sub={order.customer.landmark || "Tap to call"} href={`tel:${order.customer.phone}`} />
          <DarkInfo icon={Navigation} label="Distance" value={`${Number(order.delivery?.distanceKm || 0).toFixed(1)} km`} sub={`${order.delivery?.etaMinutes || 30} min ETA`} />
          <DarkInfo icon={IndianRupee} label="Earnings" value={`Rs ${deliveryEarning(order)}`} sub={order.paymentMethod === "cod" ? `Collect Rs ${order.total}` : "Prepaid or wallet"} />
        </div>

        {mode === "available" && (
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Name" value={partnerName} onChange={setPartnerName} />
            <Field label="Phone" value={partnerPhone} onChange={setPartnerPhone} />
            <Field label="Vehicle" value={vehicleNumber} onChange={setVehicleNumber} placeholder="TS 00 AB 0000" />
          </div>
        )}

        <div className="rounded-3xl bg-slate-950/35 p-3">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Items</p>
          <div className="mt-2 space-y-2 text-sm text-slate-100">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-3">
                <span>{item.qty} x {item.name}</span>
                <span className="font-black">Rs {item.price * item.qty}</span>
              </div>
            ))}
          </div>
        </div>

        {mode === "available" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => reserve.mutate()}
              disabled={reserve.isPending}
              className="rounded-2xl border border-orange-400/40 bg-orange-400/10 px-4 py-4 text-sm font-black text-orange-100"
            >
              Reserve 30 sec
            </button>
            <button
              onClick={() => accept.mutate()}
              disabled={accept.isPending}
              className="rounded-2xl bg-orange-500 px-4 py-4 text-sm font-black text-white shadow-lg shadow-orange-950/30"
            >
              Accept Order
            </button>
          </div>
        ) : (
          <a
            href={googleMapsDirectionsUrl(order)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-4 text-sm font-black text-slate-950"
          >
            <Navigation className="h-4 w-4" /> Navigate to customer
          </a>
        )}
      </div>
    </article>
  );
}

function ActiveTripPanel({
  order,
  online,
  gpsState,
  lastPosition,
  onDone,
}: {
  order?: Order;
  online: boolean;
  gpsState: string;
  lastPosition: DeliveryLocation | null;
  onDone: () => Promise<void>;
}) {
  if (!order) {
    return (
      <section className="rounded-[30px] border border-white/10 bg-white/[0.06] p-5 shadow-2xl">
        <EmptyState icon={Bike} title="No active trip" text="Accepted delivery orders will appear here with navigation, OTP and live GPS controls." />
      </section>
    );
  }
  return (
    <section className="overflow-hidden rounded-[32px] border border-orange-400/25 bg-orange-500/10 shadow-2xl shadow-orange-950/20">
      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_24rem]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-200">Active trip</p>
              <h2 className="mt-1 text-3xl font-black">#{order.id}</h2>
              <p className="mt-1 text-sm text-slate-300">{order.customer.name} - {order.customer.address || order.delivery?.destinationText || "Delivery address"}</p>
            </div>
            <StageBadge order={order} />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <DarkInfo icon={LocateFixed} label="GPS" value={online ? gpsState.toUpperCase() : "OFFLINE"} sub={lastPosition ? `${lastPosition.lat.toFixed(5)}, ${lastPosition.lng.toFixed(5)}` : "Waiting for live GPS"} />
            <DarkInfo icon={Timer} label="ETA" value={`${order.delivery?.etaMinutes || 30} min`} sub={`${Number(order.delivery?.distanceKm || 0).toFixed(1)} km remaining`} />
            <DarkInfo icon={IndianRupee} label="Payment" value={order.paymentMethod.toUpperCase()} sub={order.paymentMethod === "cod" ? `Collect Rs ${order.total}` : order.paymentStatus} />
          </div>
        </div>
        <DeliveryMap order={order} compact premium />
      </div>
      <TripControls order={order} onDone={onDone} />
    </section>
  );
}

function TripControls({ order, onDone }: { order: Order; onDone: () => Promise<void> }) {
  const [pickupPin, setPickupPin] = useState("");
  const [deliveryOtp, setDeliveryOtp] = useState("");
  const [delayReason, setDelayReason] = useState("");
  const [proofText, setProofText] = useState("");
  const [codAmount, setCodAmount] = useState(order.paymentMethod === "cod" ? String(order.total) : "");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const queryClient = useQueryClient();

  const refresh = async () => {
    await onDone();
    await queryClient.invalidateQueries({ queryKey: ["order", order.id] });
  };
  const updateStage = useMutation({
    mutationFn: (deliveryStage: string) => updateDeliveryPortalStatus(order.id, { deliveryStage }),
    onSuccess: refresh,
    onError: showMutationError("Could not update status"),
  });
  const verifyPickup = useMutation({
    mutationFn: () => verifyDeliveryPickup(order.id, pickupPin),
    onSuccess: async () => {
      toast.success("Pickup verified. Delivery started.");
      await refresh();
    },
    onError: showMutationError("Pickup verification failed"),
  });
  const deliver = useMutation({
    mutationFn: () =>
      completeDeliveryOrder(order.id, deliveryOtp, {
        codCollectedAmount: codAmount ? Number(codAmount) : undefined,
        proofOfDelivery: proofText || undefined,
        pickupChecklist: checklist,
      }),
    onSuccess: async () => {
      toast.success("Delivery completed");
      await refresh();
    },
    onError: showMutationError("Delivery OTP failed"),
  });
  const saveDelay = useMutation({
    mutationFn: () =>
      updateDeliveryPortalStatus(order.id, {
        deliveryStage: order.delivery?.deliveryStage || "on_the_way",
        delayReason,
        etaMinutes: (order.delivery?.etaMinutes || 30) + 10,
      }),
    onSuccess: async () => {
      toast.success("Delay shared with restaurant and customer");
      await refresh();
    },
    onError: showMutationError("Could not save delay"),
  });
  const sos = useMutation({
    mutationFn: () =>
      updateOrderDelivery(order.id, {
        sosAlert: true,
        supportMessage: "Rider requested emergency support",
        managerAlert: true,
      }),
    onSuccess: async () => {
      toast.success("SOS sent to manager");
      await refresh();
    },
    onError: showMutationError("Could not send SOS"),
  });

  const checklistItems = ["Food packed", "Beverages", "Cutlery", "Bill", "Thermal bag"];

  return (
    <div className="space-y-4 border-t border-white/10 bg-slate-950/35 p-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <a href={googleMapsRestaurantDirectionsUrl(order)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-4 text-sm font-black text-white">
          <MapPin className="h-4 w-4" /> Restaurant
        </a>
        <a href={googleMapsDirectionsUrl(order)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-4 text-sm font-black text-white">
          <Navigation className="h-4 w-4" /> Customer
        </a>
        <a href={`tel:${order.customer.phone}`} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-4 text-sm font-black text-white">
          <Phone className="h-4 w-4" /> Call customer
        </a>
        <button onClick={() => sos.mutate()} disabled={sos.isPending} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/15 px-4 py-4 text-sm font-black text-red-100">
          <ShieldAlert className="h-4 w-4" /> SOS
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-[26px] border border-white/10 bg-white/[0.06] p-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-200">Pickup verification</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
            <Field label="Pickup PIN" value={pickupPin} onChange={setPickupPin} placeholder="4 digit PIN" />
            <button onClick={() => verifyPickup.mutate()} disabled={verifyPickup.isPending} className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-emerald-950">
              Verify
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {checklistItems.map((item) => (
              <label key={item} className="flex items-center gap-2 rounded-2xl bg-slate-950/35 px-3 py-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={Boolean(checklist[item])}
                  onChange={(e) => setChecklist((current) => ({ ...current, [item]: e.target.checked }))}
                  className="h-4 w-4 accent-orange-500"
                />
                {item}
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-[26px] border border-white/10 bg-white/[0.06] p-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-200">Delivery verification</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
            <Field label="Delivery OTP" value={deliveryOtp} onChange={setDeliveryOtp} placeholder="Customer OTP" />
            <button onClick={() => deliver.mutate()} disabled={deliver.isPending} className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white">
              Deliver
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {order.paymentMethod === "cod" && <Field label="COD collected" value={codAmount} onChange={setCodAmount} />}
            <Field label="Proof / recipient note" value={proofText} onChange={setProofText} placeholder="Recipient name or note" />
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <button onClick={() => updateStage.mutate("arrived_restaurant")} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white">Reached Restaurant</button>
        <button onClick={() => updateStage.mutate("nearby")} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white">Nearby</button>
        <button onClick={() => updateStage.mutate("almost_there")} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white">Almost There</button>
        <button onClick={() => updateStage.mutate("outside")} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white">Outside</button>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Field label="Delay reason" value={delayReason} onChange={setDelayReason} placeholder="Traffic, customer delay, vehicle issue..." />
        <button onClick={() => saveDelay.mutate()} disabled={!delayReason || saveDelay.isPending} className="rounded-2xl border border-yellow-300/30 bg-yellow-300/10 px-5 py-3 text-sm font-black text-yellow-100">
          Share Delay
        </button>
      </div>
    </div>
  );
}

function IncomingOrderModal({
  order,
  onClose,
  onDone,
}: {
  order: Order;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [seconds, setSeconds] = useState(30);
  const accept = useMutation({
    mutationFn: () => pickDeliveryOrder(order.id),
    onSuccess: async () => {
      toast.success("Order accepted");
      await onDone();
    },
    onError: showMutationError("Could not accept order"),
  });
  const reserve = useMutation({
    mutationFn: () => reserveDeliveryOrder(order.id),
    onSuccess: async () => {
      toast.success("Order reserved for 30 seconds");
      await onDone();
    },
    onError: showMutationError("Could not reserve order"),
  });

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur">
      <section className="w-full max-w-md overflow-hidden rounded-[34px] border border-orange-300/30 bg-[#111827] text-white shadow-2xl">
        <div className="bg-gradient-to-br from-orange-500 to-red-600 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-white/80">New delivery order</p>
              <h2 className="mt-1 text-3xl font-black">#{order.id}</h2>
            </div>
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-white text-2xl font-black text-red-600">
              {seconds}
            </div>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid gap-2">
            <DarkInfo icon={MapPin} label="Customer" value={order.customer.name} sub={order.customer.address || "Delivery address"} />
            <DarkInfo icon={Timer} label="ETA and earnings" value={`${order.delivery?.etaMinutes || 30} min`} sub={`Expected earnings Rs ${deliveryEarning(order)}`} />
            <DarkInfo icon={IndianRupee} label="Payment" value={order.paymentMethod.toUpperCase()} sub={order.paymentMethod === "cod" ? `Collect Rs ${order.total}` : order.paymentStatus} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onClose} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 text-sm font-black">Decline</button>
            <button onClick={() => reserve.mutate()} disabled={reserve.isPending} className="rounded-2xl border border-orange-300/30 bg-orange-300/10 px-4 py-4 text-sm font-black text-orange-100">Reserve</button>
          </div>
          <button onClick={() => accept.mutate()} disabled={accept.isPending} className="w-full rounded-2xl bg-orange-500 px-5 py-4 text-sm font-black text-white shadow-lg shadow-orange-950/30">
            Accept and Start Trip
          </button>
        </div>
      </section>
    </div>
  );
}

function WalletPanel({ profile, history }: { profile?: DeliveryProfile; history: Order[] }) {
  const earnings = history.reduce((sum, order) => sum + deliveryEarning(order), 0);
  return (
    <section className="space-y-4">
      <div className="rounded-[32px] border border-emerald-400/20 bg-emerald-400/10 p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">Driver wallet</p>
        <h2 className="mt-2 text-4xl font-black text-emerald-100">Rs {profile?.todayEarnings ?? 0}</h2>
        <p className="mt-1 text-sm text-emerald-100/80">Today earnings. Withdrawals and payouts can be connected later.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard icon={WalletCards} label="Total shown" value={`Rs ${earnings}`} tone="green" />
        <MetricCard icon={BadgeIndianRupee} label="Bonus" value={`Rs ${profile?.bonusEarned ?? 0}`} tone="orange" />
        <MetricCard icon={History} label="Completed" value={history.length} tone="blue" />
      </div>
      <div className="rounded-[28px] border border-white/10 bg-white/[0.06] p-4">
        <h3 className="text-lg font-black">Recent delivery earnings</h3>
        <div className="mt-3 space-y-2">
          {history.slice(0, 8).map((order) => (
            <div key={order.id} className="flex items-center justify-between gap-2 rounded-2xl bg-slate-950/40 p-3 text-sm">
              <span className="font-bold">#{order.id}</span>
              <span className="text-slate-300">{new Date(order.updatedAt).toLocaleString()}</span>
              <span className="font-black text-emerald-300">Rs {deliveryEarning(order)}</span>
            </div>
          ))}
          {history.length === 0 && <p className="text-sm text-slate-400">No completed deliveries yet.</p>}
        </div>
      </div>
    </section>
  );
}

function ProfilePanel({
  profile,
  gpsState,
  online,
  lastPosition,
}: {
  profile?: DeliveryProfile;
  gpsState: string;
  online: boolean;
  lastPosition: DeliveryLocation | null;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-[30px] border border-white/10 bg-white/[0.06] p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-200">Driver profile</p>
        <h2 className="mt-2 text-3xl font-black">{profile?.user.name || "Delivery Partner"}</h2>
        <div className="mt-4 grid gap-2">
          <DarkInfo icon={Phone} label="Phone" value={profile?.user.phone || "Not set"} sub="Login phone" />
          <DarkInfo icon={Bike} label="Branch" value={profile?.branch || "Main Branch"} sub="The Ankapure Dhaba" />
          <DarkInfo icon={Star} label="Rating" value={String(profile?.rating ?? 4.8)} sub="Customer rating" />
        </div>
      </div>
      <div className="rounded-[30px] border border-white/10 bg-white/[0.06] p-5">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-200">Device and safety</p>
        <div className="mt-4 grid gap-2">
          <DarkInfo icon={LocateFixed} label="GPS" value={gpsState.toUpperCase()} sub={online ? "Tracking active when trip is assigned" : "Offline"} />
          <DarkInfo icon={CircleDot} label="Last location" value={lastPosition ? `${lastPosition.lat.toFixed(5)}, ${lastPosition.lng.toFixed(5)}` : "Waiting"} sub={lastPosition?.updatedAt || "No GPS update yet"} />
          <DarkInfo icon={Headphones} label="Support" value="Manager and restaurant" sub="SOS available from active trip" />
        </div>
      </div>
    </section>
  );
}

function MobileNav({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 gap-1 rounded-[28px] border border-white/15 bg-slate-950/88 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl lg:hidden">
      {mobileTabs.map((tab) => {
        const Icon = tab.icon;
        const selected = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`rounded-2xl px-2 py-2 text-[11px] font-black transition ${selected ? "bg-orange-500 text-white" : "text-slate-300"}`}
          >
            <Icon className="mx-auto mb-1 h-5 w-5" />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: any; tone: string }) {
  const colors: Record<string, string> = {
    orange: "bg-orange-500/12 text-orange-200",
    green: "bg-emerald-500/12 text-emerald-200",
    blue: "bg-sky-500/12 text-sky-200",
  };
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-3">
      <div className={`mb-3 grid h-10 w-10 place-items-center rounded-2xl ${colors[tone] || colors.orange}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/35 p-3">
      <Icon className="mb-2 h-4 w-4 text-orange-200" />
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black">{value}</p>
    </div>
  );
}

function DarkInfo({
  icon: Icon,
  label,
  value,
  sub,
  href,
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  href?: string;
}) {
  const body = (
    <>
      <Icon className="h-5 w-5 shrink-0 text-orange-200" />
      <span className="min-w-0">
        <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</span>
        <span className="mt-1 block break-words text-sm font-black text-white">{value}</span>
        {sub && <span className="mt-0.5 block break-words text-xs text-slate-400">{sub}</span>}
      </span>
    </>
  );
  const className = "flex min-w-0 gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-3";
  return href ? (
    <a href={href} className={className}>
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-3 text-sm font-bold text-white outline-none focus:border-orange-300"
      />
    </label>
  );
}

function StatusPill({ tone, children }: { tone: "green" | "orange" | "slate"; children: any }) {
  const colors = {
    green: "bg-emerald-400/15 text-emerald-200 border-emerald-300/20",
    orange: "bg-orange-400/15 text-orange-200 border-orange-300/20",
    slate: "bg-slate-500/15 text-slate-200 border-white/10",
  };
  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${colors[tone]}`}>{children}</span>;
}

function StageBadge({ order }: { order: Order }) {
  const stage = order.delivery?.deliveryStage || order.status;
  const label = String(stage).replace(/_/g, " ");
  const tone = order.status === "delivered" ? "green" : order.status === "ready" ? "orange" : "slate";
  return <StatusPill tone={tone}>{label}</StatusPill>;
}

function EmptyState({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="rounded-[28px] border border-dashed border-white/15 bg-white/[0.04] p-6 text-center">
      <Icon className="mx-auto h-10 w-10 text-orange-200" />
      <h3 className="mt-3 text-xl font-black">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">{text}</p>
    </div>
  );
}

function DeliveryGate({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#0F172A] p-6 text-center text-white">
      <div className="max-w-md rounded-[30px] border border-white/10 bg-white/[0.06] p-8 shadow-2xl">
        <Bike className="mx-auto h-12 w-12 text-orange-300" />
        <h1 className="mt-4 text-3xl font-black">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-slate-300">{subtitle}</p>}
      </div>
    </div>
  );
}

function isMine(order: Order, userId?: string, phone?: string) {
  const delivery = order.delivery || {};
  return (
    delivery.assignedRiderId === userId ||
    delivery.reservedBy === userId ||
    delivery.partnerPhone === phone
  );
}

function reservationExpired(order: Order) {
  const expiry = order.delivery?.reserveExpiresAt;
  if (!expiry) return true;
  return new Date(expiry).getTime() <= Date.now();
}

function itemCount(order: Order) {
  return order.items.reduce((sum, item) => sum + item.qty, 0);
}

function deliveryEarning(order: Order) {
  return Number(order.deliveryFee || 0) + Number(order.delivery?.tip || 0) + Number(order.delivery?.bonus || 0);
}

function nextProgress(order: Order, location: DeliveryLocation) {
  const destination = coordsFrom(order.delivery?.destinationLat, order.delivery?.destinationLng);
  const restaurant = coordsFrom(order.delivery?.restaurantLat, order.delivery?.restaurantLng);
  if (!destination) return Math.max(Number(order.delivery?.routeProgress || 0), 0.15);
  const start = restaurant || destination;
  const total = Math.max(distanceMeters(start.lat, start.lng, destination.lat, destination.lng), 1);
  const left = distanceMeters(location.lat, location.lng, destination.lat, destination.lng);
  const progress = Math.min(0.98, Math.max(0.15, 1 - left / total));
  return Number(progress.toFixed(2));
}

function estimateDistanceKm(order: Order, location: DeliveryLocation) {
  const destination = coordsFrom(order.delivery?.destinationLat, order.delivery?.destinationLng);
  if (!destination) return Number(order.delivery?.distanceKm || 0);
  return Number((distanceMeters(location.lat, location.lng, destination.lat, destination.lng) / 1000).toFixed(2));
}

async function liveRoutePatch(order: Order, location: DeliveryLocation) {
  const destination = coordsFrom(order.delivery?.destinationLat, order.delivery?.destinationLng);
  if (!destination) return {};
  try {
    return await calculateDrivingRoute(location, destination);
  } catch {
    return {};
  }
}

async function maybeUpdateGeofence(
  order: Order,
  location: DeliveryLocation,
  stageCache: Record<string, string>,
) {
  const restaurant = coordsFrom(order.delivery?.restaurantLat, order.delivery?.restaurantLng);
  const destination = coordsFrom(order.delivery?.destinationLat, order.delivery?.destinationLng);
  const currentStage = order.delivery?.deliveryStage || "";
  let nextStage: string | null = null;
  if (
    restaurant &&
    ["reserved", "heading_to_restaurant"].includes(currentStage) &&
    distanceMeters(location.lat, location.lng, restaurant.lat, restaurant.lng) <= 100
  ) {
    nextStage = "arrived_restaurant";
  }
  if (destination && ["on_the_way", "nearby", "almost_there"].includes(currentStage)) {
    const meters = distanceMeters(location.lat, location.lng, destination.lat, destination.lng);
    if (meters <= 20) nextStage = "outside";
    else if (meters <= 50) nextStage = "almost_there";
    else if (meters <= 100) nextStage = "nearby";
  }
  if (!nextStage || nextStage === currentStage || stageCache[order.id] === nextStage) return;
  stageCache[order.id] = nextStage;
  await updateDeliveryPortalStatus(order.id, {
    deliveryStage: nextStage,
    etaMinutes: order.delivery?.etaMinutes,
  });
}

function coordsFrom(lat?: number, lng?: number) {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return { lat, lng };
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function notifyNewOrder(order: Order) {
  try {
    navigator.vibrate?.([180, 80, 180]);
    if (Notification.permission === "granted") {
      new Notification("New delivery order", {
        body: `Order #${order.id} is ready for delivery.`,
        icon: "/the-ankapure-dhaba-logo.png",
      });
    }
  } catch {
    // Browser notification support varies; ignore safely.
  }
}

function showMutationError(fallback: string) {
  return (error: unknown) => toast.error(error instanceof Error ? error.message : fallback);
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}
