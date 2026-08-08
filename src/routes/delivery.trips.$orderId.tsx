import { createFileRoute, Link } from "@tanstack/react-router";
import { ActiveTripPanel } from "@/components/delivery/delivery-trip";
import { EmptyState } from "@/components/delivery/delivery-ui";
import { useDeliveryPortal } from "@/components/delivery/delivery-context";
import { Bike } from "lucide-react";

export const Route = createFileRoute("/delivery/trips/$orderId")({
  component: DeliveryTripDetail,
});

function DeliveryTripDetail() {
  const { orderId } = Route.useParams();
  const portal = useDeliveryPortal();
  const order = portal.orders.find((item) => item.id === orderId);

  if (!order) {
    return (
      <div className="space-y-4">
        <EmptyState icon={Bike} title="Trip not found" text="This order may have been completed or reassigned." />
        <Link to="/delivery/dashboard" className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black text-white">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <ActiveTripPanel
      order={order}
      online={portal.online}
      gpsState={portal.gpsState}
      lastPosition={portal.lastPosition}
      onDone={portal.invalidate}
    />
  );
}
