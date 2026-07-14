import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, ChevronDown, Clock3, Heart, Home, Mail, MapPin, Package, Phone, ShieldCheck, ShoppingBag, User, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/stores/auth";
import { useCart, selectCartCount, selectCartSubtotal } from "@/stores/cart";
import { useCustomerRealtime } from "@/hooks/use-customer-realtime";
import { useActiveOrderTracking } from "@/stores/active-order";
import { subscribeToCustomerContent, subscribeToOrderEvents } from "@/services/api";

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

type LocalNotice = {
  id: string;
  title: string;
  body: string;
  time: string;
  tone: "order" | "offer" | "system";
  read: boolean;
};

export function CustomerShell({ children }: { children: React.ReactNode }) {
  useCustomerRealtime();
  const notifications = useLocalNotifications();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const count = useCart(selectCartCount);
  const subtotal = useCart(selectCartSubtotal);
  const { order } = useActiveOrderTracking();
  const { user, isAuthenticated } = useAuth();
  const isCheckoutSurface = pathname === "/cart" || pathname === "/checkout";
  const isOrderDetail = /^\/orders\/[^/]+/.test(pathname);
  const allowLiveOrderTray = pathname === "/" || pathname === "/orders";
  const showLiveOrder = Boolean(order && allowLiveOrderTray && !isOrderDetail && !isCheckoutSurface);
  const showCartTray = count > 0 && !isCheckoutSurface;

  return (
    <div className="min-h-screen bg-[#F8F9FB] text-zinc-950">
      <header className="sticky top-0 z-40 border-b border-white/65 bg-white/82 shadow-[0_14px_45px_rgba(15,23,42,0.10)] backdrop-blur-2xl">
        <div className="mx-auto hidden max-w-7xl items-center gap-3 px-6 py-3 md:flex">
          <BrandMark />

          <div className="flex min-w-[160px] items-center gap-2 rounded-2xl border border-white/70 bg-white/75 px-3 py-2 shadow-sm">
            <MapPin className="h-4 w-4 shrink-0 text-red-600" />
            <span className="min-w-0">
              <span className="block truncate text-xs font-black text-zinc-950">Deliver to Ankapur</span>
              <span className="block truncate text-[11px] font-semibold text-green-600">Open now - 30 min</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
          </div>

          <nav className="ml-auto flex items-center gap-1 rounded-2xl border border-white/70 bg-white/70 p-1 shadow-sm backdrop-blur-xl">
            {NAV.map((item) => <NavLink key={item.to} item={item} pathname={pathname} />)}
          </nav>

          <NotificationBell {...notifications} />

          <Link to="/cart" className={`relative inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 text-sm font-black shadow-sm transition ${count > 0 ? "bg-red-600 text-white shadow-red-600/20" : "bg-white/80 text-zinc-700 ring-1 ring-white/70"}`}>
            <ShoppingBag className="h-5 w-5" />
            <span>{count > 0 ? `Cart Rs ${subtotal}` : "Cart"}</span>
            {count > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-zinc-950 px-1 text-[10px] text-white">{count}</span>}
          </Link>

          <Link to={isAuthenticated() ? "/profile" : "/login"} className="grid h-11 min-w-11 place-items-center rounded-2xl bg-red-50 px-3 font-black text-red-600 ring-1 ring-red-100">
            {user?.name?.slice(0, 1).toUpperCase() || <User className="h-5 w-5" />}
          </Link>
        </div>

        <div className="mx-auto max-w-md px-3 py-2.5 md:hidden">
          <div className="flex items-center justify-between gap-3">
            <BrandMark compact />
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-2xl bg-green-50 px-2.5 py-2 text-xs font-black text-green-700">
                <Clock3 className="h-3.5 w-3.5" />
                30 min
              </div>
              <NotificationBell {...notifications} compact />
            </div>
          </div>
          <div className="mt-2">
            <div className="inline-flex w-fit max-w-full items-center gap-2 rounded-2xl border border-white/70 bg-white/80 px-3 py-2 text-[11px] font-black text-zinc-600 shadow-sm">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-red-600" />
              <span className="truncate">Ankapur - Open now</span>
            </div>
          </div>
        </div>
      </header>

      <main className="min-h-screen pb-32 md:pb-10">{children}</main>

      <CustomerFooter />

      {showLiveOrder && order && (
        <Link
          to="/orders/$orderId"
          params={{ orderId: order.id }}
          className="fixed bottom-28 left-4 right-4 z-50 mx-auto flex max-w-md items-center justify-between rounded-[22px] border border-white/15 bg-zinc-950/94 px-3.5 py-2.5 text-white shadow-2xl shadow-zinc-950/30 backdrop-blur-2xl md:bottom-8 md:left-auto md:right-8 md:w-96"
        >
          <span className="min-w-0">
            <span className="block truncate text-[10px] font-black uppercase tracking-[0.16em] text-white/55">Current order #{order.id}</span>
            <span className="block truncate text-base font-black capitalize leading-tight">{order.status.replace(/_/g, " ")}</span>
            <span className="mt-0.5 block text-[11px] font-bold text-white/70">View tracking</span>
          </span>
          <span className="ml-3 shrink-0 rounded-2xl bg-green-400 px-3 py-1.5 text-sm font-black text-zinc-950">
            {order.delivery?.etaMinutes || order.delivery?.prepEtaMinutes || 20} min
          </span>
        </Link>
      )}

      {showCartTray && !showLiveOrder && (
        <Link
          to="/cart"
          className="fixed bottom-28 left-4 right-4 z-50 mx-auto flex max-w-md items-center justify-between rounded-[22px] border border-white/20 bg-red-600/95 px-4 py-2.5 text-white shadow-2xl shadow-red-600/30 backdrop-blur-2xl md:bottom-8 md:left-auto md:right-8 md:w-96"
        >
          <span className="flex min-w-0 items-center gap-3 font-bold">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/18">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <span className="truncate">{count} item{count > 1 ? "s" : ""} added</span>
          </span>
          <span className="shrink-0 font-black">Rs {subtotal} - Cart</span>
        </Link>
      )}

      {showCartTray && showLiveOrder && (
        <Link
          to="/cart"
          className="fixed bottom-[6.7rem] right-4 z-[51] inline-flex min-h-11 items-center gap-2 rounded-2xl bg-red-600 px-4 text-sm font-black text-white shadow-xl shadow-red-600/25 md:bottom-[6.4rem] md:right-8"
        >
          <ShoppingBag className="h-4 w-4" />
          {count} - Rs {subtotal}
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

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex min-w-0 items-center gap-2.5">
      <img src="/the-ankapure-dhaba-logo.png" alt="The Ankapure Dhaba logo" className={`${compact ? "h-11 w-11 rounded-2xl" : "h-12 w-12 rounded-[18px]"} shrink-0 object-cover shadow-lg shadow-red-600/20 ring-1 ring-white/80`} />
      <span className="min-w-0">
        <span className={`${compact ? "text-sm" : "text-[13px]"} block truncate font-black uppercase tracking-[0.14em] text-red-600`}>The Ankapure</span>
        <span className={`${compact ? "text-xs" : "text-sm"} block truncate font-black text-zinc-950`}>Dhaba</span>
      </span>
    </Link>
  );
}

function NavLink({ item, pathname }: { item: (typeof NAV)[number]; pathname: string }) {
  const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-black transition ${
        active ? "bg-zinc-950 text-white shadow-lg shadow-zinc-950/15" : "text-zinc-600 hover:bg-white hover:text-zinc-950"
      }`}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}

function NotificationBell({
  notices,
  unread,
  permission,
  requestPermission,
  markAllRead,
  compact = false,
}: ReturnType<typeof useLocalNotifications> & { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) markAllRead();
        }}
        className={`${compact ? "h-11 w-11" : "h-11 w-11"} relative grid place-items-center rounded-2xl bg-white/85 text-zinc-800 shadow-sm ring-1 ring-white/80 transition hover:text-red-600`}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white" />}
      </button>
      {open && (
        <div className={`absolute right-0 top-[3.25rem] z-[70] w-[min(92vw,360px)] overflow-hidden rounded-[26px] border border-white/75 bg-white/95 shadow-2xl shadow-zinc-950/18 backdrop-blur-2xl ${compact ? "right-[-2px]" : ""}`}>
          <div className="border-b border-zinc-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">Notifications</h2>
                <p className="text-xs font-semibold text-zinc-500">Offers and order updates on this device</p>
              </div>
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-600">{permission}</span>
            </div>
            {permission !== "granted" && (
              <button onClick={requestPermission} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 text-sm font-black text-white">
                <Bell className="h-4 w-4" />
                Enable notifications
              </button>
            )}
          </div>
          <div className="max-h-[360px] overflow-y-auto p-2">
            {notices.map((notice) => (
              <div key={notice.id} className="rounded-2xl p-3 transition hover:bg-zinc-50">
                <div className="flex items-start gap-3">
                  <span className={`mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-2xl ${notice.tone === "order" ? "bg-green-50 text-green-700" : notice.tone === "offer" ? "bg-red-50 text-red-600" : "bg-zinc-100 text-zinc-600"}`}>
                    {notice.tone === "order" ? <CheckCircle2 className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-black text-zinc-950">{notice.title}</span>
                    <span className="mt-0.5 block text-sm leading-snug text-zinc-600">{notice.body}</span>
                    <span className="mt-1 block text-[11px] font-bold text-zinc-400">{notice.time}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function useLocalNotifications() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    return Notification.permission;
  });
  const [notices, setNotices] = useState<LocalNotice[]>(() => [
    {
      id: "welcome",
      title: "Welcome to The Ankapure Dhaba",
      body: "Enable notifications for live order and offer updates on this device.",
      time: "Just now",
      tone: "system",
      read: false,
    },
  ]);

  const unread = useMemo(() => notices.filter((notice) => !notice.read).length, [notices]);

  function pushNotice(input: Omit<LocalNotice, "id" | "time" | "read">) {
    const notice: LocalNotice = {
      ...input,
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      read: false,
    };
    setNotices((current) => [notice, ...current].slice(0, 12));
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification(notice.title, { body: notice.body, icon: "/favicon.ico" });
    }
  }

  async function requestPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      toast.error("This browser does not support notifications");
      return;
    }
    const next = await Notification.requestPermission();
    setPermission(next);
    if (next === "granted") {
      toast.success("Notifications enabled on this device");
      pushNotice({ title: "Notifications enabled", body: "You will see local offer and order updates here.", tone: "system" });
    } else {
      toast.error("Notification permission was not granted");
    }
  }

  function markAllRead() {
    setNotices((current) => current.map((notice) => ({ ...notice, read: true })));
  }

  useEffect(() => {
    if (typeof window === "undefined" || permission !== "default") return;
    if (window.localStorage.getItem("ankapur-notification-prompted") === "yes") return;
    window.localStorage.setItem("ankapur-notification-prompted", "yes");
    const id = window.setTimeout(() => {
      toast("Enable live order notifications?", {
        description: "Allow this device to show order status and offer alerts.",
        action: { label: "Allow", onClick: requestPermission },
      });
    }, 1200);
    return () => window.clearTimeout(id);
  }, [permission]);

  useEffect(() => {
    const unsubscribeContent = subscribeToCustomerContent((event) => {
      pushNotice({
        title: contentNoticeTitle(event.type),
        body: "Open the app to see the latest menu, offer, or store update.",
        tone: "offer",
      });
    });
    const unsubscribeOrders = subscribeToOrderEvents((event) => {
      if (!event.order) {
        pushNotice({
          title: "Order update",
          body: "An order changed. Open Orders for the latest status.",
          tone: "order",
        });
        return;
      }
      pushNotice({
        title: `Order #${event.order.id}`,
        body: `Status updated to ${event.order.status.replace(/_/g, " ")}.`,
        tone: "order",
      });
    });
    return () => {
      unsubscribeContent();
      unsubscribeOrders();
    };
  }, []);

  return { notices, unread, permission, requestPermission, markAllRead };
}

function contentNoticeTitle(type: string) {
  if (type === "banner") return "New banner offer";
  if (type === "coupon") return "New coupon available";
  if (type === "announcement") return "Restaurant announcement";
  if (type === "store") return "Restaurant status updated";
  return "The Ankapure Dhaba updated";
}

function CustomerFooter() {
  return (
    <footer className="hidden border-t border-zinc-200 bg-zinc-950 px-4 pb-32 pt-10 text-white md:block md:px-6 md:pb-10">
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
