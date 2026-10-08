import { IPrinterTransport } from '../printerTypes';
import { PrinterDevice, PrinterPlatform } from '../../../types';

export class WebSerialTransport implements IPrinterTransport {
  public readonly platform: PrinterPlatform = 'web-serial';
  private port: any = null;
  private writer: any = null;
  private connectedName: string | null = null;

  public isAvailable(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator && typeof navigator.serial?.requestPort === 'function';
  }

  public isConnected(): boolean {
    return this.port !== null && this.writer !== null;
  }

  public getConnectedDeviceName(): string | null {
    return this.connectedName;
  }

  public async getAvailablePrinters(): Promise<PrinterDevice[]> {
    if (!this.isAvailable()) return [];
    try {
      const ports = await navigator.serial!.getPorts();
      return ports.map((p, idx) => ({
        id: `serial_port_${idx}`,
        name: `Serial / Bluetooth COM Port ${idx + 1}`,
        type: 'serial'
      }));
    } catch {
      return [];
    }
  }

  public async connect(): Promise<{ success: boolean; deviceName?: string; error?: string }> {
    if (!this.isAvailable()) {
      return { success: false, error: 'WEB_SERIAL_NOT_SUPPORTED' };
    }

    try {
      // Prompt user to select paired Bluetooth Serial COM port
      const selectedPort = await navigator.serial!.requestPort();
      // Standard SpeedX 58mm thermal baud rate is 9600 (or 115200)
      await selectedPort.open({ baudRate: 9600 });
      this.port = selectedPort;
      this.writer = selectedPort.writable.getWriter();
      this.connectedName = 'SpeedX 58mm (Serial/COM)';
      return { success: true, deviceName: this.connectedName };
    } catch (err: unknown) {
      this.disconnect();
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.writer) {
        await this.writer.close();
      }
      if (this.port) {
        await this.port.close();
      }
    } catch (e) {
      console.warn('Error closing serial port:', e);
    } finally {
      this.port = null;
      this.writer = null;
      this.connectedName = null;
    }
  }

  public async sendBytes(data: Uint8Array): Promise<{ success: boolean; error?: string }> {
    if (!this.isConnected() || !this.writer) {
      return { success: false, error: 'PRINTER_DISCONNECTED' };
    }

    try {
      await this.writer.write(data);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
