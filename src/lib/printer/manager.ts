import type { Order, PrinterRecord, PrinterSettings } from "@/services/api";
import { buildKotPrint, buildKotPrintHtml, buildTestPrint, buildTestPrintHtml, escPosToBase64, triggerBrowserPrint } from "./escpos";
import {
  connectWebBluetoothPrinter,
  getActiveBluetoothDevice,
  isWebBluetoothSupported,
  sendWebBluetoothEscPos,
} from "./web-bluetooth";

declare global {
  interface Window {
    AndroidPrinterBridge?: {
      printEscPos?: (payload: BridgePayload | string) => Promise<BridgeResult | string> | BridgeResult | string;
      scanPrinters?: () => Promise<DetectedPrinterDevice[] | string> | DetectedPrinterDevice[] | string;
    };
    localPrinterBridge?: {
      printEscPos?: (payload: BridgePayload | string) => Promise<BridgeResult | string> | BridgeResult | string;
      scanPrinters?: () => Promise<DetectedPrinterDevice[] | string> | DetectedPrinterDevice[] | string;
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

export interface DetectedPrinterDevice {
  id: string;
  name: string;
  model?: string | null;
  macAddress?: string | null;
  connectionType: "web-bluetooth" | "android-bridge" | "local-bridge" | "web-serial" | "bridge";
  status: "available" | "saved" | "unsupported" | "bridge_required" | string;
  signalStrength?: number | null;
  batteryLevel?: number | null;
  message?: string;
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
  const webBluetooth = isWebBluetoothSupported();
  const androidBridge = Boolean(window.AndroidPrinterBridge?.printEscPos);
  const localBridge = Boolean(window.localPrinterBridge?.printEscPos);
  const activeBtDevice = Boolean(getActiveBluetoothDevice());

  return {
    browserPrint: typeof window.print === "function",
    webSerial,
    webBluetooth,
    androidBridge,
    localBridge,
    directEscPos: androidBridge || localBridge || activeBtDevice,
  };
}

export interface ActivePrinterConnection {
  id: string;
  name: string;
  connectionType: DetectedPrinterDevice["connectionType"];
  online: true;
}

export function getPrinterActiveConnection(): ActivePrinterConnection | null {
  if (typeof window === "undefined") return null;
  const btDevice = getActiveBluetoothDevice();
  if (btDevice) return { id: btDevice.id, name: btDevice.name || "Bluetooth Printer", connectionType: "web-bluetooth", online: true };
  if (window.AndroidPrinterBridge?.printEscPos) return { id: "android-bridge", name: "Android Bridge", connectionType: "android-bridge", online: true };
  if (window.localPrinterBridge?.printEscPos) return { id: "local-bridge", name: "Local Bridge", connectionType: "local-bridge", online: true };
  return null;
}

export function isPrinterLive(): boolean {
  return getPrinterActiveConnection() !== null;
}

export function isDeviceConnectionLive(connectionType: DetectedPrinterDevice["connectionType"] | string): boolean {
  if (typeof window === "undefined") return false;
  if (connectionType === "web-bluetooth") return Boolean(getActiveBluetoothDevice());
  if (connectionType === "android-bridge") return Boolean(window.AndroidPrinterBridge?.printEscPos);
  if (connectionType === "local-bridge") return Boolean(window.localPrinterBridge?.printEscPos);
  return false;
}

export function compatibilityMessage(): string {
  const support = getPrinterRuntimeSupport();
  if (support.androidBridge) return "Android native bridge detected. Direct Bluetooth ESC/POS printing ready.";
  if (support.localBridge) return "Local desktop bridge detected. USB/Bluetooth printing ready.";
  if (getActiveBluetoothDevice()) return `Web Bluetooth printer connected (${getActiveBluetoothDevice()?.name}).`;
  if (support.webBluetooth) return "Web Bluetooth available. You can pair BLE thermal printers directly in browser.";
  if (support.webSerial) return "Web Serial available for USB thermal printers.";
  return "Standard browser print available (will trigger system print dialog for installed printers).";
}

export async function scanPrinterDevices(): Promise<DetectedPrinterDevice[]> {
  if (typeof window === "undefined") return [];

  const nativeScanner = window.AndroidPrinterBridge?.scanPrinters || window.localPrinterBridge?.scanPrinters;
  if (nativeScanner) {
    try {
      const raw = await nativeScanner();
      const devices: DetectedPrinterDevice[] = typeof raw === "string" ? JSON.parse(raw) : raw;
      return (devices || []).map((device) => ({
        ...device,
        id: device.id || device.macAddress || device.name,
        name: device.name || "Thermal Printer",
        model: device.model || "EZO 58D",
        connectionType: device.connectionType || (window.AndroidPrinterBridge ? "android-bridge" : "local-bridge"),
        status: device.status || "available",
      }));
    } catch (err) {
      console.warn("[PrinterScan] Native scanner parse error:", err);
    }
  }

  if (isWebBluetoothSupported()) {
    try {
      const connected = await connectWebBluetoothPrinter();
      return [
        {
          id: connected.id,
          name: connected.name,
          model: "Web Bluetooth Printer",
          connectionType: "web-bluetooth",
          status: "available",
          message: "Connected via Web Bluetooth GATT. Ready to print ESC/POS.",
        },
      ];
    } catch (err) {
      if (err instanceof Error && err.message.includes("cancelled")) {
        throw err;
      }
    }
  }

  return [];
}

async function sendBridge(payload: BridgePayload): Promise<BridgeResult> {
  // 1. Try Native Android / Desktop Bridge first
  const bridge = window.AndroidPrinterBridge?.printEscPos || window.localPrinterBridge?.printEscPos;
  if (bridge) {
    try {
      const payloadArg = window.AndroidPrinterBridge ? JSON.stringify(payload) : payload;
      const rawResult = await bridge(payloadArg as unknown as BridgePayload);
      const result: BridgeResult = typeof rawResult === "string" ? JSON.parse(rawResult) : rawResult;
      return result || { jobId: payload.jobId, status: "success", printedAt: new Date().toISOString() };
    } catch (error) {
      return {
        jobId: payload.jobId,
        status: "failed",
        message: error instanceof Error ? error.message : "Native bridge print failed.",
      };
    }
  }

  // 2. Try Active Web Bluetooth Connection
  if (getActiveBluetoothDevice()) {
    try {
      const rawData = base64ToUint8Array(payload.payloadBase64);
      await sendWebBluetoothEscPos(rawData, payload.copies);
      return {
        jobId: payload.jobId,
        status: "success",
        printedAt: new Date().toISOString(),
        message: "Printed via Web Bluetooth",
      };
    } catch (error) {
      return {
        jobId: payload.jobId,
        status: "failed",
        message: error instanceof Error ? error.message : "Web Bluetooth print failed",
      };
    }
  }

  return {
    jobId: payload.jobId,
    status: "failed",
    message: "NO_BRIDGE",
  };
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function printTestJob(
  printer: PrinterRecord | null | undefined,
  settings: PrinterSettings,
): Promise<BridgeResult> {
  const payloadBase64 = escPosToBase64(buildTestPrint(settings));
  const bridgeResult = await sendBridge({
    jobId: crypto.randomUUID(),
    printerId: printer?.id,
    paperSize: settings.paperSize,
    copies: settings.copies,
    payloadBase64,
  });

  if (bridgeResult.status === "success") {
    return bridgeResult;
  }

  // Fallback to Browser Print if no native bridge/Web Bluetooth was available or bridge failed
  const html = buildTestPrintHtml(settings);
  const printed = await triggerBrowserPrint(html);
  if (printed) {
    return {
      jobId: bridgeResult.jobId,
      status: "success",
      message: "Test print launched via system print dialog",
      printedAt: new Date().toISOString(),
    };
  }

  return bridgeResult;
}

export async function printKotJob(
  order: Order,
  printer: PrinterRecord | null | undefined,
  settings: PrinterSettings,
  mode: "kot" | "kitchen-copy" = "kot",
): Promise<BridgeResult> {
  const payloadBase64 = escPosToBase64(buildKotPrint(order, settings, mode));
  const bridgeResult = await sendBridge({
    jobId: crypto.randomUUID(),
    printerId: printer?.id,
    paperSize: settings.paperSize,
    copies: settings.copies,
    payloadBase64,
  });

  if (bridgeResult.status === "success") {
    return bridgeResult;
  }

  // Fallback to Browser Print if no native bridge/Web Bluetooth was available or bridge failed
  const html = buildKotPrintHtml(order, settings, mode);
  const printed = await triggerBrowserPrint(html);
  if (printed) {
    return {
      jobId: bridgeResult.jobId,
      status: "success",
      message: "KOT printed via system print dialog",
      printedAt: new Date().toISOString(),
    };
  }

  return bridgeResult;
}
