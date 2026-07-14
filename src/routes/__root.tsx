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
import { getFirebaseAnalytics } from "../lib/firebase";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CustomerShell } from "@/components/site/CustomerShell";
import { Toaster } from "@/components/ui/sonner";

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl tracking-widest text-primary">Something burnt</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We hit a snag plating this page. Try again or head home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-5 py-2.5 font-display text-sm tracking-widest text-primary-foreground hover:bg-primary-glow"
          >
            Try again
          </button>
          <a href="/" className="rounded-md border border-border bg-surface px-5 py-2.5 font-display text-sm tracking-widest hover:border-primary/40">
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
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#C62828" },
      { title: "Ankapur Dhaba — Ankapur Chicken, Biryani & Telangana Classics" },
      {
        name: "description",
        content:
          "Order slow-cooked Ankapur chicken, Hyderabadi biryani and Telangana classics from Ankapur Dhaba. Delivery, pickup, dine-in.",
      },
      { property: "og:title", content: "Ankapur Dhaba — Ankapur Chicken, Biryani & Telangana Classics" },
      { property: "og:description", content: "A PWA for restaurants to manage online ordering, KOT, and delivery for customers and staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Ankapur Dhaba — Ankapur Chicken, Biryani & Telangana Classics" },
      { name: "description", content: "A PWA for restaurants to manage online ordering, KOT, and delivery for customers and staff." },
      { name: "twitter:description", content: "A PWA for restaurants to manage online ordering, KOT, and delivery for customers and staff." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fd0bce0e-92e2-437e-9c38-67d40982e514/id-preview-9ef9aefd--ec5a08b1-d817-4523-b6e0-4a65406ba29c.lovable.app-1782314593038.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fd0bce0e-92e2-437e-9c38-67d40982e514/id-preview-9ef9aefd--ec5a08b1-d817-4523-b6e0-4a65406ba29c.lovable.app-1782314593038.png" },
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
  return (
    <html lang="en">
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isStaff = pathname.startsWith("/admin") || pathname.startsWith("/kitchen") || pathname.startsWith("/delivery") || pathname.startsWith("/restaurant/delivery");
  const isCustomerApp = isCustomerAppPath(pathname);

  useEffect(() => {
    void getFirebaseAnalytics();
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (import.meta.env.DEV) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      }).catch(() => undefined);
      return;
    }
    if (import.meta.env.PROD) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {isStaff ? (
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
  return ["/menu", "/cart", "/checkout", "/orders", "/favorites", "/profile", "/account", "/track", "/t"].some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
