import { AndroidBridgeTransport } from './transports/androidBridgeTransport';
import { WebSerialTransport } from './transports/webSerialTransport';
import { WebBluetoothTransport } from './transports/webBluetoothTransport';
import { IPrinterTransport } from './printerTypes';
import { PrinterPlatform, PrinterConnectionState, PrinterDevice, PrinterDiagnostic } from '../../types';

export class PrinterService {
  private androidTransport = new AndroidBridgeTransport();
  private serialTransport = new WebSerialTransport();
  private bluetoothTransport = new WebBluetoothTransport();

  private activeTransport: IPrinterTransport | null = null;
  private connectionState: PrinterConnectionState = 'DISCONNECTED';
  private lastErrorMessage: string | null = null;

  public getPlatform(): PrinterPlatform {
    if (this.androidTransport.isAvailable()) return 'android-native';
    if (this.serialTransport.isAvailable()) return 'web-serial';
    if (this.bluetoothTransport.isAvailable()) return 'web-bluetooth';
    return 'unsupported-browser';
  }

  public isConnected(): boolean {
    return this.activeTransport !== null && this.activeTransport.isConnected();
  }

  public getConnectionState(): PrinterConnectionState {
    if (this.isConnected()) return 'CONNECTED';
    return this.connectionState;
  }

  public getConnectedDeviceName(): string | null {
    return this.activeTransport?.getConnectedDeviceName() || null;
  }

  public getDiagnostic(): PrinterDiagnostic {
    const isIframe = this.bluetoothTransport.isIframe();
    const hasWebBluetooth = this.bluetoothTransport.isAvailable();
    const hasWebSerial = this.serialTransport.isAvailable();
    const isAndroidBridge = this.androidTransport.isAvailable();
    const isPermissionsPolicyBlocked = isIframe && hasWebBluetooth;
    const activePlatform = this.getPlatform();

    let recommendedTransport = 'Android Native Bluetooth Classic (SpeedX SPP)';
    let diagnosticMessage = '';

    if (isAndroidBridge) {
      recommendedTransport = 'Darzify Android Native Bridge';
      diagnosticMessage = 'Android native Bluetooth bridge active. Direct Bluetooth Classic/SPP to SpeedX 58mm supported.';
    } else if (isPermissionsPolicyBlocked) {
      recommendedTransport = 'Darzify Android App (SpeedX SPP) or Web Serial (Desktop)';
      diagnosticMessage =
        'Access to Bluetooth is blocked by browser Permissions Policy inside this embedded AI Studio preview iframe. To print to your SpeedX printer, use the Darzify Android app (supports Bluetooth Classic/SPP), or open Darzify directly in desktop Chrome with Web Serial.';
    } else if (hasWebSerial) {
      recommendedTransport = 'Web Serial / Bluetooth COM Port (Windows)';
      diagnosticMessage =
        'Desktop Chrome Web Serial is available. If SpeedX is paired in Windows Bluetooth settings, you can connect directly via its COM port.';
    } else if (hasWebBluetooth) {
      recommendedTransport = 'Web Bluetooth GATT';
      diagnosticMessage =
        'Web Bluetooth is supported, but SpeedX 58mm printers typically use Bluetooth Classic/SPP rather than BLE GATT. Use Android app for reliable production.';
    } else {
      recommendedTransport = 'Browser Print / PDF';
      diagnosticMessage = 'Bluetooth hardware access is not supported by this browser. Use PDF sharing or 58mm browser print.';
    }

    return {
      isIframe,
      hasWebBluetooth,
      hasWebSerial,
      isAndroidBridge,
      isPermissionsPolicyBlocked,
      activePlatform,
      recommendedTransport,
      diagnosticMessage
    };
  }

  public async getAvailablePrinters(): Promise<PrinterDevice[]> {
    if (this.androidTransport.isAvailable()) {
      return this.androidTransport.getAvailablePrinters();
    }
    if (this.serialTransport.isAvailable()) {
      return this.serialTransport.getAvailablePrinters();
    }
    return [];
  }

  public async connect(deviceIdOrAddress?: string, preferredTransport?: 'android' | 'serial' | 'bluetooth'): Promise<{
    success: boolean;
    deviceName?: string;
    error?: string;
    diagnostic?: string;
  }> {
    this.connectionState = 'CONNECTING';
    this.lastErrorMessage = null;

    // 1. If running on Android with Native Bridge
    if (this.androidTransport.isAvailable() && preferredTransport !== 'serial' && preferredTransport !== 'bluetooth') {
      const res = await this.androidTransport.connect(deviceIdOrAddress);
      if (res.success) {
        this.activeTransport = this.androidTransport;
        this.connectionState = 'CONNECTED';
        return { success: true, deviceName: res.deviceName };
      } else {
        this.connectionState = 'ERROR';
        this.lastErrorMessage = res.error || 'Android connection failed';
        return { success: false, error: res.error, diagnostic: 'Could not connect to SpeedX via Android Bluetooth SPP socket.' };
      }
    }

    // 2. If user explicitly requested Web Serial (Desktop Windows Bluetooth COM port)
    if (preferredTransport === 'serial' && this.serialTransport.isAvailable()) {
      const res = await this.serialTransport.connect();
      if (res.success) {
        this.activeTransport = this.serialTransport;
        this.connectionState = 'CONNECTED';
        return { success: true, deviceName: res.deviceName };
      } else {
        this.connectionState = 'ERROR';
        this.lastErrorMessage = res.error || 'Serial connection failed';
        return { success: false, error: res.error, diagnostic: 'Could not connect to SpeedX via Serial port.' };
      }
    }

    // 3. Web Bluetooth attempt with accurate diagnostic intercept
    const diag = this.getDiagnostic();
    if (diag.isPermissionsPolicyBlocked) {
      this.connectionState = 'ERROR';
      this.lastErrorMessage = 'PERMISSIONS_POLICY_DISALLOWED';
      return {
        success: false,
        error: 'PERMISSIONS_POLICY_DISALLOWED',
        diagnostic: diag.diagnosticMessage
      };
    }

    if (this.bluetoothTransport.isAvailable()) {
      const res = await this.bluetoothTransport.connect();
      if (res.success) {
        this.activeTransport = this.bluetoothTransport;
        this.connectionState = 'CONNECTED';
        return { success: true, deviceName: res.deviceName };
      } else {
        this.connectionState = 'ERROR';
        this.lastErrorMessage = res.error || 'Bluetooth connect failed';
        return { success: false, error: res.error, diagnostic: res.diagnostic };
      }
    }

    // 4. No supported Bluetooth transport in this context
    this.connectionState = 'ERROR';
    this.lastErrorMessage = 'BLUETOOTH_UNAVAILABLE';
    return {
      success: false,
      error: 'BLUETOOTH_UNAVAILABLE',
      diagnostic: diag.diagnosticMessage
    };
  }

  public async disconnect(): Promise<void> {
    if (this.activeTransport) {
      await this.activeTransport.disconnect();
    }
    this.activeTransport = null;
    this.connectionState = 'DISCONNECTED';
    this.lastErrorMessage = null;
  }

  /**
   * High-fidelity 1-bit monochrome raster conversion for SpeedX 58mm thermal paper
   * Standard width: 384 dots (48 bytes per row at 203 DPI)
   */
  public canvasToEscPosRaster(canvas: HTMLCanvasElement): Uint8Array {
    const width = 384; // Standard 58mm thermal dot count
    const height = canvas.height;

    // Off-screen canvas normalized to 384px width
    const normCanvas = document.createElement('canvas');
    normCanvas.width = width;
    normCanvas.height = height;
    const ctx = normCanvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D canvas context');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(canvas, 0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height);
    const bytesWidth = 48; // 384 / 8 = 48 bytes
    const rasterBytes = new Uint8Array(bytesWidth * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        const r = imgData.data[offset];
        const g = imgData.data[offset + 1];
        const b = imgData.data[offset + 2];
        const a = imgData.data[offset + 3];

        // High-contrast thresholding for crisp thermal burning
        const isBlack = a > 120 && (r * 0.299 + g * 0.587 + b * 0.114) < 170;
        if (isBlack) {
          const byteIndex = y * bytesWidth + (x >> 3);
          const bitIndex = 7 - (x & 7);
          rasterBytes[byteIndex] |= 1 << bitIndex;
        }
      }
    }

    // ESC/POS Commands:
    // 1B 40          : Initialize printer
    // 1B 61 01       : Center alignment
    // 1D 76 30 00    : GS v 0 m=0 (Raster bit image normal mode)
    // xL xH yL yH    : Width in bytes (48, 0) and Height in dots
    const xL = bytesWidth & 0xff;
    const xH = (bytesWidth >> 8) & 0xff;
    const yL = height & 0xff;
    const yH = (height >> 8) & 0xff;

    const header = new Uint8Array([
      0x1b, 0x40,
      0x1b, 0x61, 0x01,
      0x1d, 0x76, 0x30, 0x00,
      xL, xH, yL, yH
    ]);

    // 1B 64 04       : Feed 4 lines for tear bar
    // 10 04 02       : DLE EOT status request
    const footer = new Uint8Array([0x1b, 0x64, 0x04, 0x10, 0x04, 0x02]);

    const fullPayload = new Uint8Array(header.length + rasterBytes.length + footer.length);
    fullPayload.set(header, 0);
    fullPayload.set(rasterBytes, header.length);
    fullPayload.set(footer, header.length + rasterBytes.length);

    return fullPayload;
  }

  public async printCanvas(canvas: HTMLCanvasElement): Promise<{ success: boolean; error?: string }> {
    if (!this.isConnected() || !this.activeTransport) {
      return { success: false, error: 'PRINTER_DISCONNECTED' };
    }

    try {
      this.connectionState = 'PRINTING';
      const rasterData = this.canvasToEscPosRaster(canvas);
      const res = await this.activeTransport.sendBytes(rasterData);
      this.connectionState = 'CONNECTED';
      return res;
    } catch (err: unknown) {
      this.connectionState = 'CONNECTED';
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Generates a 58mm test canvas to diagnose connection, alignment, and bilingual typography
   */
  public generateTestCanvas(lang: 'ur' | 'en' = 'ur'): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 420;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 384, 420);

    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;

    let y = 30;
    const drawLine = () => {
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(374, y);
      ctx.stroke();
      y += 18;
    };

    // Header
    ctx.font = "bold 26px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('DARZIFY', 192, y);
    y += 24;

    ctx.font = "bold 15px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.fillText('SpeedX 58mm Printer Test', 192, y);
    y += 18;

    drawLine();

    // Bilingual Diagnostic Text
    ctx.font = "bold 18px 'Noto Sans Arabic', 'Noto Nastaliq Urdu', sans-serif";
    ctx.fillText('درزیفائی — ٹیسٹ پرنٹ', 192, y);
    y += 26;

    ctx.font = "14px 'Noto Sans Arabic', sans-serif";
    ctx.fillText('اردو اور انگریزی پرنٹنگ مکمل فعال ہے', 192, y);
    y += 22;

    drawLine();

    // Alignment & Dot Ruler (384 dots)
    ctx.font = "bold 13px 'JetBrains Mono', monospace";
    ctx.fillText('0123456789 ABCDEFGHIJKLMNOP', 192, y);
    y += 18;

    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.fillText('|--- 384 Dots / 58mm Roll ---|', 192, y);
    y += 22;

    // Date & Transport Info
    const nowStr = new Date().toLocaleString();
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.fillText(`Date: ${nowStr}`, 192, y);
    y += 16;
    ctx.fillText(`Transport: ${this.activeTransport?.platform || 'Direct'}`, 192, y);
    y += 20;

    drawLine();

    ctx.font = "bold 12px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText('*** TEST PRINT OK ***', 192, y);

    return canvas;
  }

  public async testPrint(lang: 'ur' | 'en' = 'ur'): Promise<{ success: boolean; error?: string }> {
    const canvas = this.generateTestCanvas(lang);
    return this.printCanvas(canvas);
  }
}

export const printerService = new PrinterService();
