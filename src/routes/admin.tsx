import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, UtensilsCrossed, ClipboardList, ArrowLeft, ChefHat, QrCode, Bike, Store, Users, ReceiptText, Megaphone } from "lucide-react";
import { useAuth } from "@/stores/auth";
import { subscribeToCustomerContent, subscribeToOrderEvents } from "@/services/api";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin · Ankapur Dhaba" }, { name: "robots", content: "noindex" }] }),
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
  { to: "/kitchen", label: "Kitchen", icon: ChefHat },
  { to: "/delivery", label: "Delivery", icon: Bike },
];

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { hasRole, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated() || !hasRole('ADMIN')) {
      navigate({ to: '/login' });
    }
  }, [mounted, isAuthenticated, hasRole, navigate]);

  useEffect(() => {
    if (!mounted || !isAuthenticated() || !hasRole("ADMIN")) return;

    const notify = (title: string, body: string) => {
      toast.info(body);
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
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
        event.order ? `Order #${event.order.id} updated to ${event.order.status.replace(/_/g, " ")}.` : "Orders changed. Refreshing admin queues.",
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

  if (!mounted || !isAuthenticated() || !hasRole('ADMIN')) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground font-display tracking-widest">REDIRECTING...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              <span className="font-display text-sm tracking-widest">ANKAPUR DHABA</span>
            </Link>
            <span className="hidden h-6 w-px bg-border md:block" />
            <span className="hidden font-display text-xs tracking-[0.4em] text-primary md:inline">ADMIN</span>
          </div>
          <nav className="flex gap-1">
            {NAV.map((n) => {
              const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`inline-flex items-center gap-2 rounded-md px-3 py-2 font-display text-xs tracking-widest transition ${
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface hover:text-foreground"
                  }`}
                >
                  <n.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{n.label.toUpperCase()}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <Outlet />
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
