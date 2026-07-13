import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";

export const Route = createFileRoute("/shipping-delivery-policy")({
  head: () => ({ meta: [{ title: "Shipping and Delivery Policy | The Ankapure Dhaba" }, { name: "description", content: "Delivery policy and estimated delivery information for The Ankapure Dhaba." }] }),
  component: ShippingDeliveryPolicy,
});

function ShippingDeliveryPolicy() {
  return (
    <LegalPage
      title="Shipping and Delivery Policy"
      intro="The Ankapure Dhaba delivers freshly prepared food orders within serviceable areas shown in the app. This page explains delivery availability, timing and customer responsibilities."
      sections={[
        {
          title: "Delivery Areas",
          body: [
            "Delivery is available only within restaurant-approved serviceable locations and radius. Availability may change depending on rider availability, weather, traffic, operational load and local restrictions.",
            "If a location is not serviceable, customers may choose pickup or contact the restaurant for assistance where available.",
          ],
        },
        {
          title: "Estimated Delivery Time",
          body: [
            "Delivery ETA includes kitchen preparation time and rider travel time. ETA is an estimate and may change in real time due to kitchen load, traffic, distance, weather or rider assignment.",
            "Customers can track order status in the app from order received to accepted, preparing, ready, out for delivery and delivered.",
          ],
        },
        {
          title: "Customer Responsibility",
          body: [
            "Customers must provide a complete address, landmark, reachable phone number and delivery notes where needed. The delivery partner may call for location clarification.",
            "If the customer is unavailable or unreachable after reasonable delivery attempts, the order may be marked as failed or delivered as per restaurant decision, and refund may not be applicable.",
          ],
        },
        {
          title: "Pickup and Dine-In",
          body: [
            "Pickup and dine-in orders follow the restaurant preparation timeline shown in the app. Customers should collect pickup orders using the order ID or token where provided.",
            "Food quality is best when collected or received promptly after preparation.",
          ],
        },
      ]}
    />
  );
}
