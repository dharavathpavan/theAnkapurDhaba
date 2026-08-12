import { createFileRoute } from "@tanstack/react-router";
import { OrdersPanel } from "@/components/delivery/delivery-orders";
import { useDeliveryPortal } from "@/components/delivery/delivery-context";

export const Route = createFileRoute("/delivery/orders")({
  component: DeliveryOrders,
});

function DeliveryOrders() {
  const portal = useDeliveryPortal();
  return (
    <OrdersPanel
      online={portal.online}
      ordersLoading={portal.ordersLoading}
      available={portal.available}
      myOrders={portal.myOrders}
      onDone={portal.invalidate}
    />
  );
}
