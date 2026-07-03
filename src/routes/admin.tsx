import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, UtensilsCrossed, ClipboardList, ArrowLeft, ChefHat, QrCode, Bike, Store, Users, ReceiptText, Megaphone } from "lucide-react";
import { useAuth } from "@/stores/auth";
import { useEffect, useState } from "react";

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
