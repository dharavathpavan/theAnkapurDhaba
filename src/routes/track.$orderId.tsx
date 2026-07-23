import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bike,
  Check,
  CheckCircle2,
  ChefHat,
  Circle,
  Home,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Plus,
  RotateCcw,
  Star,
  TimerReset,
  Utensils,
  XCircle,
} from "lucide-react";
import {
  getCustomerHome,
  getOrder,
  type CustomerBanner,
  type Order,
  type OrderStatus,
} from "@/services/api";
import { useOrderRealtime } from "@/hooks/use-order-realtime";
import { imageFallback, isVideoUrl, resolveMediaUrl } from "@/lib/media";
import { DeliveryMap } from "@/components/site/DeliveryMap";
import { clearActiveOrder, saveActiveOrder } from "@/stores/active-order";

export const Route = createFileRoute("/track/$orderId")({
  head: ({ params }) => ({ meta: [{ title: `Order ${params.orderId} - Ankapur Dhaba` }] }),
  component: TrackRedirect,
});

type ProgressStep = {
  id: "placed" | "preparing" | "out_for_delivery" | "delivered";
  title: string;
  description: string;
  icon: React.ElementType;
};

const PROGRESS_STEPS: ProgressStep[] = [
  {
    id: "placed",
    title: "Order Placed",
    description: "Restaurant has accepted your order",
    icon: Check,
  },
  {
    id: "preparing",
    title: "Preparing Food",
    description: "Chef is working on your order",
    icon: Utensils,
  },
  {
    id: "out_for_delivery",
    title: "Out for Delivery",
    description: "Your delivery partner will pick it up soon",
    icon: Bike,
  },
  {
    id: "delivered",
    title: "Delivered",
    description: "Drop off at your location",
    icon: Home,
  },
];

function TrackRedirect() {
  const { orderId } = Route.useParams();
  return <Navigate to="/orders/$orderId" params={{ orderId }} replace />;
}

export function OrderTrackingView({ orderId }: { orderId: string }) {
  const [mounted, setMounted] = useState(false);
  useOrderRealtime(orderId);
  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => getOrder(orderId),
    refetchInterval: 5000,
  });
  const { data: homeContent } = useQuery({
    queryKey: ["customer-home"],
    queryFn: getCustomerHome,
    staleTime: 30_000,
  });

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

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f5f3f3] text-[#1b1c1c]">
      <TopControls />
      <main className="mx-auto w-full max-w-[640px] pb-28">
        <TrackingHero order={order} />
        <div className="-mt-7 space-y-4 px-4">
          <LiveTrackingCard order={order} />
          <DelayAlert order={order} />
          <ProgressCard order={order} />
          <ItemsOrderedCard order={order} />
          <WhileYouWaitAd banners={homeContent?.banners ?? []} />
          {order.status === "delivered" && <CompletionCard />}
          {order.status === "cancelled" && <CancelledCard />}
        </div>
      </main>
    </div>
  );
}

function TopControls() {
  return (
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-40 mx-auto flex h-16 max-w-[640px] items-center justify-between px-4">
      <button
        type="button"
        onClick={() => window.history.back()}
        className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-black/5 bg-white/90 text-zinc-950 shadow-sm backdrop-blur"
        aria-label="Go back"
      >
        <ArrowLeft className="h-6 w-6" />
      </button>
      <button
        type="button"
        className="pointer-events-auto grid h-11 w-11 place-items-center rounded-full border border-black/5 bg-white/90 text-zinc-950 shadow-sm backdrop-blur"
        aria-label="More order actions"
      >
        <MoreHorizontal className="h-6 w-6" />
      </button>
    </div>
  );
}

function TrackingHero({ order }: { order: Order }) {
  return (
    <section className="relative h-[390px] overflow-hidden bg-[#dbdad9] sm:h-[430px]">
      {order.type === "delivery" ? (
        <div className="absolute inset-0 opacity-95">
          <DeliveryMap order={order} compact premium bare />
        </div>
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,#ffffff_0,#dbdad9_45%,#cfcfce_100%)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-[#f5f3f3]" />
    </section>
  );
}

function LiveTrackingCard({ order }: { order: Order }) {
  const riderName =
    order.delivery?.partnerName || order.delivery?.assignedRiderName || "Delivery partner";
  const riderStatus = riderSubtext(order);
  const canCall = Boolean(order.delivery?.partnerPhone);
  return (
    <section className="relative z-10 rounded-[24px] bg-white p-5 shadow-[0_10px_35px_rgba(0,0,0,0.08)] ring-1 ring-zinc-100">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-red-600">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            Live tracking
          </div>
          <h1 className="mt-2 text-[22px] font-black leading-tight text-zinc-950">
            {headlineFor(order)}
          </h1>
          <p className="mt-1 truncate text-sm font-medium text-zinc-500">{riderStatus}</p>
        </div>
        <div className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-[18px] bg-zinc-950 text-center text-white shadow-lg">
          <span className="block text-2xl font-black leading-none">{etaNumber(order)}</span>
          <span className="mt-1 block text-[10px] font-black uppercase leading-none">min</span>
        </div>
      </div>

      <div className="my-5 h-px bg-zinc-100" />

      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-red-50">
          <Bike className="h-7 w-7 text-red-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black text-zinc-950">{riderName}</div>
          <div className="mt-0.5 flex items-center gap-1 text-xs font-medium text-zinc-500">
            <Star className="h-3.5 w-3.5 fill-[#FF8A00] text-[#FF8A00]" />
            <span>4.9</span>
            <span>•</span>
            <span>{order.type === "delivery" ? "Delivery Partner" : order.type}</span>
          </div>
        </div>
        <button
          type="button"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-700"
          aria-label="Message support"
        >
          <MessageSquare className="h-5 w-5" />
        </button>
        {canCall ? (
          <a
            href={`tel:${order.delivery?.partnerPhone}`}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-red-600 text-white shadow-lg shadow-red-600/20"
            aria-label="Call delivery partner"
          >
            <Phone className="h-5 w-5" />
          </a>
        ) : (
          <a
            href="tel:+919963218601"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-red-600 text-white shadow-lg shadow-red-600/20"
            aria-label="Call restaurant"
          >
            <Phone className="h-5 w-5" />
          </a>
        )}
      </div>

      <div className="my-5 h-px bg-zinc-100" />

      <button
        type="button"
        className="flex w-full items-center gap-3 text-left"
        aria-label="Add delivery instructions"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
          <Plus className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-black text-zinc-950">Add Delivery Instructions</span>
          <span className="block truncate text-xs font-medium text-zinc-500">
            Ring bell, leave at door...
          </span>
        </span>
      </button>
    </section>
  );
}

function DelayAlert({ order }: { order: Order }) {
  const delayed =
    Boolean(order.delivery?.delayReason) ||
    Boolean(order.delivery?.delayExtraMinutes) ||
    isOlderThan(order, 35);
  if (!delayed) return null;
  const minutes = order.delivery?.delayExtraMinutes || 5;
  return (
    <section className="flex items-center gap-4 rounded-[18px] bg-white p-4 shadow-sm ring-1 ring-zinc-100">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
        <TimerReset className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-red-600">
          Delayed by {minutes} mins
        </div>
        <p className="mt-1 text-sm font-semibold text-zinc-950">
          {order.delivery?.delayReason || "Get Rs 25 coupon after order delivery"}
        </p>
      </div>
    </section>
  );
}

function ProgressCard({ order }: { order: Order }) {
  const active = progressId(order.status);
  const badge = order.status === "cancelled" ? "Cancelled" : labelForStatus(order.status);
  return (
    <section className="rounded-[22px] bg-white p-6 shadow-sm ring-1 ring-zinc-100">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[22px] font-black text-zinc-950">Order Progress</h2>
        <span
          className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${order.status === "cancelled" ? "bg-zinc-100 text-zinc-500" : "bg-green-50 text-green-700"}`}
        >
          {badge}
        </span>
      </div>
      <ol className="mt-7 space-y-0">
        {PROGRESS_STEPS.map((step, index) => (
          <ProgressItem
            key={step.id}
            step={step}
            order={order}
            active={active === step.id}
            done={isStepDone(step.id, order.status)}
            isLast={index === PROGRESS_STEPS.length - 1}
          />
        ))}
      </ol>
    </section>
  );
}

function ProgressItem({
  step,
  order,
  active,
  done,
  isLast,
}: {
  step: ProgressStep;
  order: Order;
  active: boolean;
  done: boolean;
  isLast: boolean;
}) {
  const Icon = step.icon;
  return (
    <li className="grid grid-cols-[40px_1fr] gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`grid h-8 w-8 place-items-center rounded-full border-2 transition-all duration-500 ${
            done
              ? "border-green-500 bg-green-500 text-white"
              : active
                ? "animate-pulse border-red-600 bg-white text-red-600 ring-4 ring-red-50"
                : "border-zinc-200 bg-zinc-100 text-zinc-400"
          }`}
        >
          {done ? (
            <Check className="h-4 w-4" />
          ) : active ? (
            <Circle className="h-4 w-4" />
          ) : (
            <Icon className="h-4 w-4" />
          )}
        </div>
        {!isLast && <div className="h-16 w-px bg-zinc-200" />}
      </div>
      <div className={`${isLast ? "pb-0" : "pb-5"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className={`font-black ${active ? "text-red-600" : "text-zinc-950"}`}>
              {step.title}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">{stepDescription(step, order)}</p>
          </div>
          <span className="shrink-0 text-xs font-bold text-zinc-500">
            {active ? "In Progress" : done && step.id === "placed" ? placedTime(order) : ""}
          </span>
        </div>
        {active && step.id === "preparing" ? (
          <div className="mt-4 flex gap-3 rounded-2xl bg-zinc-100 p-4 text-sm font-medium text-zinc-600">
            <Utensils className="h-5 w-5 shrink-0 text-red-600" />
            <span>Ingredients are being sourced and prepped.</span>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function ItemsOrderedCard({ order }: { order: Order }) {
  return (
    <section className="rounded-[22px] bg-white p-6 shadow-sm ring-1 ring-zinc-100">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[22px] font-black text-zinc-950">Items Ordered</h2>
        <span className="max-w-[130px] truncate rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-500">
          #{order.id}
        </span>
      </div>
      <ul className="mt-6 space-y-4">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-600" />
              <div className="min-w-0">
                <p className="break-words text-base font-semibold text-zinc-950">
                  {item.qty} x {item.name}
                </p>
                {item.instructions ? (
                  <p className="mt-1 text-xs text-zinc-500">{item.instructions}</p>
                ) : null}
              </div>
            </div>
            <span className="shrink-0 font-black text-zinc-950">
              {money(item.price * item.qty)}
            </span>
          </li>
        ))}
      </ul>
      <div className="my-6 h-px bg-zinc-100" />
      <div className="flex items-center justify-between gap-4 text-lg font-black">
        <span>Total Bill</span>
        <span className="text-red-600">{money(order.total)}</span>
      </div>
    </section>
  );
}

function WhileYouWaitAd({ banners }: { banners: CustomerBanner[] }) {
  const ad = banners.find((banner) => /ad|sponsor|brand/i.test(banner.type || ""));
  if (ad) {
    return (
      <Link
        to={(ad.ctaLink || "/menu") as never}
        className="group block overflow-hidden rounded-[18px] bg-zinc-950 text-white shadow-sm"
      >
        <div className="relative min-h-[160px]">
          <AdMedia src={ad.image} />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-6">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
              While you wait
            </div>
            <div className="mt-2 line-clamp-2 text-2xl font-black">{ad.title}</div>
          </div>
        </div>
      </Link>
    );
  }
  return (
    <section className="rounded-[18px] bg-gradient-to-r from-zinc-950 via-zinc-600 to-zinc-100 p-6 text-white shadow-sm">
      <div className="text-xs font-black uppercase tracking-[0.2em] text-white/70">
        While you wait
      </div>
      <h2 className="mt-3 max-w-xs text-2xl font-black leading-tight">
        Get 20% OFF your next feast!
      </h2>
      <div className="mt-5 inline-flex rounded-lg bg-red-600 px-4 py-3 text-sm font-black uppercase tracking-wide">
        Code: DHABA20
      </div>
    </section>
  );
}

function CompletionCard() {
  return (
    <section className="rounded-[22px] bg-green-50 p-6 text-center">
      <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
      <h2 className="mt-3 text-2xl font-black">Delivered successfully</h2>
      <p className="mt-1 text-zinc-600">Rate your food and reorder your favorites anytime.</p>
      <div className="mt-4 flex justify-center gap-2">
        <Link to="/menu" className="rounded-2xl bg-green-600 px-4 py-3 font-black text-white">
          <RotateCcw className="mr-2 inline h-4 w-4" /> Reorder
        </Link>
        <button className="rounded-2xl bg-white px-4 py-3 font-black text-green-700">
          <Star className="mr-2 inline h-4 w-4" /> Review
        </button>
      </div>
    </section>
  );
}

function CancelledCard() {
  return (
    <section className="rounded-[22px] bg-zinc-100 p-6 text-center">
      <XCircle className="mx-auto h-12 w-12 text-zinc-600" />
      <h2 className="mt-3 text-2xl font-black">Order cancelled</h2>
      <p className="mt-1 text-zinc-600">Please contact the restaurant if you need help.</p>
    </section>
  );
}

function TrackingSkeleton() {
  return (
    <div className="min-h-screen bg-[#f5f3f3]">
      <div className="mx-auto max-w-[640px] pb-28">
        <div className="h-[390px] animate-pulse bg-zinc-200" />
        <div className="-mt-7 space-y-4 px-4">
          <div className="h-64 animate-pulse rounded-[24px] bg-white" />
          <div className="h-72 animate-pulse rounded-[22px] bg-white" />
          <div className="h-56 animate-pulse rounded-[22px] bg-white" />
        </div>
      </div>
    </div>
  );
}

function NotFound({ orderId }: { orderId: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-3xl font-black">Order not found</h1>
      <p className="mt-2 text-zinc-500">We could not find order {orderId}.</p>
      <Link
        to="/orders"
        className="mt-6 inline-flex rounded-3xl bg-red-600 px-6 py-4 font-black text-white"
      >
        View orders
      </Link>
    </div>
  );
}

function AdMedia({ src }: { src: string }) {
  const url = resolveMediaUrl(src);
  if (isVideoUrl(url)) {
    return (
      <video
        src={url}
        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
        muted
        autoPlay
        loop
        playsInline
      />
    );
  }
  return (
    <img
      src={url}
      alt=""
      onError={imageFallback}
      className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
    />
  );
}

function headlineFor(order: Order) {
  if (order.status === "delivered") return "Delivered";
  if (order.status === "cancelled") return "Order cancelled";
  if (order.status === "out_for_delivery") return `Arriving in ${etaNumber(order)} mins`;
  if (order.status === "ready") return "Ready for pickup";
  if (order.status === "preparing") return `Arriving in ${etaNumber(order)} mins`;
  return "Order received";
}

function riderSubtext(order: Order) {
  const name = order.delivery?.partnerName || order.delivery?.assignedRiderName;
  if (order.status === "out_for_delivery" && name) return `${name} is on the way`;
  if (order.status === "ready" && name) return `${name} will pick it up soon`;
  if (order.status === "preparing") return "Chef is preparing your food";
  if (order.status === "delivered") return "Thanks for ordering from The Ankapur Dhaba";
  if (order.status === "cancelled") return "Please contact support for help";
  return name ? `${name} is at the restaurant` : "Restaurant has received your order";
}

function stepDescription(step: ProgressStep, order: Order) {
  if (step.id === "preparing" && order.items[0]?.name) {
    return `Chef is working on your ${order.items[0].name}`;
  }
  if (step.id === "out_for_delivery" && order.delivery?.partnerName) {
    return `${order.delivery.partnerName} will pick it up soon`;
  }
  return step.description;
}

function progressId(status: OrderStatus): ProgressStep["id"] {
  if (status === "delivered") return "delivered";
  if (status === "out_for_delivery") return "out_for_delivery";
  return "preparing";
}

function isStepDone(step: ProgressStep["id"], status: OrderStatus) {
  if (status === "cancelled") return false;
  if (step === "placed") return true;
  if (step === "preparing") return ["ready", "out_for_delivery", "delivered"].includes(status);
  if (step === "out_for_delivery") return status === "delivered";
  if (step === "delivered") return status === "delivered";
  return false;
}

function labelForStatus(status: OrderStatus) {
  if (status === "out_for_delivery") return "On way";
  return status.replace(/_/g, " ");
}

function etaNumber(order: Order) {
  if (order.status === "delivered") return 0;
  if (order.status === "cancelled") return 0;
  return order.delivery?.etaMinutes || order.delivery?.prepEtaMinutes || 23;
}

function placedTime(order: Order) {
  return new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isOlderThan(order: Order, minutes: number) {
  if (["delivered", "cancelled"].includes(order.status)) return false;
  return Date.now() - new Date(order.createdAt).getTime() > minutes * 60 * 1000;
}

function money(value: number) {
  return `Rs ${Math.round(value)}`;
}
