/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BellRing, History, Home, Navigation, UserRound, WalletCards } from "lucide-react";
import { useAuth } from "@/stores/auth";
import { useOrderRealtime } from "@/hooks/use-order-realtime";
import {
  getDeliveryProfile,
  listDeliveryHistory,
  listDeliveryOrders,
  updateDeliveryLocation,
  type DeliveryLocation,
  type Order,
} from "@/services/api";
import {
  DashboardMetrics,
  DeliveryGate,
  RiderHero,
} from "@/components/delivery/delivery-ui";
import { IncomingOrderModal } from "@/components/delivery/delivery-orders";
import { DeliveryPortalContext, type DeliveryPortalState } from "@/components/delivery/delivery-context";
import {
  estimateDistanceKm,
  isMine,
  liveRoutePatch,
  maybeUpdateGeofence,
  nextProgress,
  notifyNewOrder,
  reservationExpired,
} from "@/components/delivery/delivery-utils";

export const Route = createFileRoute("/delivery")({
  head: () => ({
    meta: [
      { title: "Delivery Partner Portal | The Ankapure Dhaba" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DeliveryPortalLayout,
});

const NAV = [
  { to: "/delivery/dashboard", label: "Dashboard", icon: Home },
  { to: "/delivery/orders", label: "Orders", icon: BellRing },
  { to: "/delivery/history", label: "History", icon: History },
  { to: "/delivery/wallet", label: "Wallet", icon: WalletCards },
  { to: "/delivery/profile", label: "Profile", icon: UserRound },
] as const;

function DeliveryPortalLayout() {
  const { user, hasRole, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mounted, setMounted] = useState(false);
  const [online, setOnline] = useState(
    () => localStorage.getItem("ankapur:delivery-online") === "true",
  );
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

  const canAccess = mounted && isAuthenticated() && hasRole("ADMIN", "DELIVERY");
  if (!mounted || !isAuthenticated()) return <DeliveryGate title="Loading delivery portal" />;
  if (!hasRole("ADMIN", "DELIVERY")) {
    return (
      <DeliveryGate title="403 Forbidden" subtitle="This portal is only for delivery partners." />
    );
  }

  const incomingOrder = incomingOrderId ? available.find((order) => order.id === incomingOrderId) : null;
  const activeNav = NAV.find((item) => pathname.startsWith(item.to));

  const portal: DeliveryPortalState = {
    online,
    setOnline,
    gpsState,
    lastPosition,
    orders,
    ordersLoading,
    history,
    profile,
    invalidate,
    myOrders,
    available,
    activeOrder,
  };

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
          <DesktopNav pathname={pathname} activeOrder={activeOrder} />
        </aside>

        <section className="min-w-0">
          <header className="mb-4 hidden items-center justify-between rounded-[30px] border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur lg:flex">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-200">The Ankapure Dhaba</p>
              <h2 className="mt-1 text-3xl font-black">{activeNav?.label || "Delivery"} Portal</h2>
              <p className="mt-1 text-sm text-slate-300">
                {online ? `${available.length} ready order${available.length === 1 ? "" : "s"} in queue` : "Go online to receive orders"}
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950/50 px-5 py-4 text-right">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Active Trip</p>
              <p className="mt-1 text-2xl font-black">
                {activeOrder ? (
                  <Link to="/delivery/trips/$orderId" params={{ orderId: activeOrder.id }} className="text-orange-300 underline underline-offset-4">
                    #{activeOrder.id}
                  </Link>
                ) : (
                  "None"
                )}
              </p>
            </div>
          </header>

          <div className="mt-0 space-y-4 lg:mt-0">
            <DeliveryPortalContext.Provider value={portal}>
              <Outlet />
            </DeliveryPortalContext.Provider>
          </div>
        </section>
      </main>

      <MobileNav pathname={pathname} />

      {incomingOrder && (
        <IncomingOrderModal
          order={incomingOrder}
          onClose={() => setDismissedIncoming((current) => ({ ...current, [incomingOrder.id]: true }))}
          onDone={async () => {
            setIncomingOrderId(null);
            await invalidate();
            navigate({ to: "/delivery/dashboard" });
          }}
        />
      )}
    </div>
  );
}

function DesktopNav({
  pathname,
  activeOrder,
}: {
  pathname: string;
  activeOrder?: Order;
}) {
  return (
    <nav className="hidden rounded-[28px] border border-white/10 bg-slate-950/45 p-2 lg:block">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`mb-1 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-black transition last:mb-0 ${
              active ? "bg-orange-500 text-white shadow-lg shadow-orange-950/30" : "text-slate-300 hover:bg-white/10"
            }`}
          >
            <span className="flex items-center gap-3">
              <Icon className="h-5 w-5" />
              {item.label}
            </span>
            <Chevron />
          </Link>
        );
      })}
      {activeOrder && (
        <Link
          to="/delivery/trips/$orderId"
          params={{ orderId: activeOrder.id }}
          className="mb-1 mt-1 flex w-full items-center justify-between rounded-2xl border border-orange-400/40 bg-orange-400/10 px-4 py-3 text-sm font-black text-orange-100 transition last:mb-0"
        >
          <span className="flex items-center gap-3">
            <Navigation className="h-5 w-5" />
            Trip #{activeOrder.id}
          </span>
          <Chevron />
        </Link>
      )}
    </nav>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 gap-1 rounded-[28px] border border-white/15 bg-slate-950/88 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl lg:hidden">
      {NAV.map((item) => {
        const Icon = item.icon;
        const selected = pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`rounded-2xl px-2 py-2 text-[11px] font-black transition ${selected ? "bg-orange-500 text-white" : "text-slate-300"}`}
          >
            <Icon className="mx-auto mb-1 h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2.5">
      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
