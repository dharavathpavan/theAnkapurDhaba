import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { UserPlus, UtensilsCrossed, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/stores/auth';
import type { AuthUser } from '@/stores/auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export const Route = createFileRoute('/signup')({
  head: () => ({ meta: [{ title: 'Sign Up · Ankapur Dhaba' }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated()) {
    navigate({ to: '/' });
    return null;
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !phone || !password || !confirm) return toast.error('Please fill in all fields');
    if (!/^[6-9]\d{9}$/.test(phone)) return toast.error('Enter a valid 10-digit Indian mobile number');
    if (password.length < 6) return toast.error('Password must be at least 6 characters');
    if (password !== confirm) return toast.error('Passwords do not match');

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone, password }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error || 'Signup failed');

      login(data.token, data.user as AuthUser);
      toast.success(`Welcome to Ankapur Dhaba, ${data.user.name}!`);
      navigate({ to: '/' });
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
        <div className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-32 bottom-20 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <UtensilsCrossed className="h-7 w-7 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="font-display text-3xl tracking-widest text-foreground">ANKAPUR DHABA</h1>
            <p className="mt-1 text-xs tracking-widest text-muted-foreground">CREATE YOUR ACCOUNT</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-surface/80 p-7 shadow-2xl backdrop-blur-sm">
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="mb-1.5 block font-display text-xs tracking-widest text-muted-foreground">FULL NAME</label>
              <input
                id="signup-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
              />
            </div>

            <div>
              <label className="mb-1.5 block font-display text-xs tracking-widest text-muted-foreground">PHONE NUMBER</label>
              <input
                id="signup-phone"
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
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
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

            <div>
              <label className="mb-1.5 block font-display text-xs tracking-widest text-muted-foreground">CONFIRM PASSWORD</label>
              <input
                id="signup-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
              />
            </div>

            <button
              id="signup-submit"
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-display text-sm tracking-widest text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <a href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
