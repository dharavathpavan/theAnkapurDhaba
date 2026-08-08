/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bike,
  MapPin,
  Navigation,
  Phone,
  ShieldAlert,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import {
  completeDeliveryOrder,
  updateDeliveryPortalStatus,
  updateOrderDelivery,
  verifyDeliveryPickup,
  type DeliveryLocation,
  type Order,
} from "@/services/api";
import {
  DeliveryMap,
  googleMapsDirectionsUrl,
  googleMapsRestaurantDirectionsUrl,
} from "@/components/site/DeliveryMap";
import { EmptyState, Field, StageBadge } from "./delivery-ui";
import { showMutationError } from "./delivery-utils";

export function ActiveTripPanel({
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
            <TripStat label="GPS" value={online ? gpsState.toUpperCase() : "OFFLINE"} sub={lastPosition ? `${lastPosition.lat.toFixed(5)}, ${lastPosition.lng.toFixed(5)}` : "Waiting for live GPS"} icon={Timer} />
            <TripStat label="ETA" value={`${order.delivery?.etaMinutes || 30} min`} sub={`${Number(order.delivery?.distanceKm || 0).toFixed(1)} km remaining`} icon={Timer} />
            <TripStat label="Payment" value={order.paymentMethod.toUpperCase()} sub={order.paymentMethod === "cod" ? `Collect Rs ${order.total}` : order.paymentStatus} icon={MapPin} />
          </div>
        </div>
        <DeliveryMap order={order} compact premium />
      </div>
      <TripControls order={order} onDone={onDone} />
    </section>
  );
}

export function TripControls({ order, onDone }: { order: Order; onDone: () => Promise<void> }) {
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

function TripStat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: any;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="flex min-w-0 gap-3 rounded-2xl border border-white/10 bg-slate-950/35 p-3">
      <Icon className="h-5 w-5 shrink-0 text-orange-200" />
      <span className="min-w-0">
        <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</span>
        <span className="mt-1 block break-words text-sm font-black text-white">{value}</span>
        <span className="mt-0.5 block break-words text-xs text-slate-400">{sub}</span>
      </span>
    </div>
  );
}
