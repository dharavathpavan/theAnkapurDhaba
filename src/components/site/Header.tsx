import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useCart, selectCartCount } from "@/stores/cart";
import { useAuth } from "@/stores/auth";
import {
  ShoppingBag,
  Menu as MenuIcon,
  X,
  Utensils,
  LogIn,
  LogOut,
  ChefHat,
  Bike,
  LayoutDashboard,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { StoreStatusBanner } from "@/components/site/StoreStatusBanner";
import { toast } from "sonner";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/menu", label: "Menu" },
  { to: "/orders", label: "Orders" },
];

export function Header() {
  const [mounted, setMounted] = useState(false);
  const count = useCart(selectCartCount);
  const tableNumber = useCart((s) => s.tableNumber);
  const setTable = useCart((s) => s.setTable);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    setMounted(true);
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!mounted) return null;

  function handleLogout() {
    logout();
    setDropdownOpen(false);
    toast.success("Signed out successfully");
    navigate({ to: "/" });
  }

  const isLoggedIn = isAuthenticated();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <StoreStatusBanner />
      {tableNumber && (
        <div className="bg-primary/15 text-primary">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 md:px-6">
            <div className="inline-flex items-center gap-2 font-display text-xs tracking-[0.3em]">
              <Utensils className="h-3.5 w-3.5" /> DINE-IN · TABLE {tableNumber}
            </div>
            <button
              onClick={() => setTable(null)}
              className="font-display text-[10px] tracking-[0.3em] text-primary/80 underline-offset-4 hover:underline"
            >
              CLEAR TABLE
            </button>
          </div>
        </div>
      )}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span
            className="grid h-9 w-9 place-items-center rounded-sm font-display text-lg text-primary-foreground"
            style={{ background: "var(--gradient-ember)" }}
          >
            AD
          </span>
          <div className="leading-none">
            <div className="font-display text-2xl tracking-widest">ANKAPUR DHABA</div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Ankapur · Telangana
            </div>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((n) => {
            const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`font-display text-sm tracking-[0.25em] transition ${
                  active ? "text-primary" : "text-foreground/80 hover:text-primary"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <Link
            to="/cart"
            aria-label="Cart"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface transition hover:border-primary/40"
          >
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 font-display text-[11px] text-primary-foreground">
                {count}
              </span>
            )}
          </Link>

          {/* User Dropdown */}
          {isLoggedIn && user ? (
            <div className="relative hidden md:block" ref={dropdownRef}>
              <button
                id="user-menu-button"
                onClick={() => setDropdownOpen((v) => !v)}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 font-display text-xs tracking-widest transition hover:border-primary/40"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/20 text-xs text-primary font-bold uppercase">
                  {user.name.charAt(0)}
                </span>
                <span className="max-w-[80px] truncate">{user.name}</span>
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-12 z-50 min-w-[180px] rounded-xl border border-border bg-surface shadow-2xl py-1 overflow-hidden">
                  <div className="px-4 py-2 border-b border-border">
                    <p className="text-xs font-medium text-foreground truncate">{user.name}</p>
                    <p className="text-[10px] text-muted-foreground tracking-widest uppercase">
                      {user.role}
                    </p>
                  </div>
                  {user.role === "ADMIN" && (
                    <Link
                      to="/admin"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-primary/10 hover:text-primary transition"
                    >
                      <LayoutDashboard className="h-4 w-4" /> Admin Dashboard
                    </Link>
                  )}
                  {user.role === "KITCHEN" && (
                    <Link
                      to="/kitchen"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-primary/10 hover:text-primary transition"
                    >
                      <ChefHat className="h-4 w-4" /> Kitchen Display
                    </Link>
                  )}
                  {user.role === "DELIVERY" && (
                    <Link
                      to="/delivery"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-primary/10 hover:text-primary transition"
                    >
                      <Bike className="h-4 w-4" /> Delivery Dashboard
                    </Link>
                  )}
                  {user.role === "USER" && (
                    <Link
                      to="/account"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-primary/10 hover:text-primary transition"
                    >
                      My Account
                    </Link>
                  )}
                  <button
                    id="header-logout"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition"
                  >
                    <LogOut className="h-4 w-4" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden md:inline-flex items-center gap-2 rounded-md bg-primary px-4 h-10 font-display text-xs tracking-widest text-primary-foreground transition hover:bg-primary/90"
            >
              <LogIn className="h-4 w-4" /> SIGN IN
            </Link>
          )}

          <button
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md border border-border"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col px-4 py-2">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="border-b border-border/60 py-3 font-display text-base tracking-[0.2em]"
              >
                {n.label}
              </Link>
            ))}
            {isLoggedIn && user ? (
              <>
                {user.role === "ADMIN" && (
                  <Link
                    to="/admin"
                    onClick={() => setOpen(false)}
                    className="border-b border-border/60 py-3 font-display text-base tracking-[0.2em]"
                  >
                    Admin
                  </Link>
                )}
                {user.role === "KITCHEN" && (
                  <Link
                    to="/kitchen"
                    onClick={() => setOpen(false)}
                    className="border-b border-border/60 py-3 font-display text-base tracking-[0.2em]"
                  >
                    Kitchen
                  </Link>
                )}
                {user.role === "DELIVERY" && (
                  <Link
                    to="/delivery"
                    onClick={() => setOpen(false)}
                    className="border-b border-border/60 py-3 font-display text-base tracking-[0.2em]"
                  >
                    Delivery
                  </Link>
                )}
                <button
                  onClick={() => {
                    handleLogout();
                    setOpen(false);
                  }}
                  className="py-3 font-display text-base tracking-[0.2em] text-red-400 text-left"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="py-3 font-display text-base tracking-[0.2em] text-primary"
              >
                Sign In
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
