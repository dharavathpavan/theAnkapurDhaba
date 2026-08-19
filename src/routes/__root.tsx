import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import {
  installChunkRecovery,
  isMissingChunkError,
  recoverFromMissingChunk,
} from "../lib/chunk-recovery";
import { getFirebaseAnalytics } from "../lib/firebase";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerShell } from "@/components/site/CustomerShell";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/stores/auth";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-8xl text-primary">404</h1>
        <h2 className="mt-2 font-display text-2xl tracking-widest">Off the menu</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This page isn't on tonight's tasting list.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 font-display text-sm tracking-widest text-primary-foreground transition hover:bg-primary-glow"
        >
          Back to the dhaba
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  const isChunkError = isMissingChunkError(error);

  useEffect(() => {
    if (isChunkError) {
      void recoverFromMissingChunk();
    }
  }, [isChunkError]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl tracking-widest text-primary">Something burnt</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isChunkError
            ? "Updating the app. This page will reload automatically."
            : "We hit a snag plating this page. Try again or head home."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-5 py-2.5 font-display text-sm tracking-widest text-primary-foreground hover:bg-primary-glow"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-md border border-border bg-surface px-5 py-2.5 font-display text-sm tracking-widest hover:border-primary/40"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#C62828" },
      { title: "Ankapur Dhaba — Ankapur Chicken, Biryani & Telangana Classics" },
      {
        name: "description",
        content:
          "Order slow-cooked Ankapur chicken, Hyderabadi biryani and Telangana classics from Ankapur Dhaba. Delivery, pickup, dine-in.",
      },
      {
        name: "apple-mobile-web-app-capable",
        content: "yes",
      },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "default",
      },
      {
        name: "apple-mobile-web-app-title",
        content: "Ankapur Dhaba",
      },
      { name: "mobile-web-app-capable", content: "yes" },
      {
        property: "og:title",
        content: "Ankapur Dhaba — Ankapur Chicken, Biryani & Telangana Classics",
      },
      {
        property: "og:description",
        content:
          "Order slow-cooked Ankapur chicken, Hyderabadi biryani and Telangana classics from Ankapur Dhaba. Delivery, pickup, dine-in.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/pwa-icon-512.png" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "Ankapur Dhaba — Ankapur Chicken, Biryani & Telangana Classics",
      },
      {
        name: "twitter:description",
        content:
          "Order slow-cooked Ankapur chicken, Hyderabadi biryani and Telangana classics from Ankapur Dhaba. Delivery, pickup, dine-in.",
      },
      { name: "twitter:image", content: "/pwa-icon-512.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@300;400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isStaff =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/kitchen") ||
    pathname.startsWith("/delivery") ||
    pathname.startsWith("/waiter") ||
    pathname.startsWith("/restaurant/delivery") ||
    pathname.startsWith("/restaurant/waiter");
  const dataTheme = isStaff || pathname === "/login" || pathname === "/signup" ? "dark" : "light";
  return (
    <html lang="en" data-theme={dataTheme}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { ready, hydrate } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isStaff =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/kitchen") ||
    pathname.startsWith("/delivery") ||
    pathname.startsWith("/waiter") ||
    pathname.startsWith("/restaurant/delivery") ||
    pathname.startsWith("/restaurant/waiter");
  const isCustomerApp = isCustomerAppPath(pathname);

  useEffect(() => {
    installChunkRecovery();
    void getFirebaseAnalytics();
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const clearWorkers = () => {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          registrations.forEach((registration) => registration.unregister());
        })
        .catch(() => undefined);
      caches
        .keys()
        .then((keys) => {
          keys.filter((key) => key.startsWith("ankapur-")).forEach((key) => caches.delete(key));
        })
        .catch(() => undefined);
    };
    if (import.meta.env.DEV || isStaff || pathname === "/login" || pathname === "/signup") {
      clearWorkers();
      return;
    }
    if (import.meta.env.PROD && isCustomerApp) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, [isCustomerApp, isStaff, pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      {!ready ? (
        pathname === "/login" || pathname === "/signup" ? (
          <LoginSkeleton />
        ) : (
          <AppSkeleton />
        )
      ) : isStaff ? (
        <div className="flex min-h-screen flex-col">
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      ) : isCustomerApp ? (
        <CustomerShell>
          <Outlet />
        </CustomerShell>
      ) : (
        <Outlet />
      )}
      <Toaster richColors theme="dark" position="top-center" />
    </QueryClientProvider>
  );
}

function isCustomerAppPath(pathname: string) {
  if (pathname === "/") return true;
  return [
    "/menu",
    "/cart",
    "/checkout",
    "/orders",
    "/favorites",
    "/profile",
    "/wallet",
    "/support",
    "/account",
    "/track",
    "/t",
  ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function LoginSkeleton() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <div className="relative w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute -inset-2 rounded-[28px] bg-primary/25 blur-2xl" />
            <Skeleton className="relative h-24 w-24 rounded-[24px]" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-8 w-60" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface/85 p-6 shadow-2xl backdrop-blur-sm sm:p-7">
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-1">
            <Skeleton className="h-9 rounded-lg" />
            <Skeleton className="h-9 rounded-lg" />
          </div>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        </div>
        <div className="mt-6 flex flex-col items-center gap-2">
          <Skeleton className="h-3 w-64" />
          <Skeleton className="h-3 w-52" />
        </div>
      </div>
    </div>
  );
}

function AppSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/60 bg-background/85 px-4 backdrop-blur-sm sm:px-6">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-12 w-12 rounded-[18px]" />
          <div className="hidden flex-col gap-2 sm:flex">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-56" />
        <div className="mt-5 flex gap-4 overflow-hidden pb-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 min-w-56 flex-1 rounded-2xl" />
          ))}
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      </main>
    </div>
  );
}
