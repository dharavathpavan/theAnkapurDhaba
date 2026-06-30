import { Link, useRouterState } from "@tanstack/react-router";
import { Heart, Home, Package, ShoppingBag, User, UtensilsCrossed } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { useCart, selectCartCount, selectCartSubtotal } from "@/stores/cart";
import { useCustomerRealtime } from "@/hooks/use-customer-realtime";
import { useActiveOrderTracking } from "@/stores/active-order";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/menu", label: "Menu", icon: UtensilsCrossed },
  { to: "/orders", label: "Orders", icon: Package },
  { to: "/favorites", label: "Favorites", icon: Heart },
  { to: "/profile", label: "Profile", icon: User },
];

export function CustomerShell({ children }: { children: React.ReactNode }) {
  useCustomerRealtime();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const count = useCart(selectCartCount);
  const subtotal = useCart(selectCartSubtotal);
  const { order } = useActiveOrderTracking();
  const showLiveOrder = Boolean(order && !pathname.startsWith("/orders"));

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-zinc-950">
      <div className="hidden md:block">
        <Header />
      </div>
      <main className="min-h-screen pb-28 md:pb-0">{children}</main>
      <div className="hidden md:block">
        <Footer />
      </div>

      {showLiveOrder && order && (
        <Link
          to="/orders/$orderId"
          params={{ orderId: order.id }}
          className="fixed bottom-24 left-4 right-4 z-50 mx-auto flex max-w-md items-center justify-between rounded-3xl bg-zinc-950 px-4 py-3 text-white shadow-2xl shadow-zinc-950/25 md:bottom-6 md:left-auto md:right-6 md:w-96"
        >
          <span>
            <span className="block text-xs font-bold text-white/60">Live order #{order.id}</span>
            <span className="font-black capitalize">{order.status.replace(/_/g, " ")}</span>
            <span className="mt-0.5 block text-xs font-bold text-white/70">View full order</span>
          </span>
          <span className="rounded-2xl bg-green-500 px-3 py-2 text-sm font-black text-black">
            {order.delivery?.etaMinutes || order.delivery?.prepEtaMinutes || 20} min
          </span>
        </Link>
      )}

      {count > 0 && (
        <Link
          to="/cart"
          className={`fixed left-4 right-4 z-50 mx-auto flex max-w-md items-center justify-between rounded-3xl bg-red-600 px-5 py-4 text-white shadow-2xl shadow-red-600/30 md:bottom-6 ${showLiveOrder ? "bottom-44 md:bottom-24" : "bottom-24"}`}
        >
          <span className="flex items-center gap-3 font-bold">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <span>{count} item{count > 1 ? "s" : ""}</span>
          </span>
          <span className="font-black">₹{subtotal} - View Cart</span>
        </Link>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-5">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-bold ${
                  active ? "bg-red-50 text-red-600" : "text-zinc-500"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
