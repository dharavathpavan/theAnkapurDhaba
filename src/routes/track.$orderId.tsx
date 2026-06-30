import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Bike,
  CheckCircle2,
  ChefHat,
  Clock3,
  Download,
  Headphones,
  Home,
  MapPin,
  PackageCheck,
  Phone,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Star,
  Store,
  Truck,
  Wallet,
  XCircle,
} from "lucide-react";
import { getCustomerHome, getOrder, type CustomerBanner, type DeliveryDetails, type Order, type OrderStatus } from "@/services/api";
import { useOrderRealtime } from "@/hooks/use-order-realtime";
import { DeliveryMap } from "@/components/site/DeliveryMap";
import { clearActiveOrder, saveActiveOrder } from "@/stores/active-order";

export const Route = createFileRoute("/track/$orderId")({
  head: ({ params }) => ({ meta: [{ title: `Order ${params.orderId} - Ankapur Dhaba` }] }),
  component: TrackRedirect,
});

const STEPS: Array<{ key: OrderStatus; label: string; desc: string; icon: React.ElementType }> = [
  { key: "received", label: "Received", desc: "Order placed", icon: ReceiptText },
  { key: "accepted", label: "Accepted", desc: "Kitchen accepted", icon: CheckCircle2 },
  { key: "preparing", label: "Preparing", desc: "Cooking now", icon: ChefHat },
  { key: "ready", label: "Ready", desc: "Packed and waiting", icon: PackageCheck },
  { key: "out_for_delivery", label: "On the way", desc: "Rider picked up", icon: Bike },
  { key: "delivered", label: "Delivered", desc: "Enjoy your meal", icon: Home },
];

function TrackRedirect() {
  const { orderId } = Route.useParams();
  return <Navigate to="/orders/$orderId" params={{ orderId }} replace />;
}

export function OrderTrackingView({ orderId }: { orderId: string }) {
  const [mounted, setMounted] = useState(false);
  useOrderRealtime(orderId);
  const { data: order, isLoading } = useQuery({ queryKey: ["order", orderId], queryFn: () => getOrder(orderId), refetchInterval: 5000 });
  const { data: homeContent } = useQuery({ queryKey: ["customer-home"], queryFn: getCustomerHome, staleTime: 30_000 });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!order) return;
    if (["delivered", "cancelled"].includes(order.status)) clearActiveOrder(order.id);
    else saveActiveOrder(order.id);
  }, [order]);

  if (!mounted || isLoading) return <TrackingSkeleton />;
  if (!order) return <NotFound orderId={orderId} />;

  const stage = currentStage(order);
  const isDone = order.status === "delivered";
  const isCancelled = order.status === "cancelled";

  return (
    <div className="mx-auto max-w-6xl px-3 pb-28 pt-3 sm:px-4 md:px-6 md:py-8">
      <section className={`overflow-hidden rounded-[30px] p-5 text-white shadow-xl md:p-7 ${isDone ? "bg-gradient-to-br from-green-600 to-emerald-900" : isCancelled ? "bg-gradient-to-br from-zinc-700 to-zinc-950" : "bg-gradient-to-br from-red-600 via-red-700 to-zinc-950"}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-white/65">Live order</div>
            <h1 className="mt-1 truncate text-3xl font-black md:text-5xl">#{order.id}</h1>
            <p className="mt-1 text-sm text-white/80 md:text-base">{stage.label} - {stage.desc}</p>
          </div>
          <div className="shrink-0 rounded-[24px] bg-white/15 px-4 py-3 text-center backdrop-blur">
            <div className="text-[11px] font-bold text-white/65">ETA</div>
            <div className="text-2xl font-black">{bestEta(order)}</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 md:gap-3">
          <HeroStat label="Type" value={order.tableNumber ? `Table ${order.tableNumber}` : order.type} />
          <HeroStat label="Total" value={`₹${order.total}`} />
        </div>
      </section>

      {isDone && <CompletionCard />}
      {isCancelled && <CancelledCard />}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_380px]">
        <main className="space-y-4">
          {order.type === "delivery" ? (
            <section className="overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-zinc-100">
              <div className="flex items-center justify-between gap-3 p-4">
                <div>
                  <h2 className="text-xl font-black">Live delivery map</h2>
                  <p className="text-sm text-zinc-500">{order.delivery?.lastLocationAt ? "Delivery partner location is live" : "Waiting for rider GPS after pickup"}</p>
                </div>
                <span className={`rounded-2xl px-3 py-2 text-xs font-black ${order.delivery?.lastLocationAt ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                  {order.delivery?.lastLocationAt ? "LIVE" : "WAITING"}
                </span>
              </div>
              <DeliveryMap order={order} premium />
            </section>
          ) : (
            <PickupDineInCard order={order} />
          )}

          <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-zinc-100">
            <h2 className="text-xl font-black">Order journey</h2>
            <Timeline order={order} />
          </section>

          <OrderDetails order={order} />
        </main>

        <aside className="space-y-4">
          <PartnerCard order={order} />
          <HelpCard order={order} />
        </aside>
      </div>

      <TrackingAdSpace banners={homeContent?.banners ?? []} />
    </div>
  );
}

function Timeline({ order }: { order: Order }) {
  const idx = order.status === "cancelled" ? -1 : STEPS.findIndex((step) => step.key === order.status);
  const progress = idx <= 0 ? 0 : (idx / (STEPS.length - 1)) * 100;
  return (
    <div className="mt-5 overflow-x-auto pb-1">
      <ol className="relative grid min-w-[720px] grid-cols-6 gap-2 px-1 pt-2">
        <div className="absolute left-[8%] right-[8%] top-8 h-2 rounded-full bg-zinc-100" />
        <div
          className="absolute left-[8%] top-8 h-2 rounded-full bg-gradient-to-r from-red-600 via-orange-500 to-green-500 transition-all duration-700 ease-out"
          style={{ width: `calc(${progress}% * 0.84)` }}
        />
        {STEPS.map((step, i) => {
          const done = i <= idx;
          const active = i === idx;
          const Icon = step.icon;
          return (
            <li key={step.key} className="relative z-10 flex flex-col items-center text-center">
              <div className={`grid h-14 w-14 place-items-center rounded-full shadow-sm transition duration-500 ${done ? "bg-red-600 text-white" : "bg-white text-zinc-400 ring-2 ring-zinc-100"} ${active ? "animate-pulse ring-4 ring-red-100" : ""}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div className={`mt-3 text-sm font-black ${active ? "text-red-600" : done ? "text-zinc-950" : "text-zinc-400"}`}>{step.label}</div>
              <div className="mt-1 max-w-24 text-xs leading-snug text-zinc-500">{step.desc}</div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function PartnerCard({ order }: { order: Order }) {
  const d = order.delivery || {};
  const assigned = Boolean(d.partnerName || d.partnerPhone || d.vehicleNumber);
  return (
    <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-zinc-100">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black">Delivery partner</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${assigned ? "bg-green-50 text-green-700" : "bg-zinc-100 text-zinc-500"}`}>{assigned ? "Assigned" : "Pending"}</span>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div className="grid h-14 w-14 place-items-center rounded-3xl bg-green-100 text-green-700"><Bike className="h-7 w-7" /></div>
        <div className="min-w-0">
          <div className="truncate font-black">{order.type === "delivery" ? (d.partnerName || "Assigning soon") : "Not required"}</div>
          <div className="text-sm text-zinc-500">{d.vehicleNumber || "Vehicle updates after pickup"}</div>
          <div className="text-xs text-zinc-400">{d.trackingPaused ? "GPS paused" : d.lastLocationAt ? "GPS active" : "GPS waiting"}</div>
        </div>
      </div>
      {d.partnerPhone && <a href={`tel:${d.partnerPhone}`} className="mt-4 flex min-h-12 items-center justify-center rounded-2xl bg-green-600 font-black text-white"><Phone className="mr-2 h-5 w-5" /> Call partner</a>}
    </section>
  );
}

function EtaCard({ order }: { order: Order }) {
  const d = order.delivery || {};
  return (
    <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-zinc-100">
      <h2 className="text-xl font-black">ETA details</h2>
      <div className="mt-4 grid gap-3">
        <EtaRow icon={Clock3} label="Estimated arrival" value={bestEta(order)} />
        <EtaRow icon={ChefHat} label="Kitchen prep" value={`${d.prepEtaMinutes || 15} min`} />
        <EtaRow icon={Truck} label="Delivery ETA" value={`${d.etaMinutes || 30} min`} />
        <EtaRow icon={MapPin} label="Last GPS" value={d.lastLocationAt ? new Date(d.lastLocationAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Not started"} />
      </div>
    </section>
  );
}

function PaymentCard({ order }: { order: Order }) {
  return (
    <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-zinc-100">
      <h2 className="text-xl font-black">Payment</h2>
      <div className="mt-4 grid gap-3">
        <EtaRow icon={Wallet} label="Method" value={order.paymentMethod.toUpperCase()} />
        <EtaRow icon={ShieldCheck} label="Status" value={order.paymentStatus.replace(/_/g, " ")} />
        <EtaRow icon={ReceiptText} label="Order total" value={`₹${order.total}`} />
      </div>
    </section>
  );
}

function OrderDetails({ order }: { order: Order }) {
  return (
    <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-zinc-100">
      <h2 className="text-xl font-black">Order details</h2>
      <div className="mt-4 rounded-3xl bg-zinc-50 p-4">
        <div className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Customer</div>
        <div className="mt-1 font-black">{order.customer.name}</div>
        <div className="text-sm text-zinc-500">{order.customer.phone}</div>
        {order.customer.address && <div className="mt-2 text-sm text-zinc-600">{order.customer.address}</div>}
        {order.customer.notes && <div className="mt-2 rounded-2xl bg-white p-3 text-sm text-zinc-600">Note: {order.customer.notes}</div>}
      </div>
      <ul className="mt-4 divide-y divide-zinc-100">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 py-3">
            <span className="min-w-0 text-zinc-600"><span className="font-black text-zinc-950">{item.qty}x</span> {item.name}</span>
            <span className="shrink-0 font-black">₹{item.price * item.qty}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-2 border-t border-zinc-100 pt-4 text-sm">
        <PriceRow label="Subtotal" value={order.subtotal} />
        <PriceRow label="GST" value={order.tax} />
        <PriceRow label="Delivery" value={order.deliveryFee} />
        <div className="flex justify-between pt-2 text-lg font-black"><span>Grand total</span><span className="text-red-600">₹{order.total}</span></div>
      </div>
    </section>
  );
}

function PickupDineInCard({ order }: { order: Order }) {
  const m = order.delivery || {};
  return (
    <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-zinc-100">
      <h2 className="text-xl font-black">{order.type === "pickup" ? "Pickup details" : "Dine-in status"}</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <EtaRow icon={Store} label={order.type === "pickup" ? "Token" : "Table"} value={m.pickupToken || order.tableNumber || "Updating"} />
        <EtaRow icon={Clock3} label="Ready in" value={`${m.prepEtaMinutes || m.etaMinutes || 20} min`} />
        <EtaRow icon={ChefHat} label="Kitchen" value={order.status.replace(/_/g, " ")} />
      </div>
    </section>
  );
}

function HelpCard({ order }: { order: Order }) {
  return (
    <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-zinc-100">
      <h2 className="text-xl font-black">Need help?</h2>
      <div className="mt-4 grid gap-2">
        <a href="tel:+919000000000" className="flex min-h-12 items-center gap-3 rounded-2xl bg-zinc-100 px-4 font-black"><Phone className="h-5 w-5 text-red-600" /> Call restaurant</a>
        {order.delivery?.partnerPhone && <a href={`tel:${order.delivery.partnerPhone}`} className="flex min-h-12 items-center gap-3 rounded-2xl bg-zinc-100 px-4 font-black"><Bike className="h-5 w-5 text-green-600" /> Call rider</a>}
        <button className="flex min-h-12 items-center gap-3 rounded-2xl bg-zinc-100 px-4 font-black"><Headphones className="h-5 w-5 text-red-600" /> Support</button>
        <button className="flex min-h-12 items-center gap-3 rounded-2xl bg-zinc-100 px-4 font-black"><Download className="h-5 w-5 text-red-600" /> Invoice</button>
      </div>
    </section>
  );
}

function CompletionCard() {
  return <section className="mt-4 rounded-[28px] bg-green-50 p-5 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-green-600" /><h2 className="mt-3 text-2xl font-black">Delivered successfully</h2><p className="mt-1 text-zinc-600">Rate your food and reorder your favorites anytime.</p><div className="mt-4 flex justify-center gap-2"><Link to="/menu" className="rounded-2xl bg-green-600 px-4 py-3 font-black text-white"><RotateCcw className="mr-2 inline h-4 w-4" /> Reorder</Link><button className="rounded-2xl bg-white px-4 py-3 font-black text-green-700"><Star className="mr-2 inline h-4 w-4" /> Review</button></div></section>;
}

function CancelledCard() {
  return <section className="mt-4 rounded-[28px] bg-zinc-100 p-5 text-center"><XCircle className="mx-auto h-12 w-12 text-zinc-600" /><h2 className="mt-3 text-2xl font-black">Order cancelled</h2><p className="mt-1 text-zinc-600">Please contact the restaurant if you need help.</p></section>;
}

function TrackingAdSpace({ banners }: { banners: CustomerBanner[] }) {
  const ads = banners.filter((banner) => /ad|sponsor|brand/i.test(banner.type || ""));
  if (!ads.length) return null;
  return (
    <section className="mt-4 rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-zinc-100">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500">Sponsored</h2>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-500">Ad</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {ads.slice(0, 2).map((ad) => (
          <Link key={ad.id} to={(ad.ctaLink || "/menu") as never} className="group overflow-hidden rounded-[24px] bg-zinc-950 text-white">
            <div className="relative aspect-[16/7] overflow-hidden">
              <AdMedia src={ad.image} />
              <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/20 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-end p-4">
                <div className="text-xs font-black uppercase tracking-[0.2em] text-white/60">{ad.ctaLabel || "View offer"}</div>
                <div className="mt-1 line-clamp-1 text-xl font-black">{ad.title}</div>
                {ad.subtitle && <div className="line-clamp-1 text-sm text-white/75">{ad.subtitle}</div>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-3xl bg-white/15 p-3"><div className="text-[11px] text-white/60">{label}</div><div className="truncate text-sm font-black capitalize md:text-base">{value}</div></div>;
}

function EtaRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-2xl bg-zinc-50 p-3"><Icon className="h-5 w-5 shrink-0 text-red-600" /><div className="min-w-0"><div className="text-xs text-zinc-500">{label}</div><div className="truncate font-black capitalize">{value}</div></div></div>;
}

function LocationRow({ icon: Icon, label, title, text, sub }: { icon: React.ElementType; label: string; title: string; text: string; sub?: string }) {
  return <div className="rounded-3xl bg-zinc-50 p-4"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-red-600 shadow-sm"><Icon className="h-5 w-5" /></div><div className="min-w-0"><div className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">{label}</div><div className="mt-1 truncate font-black">{title}</div><div className="mt-1 text-sm text-zinc-600">{text}</div>{sub && <div className="mt-1 text-xs text-zinc-400">{sub}</div>}</div></div></div>;
}

function PriceRow({ label, value }: { label: string; value: number }) {
  return <div className="flex justify-between"><span className="text-zinc-500">{label}</span><span className="font-bold">₹{value}</span></div>;
}

function bestEta(order: Order) {
  if (order.status === "delivered") return "Done";
  if (order.status === "cancelled") return "--";
  const mins = order.delivery?.etaMinutes || order.delivery?.prepEtaMinutes || 20;
  return `${mins} min`;
}

function currentStage(order: Order) {
  return STEPS.find((step) => step.key === order.status) || STEPS[0];
}

function coords(lat?: number, lng?: number) {
  if (typeof lat !== "number" || typeof lng !== "number") return "";
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function lastUpdated(delivery: DeliveryDetails) {
  const at = delivery.lastLocationAt || delivery.currentLocation?.updatedAt;
  return at ? `Updated ${new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Waiting for live GPS";
}

function progressFromStatus(status: Order["status"]) {
  if (status === "delivered") return 1;
  if (status === "out_for_delivery") return 0.55;
  if (status === "ready") return 0.3;
  if (status === "preparing") return 0.2;
  if (status === "accepted") return 0.12;
  return 0.05;
}

function NotFound({ orderId }: { orderId: string }) {
  return <div className="mx-auto max-w-md px-4 py-20 text-center"><h1 className="text-3xl font-black">Order not found</h1><p className="mt-2 text-zinc-500">We could not find order {orderId}.</p><Link to="/orders" className="mt-6 inline-flex rounded-3xl bg-red-600 px-6 py-4 font-black text-white">View orders</Link></div>;
}

function TrackingSkeleton() {
  return <div className="mx-auto max-w-6xl space-y-4 px-3 py-3 sm:px-4 md:px-6 md:py-8"><div className="h-44 animate-pulse rounded-[30px] bg-zinc-200" /><div className="grid gap-4 lg:grid-cols-[1fr_380px]"><div className="h-96 animate-pulse rounded-[28px] bg-white" /><div className="h-80 animate-pulse rounded-[28px] bg-white" /></div></div>;
}

function AdMedia({ src }: { src: string }) {
  if (isVideo(src)) return <video src={src} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" muted autoPlay loop playsInline />;
  return <img src={src} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />;
}

function isVideo(url: string) {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}
