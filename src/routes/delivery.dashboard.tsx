import { createFileRoute } from "@tanstack/react-router";
import { ActiveTripPanel } from "@/components/delivery/delivery-trip";
import { OrdersPanel } from "@/components/delivery/delivery-orders";
import { useDeliveryPortal } from "@/components/delivery/delivery-context";

export const Route = createFileRoute("/delivery/dashboard")({
  component: DeliveryDashboard,
});

function DeliveryDashboard() {
  const portal = useDeliveryPortal();
  return (
    <div className="space-y-4">
      <ActiveTripPanel
        order={portal.activeOrder}
        online={portal.online}
        gpsState={portal.gpsState}
        lastPosition={portal.lastPosition}
        onDone={portal.invalidate}
      />
      <OrdersPanel
        online={portal.online}
        ordersLoading={portal.ordersLoading}
        available={portal.available}
        myOrders={portal.myOrders}
        onDone={portal.invalidate}
      />
    </div>
  );
}
