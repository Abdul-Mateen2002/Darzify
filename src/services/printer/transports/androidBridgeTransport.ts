import { IPrinterTransport } from '../printerTypes';
import { PrinterDevice, PrinterPlatform } from '../../../types';

export class AndroidBridgeTransport implements IPrinterTransport {
  public readonly platform: PrinterPlatform = 'android-native';

  public isAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.AndroidPrinterBridge !== 'undefined' &&
      typeof window.AndroidPrinterBridge.isAvailable === 'function' &&
      window.AndroidPrinterBridge.isAvailable()
    );
  }

  public isConnected(): boolean {
    if (!this.isAvailable()) return false;
    try {
      return window.AndroidPrinterBridge?.isConnected() ?? false;
    } catch {
      return false;
    }
  }

  public getConnectedDeviceName(): string | null {
    if (!this.isAvailable()) return null;
    try {
      const name = window.AndroidPrinterBridge?.getConnectedDeviceName();
      return name && name.length > 0 ? name : null;
    } catch {
      return null;
    }
  }

  public async getAvailablePrinters(): Promise<PrinterDevice[]> {
    if (!this.isAvailable()) return [];
    try {
      const jsonStr = window.AndroidPrinterBridge?.getPairedPrinters();
      if (!jsonStr) return [];
      const list = JSON.parse(jsonStr) as Array<{ name: string; address: string }>;
      return list.map((item) => ({
        id: item.address,
        name: item.name,
        address: item.address,
        type: 'bluetooth-classic'
      }));
    } catch (e) {
      console.warn('Failed to parse paired printers from Android bridge:', e);
      return [];
    }
  }

  public async connect(macAddress?: string): Promise<{ success: boolean; deviceName?: string; error?: string }> {
    if (!this.isAvailable()) {
      return { success: false, error: 'ANDROID_BRIDGE_UNAVAILABLE' };
    }

    try {
      let targetAddress = macAddress;
      if (!targetAddress) {
        // Auto-select first SpeedX or thermal printer if no specific address passed
        const paired = await this.getAvailablePrinters();
        const speedX = paired.find(p => p.name.toLowerCase().includes('speedx') || p.name.toLowerCase().includes('pos') || p.name.toLowerCase().includes('printer'));
        targetAddress = speedX ? speedX.address : (paired[0]?.address);
      }

      if (!targetAddress) {
        return { success: false, error: 'NO_PAIRED_PRINTER_FOUND' };
      }

      const res = window.AndroidPrinterBridge?.connect(targetAddress);
      if (res) {
        const devName = window.AndroidPrinterBridge?.getConnectedDeviceName() || 'SpeedX 58mm';
        return { success: true, deviceName: devName };
      } else {
        return { success: false, error: 'BLUETOOTH_CONNECT_FAILED' };
      }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  public async disconnect(): Promise<void> {
    if (this.isAvailable()) {
      try {
        window.AndroidPrinterBridge?.disconnect();
      } catch (e) {
        console.warn('Error disconnecting Android printer bridge:', e);
      }
    }
  }

  public async sendBytes(data: Uint8Array): Promise<{ success: boolean; error?: string }> {
    if (!this.isConnected()) {
      return { success: false, error: 'PRINTER_DISCONNECTED' };
    }

    try {
      // Convert Uint8Array to Base64 for safe string transport through WebView interface
      let binary = '';
      const len = data.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(data[i]);
      }
      const base64 = btoa(binary);

      const ok = window.AndroidPrinterBridge?.printBase64(base64);
      if (ok) {
        return { success: true };
      } else {
        return { success: false, error: 'PRINT_STREAM_WRITE_ERROR' };
      }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
