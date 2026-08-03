import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bluetooth,
  CheckCircle2,
  MonitorSmartphone,
  PlugZap,
  Printer,
  RefreshCcw,
  Save,
  Settings2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import {
  createPrinterHistory,
  getPrinters,
  logPrinterConnection,
  savePrinter,
  savePrinterSettings,
  saveStationPrinter,
  type KitchenStationPrinter,
  type PrinterRecord,
  type PrinterSettings,
} from "@/services/api";
import { compatibilityMessage, getPrinterRuntimeSupport, printTestJob, scanPrinterDevices, type DetectedPrinterDevice } from "@/lib/printer/manager";
import { useAuth } from "@/stores/auth";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/admin/kitchen/printer")({
  head: () => ({
    meta: [{ title: "Kitchen Printer Settings | The Ankapure Dhaba" }, { name: "robots", content: "noindex" }],
  }),
  component: KitchenPrinterPage,
});

const DEFAULT_STATIONS = ["General", "Biryani", "Tandoor", "Grill", "Drinks", "Desserts"];

function KitchenPrinterPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const canManage = hasRole("ADMIN");
  const support = getPrinterRuntimeSupport();
  const [savingStation, setSavingStation] = useState<string | null>(null);
  const [detectedDevices, setDetectedDevices] = useState<DetectedPrinterDevice[]>([]);
  const [testPrintOpen, setTestPrintOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ["printers"], queryFn: getPrinters });
  const settings = data?.settings;
  const defaultPrinter = data?.printers.find((printer) => printer.isDefault) || data?.printers[0] || null;

  const saveSettingsMutation = useMutation({
    mutationFn: savePrinterSettings,
    onSuccess: () => {
      toast.success("Printer settings saved");
      qc.invalidateQueries({ queryKey: ["printers"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save printer settings"),
  });

  const savePrinterMutation = useMutation({
    mutationFn: savePrinter,
    onSuccess: async (printer) => {
      await logPrinterConnection({ printerId: printer.id, message: "Printer saved from kitchen settings" }).catch(() => undefined);
      toast.success("Default printer saved");
      qc.invalidateQueries({ queryKey: ["printers"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save printer"),
  });

  const scanMutation = useMutation({
    mutationFn: scanPrinterDevices,
    onSuccess: (devices) => {
      setDetectedDevices(devices);
      if (devices.length) {
        toast.success(`${devices.length} printer device${devices.length > 1 ? "s" : ""} found`);
      } else {
        toast.warning("No printer devices found");
      }
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Printer scan failed";
      toast.error(message.includes("User cancelled") ? "Bluetooth scan cancelled" : message);
    },
  });

  const testPrintMutation = useMutation({
    mutationFn: async () => {
      if (!settings) throw new Error("Printer settings are still loading");
      const history = await createPrinterHistory({
        printerId: defaultPrinter?.id,
        orderNumber: "TEST",
        jobType: "test",
        copies: settings.copies,
        paperSize: settings.paperSize,
        status: "printing",
        message: "Kitchen printer test started",
      });
      const result = await printTestJob(defaultPrinter, settings);
      const useBrowserFallback = result.status === "failed" && result.message?.toLowerCase().includes("bridge");
      if (useBrowserFallback) setTestPrintOpen(true);
      await createPrinterHistory({
        printerId: defaultPrinter?.id,
        orderNumber: "TEST",
        jobType: "test",
        copies: settings.copies,
        paperSize: settings.paperSize,
        status: useBrowserFallback ? "success" : result.status,
        attempts: 1,
        message: useBrowserFallback
          ? "Bridge unavailable. Browser test print fallback opened."
          : result.message || (result.status === "success" ? "Test print completed" : "Bridge required or printer unavailable"),
        fingerprint: history.id,
        printedAt: result.status === "success" || useBrowserFallback ? result.printedAt || new Date().toISOString() : null,
      });
      return useBrowserFallback
        ? { ...result, status: "success" as const, message: "Browser test print opened. Select your thermal printer in the print dialog." }
        : result;
    },
    onSuccess: (result) => {
      toast[result.status === "success" ? "success" : "warning"](
        result.status === "success" ? "Test print sent" : result.message || "Bridge required for direct print",
      );
      qc.invalidateQueries({ queryKey: ["printer-history"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Test print failed"),
  });
  const status = defaultPrinter?.status || (support.directEscPos ? "disconnected" : "bridge_required");
  const printerLabel = defaultPrinter ? `${defaultPrinter.name} (${defaultPrinter.paperWidth})` : "EZO 58D not saved";

  return (
    <main className="min-h-screen bg-[#0f1115] p-4 text-white md:p-6">
      <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/30">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.24em] text-red-300">
              <Printer className="h-5 w-5" /> Kitchen Printer
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Bluetooth Printer Settings</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
              EZO 58D printing is prepared as ESC/POS bytes. Browser direct Bluetooth may require an Android or local print bridge for Bluetooth Classic printers.
            </p>
          </div>
          <button
            type="button"
            disabled={!canManage || savePrinterMutation.isPending}
            onClick={() =>
              savePrinterMutation.mutate({
                name: "EZO 58D",
                model: "EZO 58D",
                paperWidth: settings?.paperSize || "58mm",
                connectionType: support.androidBridge ? "android-bridge" : support.localBridge ? "local-bridge" : "bridge",
                isDefault: true,
                status: support.directEscPos ? "disconnected" : "bridge_required",
              })
            }
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 text-sm font-black text-white shadow-lg shadow-red-950/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Bluetooth className="h-5 w-5" /> Save EZO 58D
          </button>
        </div>
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-4 md:grid-cols-2">
          <StatusCard title="Printer Status" icon={PlugZap} value={statusLabel(status)} sub={printerLabel} tone={status === "connected" ? "green" : status === "bridge_required" ? "amber" : "slate"} />
          <StatusCard title="Runtime Support" icon={MonitorSmartphone} value={support.directEscPos ? "Bridge Ready" : "Bridge Required"} sub={compatibilityMessage()} tone={support.directEscPos ? "green" : "amber"} />
          <StatusCard title="Paper Size" icon={Settings2} value={settings?.paperSize || "58mm"} sub={`${settings?.copies || 1} print copy/copies`} tone="slate" />
          <StatusCard title="Auto Print" icon={RefreshCcw} value={settings?.autoPrint ? "Enabled" : "Disabled"} sub={settings?.autoReconnect ? "Auto reconnect on" : "Auto reconnect off"} tone={settings?.autoPrint ? "green" : "slate"} />
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-xl font-black">Print Rules</h2>
          <p className="mt-1 text-sm text-white/55">Admin controls auto-print, copies and paper size. Kitchen can print and reprint KOTs.</p>
          {isLoading ? (
            <div className="mt-5 h-32 animate-pulse rounded-3xl bg-white/8" />
          ) : (
            <PrinterSettingsForm
              disabled={!canManage || saveSettingsMutation.isPending}
              settings={settings}
              onSave={(input) => saveSettingsMutation.mutate(input)}
            />
          )}
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-xl font-black">Test Print</h2>
          <p className="mt-1 text-sm leading-6 text-white/55">
            Test print sends ESC/POS bytes to the Android/local bridge when available. Without a bridge, the test is recorded as bridge required.
          </p>
          <button
            type="button"
            disabled={testPrintMutation.isPending}
            onClick={() => testPrintMutation.mutate()}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white text-sm font-black text-slate-950 disabled:opacity-50"
          >
            <Printer className="h-5 w-5" /> {testPrintMutation.isPending ? "Testing..." : "Print Test"}
          </button>
          {!support.directEscPos ? (
            <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100">
              <AlertTriangle className="mb-2 h-5 w-5" />
              EZO 58D usually uses Bluetooth Classic/SPP. Browser Web Bluetooth cannot print to Classic/SPP devices directly, so use the Android app bridge or local desktop bridge for reliable thermal printing.
            </div>
          ) : null}
        </div>

        <StationRouting
          canManage={canManage}
          stations={data?.stations || []}
          printers={data?.printers || []}
          savingStation={savingStation}
          onSave={(station, printer) => {
            setSavingStation(station);
            saveStationPrinter({
              station,
              printerId: printer?.id || null,
              printerName: printer?.name || null,
              active: true,
            })
              .then(() => {
                toast.success(`${station} station saved`);
                qc.invalidateQueries({ queryKey: ["printers"] });
              })
              .catch((error) => toast.error(error instanceof Error ? error.message : "Could not save station"))
              .finally(() => setSavingStation(null));
          }}
        />
      </section>

      <section className="mt-5 rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black">Device Scan & Connection</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-white/55">
              Browser scanning opens the system Bluetooth picker and can only discover Web Bluetooth compatible BLE devices. Bluetooth Classic printers need the Android/local bridge to show realtime devices and print.
            </p>
          </div>
          <button
            type="button"
            disabled={scanMutation.isPending}
            onClick={() => scanMutation.mutate()}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-slate-950 disabled:opacity-50"
          >
            <Bluetooth className="h-5 w-5" /> {scanMutation.isPending ? "Scanning..." : "Scan Printers"}
          </button>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {[...(data?.devices || []), ...detectedDevices].length ? (
            [...(data?.devices || []), ...detectedDevices].map((device) => (
              <div key={`${device.connectionType}-${device.id}`} className="rounded-3xl border border-white/10 bg-black/25 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-black">{device.name || "Thermal Printer"}</div>
                    <p className="mt-1 text-xs text-white/45">
                      {device.model || "Printer"} • {device.connectionType.replace(/-/g, " ")}
                    </p>
                    {"message" in device && device.message ? <p className="mt-2 text-xs leading-5 text-amber-100">{device.message}</p> : null}
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white/70">
                    {String(device.status || "available").replace(/_/g, " ")}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!canManage || savePrinterMutation.isPending}
                  onClick={() =>
                    savePrinterMutation.mutate({
                      name: device.name || "EZO 58D",
                      model: device.model || "EZO 58D",
                      macAddress: device.macAddress || device.id,
                      connectionType: device.connectionType === "web-bluetooth" ? "bridge" : device.connectionType,
                      paperWidth: settings?.paperSize || "58mm",
                      isDefault: true,
                      status: device.status === "available" ? "disconnected" : "bridge_required",
                    })
                  }
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-red-600 text-sm font-black text-white disabled:opacity-50"
                >
                  Save as Default Printer
                </button>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-white/15 bg-black/20 p-6 text-sm leading-6 text-white/55 lg:col-span-2">
              No devices scanned yet. Click scan from a user gesture, or connect through the Android/local bridge for realtime Classic Bluetooth printer discovery.
            </div>
          )}
        </div>
      </section>

      {testPrintOpen ? (
        <TestPrintOverlay settings={settings} printer={defaultPrinter} onDone={() => setTestPrintOpen(false)} />
      ) : null}
    </main>
  );
}

function StatusCard({
  title,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  sub: string;
  icon: LucideIcon;
  tone: "green" | "amber" | "slate";
}) {
  const tones = {
    green: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-100",
    slate: "border-white/10 bg-white/[0.04] text-white",
  };
  return (
    <article className={`rounded-[28px] border p-5 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.22em] opacity-70">{title}</p>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 text-2xl font-black">{value}</div>
      <p className="mt-2 text-sm leading-6 opacity-70">{sub}</p>
    </article>
  );
}

function PrinterSettingsForm({
  settings,
  disabled,
  onSave,
}: {
  settings?: PrinterSettings;
  disabled: boolean;
  onSave: (settings: Partial<PrinterSettings>) => void;
}) {
  const [draft, setDraft] = useState<Partial<PrinterSettings>>(() => settings || {});

  useEffect(() => {
    setDraft(settings || {});
  }, [settings]);

  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Toggle label="Auto print new KOT" checked={Boolean(draft.autoPrint)} disabled={disabled} onChange={(autoPrint) => setDraft((prev) => ({ ...prev, autoPrint }))} />
        <Toggle label="Auto reconnect" checked={draft.autoReconnect !== false} disabled={disabled} onChange={(autoReconnect) => setDraft((prev) => ({ ...prev, autoReconnect }))} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-black uppercase tracking-widest text-white/45">Paper size</span>
          <select
            disabled={disabled}
            value={draft.paperSize || "58mm"}
            onChange={(event) => setDraft((prev) => ({ ...prev, paperSize: event.target.value as "58mm" | "80mm" }))}
            className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white"
          >
            <option value="58mm">58mm</option>
            <option value="80mm">80mm</option>
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-black uppercase tracking-widest text-white/45">Copies</span>
          <select
            disabled={disabled}
            value={draft.copies || 1}
            onChange={(event) => setDraft((prev) => ({ ...prev, copies: Number(event.target.value) }))}
            className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white"
          >
            {[1, 2, 3, 4, 5].map((copy) => (
              <option key={copy} value={copy}>
                {copy} copy{copy > 1 ? "ies" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-black uppercase tracking-widest text-white/45">Footer text</span>
        <input
          disabled={disabled}
          value={draft.footerText || ""}
          onChange={(event) => setDraft((prev) => ({ ...prev, footerText: event.target.value }))}
          className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm font-bold text-white"
          placeholder="THANK YOU"
        />
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSave(draft)}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red-600 text-sm font-black text-white disabled:opacity-50"
      >
        <Save className="h-5 w-5" /> Save Settings
      </button>
    </div>
  );
}

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex min-h-12 items-center justify-between rounded-2xl border px-4 text-sm font-black disabled:opacity-50 ${
        checked ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100" : "border-white/10 bg-black/30 text-white/65"
      }`}
    >
      {label}
      <span className={`h-6 w-11 rounded-full p-1 ${checked ? "bg-emerald-500" : "bg-white/20"}`}>
        <span className={`block h-4 w-4 rounded-full bg-white transition ${checked ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}

function StationRouting({
  canManage,
  stations,
  printers,
  savingStation,
  onSave,
}: {
  canManage: boolean;
  stations: KitchenStationPrinter[];
  printers: PrinterRecord[];
  savingStation: string | null;
  onSave: (station: string, printer: PrinterRecord | null) => void;
}) {
  const stationMap = new Map(stations.map((station) => [station.station, station]));
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">Kitchen Station Routing</h2>
          <p className="mt-1 text-sm text-white/55">Assign default printer per station. V1 routes by item kitchen station where available.</p>
        </div>
        <CheckCircle2 className="h-6 w-6 text-emerald-300" />
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {DEFAULT_STATIONS.map((station) => {
          const saved = stationMap.get(station);
          const selectedPrinter = printers.find((printer) => printer.id === saved?.printerId) || null;
          return (
            <div key={station} className="rounded-3xl border border-white/10 bg-black/25 p-4">
              <div className="text-sm font-black">{station}</div>
              <div className="mt-1 text-xs text-white/45">{selectedPrinter?.name || saved?.printerName || "No printer assigned"}</div>
              <select
                disabled={!canManage || savingStation === station}
                value={selectedPrinter?.id || ""}
                onChange={(event) => onSave(station, printers.find((printer) => printer.id === event.target.value) || null)}
                className="mt-3 h-11 w-full rounded-2xl border border-white/10 bg-black/40 px-3 text-sm font-bold text-white disabled:opacity-50"
              >
                <option value="">Use default printer</option>
                {printers.map((printer) => (
                  <option key={printer.id} value={printer.id}>
                    {printer.name}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function TestPrintOverlay({
  settings,
  printer,
  onDone,
}: {
  settings?: PrinterSettings;
  printer?: PrinterRecord | null;
  onDone: () => void;
}) {
  const triggered = useRef(false);
  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;
    const id = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/80 p-4 text-white">
      <div className="no-print absolute right-4 top-4 flex gap-2">
        <div className="hidden rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-bold text-zinc-300 md:block">
          {printer?.name || "Browser print"} - {settings?.paperSize || "58mm"} - {settings?.copies || 1} copy
        </div>
        <button type="button" onClick={() => window.print()} className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white">
          PRINT
        </button>
        <button type="button" onClick={onDone} className="rounded-2xl bg-zinc-800 px-5 py-3 text-sm font-black text-white">
          DONE
        </button>
      </div>

      <div className="print-area w-[300px] max-w-full bg-white p-5 font-mono text-sm text-black shadow-2xl">
        <div className="text-center text-lg font-black">THE ANKAPUR DHABA</div>
        <div className="text-center font-bold">Kitchen Printer Test</div>
        <div className="my-3 border-t border-dashed border-black" />
        <div>Printer : {printer?.name || "EZO 58D"}</div>
        <div>Paper   : {settings?.paperSize || "58mm"}</div>
        <div>Copies  : {settings?.copies || 1}</div>
        <div>Date    : {new Date().toLocaleString()}</div>
        <div className="my-3 border-t border-dashed border-black" />
        <div className="text-center font-black">Print Successful</div>
        <div className="mt-2 text-center text-xs">Browser fallback mode</div>
      </div>
    </div>
  );
}