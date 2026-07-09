import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { LogIn, UtensilsCrossed, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import type { UserRole, AuthUser } from '@/stores/auth';

const API_BASE = 'http://localhost:4000/api';

export const Route = createFileRoute('/login')({
  head: () => ({ meta: [{ title: 'Login · Ankapur Dhaba' }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect
  if (isAuthenticated() && user) {
    const dest = redirectFor(user.role);
    navigate({ to: dest });
    return null;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!phone || !password) return toast.error('Please fill in all fields');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error || 'Login failed');

      login(data.token, data.user as AuthUser);
      toast.success(`Welcome back, ${data.user.name}!`);
      navigate({ to: redirectFor(data.user.role as UserRole) });
    } catch {
      toast.error('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Background gradient blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <UtensilsCrossed className="h-7 w-7 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="font-display text-3xl tracking-widest text-foreground">ANKAPUR DHABA</h1>
            <p className="mt-1 text-xs tracking-widest text-muted-foreground">SIGN IN TO YOUR ACCOUNT</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-surface/80 p-7 shadow-2xl backdrop-blur-sm">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="mb-1.5 block font-display text-xs tracking-widest text-muted-foreground">PHONE NUMBER</label>
              <input
                id="login-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                inputMode="tel"
                className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
              />
            </div>

            <div>
              <label className="mb-1.5 block font-display text-xs tracking-widest text-muted-foreground">PASSWORD</label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full rounded-lg border border-input bg-background px-4 py-3 pr-11 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-display text-sm tracking-widest text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              {loading ? 'SIGNING IN...' : 'SIGN IN'}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <a href="/signup" className="font-medium text-primary hover:underline">
              Sign up
            </a>
          </div>
        </div>

        {/* Role hint */}
        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          Kitchen & Delivery accounts are created by the Admin.
        </p>
      </div>
    </div>
  );
}

function redirectFor(role: UserRole): string {
  switch (role) {
    case 'ADMIN': return '/admin';
    case 'KITCHEN': return '/kitchen';
    case 'DELIVERY': return '/restaurant/delivery';
    default: return '/';
  }
}
