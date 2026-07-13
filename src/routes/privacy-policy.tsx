import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/site/LegalPage";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({ meta: [{ title: "Privacy Policy | The Ankapure Dhaba" }, { name: "description", content: "Privacy Policy for The Ankapure Dhaba online food ordering app." }] }),
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This Privacy Policy explains how The Ankapure Dhaba collects, uses, stores and protects information when customers use our website, PWA, ordering, payment, delivery and support services."
      sections={[
        {
          title: "Information We Collect",
          body: [
            "We collect customer details needed to place and deliver orders, including name, phone number, delivery address, landmark, order notes, cart items, payment method, order history and support messages.",
            "When live delivery tracking is used, rider location data may be processed to show order progress and estimated delivery status. Customer device location is used only when the customer chooses to provide it for delivery convenience.",
          ],
        },
        {
          title: "How We Use Information",
          body: [
            "We use information to create orders, process payments, prepare food, assign delivery, provide order tracking, send order updates, prevent fraud, improve service quality and respond to customer support requests.",
            "Payment processing may be handled by trusted payment gateway partners such as Cashfree. We do not store complete card numbers, UPI PINs, CVV or sensitive banking credentials on our servers.",
          ],
        },
        {
          title: "Sharing and Security",
          body: [
            "Information is shared only with restaurant staff, delivery partners, payment processors and service providers when required to complete an order or comply with law.",
            "We use reasonable technical and organisational safeguards to protect customer data. No internet service is completely risk free, but we work to keep access limited and purpose based.",
          ],
        },
        {
          title: "Customer Choices",
          body: [
            "Customers may request correction or deletion of account information where legally permitted by contacting support. Some order, invoice, tax, payment and fraud-prevention records may be retained as required by law or business compliance.",
            "Marketing or promotional communication preferences can be changed from the app where available or by contacting support.",
          ],
        },
      ]}
    />
  );
}
