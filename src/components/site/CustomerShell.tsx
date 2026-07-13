import { Link, useRouterState } from "@tanstack/react-router";
import { Heart, Home, Mail, MapPin, Package, Phone, Search, ShieldCheck, ShoppingBag, User, UtensilsCrossed } from "lucide-react";
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

const QUICK_LINKS = [
  { to: "/", label: "Home" },
  { to: "/menu", label: "Menu" },
  { to: "/orders", label: "Orders" },
  { to: "/cart", label: "Cart" },
  { to: "/profile", label: "Profile" },
];

const LEGAL_LINKS = [
  { to: "/privacy-policy", label: "Privacy Policy" },
  { to: "/terms-and-conditions", label: "Terms & Conditions" },
  { to: "/cancellation-refund-policy", label: "Cancellation & Refund" },
  { to: "/shipping-delivery-policy", label: "Shipping & Delivery" },
  { to: "/contact-us", label: "Contact Us" },
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
            <img src="/the-ankapure-dhaba-logo.png" alt="The Ankapure Dhaba logo" className="h-11 w-11 rounded-2xl object-cover shadow-lg shadow-red-600/20" />
            <span>
              <span className="block text-[11px] font-black uppercase tracking-[0.24em] text-red-600">The Ankapure Dhaba</span>
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

      <main className="min-h-screen pb-16 md:pb-10">{children}</main>

      <CustomerFooter />

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

function CustomerFooter() {
  return (
    <footer className="border-t border-zinc-200 bg-zinc-950 px-4 pb-32 pt-10 text-white md:px-6 md:pb-10">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1fr]">
        <section>
          <Link to="/" className="inline-flex items-center gap-3">
            <img src="/the-ankapure-dhaba-logo.png" alt="The Ankapure Dhaba logo" className="h-16 w-16 rounded-3xl object-cover ring-1 ring-white/10" />
            <span>
              <span className="block text-xl font-black tracking-tight">The Ankapure Dhaba</span>
              <span className="block text-xs font-black uppercase tracking-[0.22em] text-red-300">Fresh food ordering</span>
            </span>
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-6 text-white/65">
            Order Telangana classics, biryani, starters, breads and family meals from The Ankapure Dhaba. Built for secure checkout, live order tracking, pickup, dine-in and self delivery.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-200">
            <ShieldCheck className="h-4 w-4" />
            Secure payments via Cashfree, UPI, cards and COD where available
          </div>
        </section>

        <FooterLinkGroup title="Explore" links={QUICK_LINKS} />
        <FooterLinkGroup title="Legal" links={LEGAL_LINKS} />

        <section>
          <h2 className="text-sm font-black uppercase tracking-[0.22em] text-white/45">Restaurant Info</h2>
          <div className="mt-4 grid gap-3 text-sm text-white/70">
            <a href="tel:+919000000000" className="flex items-start gap-3 hover:text-white">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
              +91 90000 00000
            </a>
            <a href="mailto:support@theankapuredhaba.com" className="flex items-start gap-3 break-all hover:text-white">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
              support@theankapuredhaba.com
            </a>
            <p className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
              Ankapur Village, Nizamabad District, Telangana 503217
            </p>
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 font-semibold text-white/80">
              Open daily: 10:00 AM to 11:00 PM
            </p>
          </div>
        </section>
      </div>

      <div className="mx-auto mt-8 flex max-w-7xl flex-col gap-3 border-t border-white/10 pt-5 text-xs font-semibold text-white/45 md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} The Ankapure Dhaba. All rights reserved.</p>
        <p>Food images are for representation. Prices, taxes, delivery charges and availability may change.</p>
      </div>
    </footer>
  );
}

function FooterLinkGroup({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <section>
      <h2 className="text-sm font-black uppercase tracking-[0.22em] text-white/45">{title}</h2>
      <nav className="mt-4 grid gap-3">
        {links.map((link) => (
          <Link key={link.to} to={link.to} className="text-sm font-bold text-white/70 transition hover:text-white">
            {link.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
