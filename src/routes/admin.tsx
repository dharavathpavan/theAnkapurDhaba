import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ClipboardList,
  ChefHat,
  QrCode,
  Bike,
  Store,
  Users,
  ReceiptText,
  Megaphone,
  Bell,
  LogOut,
  PanelLeft,
  ShieldCheck,
  Headphones,
} from "lucide-react";
import { useAuth } from "@/stores/auth";
import { subscribeToCustomerContent, subscribeToOrderEvents } from "@/services/api";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin · Ankapur Dhaba" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/billing", label: "Billing", icon: ReceiptText },
  { to: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList },
  { to: "/admin/tables", label: "Tables", icon: QrCode },
  { to: "/admin/store", label: "Store", icon: Store },
  { to: "/admin/marketing", label: "Marketing", icon: Megaphone },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/support", label: "Support", icon: Headphones },
  { to: "/kitchen", label: "Kitchen", icon: ChefHat },
  { to: "/delivery", label: "Delivery", icon: Bike },
];

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { hasRole, isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated() || !hasRole("ADMIN")) {
      navigate({ to: "/login" });
    }
  }, [mounted, isAuthenticated, hasRole, navigate]);

  useEffect(() => {
    if (!mounted || !isAuthenticated() || !hasRole("ADMIN")) return;

    const notify = (title: string, body: string) => {
      toast.info(body);
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification(title, { body, icon: "/favicon.ico" });
      }
    };

    const unsubscribeOrders = subscribeToOrderEvents((event) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      qc.invalidateQueries({ queryKey: ["delivery-orders"] });
      if (event.order?.id) qc.invalidateQueries({ queryKey: ["order", event.order.id] });
      notify(
        "Admin order update",
        event.order
          ? `Order #${event.order.id} updated to ${event.order.status.replace(/_/g, " ")}.`
          : "Orders changed. Refreshing admin queues.",
      );
    });

    const unsubscribeContent = subscribeToCustomerContent((event) => {
      qc.invalidateQueries({ queryKey: ["admin-customer-content"] });
      qc.invalidateQueries({ queryKey: ["customer-home"] });
      qc.invalidateQueries({ queryKey: ["customer-menu"] });
      notify("Admin content update", adminContentNotice(event.type));
    });

    return () => {
      unsubscribeOrders();
      unsubscribeContent();
    };
  }, [mounted, isAuthenticated, hasRole, qc]);

  if (!mounted || !isAuthenticated() || !hasRole("ADMIN")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground font-display tracking-widest">REDIRECTING...</p>
      </div>
    );
  }

  const current = NAV.find((n) => (n.exact ? pathname === n.to : pathname.startsWith(n.to)));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[292px] border-r border-white/10 bg-[#110f12] text-white shadow-2xl transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 p-5">
            <Link
              to="/admin"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3"
            >
              <img
                src="/the-ankapure-dhaba-logo.png"
                alt="The Ankapure Dhaba"
                className="h-14 w-14 rounded-2xl border border-white/10 bg-black object-cover shadow-lg"
              />
              <div>
                <div className="font-display text-sm tracking-[0.24em] text-red-300">
                  THE ANKAPURE
                </div>
                <div className="text-lg font-black leading-tight">Dhaba Admin</div>
                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-200">
                  <ShieldCheck className="h-3 w-3" /> Live Control
                </div>
              </div>
            </Link>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {NAV.map((n) => {
              const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setSidebarOpen(false)}
                  className={`group flex min-h-12 items-center gap-3 rounded-2xl px-4 text-sm font-bold transition ${
                    active
                      ? "bg-red-600 text-white shadow-lg shadow-red-950/30"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <n.icon className="h-5 w-5 shrink-0" />
                  <span>{n.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-white/10 p-4">
            <div className="rounded-2xl bg-white/8 p-4">
              <div className="text-xs uppercase tracking-widest text-white/45">Signed in</div>
              <div className="mt-1 truncate text-sm font-bold">{user?.name || "Admin"}</div>
              <div className="text-xs text-white/55">{user?.phone || "Restaurant control"}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate({ to: "/login" });
              }}
              className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          aria-label="Close admin menu"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="lg:pl-[292px]">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
          <div className="flex min-h-20 items-center justify-between gap-3 px-4 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-surface text-foreground shadow-sm lg:hidden"
              >
                <PanelLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <div className="font-display text-[11px] tracking-[0.24em] text-red-600">
                  THE ANKAPURE DHABA
                </div>
                <h1 className="truncate text-xl font-black md:text-2xl">
                  {current?.label || "Admin"} Console
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/"
                className="hidden rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-bold text-muted-foreground shadow-sm hover:text-primary md:inline-flex"
              >
                View website
              </Link>
              <button
                type="button"
                className="relative grid h-11 w-11 place-items-center rounded-2xl border border-border bg-surface shadow-sm"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white" />
              </button>
            </div>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}

function adminContentNotice(type: string) {
  if (type === "banner") return "Banner changes are live on the customer app.";
  if (type === "coupon") return "Coupon changes are live on the customer app.";
  if (type === "announcement") return "Announcement changes are live on the customer app.";
  if (type === "store") return "Store settings changed and customer screens are refreshing.";
  return "Customer app content changed and screens are refreshing.";
}
