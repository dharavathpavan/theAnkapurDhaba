import { Link, useRouterState } from "@tanstack/react-router";
import { Heart, Home, Package, Search, ShoppingBag, User, UtensilsCrossed } from "lucide-react";
import { useAuth } from "@/stores/auth";
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
  const { user, isAuthenticated } = useAuth();
  const showLiveOrder = Boolean(order && !pathname.startsWith("/orders"));

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-zinc-950">
      <header className="sticky top-0 z-40 hidden border-b border-white/60 bg-white/82 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur-2xl md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-red-600 font-black text-white shadow-lg shadow-red-600/25">AD</span>
            <span>
              <span className="block text-[11px] font-black uppercase tracking-[0.24em] text-red-600">Ankapur Dhaba</span>
              <span className="block text-sm font-semibold text-zinc-500">Telangana classics delivered hot</span>
            </span>
          </Link>

          <Link to="/menu" className="mx-8 flex min-h-11 flex-1 max-w-xl items-center gap-3 rounded-2xl border border-white/70 bg-white/80 px-4 text-sm font-semibold text-zinc-500 shadow-sm backdrop-blur-xl">
            <Search className="h-5 w-5 text-red-500" />
            Search biryani, chicken, naan...
          </Link>

          <nav className="flex items-center gap-1 rounded-2xl border border-white/70 bg-white/70 p-1 shadow-sm backdrop-blur-xl">
            {NAV.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-black transition ${
                    active ? "bg-zinc-950 text-white shadow-lg shadow-zinc-950/15" : "text-zinc-600 hover:bg-white hover:text-zinc-950"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <Link to={isAuthenticated() ? "/profile" : "/login"} className="ml-3 grid h-11 min-w-11 place-items-center rounded-2xl bg-red-50 px-3 font-black text-red-600">
            {user?.name?.slice(0, 1).toUpperCase() || "AD"}
          </Link>
        </div>
      </header>

      <main className="min-h-screen pb-36 md:pb-10">{children}</main>

      {showLiveOrder && order && (
        <Link
          to="/orders/$orderId"
          params={{ orderId: order.id }}
          className="fixed bottom-28 left-4 right-4 z-50 mx-auto flex max-w-md items-center justify-between rounded-[26px] border border-white/15 bg-zinc-950/92 px-4 py-3 text-white shadow-2xl shadow-zinc-950/30 backdrop-blur-2xl md:bottom-8 md:left-auto md:right-8 md:w-96"
        >
          <span className="min-w-0">
            <span className="block truncate text-xs font-black uppercase tracking-[0.16em] text-white/55">Live order #{order.id}</span>
            <span className="block truncate text-lg font-black capitalize leading-tight">{order.status.replace(/_/g, " ")}</span>
            <span className="mt-0.5 block text-xs font-bold text-white/70">Tap to view full tracking</span>
          </span>
          <span className="ml-3 shrink-0 rounded-2xl bg-green-400 px-3 py-2 text-sm font-black text-zinc-950">
            {order.delivery?.etaMinutes || order.delivery?.prepEtaMinutes || 20} min
          </span>
        </Link>
      )}

      {count > 0 && (
        <Link
          to="/cart"
          className={`fixed left-4 right-4 z-50 mx-auto flex max-w-md items-center justify-between rounded-[26px] border border-white/20 bg-red-600/95 px-4 py-3 text-white shadow-2xl shadow-red-600/30 backdrop-blur-2xl md:left-auto md:right-8 md:w-96 ${showLiveOrder ? "bottom-48 md:bottom-28" : "bottom-28 md:bottom-8"}`}
        >
          <span className="flex min-w-0 items-center gap-3 font-bold">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/18">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <span className="truncate">{count} item{count > 1 ? "s" : ""} added</span>
          </span>
          <span className="shrink-0 font-black">Rs {subtotal} - Cart</span>
        </Link>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1 rounded-[28px] border border-white/75 bg-white/88 p-2 shadow-[0_-18px_45px_rgba(15,23,42,0.18)] backdrop-blur-2xl">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-black transition ${
                  active ? "bg-red-600 text-white shadow-lg shadow-red-600/25" : "text-zinc-600 hover:bg-white"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
