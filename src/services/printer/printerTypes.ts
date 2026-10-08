import { PrinterPlatform, PrinterConnectionState, PrinterDevice, PrinterDiagnostic } from '../../types';

export interface IPrinterTransport {
  readonly platform: PrinterPlatform;
  isAvailable(): boolean;
  isConnected(): boolean;
  getConnectedDeviceName(): string | null;
  getAvailablePrinters?(): Promise<PrinterDevice[]>;
  connect(deviceIdOrAddress?: string): Promise<{ success: boolean; deviceName?: string; error?: string; diagnostic?: string }>;
  disconnect(): Promise<void>;
  sendBytes(data: Uint8Array): Promise<{ success: boolean; error?: string }>;
}

export interface PrinterDiagnosticReport extends PrinterDiagnostic {
  supportedTransports: PrinterPlatform[];
  browserAgent: string;
}
