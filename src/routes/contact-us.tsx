import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, LEGAL_BUSINESS } from "@/components/site/LegalPage";

export const Route = createFileRoute("/contact-us")({
  head: () => ({ meta: [{ title: "Contact Us | The Ankapure Dhaba" }, { name: "description", content: "Contact The Ankapure Dhaba for order, payment, refund and support help." }] }),
  component: ContactUs,
});

function ContactUs() {
  return (
    <LegalPage
      title="Contact Us"
      intro="Contact The Ankapure Dhaba for order support, payment issues, refund requests, delivery help, feedback and restaurant enquiries."
      sections={[
        {
          title: "Customer Support",
          body: [
            `Phone: ${LEGAL_BUSINESS.phone}`,
            `Email: ${LEGAL_BUSINESS.email}`,
            `Support hours: ${LEGAL_BUSINESS.hours}`,
          ],
        },
        {
          title: "Restaurant Address",
          body: [
            LEGAL_BUSINESS.address,
            "For delivery support, please keep your order ID and registered phone number ready so our team can verify and help faster.",
          ],
        },
        {
          title: "Payment and Refund Help",
          body: [
            "For online payment issues, include your order ID, payment reference if available, amount, date and phone number used for the order.",
            "Refund requests are reviewed under our Cancellation and Refund Policy. Approved online refunds are routed through the payment provider or bank.",
          ],
        },
        {
          title: "Grievance and Feedback",
          body: [
            "Customers can contact support for privacy requests, food quality issues, missing items, billing queries or delivery concerns.",
            "We aim to review support requests promptly during restaurant operating hours.",
          ],
        },
      ]}
    />
  );
}
