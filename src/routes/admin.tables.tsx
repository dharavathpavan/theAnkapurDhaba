import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { QrCode, Printer } from "lucide-react";

export const Route = createFileRoute("/admin/tables")({
  component: AdminTables,
});

function qrSrc(url: string, size = 320) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(
    url,
  )}`;
}

function AdminTables() {
  const [count, setCount] = useState(12);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const tables = Array.from({ length: count }, (_, i) => String(i + 1));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-wide">QR Tables</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Print and stick on each table. Scanning opens the menu for that table and routes orders to the kitchen as KOT.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            Tables
            <input
              type="number"
              min={1}
              max={60}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
              className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-foreground"
            />
          </label>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-display text-xs tracking-widest text-primary-foreground hover:bg-primary-glow"
          >
            <Printer className="h-4 w-4" /> PRINT
          </button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {tables.map((t) => {
          const url = `${origin}/t/${t}`;
          return (
            <article key={t} className="rounded-xl border border-border bg-surface p-4 text-center">
              <div className="font-display text-xs tracking-[0.3em] text-muted-foreground">ANKAPUR DHABA</div>
              <div className="mt-1 font-display text-4xl tracking-wide text-primary">TABLE {t}</div>
              <div className="mt-3 grid place-items-center rounded-md bg-white p-3">
                <img src={qrSrc(url)} alt={`QR for table ${t}`} className="h-44 w-44" />
              </div>
              <div className="mt-3 inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                <QrCode className="h-3.5 w-3.5" /> /t/{t}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
