/* eslint-disable @typescript-eslint/no-explicit-any */
// Web Bluetooth API types (not in standard DOM lib)
declare global {
  interface BluetoothDevice extends EventTarget {
    id: string;
    name?: string;
    gatt?: BluetoothRemoteGATTServer;
    addEventListener(type: "gattserverdisconnected", listener: (event: Event) => void): void;
  }
  interface BluetoothRemoteGATTServer {
    connected: boolean;
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
    getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>;
  }
  interface BluetoothRemoteGATTService {
    getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
    getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
  }
  interface BluetoothRemoteGATTCharacteristic {
    properties: { write: boolean; writeWithoutResponse: boolean };
    writeValueWithoutResponse(value: BufferSource): Promise<void>;
    writeValueWithResponse(value: BufferSource): Promise<void>;
  }
  interface Navigator {
    bluetooth: {
      requestDevice(options: { acceptAllDevices: boolean; optionalServices?: string[] }): Promise<BluetoothDevice>;
    };
  }
}

export interface BluetoothPrinterDevice {
  device: BluetoothDevice;
  server?: BluetoothRemoteGATTServer;
  characteristic?: BluetoothRemoteGATTCharacteristic;
}

const COMMON_PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

const COMMON_PRINTER_CHARACTERISTICS = [
  "00002af1-0000-1000-8000-00805f9b34fb",
  "0000ffe1-0000-1000-8000-00805f9b34fb",
  "49535343-1e4d-4bd9-ba61-23c647249616",
  "0000ff02-0000-1000-8000-00805f9b34fb",
];

let activeBluetoothSession: BluetoothPrinterDevice | null = null;

export function isWebBluetoothSupported(): boolean {
  return typeof window !== "undefined" && Boolean(navigator?.bluetooth?.requestDevice);
}

export function getActiveBluetoothDevice(): BluetoothDevice | null {
  return activeBluetoothSession?.device || null;
}

export async function connectWebBluetoothPrinter(): Promise<{ name: string; id: string }> {
  if (!isWebBluetoothSupported()) {
    throw new Error("Web Bluetooth is not supported in this browser. Use Chrome or Edge.");
  }

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: COMMON_PRINTER_SERVICES,
  });

  if (!device.gatt) {
    throw new Error("GATT server unavailable on selected Bluetooth device.");
  }

  const server = await device.gatt.connect();
  let writeCharacteristic: BluetoothRemoteGATTCharacteristic | undefined;

  for (const serviceUuid of COMMON_PRINTER_SERVICES) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      for (const charUuid of COMMON_PRINTER_CHARACTERISTICS) {
        try {
          const char = await service.getCharacteristic(charUuid);
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writeCharacteristic = char;
            break;
          }
        } catch {
          // Continue trying next characteristic
        }
      }
      if (writeCharacteristic) break;

      const characteristics = await service.getCharacteristics();
      writeCharacteristic = characteristics.find((c: BluetoothRemoteGATTCharacteristic) => c.properties.write || c.properties.writeWithoutResponse);
      if (writeCharacteristic) break;
    } catch {
      // Service not offered by this device, try next
    }
  }

  if (!writeCharacteristic) {
    // If no predefined service matched, search all services
    try {
      const services = await server.getPrimaryServices();
      for (const service of services) {
        const characteristics = await service.getCharacteristics();
        writeCharacteristic = characteristics.find((c: BluetoothRemoteGATTCharacteristic) => c.properties.write || c.properties.writeWithoutResponse);
        if (writeCharacteristic) break;
      }
    } catch (error) {
      console.warn("[WebBluetooth] Service enumeration warning:", error);
    }
  }

  if (!writeCharacteristic) {
    throw new Error(
      "Connected to Bluetooth device, but no writable ESC/POS printing characteristic was found. Printer may require Android/Local bridge if it uses Bluetooth Classic SPP.",
    );
  }

  activeBluetoothSession = {
    device,
    server,
    characteristic: writeCharacteristic,
  };

  device.addEventListener("gattserverdisconnected", () => {
    console.log("[WebBluetooth] Printer disconnected:", device.name);
    activeBluetoothSession = null;
  });

  return {
    id: device.id,
    name: device.name || "Bluetooth Thermal Printer",
  };
}

export async function sendWebBluetoothEscPos(data: Uint8Array, copies: number = 1): Promise<void> {
  if (!activeBluetoothSession?.characteristic || !activeBluetoothSession.server?.connected) {
    throw new Error("No active Web Bluetooth printer connection. Please connect printer first.");
  }

  const characteristic = activeBluetoothSession.characteristic;
  const chunkSize = 100; // Safe BLE chunk size

  for (let c = 0; c < Math.max(1, copies); c++) {
    for (let offset = 0; offset < data.length; offset += chunkSize) {
      const chunk = data.slice(offset, offset + chunkSize);
      if (characteristic.properties.writeWithoutResponse) {
        await characteristic.writeValueWithoutResponse(chunk);
      } else {
        await characteristic.writeValueWithResponse(chunk);
      }
      // Small pause between chunks to prevent Bluetooth buffer overflow
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
}

export async function disconnectWebBluetoothPrinter(): Promise<void> {
  if (activeBluetoothSession?.server?.connected) {
    activeBluetoothSession.server.disconnect();
  }
  activeBluetoothSession = null;
}
