/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BadgeIndianRupee,
  Bike,
  CheckCircle2,
  CircleDot,
  Clock3,
  IndianRupee,
  LocateFixed,
  LogOut,
  ShieldCheck,
  Star,
  Timer,
} from "lucide-react";
import type { DeliveryLocation, DeliveryProfile, Order } from "@/services/api";
import { greeting } from "./delivery-utils";

export function RiderHero({
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

export function DashboardMetrics({
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

export function CommandHeader({
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

export function MetricCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: any; tone: string }) {
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

export function MiniStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/35 p-3">
      <Icon className="mb-2 h-4 w-4 text-orange-200" />
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-black">{value}</p>
    </div>
  );
}

export function DarkInfo({
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

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950/45 px-3 text-sm font-bold text-white outline-none focus:border-orange-300"
      />
    </label>
  );
}

export function StatusPill({ tone, children }: { tone: "green" | "orange" | "slate"; children: any }) {
  const colors = {
    green: "bg-emerald-400/15 text-emerald-200 border-emerald-300/20",
    orange: "bg-orange-400/15 text-orange-200 border-orange-300/20",
    slate: "bg-slate-500/15 text-slate-200 border-white/10",
  };
  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${colors[tone]}`}>{children}</span>;
}

export function StageBadge({ order }: { order: Order }) {
  const stage = order.delivery?.deliveryStage || order.status;
  const label = String(stage).replace(/_/g, " ");
  const tone = order.status === "delivered" ? "green" : order.status === "ready" ? "orange" : "slate";
  return <StatusPill tone={tone}>{label}</StatusPill>;
}

export function EmptyState({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="rounded-[28px] border border-dashed border-white/15 bg-white/[0.04] p-6 text-center">
      <Icon className="mx-auto h-10 w-10 text-orange-200" />
      <h3 className="mt-3 text-xl font-black">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">{text}</p>
    </div>
  );
}

export function DeliveryGate({ title, subtitle }: { title: string; subtitle?: string }) {
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
