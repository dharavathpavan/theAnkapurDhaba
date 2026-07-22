import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, CreditCard, Home, MapPin, Plus, Ticket, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  createCashfreePaymentSession,
  createOrder,
  createCustomerAddress,
  getCustomerHome,
  getCustomerLoyalty,
  getCustomerWallet,
  listCustomerAddresses,
  listCustomerCoupons,
  validateCustomerCoupon,
  verifyCashfreePayment,
  type OrderType,
  type PaymentMethod,
} from "@/services/api";
import { useAuth } from "@/stores/auth";
import { useCart } from "@/stores/cart";
import { saveActiveOrder } from "@/stores/active-order";
import type { CreateOrderInput } from "@/services/api";
import { buildOrderItemName } from "@/lib/order-items";
import { LocationPicker } from "@/components/site/LocationPicker";
import type { LatLngLiteral } from "@/lib/google-maps";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout - Ankapur Dhaba" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const navigate = useNavigate();
  const checkoutFormRef = useRef<HTMLFormElement>(null);
  const { user, isAuthenticated } = useAuth();
  const lines = useCart((s) => s.lines);
  const tableNumber = useCart((s) => s.tableNumber);
  const clear = useCart((s) => s.clear);
  const [type, setType] = useState<OrderType>(tableNumber ? "dinein" : "delivery");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [couponCode, setCouponCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [selectedCoords, setSelectedCoords] = useState<LatLngLiteral | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);

  const { data: home } = useQuery({
    queryKey: ["customer-home"],
    queryFn: getCustomerHome,
    staleTime: 30_000,
  });
  const { data: addresses = [] } = useQuery({
    queryKey: ["customer-addresses"],
    queryFn: listCustomerAddresses,
    enabled: isAuthenticated(),
  });
  const { data: coupons = [] } = useQuery({
    queryKey: ["customer-coupons", user?.phone],
    queryFn: () => listCustomerCoupons(user?.phone),
    staleTime: 30_000,
  });
  const { data: loyalty } = useQuery({
    queryKey: ["customer-loyalty"],
    queryFn: getCustomerLoyalty,
    enabled: isAuthenticated(),
  });
  const { data: wallet } = useQuery({
    queryKey: ["customer-wallet"],
    queryFn: getCustomerWallet,
    enabled: isAuthenticated(),
  });

  const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  const deliveryFee =
    type === "delivery" && subtotal < (home?.store.freeDeliveryAbove ?? 499)
      ? (home?.store.deliveryCharge ?? 40)
      : 0;
  const packing = lines.length ? (home?.store.packingCharge ?? 10) : 0;
  const tax = Math.round(subtotal * 0.05);
  const total = Math.max(0, subtotal + tax + deliveryFee + packing - discount);
  const address =
    addresses.find((a) => a.id === selectedAddress) || addresses.find((a) => a.isDefault);
  const minimumOrder = home?.store.minimumOrder ?? 0;
  const needsLogin = !isAuthenticated();
  const deliveryCodDisabled = type === "delivery" && home?.store.allowDeliveryCod !== true;
  const deliveryAddressReady =
    type !== "delivery" || Boolean(address) || deliveryAddress.trim().length >= 5;
  const checkoutBlockedReason = !lines.length
    ? "Add items to your cart first."
    : home?.store.status === "offline"
      ? home.store.statusMessage || "Store is closed right now."
      : type === "delivery" && subtotal < minimumOrder
        ? `Minimum delivery order is Rs ${minimumOrder}.`
        : paymentMethod === "wallet" && (wallet?.balance ?? 0) < total
          ? "Main Wallet balance is insufficient."
          : "";
  const checkoutHintReason =
    checkoutBlockedReason ||
    (needsLogin
      ? "Login required to place your order."
      : !deliveryAddressReady
        ? "Add a delivery address to continue."
        : "");
  const submitDisabled = submitting || Boolean(checkoutBlockedReason);
  const desktopSubmitLabel = submitting
    ? "Processing..."
    : paymentMethod === "cashfree"
      ? "Pay & place order"
      : "Place order";
  const mobileSubmitLabel = submitting
    ? "Processing..."
    : paymentMethod === "cashfree"
      ? `Pay Rs ${total}`
      : `Place order - Rs ${total}`;

  useEffect(() => {
    if (!address) return;
    setDeliveryAddress(address.address);
    setSelectedCoords(
      typeof address.lat === "number" && typeof address.lng === "number"
        ? { lat: address.lat, lng: address.lng }
        : null,
    );
  }, [address?.id, address?.lat, address?.lng]);

  useEffect(() => {
    if (deliveryCodDisabled && paymentMethod === "cod") setPaymentMethod("cashfree");
  }, [deliveryCodDisabled, paymentMethod]);

  const items = useMemo(
    () =>
      lines.map((line) => ({
        id: line.id,
        name: buildOrderItemName(line),
        price: line.price,
        qty: line.qty,
        isVeg: line.isVeg,
      })),
    [lines],
  );

  async function applyCoupon(code = couponCode) {
    if (!code.trim()) return;
    try {
      const result = await validateCustomerCoupon({ code, subtotal, phone: user?.phone });
      setCouponCode(result.coupon.code);
      setDiscount(result.discount);
      toast.success(`Coupon applied: -₹${result.discount}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid coupon");
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!lines.length) return navigate({ to: "/menu" });
    if (home?.store.status === "offline")
      return toast.error(home.store.statusMessage || "Store is closed");
    if (!isAuthenticated()) {
      toast.error("Please login to place your order");
      return navigate({ to: "/login" });
    }
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || user?.name || "").trim();
    const phone = String(fd.get("phone") || user?.phone || "").trim();
    const enteredAddress = String(fd.get("address") || deliveryAddress || "").trim();
    if (!name || !/^[6-9]\d{9}$/.test(phone)) return toast.error("Enter valid customer details");
    if (type === "delivery" && !address && enteredAddress.length < 5)
      return toast.error("Delivery address is required");
    if (type === "delivery" && subtotal < minimumOrder)
      return toast.error(`Minimum delivery order is Rs ${minimumOrder}`);
    if (deliveryCodDisabled && paymentMethod === "cod")
      return toast.error("Delivery COD is disabled. Please pay online or use wallet.");
    if (paymentMethod === "wallet" && (wallet?.balance ?? 0) < total)
      return toast.error("Insufficient Main Wallet balance");

    setSubmitting(true);
    try {
      if (savingAddress && isAuthenticated() && type === "delivery" && enteredAddress) {
        await createCustomerAddress({
          id: "",
          label: "Home",
          name,
          phone,
          address: enteredAddress,
          landmark: String(fd.get("landmark") || ""),
          notes: String(fd.get("notes") || ""),
          lat: selectedCoords?.lat ?? null,
          lng: selectedCoords?.lng ?? null,
          isDefault: addresses.length === 0,
        });
      }
      const orderInput: CreateOrderInput = {
        items,
        subtotal,
        tax,
        deliveryFee,
        total,
        customer: {
          name,
          phone,
          address: type === "delivery" ? address?.address || enteredAddress : undefined,
          lat: type === "delivery" ? (address?.lat ?? selectedCoords?.lat) : undefined,
          lng: type === "delivery" ? (address?.lng ?? selectedCoords?.lng) : undefined,
          landmark:
            type === "delivery" ? address?.landmark || String(fd.get("landmark") || "") : undefined,
          notes: String(fd.get("notes") || ""),
        },
        type,
        tableNumber: tableNumber ?? undefined,
        paymentMethod,
      };
      let order;
      if (paymentMethod === "cashfree") {
        const session = await createCashfreePaymentSession(orderInput);
        if (!session.alreadyPaid) {
          if (!session.paymentSessionId)
            throw new Error("Cashfree payment session was not created");
          const checkoutResult = await openCashfreeCheckout(session.paymentSessionId, session.mode);
          if (checkoutResult !== "attempted") return;
        }
        const verified = await verifyCashfreePayment(session.orderId, orderInput);
        if (String(verified.status).toUpperCase() !== "PAID") {
          toast.error("Payment is not complete. Order was not placed.");
          return;
        }
        if (!verified.order) throw new Error("Payment verified but order was not created");
        order = verified.order;
      } else {
        order = await createOrder(orderInput);
      }
      clear();
      saveActiveOrder(order.id);
      setSuccessId(order.id);
      navigate({ to: "/orders/$orderId", params: { orderId: order.id } });
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Couldn't place order. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!lines.length && !successId) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-3xl font-black">No items in cart</h1>
        <Link
          to="/menu"
          className="mt-6 inline-flex rounded-3xl bg-red-600 px-6 py-4 font-black text-white"
        >
          Browse menu
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-5 md:px-6 md:py-8">
      <h1 className="text-3xl font-black md:text-5xl">Checkout</h1>
      <form
        ref={checkoutFormRef}
        onSubmit={submit}
        className="mt-5 grid gap-5 lg:grid-cols-[1fr_390px]"
      >
        <div className="space-y-5">
          <Panel title="Order type">
            <div className="grid grid-cols-3 gap-2">
              {(["delivery", "pickup", "dinein"] as OrderType[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={`min-h-13 rounded-2xl font-black capitalize ${type === value ? "bg-red-600 text-white" : "bg-zinc-100 text-zinc-600"}`}
                >
                  {value === "dinein" ? "Dine-in" : value}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Customer details">
            <div className="grid gap-3 md:grid-cols-2">
              <Field name="name" label="Name" defaultValue={user?.name} />
              <Field name="phone" label="Phone" defaultValue={user?.phone} inputMode="tel" />
            </div>
          </Panel>

          {type === "delivery" && (
            <Panel title="Delivery address">
              {addresses.length > 0 && (
                <div className="mb-3 grid gap-2">
                  {addresses.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedAddress(item.id)}
                      className={`rounded-2xl p-4 text-left ${selectedAddress === item.id || (!selectedAddress && item.isDefault) ? "bg-red-50 ring-2 ring-red-500" : "bg-zinc-100"}`}
                    >
                      <div className="flex items-center gap-2 font-black">
                        <Home className="h-4 w-4" /> {item.label}
                      </div>
                      <div className="mt-1 text-sm text-zinc-500">{item.address}</div>
                    </button>
                  ))}
                </div>
              )}
              <div className="grid gap-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-black">New address</span>
                  <input
                    name="address"
                    value={deliveryAddress}
                    onChange={(event) => {
                      setDeliveryAddress(event.target.value);
                      if (selectedAddress) setSelectedAddress("");
                    }}
                    placeholder="House no, street, area, pincode"
                    className="h-13 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 outline-none focus:border-red-400"
                  />
                </label>
                <LocationPicker
                  value={selectedCoords}
                  address={address?.address || deliveryAddress}
                  restaurant={
                    home?.store ? { lat: home.store.lat, lng: home.store.lng } : undefined
                  }
                  onChange={({ coords, address: nextAddress }) => {
                    setSelectedAddress("");
                    setSelectedCoords(coords);
                    if (nextAddress) setDeliveryAddress(nextAddress);
                  }}
                />
                <Field name="landmark" label="Landmark" placeholder="Near temple, beside ATM" />
                <label className="flex items-center gap-2 rounded-2xl bg-zinc-100 p-4 font-bold">
                  <input
                    type="checkbox"
                    checked={savingAddress}
                    onChange={(e) => setSavingAddress(e.target.checked)}
                  />{" "}
                  Save this address
                </label>
              </div>
            </Panel>
          )}

          <Panel title="Payment">
            <div className="grid gap-2 md:grid-cols-3">
              {(
                [
                  ["cod", "Cash on Delivery"],
                  ["cashfree", "UPI / Card / Wallet"],
                  ["wallet", `Main Wallet - Rs ${Math.round(wallet?.balance ?? 0)}`],
                ] as Array<[PaymentMethod, string]>
              )
                .filter(([value]) => !(deliveryCodDisabled && value === "cod"))
                .map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPaymentMethod(value)}
                    className={`min-h-16 rounded-2xl px-4 text-left font-black ${paymentMethod === value ? "bg-green-600 text-white" : "bg-zinc-100 text-zinc-700"}`}
                  >
                    <CreditCard className="mb-1 h-5 w-5" /> {label}
                  </button>
                ))}
            </div>
            <p className="mt-3 text-sm font-semibold text-zinc-500">
              {deliveryCodDisabled
                ? "Delivery orders require online payment or wallet payment."
                : "Online orders are placed only after Cashfree confirms successful payment."}
            </p>
          </Panel>

          <Panel title="Order notes">
            <textarea
              name="notes"
              rows={3}
              placeholder="Delivery notes or kitchen request"
              className="w-full rounded-3xl border border-zinc-200 bg-zinc-50 p-4 outline-none focus:border-red-400"
            />
          </Panel>
        </div>

        <aside className="h-fit rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <h2 className="text-xl font-black">Review order</h2>
          <ul className="mt-4 space-y-3">
            {lines.map((line) => (
              <li key={line.lineId || line.id} className="flex justify-between gap-3 text-sm">
                <span className="text-zinc-600">
                  {line.qty}x {line.name}
                </span>
                <span className="font-bold">Rs {line.qty * line.price}</span>
              </li>
            ))}
          </ul>
          <div className="my-4 border-t border-zinc-200" />
          {coupons.length > 0 && (
            <div className="mb-4 space-y-2">
              {coupons.slice(0, 2).map((coupon) => (
                <button
                  key={coupon.id}
                  type="button"
                  onClick={() => applyCoupon(coupon.code)}
                  className="flex w-full items-center justify-between rounded-2xl border border-dashed border-red-300 bg-red-50 p-3 text-left"
                >
                  <span>
                    <span className="font-black">{coupon.code}</span>
                    <span className="block text-xs text-zinc-500">{coupon.title}</span>
                  </span>
                  <Ticket className="h-5 w-5 text-red-600" />
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
              placeholder="Coupon code"
              className="min-w-0 flex-1 rounded-2xl bg-zinc-100 px-3 outline-none"
            />
            <button
              type="button"
              onClick={() => applyCoupon()}
              className="rounded-2xl bg-zinc-950 px-4 font-black text-white"
            >
              Apply
            </button>
          </div>
          {loyalty && (
            <div className="mt-4 rounded-2xl bg-yellow-50 p-3 text-sm">
              <Wallet className="mr-2 inline h-4 w-4 text-yellow-700" /> {loyalty.points} loyalty
              points available
            </div>
          )}
          <div className="my-4 border-t border-zinc-200" />
          <dl className="space-y-2 text-sm">
            <Row label="Subtotal" value={`Rs ${subtotal}`} />
            <Row label="GST" value={`Rs ${tax}`} />
            <Row label="Packing" value={`Rs ${home?.store.packingCharge ?? 10}`} />
            <Row label="Delivery" value={deliveryFee ? `Rs ${deliveryFee}` : "FREE"} />
            {discount > 0 && <Row label="Discount" value={`-Rs ${discount}`} />}
          </dl>
          <div className="my-4 border-t border-zinc-200" />
          <div className="flex items-center justify-between">
            <span className="text-lg font-black">To pay</span>
            <span className="text-3xl font-black text-red-600">Rs {total}</span>
          </div>
          {checkoutHintReason && (
            <p className="mt-4 rounded-2xl bg-yellow-50 px-4 py-3 text-sm font-bold text-yellow-800">
              {checkoutHintReason}
            </p>
          )}
          <button
            type="submit"
            disabled={submitDisabled}
            className="mt-5 hidden min-h-14 w-full rounded-3xl bg-red-600 font-black text-white disabled:bg-zinc-300 md:block"
          >
            {desktopSubmitLabel}
          </button>
        </aside>
      </form>
      {checkoutHintReason && (
        <p className="fixed bottom-[9.1rem] left-4 right-4 z-40 mx-auto max-w-md rounded-2xl bg-yellow-50 px-4 py-2 text-center text-xs font-bold text-yellow-800 shadow-lg md:hidden">
          {checkoutHintReason}
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          if (!checkoutFormRef.current) return toast.error("Checkout is still loading. Try again.");
          checkoutFormRef.current.requestSubmit();
        }}
        disabled={submitDisabled}
        className="fixed bottom-24 left-4 right-4 z-40 mx-auto min-h-14 max-w-md rounded-3xl bg-red-600 font-black text-white shadow-2xl shadow-red-600/25 disabled:bg-zinc-300 md:hidden"
      >
        {mobileSubmitLabel}
      </button>

      {successId && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-[#F8F9FB] p-5">
          <div className="max-w-md text-center">
            <div className="mx-auto grid h-28 w-28 place-items-center rounded-[36px] bg-green-100">
              <CheckCircle2 className="h-16 w-16 text-green-600" />
            </div>
            <h2 className="mt-6 text-4xl font-black">Order placed</h2>
            <p className="mt-2 text-zinc-500">
              Order #{successId} is sent to the kitchen. ETA {home?.store.averageDeliveryMin ?? 30}{" "}
              min.
            </p>
            <div className="mt-8 grid gap-3">
              <Link
                to="/orders/$orderId"
                params={{ orderId: successId }}
                className="rounded-3xl bg-red-600 px-6 py-4 font-black text-white"
              >
                View order status
              </Link>
              <Link to="/menu" className="rounded-3xl bg-white px-6 py-4 font-black text-zinc-700">
                Continue shopping
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-zinc-100">
      <h2 className="mb-4 text-xl font-black">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
  inputMode,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  inputMode?: "tel" | "text";
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-black">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        inputMode={inputMode}
        className="h-13 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 outline-none focus:border-red-400"
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}

declare global {
  interface Window {
    Cashfree?: (options: { mode: "sandbox" | "production" }) => {
      checkout: (options: {
        paymentSessionId: string;
        redirectTarget: "_modal" | "_self" | "_top" | "_blank";
      }) => Promise<{ error?: unknown; redirect?: boolean; paymentDetails?: unknown }>;
    };
    __cashfreeScriptLoading?: Promise<void>;
  }
}

async function loadCashfreeScript() {
  if (typeof window === "undefined")
    throw new Error("Cashfree checkout is available only in browser");
  if (window.Cashfree) return;
  if (!window.__cashfreeScriptLoading) {
    window.__cashfreeScriptLoading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Unable to load Cashfree checkout"));
      document.head.appendChild(script);
    });
  }
  await window.__cashfreeScriptLoading;
  if (!window.Cashfree) throw new Error("Cashfree checkout did not initialize");
}

async function openCashfreeCheckout(paymentSessionId: string, mode: "sandbox" | "production") {
  await loadCashfreeScript();
  const cashfree = window.Cashfree?.({ mode });
  if (!cashfree) throw new Error("Cashfree checkout is unavailable");
  const result = await cashfree.checkout({ paymentSessionId, redirectTarget: "_modal" });
  if (result.error) throw new Error("Payment was not completed. No order was placed.");
  if (result.redirect)
    throw new Error("Payment was redirected. Complete payment and return to confirm your order.");
  if (!result.paymentDetails) throw new Error("Payment was not completed. No order was placed.");
  return "attempted" as const;
}
