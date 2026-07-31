import type { PrinterRecord, PrinterSettings } from "@/services/api";
import { buildKotPrint, buildTestPrint, escPosToBase64 } from "./escpos";
import type { Order } from "@/services/api";

declare global {
  interface Window {
    AndroidPrinterBridge?: {
      printEscPos?: (payload: BridgePayload) => Promise<BridgeResult> | BridgeResult;
    };
    localPrinterBridge?: {
      printEscPos?: (payload: BridgePayload) => Promise<BridgeResult> | BridgeResult;
    };
  }
}

export interface BridgePayload {
  jobId: string;
  printerId?: string | null;
  paperSize: "58mm" | "80mm";
  copies: number;
  payloadBase64: string;
}

export interface BridgeResult {
  jobId: string;
  status: "success" | "failed";
  message?: string;
  printedAt?: string;
}

export interface RuntimeSupport {
  browserPrint: boolean;
  webSerial: boolean;
  webBluetooth: boolean;
  androidBridge: boolean;
  localBridge: boolean;
  directEscPos: boolean;
}

export function getPrinterRuntimeSupport(): RuntimeSupport {
  if (typeof window === "undefined") {
    return {
      browserPrint: false,
      webSerial: false,
      webBluetooth: false,
      androidBridge: false,
      localBridge: false,
      directEscPos: false,
    };
  }

  const webSerial = "serial" in navigator;
  const webBluetooth = "bluetooth" in navigator;
  const androidBridge = Boolean(window.AndroidPrinterBridge?.printEscPos);
  const localBridge = Boolean(window.localPrinterBridge?.printEscPos);

  return {
    browserPrint: typeof window.print === "function",
    webSerial,
    webBluetooth,
    androidBridge,
    localBridge,
    directEscPos: androidBridge || localBridge || webSerial || webBluetooth,
  };
}

export function compatibilityMessage() {
  const support = getPrinterRuntimeSupport();
  if (support.androidBridge) return "Android bridge detected. ESC/POS Bluetooth printing can run from the app.";
  if (support.localBridge) return "Local desktop bridge detected. USB/Bluetooth printing can run from this computer.";
  if (support.webSerial) return "Web Serial is available for compatible USB serial ESC/POS printers.";
  if (support.webBluetooth) return "Web Bluetooth is available, but many 58mm printers use Bluetooth Classic and need a bridge.";
  return "Direct ESC/POS printing is not supported in this browser. Use Android app bridge or local print bridge.";
}

async function sendBridge(payload: BridgePayload): Promise<BridgeResult> {
  const bridge = window.AndroidPrinterBridge?.printEscPos || window.localPrinterBridge?.printEscPos;
  if (!bridge) return { jobId: payload.jobId, status: "failed", message: "Printer bridge is not available." };
  try {
    const result = await bridge(payload);
    return result || { jobId: payload.jobId, status: "success", printedAt: new Date().toISOString() };
  } catch (error) {
    return {
      jobId: payload.jobId,
      status: "failed",
      message: error instanceof Error ? error.message : "Bridge print failed.",
    };
  }
}

export async function printTestJob(
  printer: PrinterRecord | null | undefined,
  settings: PrinterSettings,
): Promise<BridgeResult> {
  const payloadBase64 = escPosToBase64(buildTestPrint(settings));
  return sendBridge({
    jobId: crypto.randomUUID(),
    printerId: printer?.id,
    paperSize: settings.paperSize,
    copies: settings.copies,
    payloadBase64,
  });
}

export async function printKotJob(
  order: Order,
  printer: PrinterRecord | null | undefined,
  settings: PrinterSettings,
  mode: "kot" | "kitchen-copy" = "kot",
): Promise<BridgeResult> {
  const payloadBase64 = escPosToBase64(buildKotPrint(order, settings, mode));
  return sendBridge({
    jobId: crypto.randomUUID(),
    printerId: printer?.id,
    paperSize: settings.paperSize,
    copies: settings.copies,
    payloadBase64,
  });
}
