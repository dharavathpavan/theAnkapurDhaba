import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlarmClock,
  Bell,
  BellRing,
  Check,
  CheckCircle2,
  ChefHat,
  Clock3,
  Filter,
  Flame,
  HelpCircle,
  Megaphone,
  Mic2,
  PackageCheck,
  PauseCircle,
  Printer,
  Search,
  Settings,
  ShieldAlert,
  Siren,
  TimerReset,
  Truck,
  Utensils,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/stores/auth";
import {
  bulkUpdateOrderKds,
  listOrders,
  subscribeToOrderEvents,
  updateOrderKds,
  type DeliveryDetails,
  type Order,
  type OrderStatus,
} from "@/services/api";
import { KotBill } from "@/components/site/KotBill";

export const Route = createFileRoute("/kitchen")({
  head: () => ({
    meta: [
      { title: "Kitchen Display System | Ankapur Dhaba" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: KitchenDisplaySystem,
});

const KDS_SETTINGS_KEY = "ankapurdhaba:kds-settings";
const PRINTED_KEY = "ankapurdhaba:kds-printed";
const BUILT_IN_ORDER_SOUND = "/kitchen-order.mp3";
const PREP_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 45, 60];
const DELAY_REASONS = ["Need Ingredients", "High Load", "Machine Issue", "Staff Shortage", "Custom"];
const DELAY_TIMES = [5, 10, 15, 20];
const ACTIVE_STATUSES: OrderStatus[] = ["received", "accepted", "preparing", "ready"];

type KdsColumn = "new" | "preparing" | "ready";
type PrintJob = { key: string; order: Order; kind: "kot" | "bill" };
type SoundKind = "school" | "kitchen" | "restaurant" | "alarm" | "custom";
type Language = "en-US" | "hi-IN" | "te-IN";

type KdsSettings = {
  soundOn: boolean;
  soundKind: SoundKind;
  volume: number;
  repeatInterval: number;
  voiceOn: boolean;
  language: Language;
  customSound?: string;
};

const DEFAULT_SETTINGS: KdsSettings = {
  soundOn: false,
  soundKind: "school",
  volume: 0.9,
  repeatInterval: 6,
  voiceOn: false,
  language: "en-US",
};

function KitchenDisplaySystem() {
  const { hasRole, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated() || !hasRole("ADMIN", "KITCHEN")) navigate({ to: "/login" });
  }, [hasRole, isAuthenticated, navigate]);

  const { data: orders = [], dataUpdatedAt } = useQuery({
    queryKey: ["orders"],
    queryFn: listOrders,
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  const [settings, setSettings] = usePersistentSettings();
  const [now, setNow] = useState(Date.now());
  const [incoming, setIncoming] = useState<Order[]>([]);
  const [prepOrder, setPrepOrder] = useState<Order | null>(null);
  const [delayOrder, setDelayOrder] = useState<Order | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [printQueue, setPrintQueue] = useState<PrintJob[]>([]);
  const [soundPanel, setSoundPanel] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [stationFilter, setStationFilter] = useState("all");
  const [flash, setFlash] = useState(false);

  const knownNewIdsRef = useRef<Set<string> | null>(null);
  const incomingIdsRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<AudioContext | null>(null);
  const printedRef = useRef<Set<string>>(loadPrinted());
  const alertedOverdueRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    return subscribeToOrderEvents((event) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      if (event.type === "created" && event.order) pushIncoming(event.order);
    });
  }, [qc]);

  useEffect(() => {
    const receivedIds = new Set(orders.filter((o) => o.status === "received").map((o) => o.id));
    if (knownNewIdsRef.current === null) {
      knownNewIdsRef.current = receivedIds;
      return;
    }
    receivedIds.forEach((id) => {
      if (!knownNewIdsRef.current!.has(id)) {
        const order = orders.find((o) => o.id === id);
        if (order) pushIncoming(order);
      }
    });
    knownNewIdsRef.current = receivedIds;
  }, [orders]);

  useEffect(() => {
    if (incoming.length === 0 || !settings.soundOn) return;
    playBell(settings, audioRef);
    speakOrder(incoming[0], settings);
    const soundId = window.setInterval(() => {
      playBell(settings, audioRef);
      speakOrder(incoming[0], settings);
    }, Math.max(2, settings.repeatInterval) * 1000);
    const vibrateId = window.setInterval(() => {
      if ("vibrate" in navigator) navigator.vibrate([220, 120, 220, 120, 420]);
    }, 6000);
    if ("vibrate" in navigator) navigator.vibrate([260, 120, 260, 120, 600]);
    return () => {
      window.clearInterval(soundId);
      window.clearInterval(vibrateId);
      if ("vibrate" in navigator) navigator.vibrate(0);
    };
  }, [incoming, settings]);

  useEffect(() => {
    const overdue = visibleOrders.filter((o) => isOverdue(o, now));
    overdue.forEach((order) => {
      if (alertedOverdueRef.current.has(order.id)) return;
      alertedOverdueRef.current.add(order.id);
      toast.error(`Manager alert: Order ${order.id} is overdue`, { duration: 6000 });
      if (settings.soundOn) playBell({ ...settings, soundKind: "alarm" }, audioRef);
    });
  });

  const activeOrders = useMemo(
    () => orders.filter((o) => ACTIVE_STATUSES.includes(o.status)),
    [orders],
  );
  const visibleOrders = useMemo(
    () => activeOrders.filter((o) => matchesFilters(o, query, typeFilter, priorityFilter, stationFilter)),
    [activeOrders, query, typeFilter, priorityFilter, stationFilter],
  );

  const groups: Record<KdsColumn, Order[]> = {
    new: visibleOrders.filter((o) => o.status === "received"),
    preparing: visibleOrders.filter((o) => ["accepted", "preparing"].includes(o.status)),
    ready: visibleOrders.filter((o) => o.status === "ready"),
  };

  const analytics = useMemo(() => computeAnalytics(orders, now), [orders, now]);
  const syncAge = Math.max(0, Math.floor((now - dataUpdatedAt) / 1000));
  const stations = unique(["all", ...orders.map((o) => meta(o).station || inferStation(o))]);
  const currentPrint = printQueue[0];

  if (!isAuthenticated() || !hasRole("ADMIN", "KITCHEN")) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#121212] text-white">
        <p className="font-display text-2xl tracking-widest">OPENING KDS...</p>
      </div>
    );
  }

  function pushIncoming(order: Order) {
    if (incomingIdsRef.current.has(order.id)) return;
    incomingIdsRef.current.add(order.id);
    setIncoming((current) => (current.some((o) => o.id === order.id) ? current : [...current, order]));
    setFlash(true);
    window.setTimeout(() => setFlash(false), 1000);
    enqueuePrint(order, "kot");
  }

  async function acceptOrder(order: Order) {
    const acceptedAt = new Date().toISOString();
    const updated = await updateOrderKds(order.id, {
      status: "accepted",
      metadata: { acceptedAt, priority: meta(order).priority || "normal", station: meta(order).station || inferStation(order) },
    });
    playSuccess(settings, audioRef);
    incomingIdsRef.current.delete(order.id);
    setIncoming((current) => current.filter((o) => o.id !== order.id));
    setPrepOrder(updated);
    await qc.invalidateQueries({ queryKey: ["orders"] });
  }

  async function setPrepTime(order: Order, minutes: number) {
    const acceptedAt = meta(order).acceptedAt || new Date().toISOString();
    await updateOrderKds(order.id, {
      status: "preparing",
      metadata: { prepEtaMinutes: minutes, etaMinutes: minutes, acceptedAt, startedAt: new Date().toISOString() },
    });
    setPrepOrder(null);
    await qc.invalidateQueries({ queryKey: ["orders"] });
    toast.success(`Prep timer set: ${minutes} min`);
  }

  async function setStatus(order: Order, status: OrderStatus, metadata: Partial<DeliveryDetails> = {}) {
    const stamps: Partial<DeliveryDetails> = {};
    if (status === "preparing") stamps.startedAt = meta(order).startedAt || new Date().toISOString();
    if (status === "ready") stamps.readyAt = new Date().toISOString();
    await updateOrderKds(order.id, { status, metadata: { ...stamps, ...metadata } });
    await qc.invalidateQueries({ queryKey: ["orders"] });
  }

  async function delay(order: Order, reason: string, minutes: number) {
    await updateOrderKds(order.id, {
      metadata: {
        delayReason: reason,
        delayExtraMinutes: minutes,
        prepEtaMinutes: (meta(order).prepEtaMinutes || 0) + minutes,
        etaMinutes: (meta(order).etaMinutes || meta(order).prepEtaMinutes || 0) + minutes,
        managerAlert: true,
      },
    });
    setDelayOrder(null);
    await qc.invalidateQueries({ queryKey: ["orders"] });
    toast.error(`Delayed ${order.id}: ${reason} +${minutes}m`);
  }

  async function bulk(status?: OrderStatus, metadata: Partial<DeliveryDetails> = {}) {
    if (selectedIds.length === 0) return toast.error("Select orders first");
    await bulkUpdateOrderKds(selectedIds, { status, metadata });
    setSelectedIds([]);
    await qc.invalidateQueries({ queryKey: ["orders"] });
    toast.success("Bulk action complete");
  }

  function enqueuePrint(order: Order, kind: "kot" | "bill") {
    const key = `${order.id}:${kind}:${order.status}:${Date.now()}`;
    if (printedRef.current.has(key)) return;
    setPrintQueue((q) => [...q, { key, order, kind }]);
  }

  function markPrinted(key: string) {
    printedRef.current.add(key);
    savePrinted(printedRef.current);
    setPrintQueue((q) => q.filter((job) => job.key !== key));
  }

  return (
    <div className={`min-h-screen bg-[#121212] text-white ${flash ? "animate-[kds-flash_1s_ease-out]" : ""}`}>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#121212]/95 px-4 py-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-red-600 shadow-[0_0_35px_rgba(220,38,38,.4)]">
              <ChefHat className="h-8 w-8" />
            </div>
            <div>
              <h1 className="font-display text-4xl tracking-wide md:text-5xl">Kitchen Display System</h1>
              <p className="text-xs uppercase tracking-[0.3em] text-zinc-400">Live sync {syncAge}s ago - touch optimized</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setSettings({ ...settings, soundOn: !settings.soundOn })} className={`inline-flex min-h-14 items-center gap-2 rounded-2xl px-5 font-display text-xl tracking-widest ${settings.soundOn ? "bg-emerald-500 text-black" : "bg-zinc-800 text-zinc-200"}`}>
              {settings.soundOn ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
              SOUND {settings.soundOn ? "ON" : "OFF"}
            </button>
            <button onClick={() => setSoundPanel(true)} className="grid min-h-14 min-w-14 place-items-center rounded-2xl bg-zinc-800 text-zinc-100">
              <Settings className="h-6 w-6" />
            </button>
          </div>
        </div>
        <PerformanceStrip analytics={analytics} />
        <Toolbar
          query={query}
          setQuery={setQuery}
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          priorityFilter={priorityFilter}
          setPriorityFilter={setPriorityFilter}
          stationFilter={stationFilter}
          setStationFilter={setStationFilter}
          stations={stations}
          bulkMode={bulkMode}
          setBulkMode={setBulkMode}
          selectedCount={selectedIds.length}
          onBulkAccept={() => bulk("accepted", { acceptedAt: new Date().toISOString() })}
          onBulkReady={() => bulk("ready", { readyAt: new Date().toISOString() })}
          onBulkDelay={() => bulk(undefined, { delayReason: "High Load", delayExtraMinutes: 10, managerAlert: true })}
          onBulkPrint={() => selectedIds.forEach((id) => { const order = orders.find((o) => o.id === id); if (order) enqueuePrint(order, "kot"); })}
        />
      </header>

      <main className={`grid gap-4 p-4 transition ${incoming.length > 0 ? "blur-sm" : ""} lg:grid-cols-3`}>
        <KdsLane title="New" count={groups.new.length} tone="border-cyan-400/50" orders={groups.new} now={now} bulkMode={bulkMode} selectedIds={selectedIds} setSelectedIds={setSelectedIds} onOpen={setSelectedOrder} onStart={(o) => setPrepOrder(o)} onReady={(o) => setStatus(o, "ready")} onDelay={setDelayOrder} onCancel={(o) => setStatus(o, "cancelled")} onPrint={enqueuePrint} />
        <KdsLane title="Preparing" count={groups.preparing.length} tone="border-orange-400/50" orders={groups.preparing} now={now} bulkMode={bulkMode} selectedIds={selectedIds} setSelectedIds={setSelectedIds} onOpen={setSelectedOrder} onStart={(o) => setStatus(o, "preparing")} onReady={(o) => setStatus(o, "ready")} onDelay={setDelayOrder} onCancel={(o) => setStatus(o, "cancelled")} onPrint={enqueuePrint} />
        <KdsLane title="Ready" count={groups.ready.length} tone="border-emerald-400/50" orders={groups.ready} now={now} bulkMode={bulkMode} selectedIds={selectedIds} setSelectedIds={setSelectedIds} onOpen={setSelectedOrder} onStart={(o) => setStatus(o, "preparing")} onReady={(o) => setStatus(o, "out_for_delivery", { readyAt: meta(o).readyAt || new Date().toISOString() })} onDelay={setDelayOrder} onCancel={(o) => setStatus(o, "cancelled")} onPrint={enqueuePrint} />
      </main>

      {incoming.length > 0 && <NewOrderPopup order={incoming[0]} queued={incoming.length} onAccept={() => acceptOrder(incoming[0])} onReject={() => setStatus(incoming[0], "cancelled")} />}
      {prepOrder && <PrepTimeSheet order={prepOrder} onClose={() => setPrepOrder(null)} onSelect={(minutes) => setPrepTime(prepOrder, minutes)} />}
      {delayOrder && <DelayDialog order={delayOrder} onClose={() => setDelayOrder(null)} onDelay={(reason, minutes) => delay(delayOrder, reason, minutes)} />}
      {soundPanel && <SoundSettingsPanel settings={settings} setSettings={setSettings} onClose={() => setSoundPanel(false)} onTest={() => playBell(settings, audioRef)} />}
      {selectedOrder && <OrderDetails order={selectedOrder} onClose={() => setSelectedOrder(null)} onPrint={enqueuePrint} />}
      {currentPrint && <PrintOverlay job={currentPrint} onDone={() => markPrinted(currentPrint.key)} />}
    </div>
  );
}

function PerformanceStrip({ analytics }: { analytics: ReturnType<typeof computeAnalytics> }) {
  const stats = [
    ["PENDING", analytics.pending],
    ["PREPARING", analytics.preparing],
    ["READY", analytics.ready],
    ["DELAYED", analytics.delayed],
    ["AVG PREP", `${analytics.avgPrep}m`],
    ["LOAD", analytics.load],
  ];
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-6">
      {stats.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3">
          <div className="text-[10px] font-black tracking-[0.25em] text-zinc-500">{label}</div>
          <div className="font-display text-3xl text-white">{value}</div>
        </div>
      ))}
    </div>
  );
}

function Toolbar(props: {
  query: string; setQuery: (v: string) => void;
  typeFilter: string; setTypeFilter: (v: string) => void;
  priorityFilter: string; setPriorityFilter: (v: string) => void;
  stationFilter: string; setStationFilter: (v: string) => void;
  stations: string[];
  bulkMode: boolean; setBulkMode: (v: boolean) => void;
  selectedCount: number;
  onBulkAccept: () => void; onBulkReady: () => void; onBulkDelay: () => void; onBulkPrint: () => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <label className="relative min-w-[260px] flex-1">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
        <input value={props.query} onChange={(e) => props.setQuery(e.target.value)} placeholder="Search order, customer, table, item" className="h-14 w-full rounded-2xl border border-white/10 bg-zinc-900 pl-12 pr-4 text-lg outline-none focus:border-red-500" />
      </label>
      <KdsSelect icon={Truck} value={props.typeFilter} onChange={props.setTypeFilter} options={["all", "delivery", "pickup", "dinein"]} />
      <KdsSelect icon={ShieldAlert} value={props.priorityFilter} onChange={props.setPriorityFilter} options={["all", "vip", "express", "normal", "scheduled"]} />
      <KdsSelect icon={Filter} value={props.stationFilter} onChange={props.setStationFilter} options={props.stations} />
      <button onClick={() => props.setBulkMode(!props.bulkMode)} className={`min-h-14 rounded-2xl px-5 font-display text-lg tracking-widest ${props.bulkMode ? "bg-yellow-400 text-black" : "bg-zinc-800 text-white"}`}>BULK {props.selectedCount}</button>
      {props.bulkMode && (
        <>
          <button onClick={props.onBulkAccept} className="min-h-14 rounded-2xl bg-cyan-500 px-5 font-display text-lg text-black">ACCEPT</button>
          <button onClick={props.onBulkReady} className="min-h-14 rounded-2xl bg-emerald-500 px-5 font-display text-lg text-black">READY</button>
          <button onClick={props.onBulkDelay} className="min-h-14 rounded-2xl bg-orange-500 px-5 font-display text-lg text-black">DELAY</button>
          <button onClick={props.onBulkPrint} className="min-h-14 rounded-2xl bg-zinc-700 px-5 font-display text-lg text-white">PRINT</button>
        </>
      )}
    </div>
  );
}

function KdsSelect({ icon: Icon, value, onChange, options }: { icon: React.ElementType; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-14 rounded-2xl border border-white/10 bg-zinc-900 pl-9 pr-4 font-display text-lg tracking-widest outline-none">
        {options.map((option) => <option key={option} value={option}>{option.toUpperCase()}</option>)}
      </select>
    </label>
  );
}

function KdsLane(props: {
  title: string; count: number; tone: string; orders: Order[]; now: number;
  bulkMode: boolean; selectedIds: string[]; setSelectedIds: (ids: string[]) => void;
  onOpen: (order: Order) => void; onStart: (order: Order) => void; onReady: (order: Order) => void; onDelay: (order: Order) => void; onCancel: (order: Order) => void; onPrint: (order: Order, kind: "kot" | "bill") => void;
}) {
  return (
    <section className={`min-h-[calc(100vh-260px)] rounded-[20px] border ${props.tone} bg-zinc-950/80 p-3`}>
      <header className="mb-3 flex items-center justify-between px-2">
        <h2 className="font-display text-4xl tracking-wide">{props.title}</h2>
        <span className="grid h-12 min-w-12 place-items-center rounded-2xl bg-white text-2xl font-black text-black">{props.count}</span>
      </header>
      <div className="space-y-3">
        {props.orders.map((order) => (
          <OrderCard key={order.id} {...props} order={order} />
        ))}
        {props.orders.length === 0 && <div className="grid h-48 place-items-center rounded-[20px] border border-dashed border-white/10 text-zinc-600"><Utensils className="h-10 w-10" /></div>}
      </div>
    </section>
  );
}

function OrderCard({
  order,
  now,
  bulkMode,
  selectedIds,
  setSelectedIds,
  onOpen,
  onStart,
  onReady,
  onDelay,
  onCancel,
  onPrint,
}: {
  order: Order; now: number; bulkMode: boolean; selectedIds: string[]; setSelectedIds: (ids: string[]) => void;
  onOpen: (order: Order) => void; onStart: (order: Order) => void; onReady: (order: Order) => void; onDelay: (order: Order) => void; onCancel: (order: Order) => void; onPrint: (order: Order, kind: "kot" | "bill") => void;
}) {
  const m = meta(order);
  const elapsed = elapsedMinutes(order, now);
  const tone = timerTone(elapsed);
  const overdue = isOverdue(order, now);
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);
  const pressTimer = useRef<number | null>(null);
  const selected = selectedIds.includes(order.id);

  function pointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    pressTimer.current = window.setTimeout(() => onOpen(order), 650);
  }
  function pointerMove(e: React.PointerEvent) {
    if (startX.current === null) return;
    const x = Math.max(-120, Math.min(120, e.clientX - startX.current));
    setDragX(x);
  }
  function pointerUp() {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    if (dragX > 85) onReady(order);
    if (dragX < -85) onDelay(order);
    startX.current = null;
    setDragX(0);
  }

  return (
    <article
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      style={{ transform: `translateX(${dragX}px)` }}
      className={`touch-none rounded-[20px] border bg-zinc-900 p-4 shadow-2xl transition-transform ${overdue ? "animate-pulse border-red-500 shadow-red-950/70" : "border-white/10"} ${selected ? "ring-4 ring-yellow-400" : ""}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <button onClick={() => onOpen(order)} className="font-display text-4xl tracking-wide text-white">#{order.id}</button>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge label={order.paymentStatus.toUpperCase()} tone={order.paymentStatus === "paid" ? "bg-emerald-400 text-black" : "bg-yellow-400 text-black"} />
            <TypeBadge order={order} />
            <Badge label={(m.priority || "normal").toUpperCase()} tone={priorityTone(m.priority)} />
            <Badge label={m.station || inferStation(order)} tone="bg-zinc-700 text-white" />
          </div>
        </div>
        <div className={`rounded-2xl px-3 py-2 text-right font-mono text-2xl font-black ${tone}`}>
          {formatTimer(order, now)}
          <div className="font-sans text-[10px] uppercase tracking-widest text-zinc-400">{new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      </header>

      <ContextBlock order={order} />

      <ul className="mt-4 divide-y divide-white/10 rounded-2xl bg-black/35 px-4 text-2xl font-black">
        {order.items.map((item) => (
          <li key={item.id} className="py-3">
            <span className="text-red-400">{item.qty}x</span> {item.name}
          </li>
        ))}
      </ul>

      {order.customer.notes && <div className="mt-3 rounded-2xl border border-orange-400/50 bg-orange-500/15 p-3 text-xl font-bold text-orange-200">NOTE: {order.customer.notes}</div>}
      {m.delayReason && <div className="mt-3 rounded-2xl border border-red-400/60 bg-red-500/15 p-3 text-xl font-bold text-red-200">DELAY: {m.delayReason} +{m.delayExtraMinutes || 0}m</div>}

      <footer className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-5">
        {bulkMode ? (
          <button onClick={() => setSelectedIds(selected ? selectedIds.filter((id) => id !== order.id) : [...selectedIds, order.id])} className={`col-span-2 min-h-16 rounded-2xl font-display text-2xl ${selected ? "bg-yellow-400 text-black" : "bg-zinc-700 text-white"}`}>{selected ? "SELECTED" : "SELECT"}</button>
        ) : (
          <>
            <ActionButton icon={Flame} label={order.status === "received" ? "Start" : "Cooking"} color="bg-orange-500 text-black" onClick={() => onStart(order)} />
            <ActionButton icon={CheckCircle2} label="Ready" color="bg-emerald-500 text-black" onClick={() => onReady(order)} />
            <ActionButton icon={HelpCircle} label="Help" color="bg-yellow-400 text-black" onClick={() => onDelay(order)} />
            <ActionButton icon={PauseCircle} label="Delay" color="bg-red-500 text-white" onClick={() => onDelay(order)} />
            <ActionButton icon={XCircle} label="Cancel" color="bg-zinc-700 text-white" onClick={() => onCancel(order)} />
            <button onClick={() => onPrint(order, "kot")} className="col-span-2 min-h-14 rounded-2xl border border-white/10 bg-black/40 font-display text-xl tracking-widest xl:col-span-5"><Printer className="mr-2 inline h-5 w-5" /> PRINT KOT</button>
          </>
        )}
      </footer>
    </article>
  );
}

function ContextBlock({ order }: { order: Order }) {
  const m = meta(order);
  if (order.type === "dinein") {
    return (
      <div className="mt-4 grid grid-cols-3 gap-2 text-lg font-bold">
        <Info label="TABLE" value={order.tableNumber || "TABLE"} tone="text-orange-300" />
        <Info label="CAPTAIN" value={m.captainName || "Ravi"} />
        <Info label="GUESTS" value={m.guestCount ? `${m.guestCount}` : "4"} />
      </div>
    );
  }
  if (order.type === "pickup") {
    return (
      <div className="mt-4 grid grid-cols-2 gap-2 text-lg font-bold">
        <Info label="CUSTOMER" value={order.customer.name} tone="text-purple-300" />
        <Info label="TOKEN" value={m.pickupToken || order.id.slice(-4)} />
      </div>
    );
  }
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 text-lg font-bold">
      <Info label="CUSTOMER" value={order.customer.name} tone="text-cyan-300" />
      <Info label="PHONE" value={order.customer.phone} />
      <Info label="ADDRESS" value={order.customer.address || "Counter"} />
      <Info label="PICKUP" value={m.expectedPickup || `${m.prepEtaMinutes || m.etaMinutes || 20} min`} />
    </div>
  );
}

function Info({ label, value, tone = "text-white" }: { label: string; value: string; tone?: string }) {
  return <div className="rounded-2xl bg-black/30 p-3"><div className="text-[10px] tracking-[0.25em] text-zinc-500">{label}</div><div className={`truncate ${tone}`}>{value}</div></div>;
}

function ActionButton({ icon: Icon, label, color, onClick }: { icon: React.ElementType; label: string; color: string; onClick: () => void }) {
  return <button onClick={onClick} className={`min-h-16 rounded-2xl px-3 font-display text-xl tracking-widest ${color}`}><Icon className="mx-auto mb-1 h-5 w-5" />{label}</button>;
}

function Badge({ label, tone }: { label: string; tone: string }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-black tracking-widest ${tone}`}>{label}</span>;
}

function TypeBadge({ order }: { order: Order }) {
  const table = order.type === "dinein" && order.tableNumber;
  const label = table ? `TABLE ${order.tableNumber}` : order.type.toUpperCase();
  const tone = table ? "bg-orange-400 text-black" : order.type === "delivery" ? "bg-cyan-400 text-black" : order.type === "pickup" ? "bg-purple-400 text-black" : "bg-emerald-400 text-black";
  return <Badge label={label} tone={tone} />;
}

function NewOrderPopup({ order, queued, onAccept, onReject }: { order: Order; queued: number; onAccept: () => void; onReject: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-md">
      <div className="w-full max-w-2xl animate-[kds-pop_.55s_cubic-bezier(.2,1.4,.2,1)] rounded-[32px] border-2 border-red-500 bg-white/10 p-6 shadow-[0_0_90px_rgba(239,68,68,.6)] backdrop-blur-xl">
        <div className="text-center">
          <div className="animate-pulse font-display text-5xl tracking-widest text-red-400">NEW ORDER</div>
          <div className="mt-2 font-display text-7xl text-white">#{order.id}</div>
          <div className="mt-2 flex justify-center gap-2"><TypeBadge order={order} /><Badge label={order.paymentStatus.toUpperCase()} tone="bg-emerald-400 text-black" /></div>
          {queued > 1 && <div className="mt-3 font-display text-2xl text-yellow-300">+{queued - 1} MORE WAITING</div>}
        </div>
        <div className="mt-6 rounded-[24px] bg-black/45 p-5">
          <div className="text-xl font-bold text-zinc-300">Customer</div>
          <div className="font-display text-4xl">{order.customer.name}</div>
          <ul className="mt-4 space-y-3 text-3xl font-black">
            {order.items.map((item) => <li key={item.id}><span className="text-red-400">{item.qty}x</span> {item.name}</li>)}
          </ul>
          {order.customer.notes && <div className="mt-4 rounded-2xl bg-orange-500/20 p-3 text-2xl font-black text-orange-200">{order.customer.notes}</div>}
        </div>
        <SwipeAccept onComplete={onAccept} />
        <button onClick={onReject} className="mt-4 min-h-14 w-full rounded-2xl border border-red-400/50 text-xl font-black text-red-200">CANCEL ORDER</button>
      </div>
    </div>
  );
}

function SwipeAccept({ onComplete }: { onComplete: () => void }) {
  const [x, setX] = useState(0);
  const dragging = useRef(false);
  const railRef = useRef<HTMLDivElement | null>(null);

  function update(clientX: number) {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect) return;
    setX(Math.max(0, Math.min(rect.width - 74, clientX - rect.left - 37)));
  }

  function done() {
    const rect = railRef.current?.getBoundingClientRect();
    dragging.current = false;
    if (rect && x > rect.width - 120) onComplete();
    setX(0);
  }

  return (
    <div ref={railRef} className="relative mt-6 h-20 rounded-full bg-zinc-950 p-2">
      <div className="absolute inset-0 grid place-items-center font-display text-3xl tracking-widest text-zinc-300">SWIPE TO ACCEPT</div>
      <div className="absolute inset-y-2 left-2 rounded-full bg-emerald-500/30" style={{ width: x + 74 }} />
      <button
        style={{ transform: `translateX(${x}px)` }}
        onPointerDown={(e) => { dragging.current = true; update(e.clientX); }}
        onPointerMove={(e) => dragging.current && update(e.clientX)}
        onPointerUp={done}
        className="absolute left-2 top-2 grid h-16 w-16 touch-none place-items-center rounded-full bg-emerald-400 text-black shadow-xl"
      >
        <Check className="h-9 w-9" />
      </button>
    </div>
  );
}

function PrepTimeSheet({ order, onClose, onSelect }: { order: Order; onClose: () => void; onSelect: (minutes: number) => void }) {
  const [custom, setCustom] = useState(35);
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm">
      <div className="w-full rounded-t-[32px] border-t border-white/10 bg-zinc-950 p-6">
        <div className="flex items-center justify-between">
          <div><h2 className="font-display text-5xl">Select Preparation Time</h2><p className="text-zinc-400">Order #{order.id}</p></div>
          <button onClick={onClose} className="grid h-14 w-14 place-items-center rounded-2xl bg-zinc-800"><X className="h-7 w-7" /></button>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3 md:grid-cols-5">
          {PREP_OPTIONS.map((min) => <button key={min} onClick={() => onSelect(min)} className="min-h-24 rounded-3xl bg-emerald-500 font-display text-4xl text-black">{min}<span className="ml-1 text-xl">min</span></button>)}
          <div className="rounded-3xl bg-zinc-900 p-3">
            <input type="number" value={custom} onChange={(e) => setCustom(Number(e.target.value))} className="h-12 w-full rounded-xl bg-black px-3 text-center text-2xl" />
            <button onClick={() => onSelect(custom)} className="mt-2 h-12 w-full rounded-xl bg-yellow-400 font-display text-xl text-black">CUSTOM</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DelayDialog({ order, onClose, onDelay }: { order: Order; onClose: () => void; onDelay: (reason: string, minutes: number) => void }) {
  const [reason, setReason] = useState(DELAY_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [minutes, setMinutes] = useState(10);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur">
      <div className="w-full max-w-xl rounded-[28px] border border-red-400/50 bg-zinc-950 p-5">
        <div className="flex items-center justify-between"><h2 className="font-display text-5xl text-red-300">Delay Order</h2><button onClick={onClose}><X className="h-8 w-8" /></button></div>
        <p className="text-zinc-400">Order #{order.id}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {DELAY_REASONS.map((r) => <button key={r} onClick={() => setReason(r)} className={`min-h-16 rounded-2xl font-display text-xl ${reason === r ? "bg-red-500 text-white" : "bg-zinc-800"}`}>{r}</button>)}
        </div>
        {reason === "Custom" && <input value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder="Custom reason" className="mt-3 h-14 w-full rounded-2xl bg-zinc-900 px-4 text-xl outline-none" />}
        <div className="mt-5 grid grid-cols-4 gap-3">
          {DELAY_TIMES.map((m) => <button key={m} onClick={() => setMinutes(m)} className={`min-h-16 rounded-2xl font-display text-2xl ${minutes === m ? "bg-yellow-400 text-black" : "bg-zinc-800"}`}>+{m}</button>)}
        </div>
        <button onClick={() => onDelay(reason === "Custom" ? customReason || "Custom" : reason, minutes)} className="mt-5 min-h-16 w-full rounded-2xl bg-red-500 font-display text-2xl tracking-widest">NOTIFY DELAY</button>
      </div>
    </div>
  );
}

function SoundSettingsPanel({ settings, setSettings, onClose, onTest }: { settings: KdsSettings; setSettings: (s: KdsSettings) => void; onClose: () => void; onTest: () => void }) {
  function upload(file: File) {
    const reader = new FileReader();
    reader.onload = () => setSettings({ ...settings, soundKind: "custom", customSound: String(reader.result) });
    reader.readAsDataURL(file);
  }
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur">
      <aside className="h-full w-full max-w-md overflow-y-auto bg-zinc-950 p-5">
        <div className="flex items-center justify-between"><h2 className="font-display text-5xl">Sound</h2><button onClick={onClose}><X className="h-8 w-8" /></button></div>
        <div className="mt-5 space-y-4">
          <ToggleRow label="Enable Sound" checked={settings.soundOn} onChange={(v) => setSettings({ ...settings, soundOn: v })} />
          <ToggleRow label="Voice Announcement" checked={settings.voiceOn} onChange={(v) => setSettings({ ...settings, voiceOn: v })} />
          <SelectRow label="Bell" value={settings.soundKind} options={["school", "kitchen", "restaurant", "alarm", "custom"]} onChange={(v) => setSettings({ ...settings, soundKind: v as SoundKind })} />
          <SelectRow label="Language" value={settings.language} options={["en-US", "hi-IN", "te-IN"]} onChange={(v) => setSettings({ ...settings, language: v as Language })} />
          <RangeRow label="Volume" value={settings.volume} min={0.1} max={1} step={0.1} onChange={(v) => setSettings({ ...settings, volume: v })} />
          <RangeRow label="Repeat Seconds" value={settings.repeatInterval} min={2} max={20} step={1} onChange={(v) => setSettings({ ...settings, repeatInterval: v })} />
          <label className="block rounded-2xl bg-zinc-900 p-4">
            <span className="font-display text-xl">Custom Upload</span>
            <input type="file" accept="audio/*" className="mt-3 block w-full text-sm" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          <button onClick={onTest} className="min-h-16 w-full rounded-2xl bg-emerald-400 font-display text-2xl text-black"><BellRing className="mr-2 inline h-6 w-6" /> TEST SOUND</button>
        </div>
      </aside>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex items-center justify-between rounded-2xl bg-zinc-900 p-4 text-xl font-bold"><span>{label}</span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /></label>;
}

function SelectRow({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return <label className="block rounded-2xl bg-zinc-900 p-4"><span className="font-display text-xl">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 h-12 w-full rounded-xl bg-black px-3 text-xl">{options.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>;
}

function RangeRow({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return <label className="block rounded-2xl bg-zinc-900 p-4"><span className="font-display text-xl">{label}: {value}</span><input type="range" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} className="mt-3 w-full" /></label>;
}

function OrderDetails({ order, onClose, onPrint }: { order: Order; onClose: () => void; onPrint: (order: Order, kind: "kot" | "bill") => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-zinc-950 p-5">
        <div className="flex items-center justify-between"><h2 className="font-display text-5xl">#{order.id}</h2><button onClick={onClose}><X className="h-8 w-8" /></button></div>
        <ContextBlock order={order} />
        <ul className="mt-5 divide-y divide-white/10 rounded-2xl bg-black/40 p-4 text-2xl font-black">{order.items.map((item) => <li key={item.id} className="py-3">{item.qty}x {item.name}</li>)}</ul>
        <div className="mt-5 grid grid-cols-2 gap-3"><button onClick={() => onPrint(order, "kot")} className="min-h-16 rounded-2xl bg-zinc-800 font-display text-2xl">PRINT KOT</button><button onClick={() => onPrint(order, "bill")} className="min-h-16 rounded-2xl bg-zinc-800 font-display text-2xl">PRINT BILL</button></div>
      </div>
    </div>
  );
}

function PrintOverlay({ job, onDone }: { job: PrintJob; onDone: () => void }) {
  const triggered = useRef(false);
  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;
    const id = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(id);
  }, [job.key]);
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/80 p-4">
      <div className="no-print absolute right-4 top-4 flex gap-2">
        <button onClick={() => window.print()} className="rounded-2xl bg-red-600 px-5 py-3 font-display text-xl">PRINT</button>
        <button onClick={onDone} className="rounded-2xl bg-zinc-800 px-5 py-3 font-display text-xl">DONE</button>
      </div>
      <div className="print-area"><KotBill order={job.order} kind={job.kind} /></div>
    </div>
  );
}

function usePersistentSettings(): [KdsSettings, (settings: KdsSettings) => void] {
  const [settings, setSettingsState] = useState<KdsSettings>(() => {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KDS_SETTINGS_KEY) || "{}") };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  function setSettings(next: KdsSettings) {
    setSettingsState(next);
    localStorage.setItem(KDS_SETTINGS_KEY, JSON.stringify(next));
  }
  return [settings, setSettings];
}

function playBell(settings: KdsSettings, audioRef: React.MutableRefObject<AudioContext | null>) {
  if (!settings.soundOn && settings.soundKind !== "alarm") return;
  if (settings.soundKind === "school") {
    const audio = new Audio(BUILT_IN_ORDER_SOUND);
    audio.volume = settings.volume;
    void audio.play().catch(() => undefined);
    return;
  }
  if (settings.soundKind === "custom" && settings.customSound) {
    const audio = new Audio(settings.customSound);
    audio.volume = settings.volume;
    void audio.play().catch(() => undefined);
    return;
  }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!audioRef.current) audioRef.current = new AC();
  const ctx = audioRef.current;
  if (ctx.state === "suspended") void ctx.resume();
  const patterns: Record<SoundKind, number[]> = {
    school: [880, 1175],
    kitchen: [880, 880, 1175],
    restaurant: [740, 988, 740, 988],
    alarm: [440, 660, 880, 660],
    custom: [880, 1175],
  };
  patterns[settings.soundKind].forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = settings.soundKind === "alarm" ? "sawtooth" : "square";
    osc.frequency.value = freq;
    osc.connect(gain).connect(ctx.destination);
    const start = ctx.currentTime + index * 0.18;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.01, settings.volume * 0.22), start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    osc.start(start);
    osc.stop(start + 0.18);
  });
}

function playSuccess(settings: KdsSettings, audioRef: React.MutableRefObject<AudioContext | null>) {
  playBell({ ...settings, soundKind: "kitchen", soundOn: true, volume: Math.min(1, settings.volume) }, audioRef);
}

function speakOrder(order: Order, settings: KdsSettings) {
  if (!settings.voiceOn || !("speechSynthesis" in window)) return;
  const text = `New ${order.type} order. Order ${order.id.split("").join(" ")}. ${order.items.length} items. ${order.items.slice(0, 3).map((i) => `${i.qty} ${i.name}`).join(". ")}`;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = settings.language;
  utterance.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function loadPrinted(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(PRINTED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function savePrinted(set: Set<string>) {
  sessionStorage.setItem(PRINTED_KEY, JSON.stringify([...set]));
}

function meta(order: Order): DeliveryDetails {
  return order.delivery ?? {};
}

function inferStation(order: Order) {
  const text = order.items.map((item) => item.name).join(" ").toLowerCase();
  if (text.includes("biryani") || text.includes("rice")) return "Biryani";
  if (text.includes("naan") || text.includes("tandoor")) return "Tandoor";
  if (text.includes("tea")) return "Tea";
  if (text.includes("dessert") || text.includes("gulab")) return "Dessert";
  if (text.includes("starter") || text.includes("65")) return "Starter";
  return "Main Course";
}

function elapsedMinutes(order: Order, now: number) {
  const base = meta(order).startedAt || meta(order).acceptedAt || order.createdAt;
  return Math.max(0, Math.floor((now - new Date(base).getTime()) / 60000));
}

function formatTimer(order: Order, now: number) {
  const sec = Math.max(0, Math.floor((now - new Date(meta(order).startedAt || meta(order).acceptedAt || order.createdAt).getTime()) / 1000));
  return `${Math.floor(sec / 60).toString().padStart(2, "0")}:${(sec % 60).toString().padStart(2, "0")}`;
}

function timerTone(minutes: number) {
  if (minutes < 10) return "bg-emerald-400 text-black";
  if (minutes < 20) return "bg-yellow-400 text-black";
  if (minutes < 30) return "bg-orange-500 text-black";
  return "bg-red-600 text-white";
}

function isOverdue(order: Order, now: number) {
  const eta = meta(order).prepEtaMinutes || meta(order).etaMinutes;
  if (!eta) return elapsedMinutes(order, now) >= 30;
  return elapsedMinutes(order, now) > eta;
}

function priorityTone(priority?: string) {
  if (priority === "vip") return "bg-red-500 text-white";
  if (priority === "express") return "bg-yellow-400 text-black";
  if (priority === "scheduled") return "bg-blue-400 text-black";
  return "bg-zinc-600 text-white";
}

function matchesFilters(order: Order, query: string, type: string, priority: string, station: string) {
  const m = meta(order);
  const q = query.trim().toLowerCase();
  const haystack = [order.id, order.customer.name, order.customer.phone, order.customer.address, order.tableNumber, ...order.items.map((i) => i.name)].filter(Boolean).join(" ").toLowerCase();
  if (q && !haystack.includes(q)) return false;
  if (type !== "all" && order.type !== type) return false;
  if (priority !== "all" && (m.priority || "normal") !== priority) return false;
  if (station !== "all" && (m.station || inferStation(order)) !== station) return false;
  return true;
}

function computeAnalytics(orders: Order[], now: number) {
  const today = new Date().toDateString();
  const todays = orders.filter((o) => new Date(o.createdAt).toDateString() === today);
  const pending = orders.filter((o) => o.status === "received").length;
  const preparing = orders.filter((o) => ["accepted", "preparing"].includes(o.status)).length;
  const ready = orders.filter((o) => o.status === "ready").length;
  const delayed = orders.filter((o) => meta(o).delayReason).length;
  const completed = todays.filter((o) => o.status === "delivered" || o.status === "ready");
  const prepTimes = completed.map((o) => elapsedMinutes(o, now)).filter((m) => Number.isFinite(m));
  const avgPrep = prepTimes.length ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length) : 0;
  return { pending, preparing, ready, delayed, avgPrep, load: pending + preparing + ready, todays: todays.length };
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
