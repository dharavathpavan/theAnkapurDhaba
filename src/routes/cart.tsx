import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Minus, Plus, ShoppingBag, Tag, Trash2, Truck } from "lucide-react";
import { getCustomerHome } from "@/services/api";
import { useCart, selectCartSubtotal } from "@/stores/cart";
import { imageFallback, resolveMediaUrl } from "@/lib/media";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Cart - Ankapur Dhaba" }] }),
  component: CartPage,
});

function CartPage() {
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const subtotal = useCart(selectCartSubtotal);
  const { data } = useQuery({ queryKey: ["customer-home"], queryFn: getCustomerHome, staleTime: 30_000 });
  const store = data?.store;
  const deliveryFee = subtotal >= (store?.freeDeliveryAbove ?? 499) ? 0 : (store?.deliveryCharge ?? 40);
  const packing = lines.length ? (store?.packingCharge ?? 10) : 0;
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + tax + deliveryFee + packing;
  const freeGap = Math.max(0, (store?.freeDeliveryAbove ?? 499) - subtotal);

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-[32px] bg-white shadow-sm">
          <ShoppingBag className="h-10 w-10 text-red-600" />
        </div>
        <h1 className="mt-6 text-3xl font-black">Your cart is empty</h1>
        <p className="mt-2 text-zinc-500">Add biryani, curries, breads or desserts to start your order.</p>
        <Link to="/menu" className="mt-8 inline-flex min-h-14 items-center rounded-3xl bg-red-600 px-6 font-black text-white">Browse menu</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 md:px-6 md:py-8">
      <h1 className="text-3xl font-black md:text-5xl">Your cart</h1>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_380px]">
        <section className="space-y-3">
          {freeGap > 0 ? (
            <div className="rounded-3xl bg-green-50 p-4 text-green-800">
              <div className="flex items-center gap-2 font-black"><Truck className="h-5 w-5" /> Spend ₹{freeGap} more for free delivery</div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-green-100"><div className="h-full bg-green-600" style={{ width: `${Math.min(100, (subtotal / (store?.freeDeliveryAbove ?? 499)) * 100)}%` }} /></div>
            </div>
          ) : (
            <div className="rounded-3xl bg-green-600 p-4 font-black text-white">Free delivery unlocked</div>
          )}

          {lines.map((line) => (
            <article key={line.lineId || line.id} className="flex gap-3 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-zinc-100">
              <img src={resolveMediaUrl(line.image)} alt={line.name} onError={imageFallback} className="h-24 w-24 rounded-3xl object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="line-clamp-2 font-black">{line.name}</h2>
                    <p className="text-sm text-zinc-500">₹{line.price} each</p>
                  </div>
                  <button onClick={() => remove(line.lineId || line.id)} className="grid h-9 w-9 place-items-center rounded-full bg-zinc-100 text-zinc-500"><Trash2 className="h-4 w-4" /></button>
                </div>
                {(line.addons?.length || line.variants?.length || line.instructions) && (
                  <div className="mt-2 text-xs text-zinc-500">
                    {line.variants?.map((v) => v.option).join(", ")}
                    {line.addons?.length ? ` + ${line.addons.map((a) => a.name).join(", ")}` : ""}
                    {line.instructions ? ` • ${line.instructions}` : ""}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center rounded-2xl bg-red-50 text-red-600">
                    <button onClick={() => setQty(line.lineId || line.id, line.qty - 1)} className="grid h-9 w-9 place-items-center"><Minus className="h-4 w-4" /></button>
                    <span className="min-w-7 text-center font-black">{line.qty}</span>
                    <button onClick={() => setQty(line.lineId || line.id, line.qty + 1)} className="grid h-9 w-9 place-items-center"><Plus className="h-4 w-4" /></button>
                  </div>
                  <span className="font-black">₹{line.price * line.qty}</span>
                </div>
              </div>
            </article>
          ))}
        </section>

        <aside className="h-fit rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-zinc-100">
          <div className="flex items-center gap-2 text-red-600"><Tag className="h-5 w-5" /><span className="font-black">Coupons available at checkout</span></div>
          <div className="my-5 border-t border-dashed border-zinc-200" />
          <h2 className="text-xl font-black">Bill details</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Item total" value={`₹${subtotal}`} />
            <Row label="GST" value={`₹${tax}`} />
            <Row label="Packing charge" value={`₹${packing}`} />
            <Row label="Delivery" value={deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`} />
          </dl>
          <div className="my-5 border-t border-zinc-200" />
          <div className="flex items-center justify-between">
            <span className="text-lg font-black">Grand total</span>
            <span className="text-3xl font-black text-red-600">₹{total}</span>
          </div>
          <Link to="/checkout" className="mt-5 flex min-h-14 w-full items-center justify-center rounded-3xl bg-red-600 font-black text-white">Proceed to checkout</Link>
          <Link to="/menu" className="mt-3 block text-center text-sm font-bold text-zinc-500">Add more items</Link>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><dt className="text-zinc-500">{label}</dt><dd className="font-bold">{value}</dd></div>;
}
