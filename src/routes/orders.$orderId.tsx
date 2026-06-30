import { createFileRoute } from "@tanstack/react-router";
import { OrderTrackingView } from "./track.$orderId";

export const Route = createFileRoute("/orders/$orderId")({
  head: ({ params }) => ({ meta: [{ title: `Order ${params.orderId} - Ankapur Dhaba` }] }),
  component: OrderDetailsPage,
});

function OrderDetailsPage() {
  const { orderId } = Route.useParams();
  return <OrderTrackingView orderId={orderId} />;
}
