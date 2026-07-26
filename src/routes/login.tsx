import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, LogIn, MessageSquareText, UtensilsCrossed } from "lucide-react";
import { resetFirebaseOtp, sendFirebasePhoneOtp, verifyFirebasePhoneOtp } from "@/lib/firebase";
import { useAuth } from "@/stores/auth";
import type { UserRole, AuthUser } from "@/stores/auth";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

type LoginMode = "otp" | "password";

const OTP_RESEND_SECONDS = 30;

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Login - The Ankapure Dhaba" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();
  const [mode, setMode] = useState<LoginMode>("otp");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  useEffect(() => {
    if (otpCooldown <= 0) return undefined;
    const timer = window.setTimeout(() => setOtpCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [otpCooldown]);

  if (isAuthenticated() && user) {
    const dest = redirectFor(user.role);
    navigate({ to: dest });
    return null;
  }

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      ...(SUPABASE_PUBLISHABLE_KEY ? { apikey: SUPABASE_PUBLISHABLE_KEY } : {}),
    };
  }

  function finishLogin(data: { token: string; user: AuthUser }) {
    login(data.token, data.user);
    toast.success(`Welcome back, ${data.user.name}!`);
    navigate({ to: redirectFor(data.user.role as UserRole) });
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!phone || !password) return toast.error("Please enter your phone number and password.");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(data.error || "Login failed");
      finishLogin({ token: data.token, user: data.user as AuthUser });
    } catch {
      toast.error("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp() {
    if (phone.length !== 10) return toast.error("Enter a valid 10-digit mobile number.");
    if (otpCooldown > 0) return toast.message(`Please wait ${otpCooldown}s before requesting another OTP.`);
    setOtpSending(true);
    try {
      resetFirebaseOtp();
      await sendFirebasePhoneOtp(phone);
      setOtpSent(true);
      setOtpCooldown(OTP_RESEND_SECONDS);
      toast.success("OTP sent. It usually arrives within a few seconds.");
    } catch (error) {
      resetFirebaseOtp();
      toast.error(firebaseOtpError(error));
    } finally {
      setOtpSending(false);
    }
  }

  async function handleOtpLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!otpSent) {
      await handleSendOtp();
      return;
    }
    if (otp.trim().length < 6) return toast.error("Enter the 6-digit OTP.");

    setLoading(true);
    try {
      const idToken = await verifyFirebasePhoneOtp(otp);
      const res = await fetch(`${API_BASE}/auth/firebase-login`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return toast.error(data.error || "OTP login failed");
      finishLogin({ token: data.token, user: data.user as AuthUser });
    } catch (error) {
      toast.error(firebaseOtpError(error));
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode: LoginMode) {
    setMode(nextMode);
    setOtp("");
    setOtpSent(false);
    setOtpCooldown(0);
    resetFirebaseOtp();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <UtensilsCrossed className="h-7 w-7 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="font-display text-3xl tracking-widest text-foreground">THE ANKAPURE DHABA</h1>
            <p className="mt-1 text-xs tracking-widest text-muted-foreground">SIGN IN TO YOUR ACCOUNT</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface/85 p-6 shadow-2xl backdrop-blur-sm sm:p-7">
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-muted/50 p-1 text-xs font-semibold uppercase tracking-widest">
            <button
              type="button"
              onClick={() => switchMode("otp")}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 transition ${
                mode === "otp" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquareText className="h-4 w-4" /> OTP
            </button>
            <button
              type="button"
              onClick={() => switchMode("password")}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 transition ${
                mode === "password" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <KeyRound className="h-4 w-4" /> Password
            </button>
          </div>

          <form onSubmit={mode === "otp" ? handleOtpLogin : handlePasswordLogin} className="space-y-5">
            <div>
              <label className="mb-1.5 block font-display text-xs tracking-widest text-muted-foreground">
                PHONE NUMBER
              </label>
              <input
                id="login-phone"
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                  setOtpSent(false);
                  setOtp("");
                  setOtpCooldown(0);
                  resetFirebaseOtp();
                }}
                placeholder="10-digit mobile number"
                inputMode="tel"
                className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {mode === "otp" ? (
              <div className="space-y-3">
                {otpSent ? (
                  <div>
                    <label className="mb-1.5 block font-display text-xs tracking-widest text-muted-foreground">
                      OTP CODE
                    </label>
                    <input
                      id="login-otp"
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="Enter 6-digit OTP"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className="w-full rounded-lg border border-input bg-background px-4 py-3 text-center text-lg font-semibold tracking-[0.4em] text-foreground placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-muted-foreground transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpSending || phone.length !== 10 || otpCooldown > 0}
                  className="w-full rounded-lg border border-primary/25 bg-primary/10 py-3 text-sm font-semibold text-primary transition hover:bg-primary/15 disabled:opacity-60"
                >
                  {otpSending ? "SENDING OTP..." : otpCooldown > 0 ? `RESEND IN ${otpCooldown}s` : otpSent ? "RESEND OTP" : "SEND OTP"}
                </button>
              </div>
            ) : (
              <div>
                <label className="mb-1.5 block font-display text-xs tracking-widest text-muted-foreground">
                  PASSWORD
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    className="w-full rounded-lg border border-input bg-background px-4 py-3 pr-11 text-sm text-foreground placeholder:text-muted-foreground transition focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              disabled={loading || otpSending || (mode === "otp" && !otpSent)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-display text-sm tracking-widest text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              {loading ? "SIGNING IN..." : mode === "otp" ? "VERIFY & SIGN IN" : "SIGN IN"}
            </button>
          </form>

          <div id="firebase-recaptcha" className="min-h-0" />

          <div className="mt-5 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <a href="/signup" className="font-medium text-primary hover:underline">
              Sign up
            </a>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/70">
          OTP login is for customers. Admin, Kitchen, Waiter and Delivery staff should use password login.
        </p>
      </div>
    </div>
  );
}

function firebaseOtpError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("auth/too-many-requests")) return "Too many OTP attempts. Please try again later.";
  if (message.includes("auth/invalid-phone-number")) return "Enter a valid mobile number.";
  if (message.includes("auth/invalid-verification-code")) return "Invalid OTP. Please check and try again.";
  if (message.includes("auth/code-expired")) return "OTP expired. Please request a new OTP.";
  if (message.includes("auth/captcha-check-failed")) return "Security check failed. Please refresh and try again.";
  return message || "OTP login failed. Please try again.";
}

function redirectFor(role: UserRole | string): string {
  switch (role.trim().toUpperCase()) {
    case "ADMIN":
      return "/admin";
    case "KITCHEN":
      return "/kitchen";
    case "DELIVERY":
      return "/restaurant/delivery";
    case "WAITER":
      return "/waiter";
    default:
      return "/";
  }
}
