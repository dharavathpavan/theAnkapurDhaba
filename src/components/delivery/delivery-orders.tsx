/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  IndianRupee,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  Timer,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/stores/auth";
import { googleMapsDirectionsUrl } from "@/components/site/DeliveryMap";
import {
  pickDeliveryOrder,
  reserveDeliveryOrder,
  type Order,
} from "@/services/api";
import {
  DarkInfo,
  EmptyState,
  Field,
  StageBadge,
  StatusPill,
} from "./delivery-ui";
import {
  deliveryEarning,
  itemCount,
  showMutationError,
} from "./delivery-utils";

export function OrdersPanel({
  online,
  ordersLoading,
  available,
  myOrders,
  onDone,
  renderTrip,
}: {
  online: boolean;
  ordersLoading: boolean;
  available: Order[];
  myOrders: Order[];
  onDone: () => Promise<void>;
  renderTrip?: (order: Order) => React.ReactNode;
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

export function DeliveryOrderCard({
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

export function IncomingOrderModal({
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
