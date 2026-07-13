import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";

export const Route = createFileRoute("/cancellation-refund-policy")({
  head: () => ({ meta: [{ title: "Cancellation and Refund Policy | The Ankapure Dhaba" }, { name: "description", content: "Cancellation and refund policy for The Ankapure Dhaba food orders." }] }),
  component: CancellationRefundPolicy,
});

function CancellationRefundPolicy() {
  return (
    <LegalPage
      title="Cancellation and Refund Policy"
      intro="This policy explains when food orders can be cancelled and when refunds may be issued for The Ankapure Dhaba."
      sections={[
        {
          title: "Cancellation Window",
          body: [
            "Customers may request cancellation before the kitchen accepts or starts preparing the order. Once preparation has started, cancellation is normally not available because food is made fresh for the customer.",
            "The restaurant may cancel an order due to item unavailability, delivery area restrictions, incorrect customer details, payment verification failure or operational constraints.",
          ],
        },
        {
          title: "Eligible Refund Cases",
          body: [
            "Refunds may be considered for duplicate payment, payment deducted but order not created, restaurant-side cancellation, unavailable items, verified missing items, wrong items or major quality issues reported promptly with order details.",
            "For online payments, refunds are processed to the original payment method through the payment gateway or bank. Timelines depend on the payment provider and issuing bank.",
          ],
        },
        {
          title: "Non-Refundable Cases",
          body: [
            "Refunds are generally not provided if the customer provides an incorrect address or phone number, refuses delivery, is unavailable at delivery, changes preference after preparation, or reports an issue after unreasonable delay.",
            "Taste preference, spice preference and minor delivery time variation may not qualify for refund unless there is a clear service failure by the restaurant.",
          ],
        },
        {
          title: "How to Raise a Claim",
          body: [
            "Customers should contact support with order ID, phone number, issue details and photos where relevant. Claims are reviewed by the restaurant team before approval.",
            "Approved refunds may take 5 to 7 working days or as per the payment gateway and bank timelines.",
          ],
        },
      ]}
    />
  );
}
