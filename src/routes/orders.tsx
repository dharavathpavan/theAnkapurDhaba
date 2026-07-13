import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package, RotateCcw } from "lucide-react";
import { listMyOrders } from "@/services/api";
import { useOrderRealtime } from "@/hooks/use-order-realtime";
import { useActiveOrderTracking } from "@/stores/active-order";
import { useCart } from "@/stores/cart";
import { toast } from "sonner";

export const Route = createFileRoute("/orders")({
  head: () => ({ meta: [{ title: "Orders - Ankapur Dhaba" }] }),
  component: OrdersPage,
});

function OrdersPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const add = useCart((state) => state.add);
  useOrderRealtime();
  const { order: activeOrder } = useActiveOrderTracking();
  const { data: orders = [], isLoading } = useQuery({ queryKey: ["my-orders"], queryFn: listMyOrders, refetchInterval: 5000 });
  const current = orders.filter((o) => !["delivered", "cancelled"].includes(o.status));
  const past = orders.filter((o) => ["delivered", "cancelled"].includes(o.status));

  if (pathname !== "/orders") return <Outlet />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-5 md:px-6 md:py-8">
      <h1 className="text-3xl font-black md:text-5xl">Your orders</h1>
      {isLoading ? <div className="mt-5 h-40 animate-pulse rounded-3xl bg-white" /> : orders.length === 0 ? (
        <Empty />
      ) : (
        <div className="mt-5 space-y-7">
          {activeOrder && (
            <Link to="/orders/$orderId" params={{ orderId: activeOrder.id }} className="block rounded-[28px] bg-zinc-950 p-5 text-white shadow-xl">
              <div className="text-xs font-bold uppercase tracking-[0.25em] text-white/50">Active live order</div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-2xl font-black">#{activeOrder.id}</span>
                <span className="rounded-2xl bg-green-500 px-3 py-2 text-sm font-black text-black">{activeOrder.delivery?.etaMinutes || 20} min</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3 capitalize text-white/75">
                <span>{activeOrder.status.replace(/_/g, " ")}</span>
                <span className="text-sm font-black text-white">View full details</span>
              </div>
            </Link>
          )}
          <OrderGroup title="Current orders" orders={current} onReorder={(order) => reorder(order, add, navigate)} />
          <OrderGroup title="Order history" orders={past} onReorder={(order) => reorder(order, add, navigate)} />
        </div>
      )}
    </div>
  );
}

function OrderGroup({ title, orders, onReorder }: { title: string; orders: Awaited<ReturnType<typeof listMyOrders>>; onReorder: (order: Awaited<ReturnType<typeof listMyOrders>>[number]) => void }) {
  if (!orders.length) return null;
  return (
    <section>
      <h2 className="mb-3 text-xl font-black">{title}</h2>
      <div className="space-y-3">
        {orders.map((order) => (
          <article key={order.id} className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-zinc-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link to="/orders/$orderId" params={{ orderId: order.id }} className="text-xl font-black text-red-600">#{order.id}</Link>
                <div className="mt-1 text-sm text-zinc-500">{new Date(order.createdAt).toLocaleString()} • {order.type}</div>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black capitalize">{order.status.replace(/_/g, " ")}</span>
            </div>
            <div className="mt-4 text-sm text-zinc-600">{order.items.map((item) => `${item.qty}x ${item.name}`).join(", ")}</div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-2xl font-black">₹{order.total}</span>
              <button onClick={() => onReorder(order)} className="inline-flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-2 text-sm font-black text-red-600"><RotateCcw className="h-4 w-4" /> Reorder</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function reorder(
  order: Awaited<ReturnType<typeof listMyOrders>>[number],
  add: ReturnType<typeof useCart.getState>["add"],
  navigate: ReturnType<typeof useNavigate>,
) {
  order.items.forEach((item) => {
    const menuItem = {
      id: item.id,
      name: item.name,
      description: "Reordered item",
      price: item.price,
      category: "Reorder",
      image: "/logo-192.png",
      isVeg: item.isVeg,
      spiceLevel: 1,
      available: true,
    };
    for (let i = 0; i < item.qty; i += 1) add(menuItem);
  });
  toast.success("Previous order added to cart");
  navigate({ to: "/cart" });
}

function Empty() {
  return (
    <div className="py-20 text-center">
      <Package className="mx-auto h-12 w-12 text-zinc-400" />
      <h2 className="mt-4 text-2xl font-black">No orders yet</h2>
      <p className="mt-1 text-zinc-500">Your current and completed orders will appear here.</p>
      <Link to="/menu" className="mt-6 inline-flex rounded-3xl bg-red-600 px-6 py-4 font-black text-white">Start ordering</Link>
    </div>
  );
}
