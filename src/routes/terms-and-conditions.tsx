import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";

export const Route = createFileRoute("/terms-and-conditions")({
  head: () => ({ meta: [{ title: "Terms and Conditions | The Ankapure Dhaba" }, { name: "description", content: "Terms and Conditions for ordering from The Ankapure Dhaba." }] }),
  component: TermsAndConditions,
});

function TermsAndConditions() {
  return (
    <LegalPage
      title="Terms and Conditions"
      intro="These Terms and Conditions apply to all orders, payments, pickup, dine-in and delivery services placed through The Ankapure Dhaba website or app."
      sections={[
        {
          title: "Ordering",
          body: [
            "Customers are responsible for providing correct name, phone number, address, delivery notes and order details before confirming an order.",
            "Menu availability, prices, taxes, packaging charges, delivery charges and offers may change based on restaurant operations, inventory, time, location and applicable laws.",
          ],
        },
        {
          title: "Payments",
          body: [
            "Orders may support Cash on Delivery, UPI, cards, wallets or payment gateway checkout depending on availability. Online payment confirmation may be verified before the order is accepted.",
            "If payment is deducted but the order is not confirmed, customers should contact support with the order/payment reference for verification and resolution.",
          ],
        },
        {
          title: "Delivery and Service",
          body: [
            "Delivery time shown in the app is an estimate and may vary due to kitchen load, traffic, distance, weather, rider availability or operational conditions.",
            "The restaurant may reject, cancel or modify an order if items are unavailable, customer details are incomplete, delivery is not serviceable, or misuse/fraud is suspected.",
          ],
        },
        {
          title: "User Conduct",
          body: [
            "Customers must not misuse offers, submit false claims, abuse staff or delivery partners, attempt unauthorised access, or use the service for unlawful purposes.",
            "The Ankapure Dhaba may restrict access or cancel orders where misuse, unsafe behaviour or policy violation is detected.",
          ],
        },
      ]}
    />
  );
}
