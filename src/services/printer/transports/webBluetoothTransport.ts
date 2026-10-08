import { IPrinterTransport } from '../printerTypes';
import { PrinterPlatform } from '../../../types';

export class WebBluetoothTransport implements IPrinterTransport {
  public readonly platform: PrinterPlatform = 'web-bluetooth';
  private connectedDevice: BluetoothDevice | null = null;
  private writeChar: BluetoothRemoteGATTCharacteristic | null = null;

  public isAvailable(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator && typeof navigator.bluetooth?.requestDevice === 'function';
  }

  public isIframe(): boolean {
    try {
      return typeof window !== 'undefined' && window.self !== window.top;
    } catch {
      return true;
    }
  }

  public isConnected(): boolean {
    return this.connectedDevice !== null && this.connectedDevice.gatt?.connected === true && this.writeChar !== null;
  }

  public getConnectedDeviceName(): string | null {
    return this.connectedDevice?.name || null;
  }

  public async connect(): Promise<{ success: boolean; deviceName?: string; error?: string; diagnostic?: string }> {
    if (!this.isAvailable()) {
      return {
        success: false,
        error: 'WEB_BLUETOOTH_NOT_SUPPORTED',
        diagnostic: 'Web Bluetooth API is not supported in this browser.'
      };
    }

    if (this.isIframe()) {
      return {
        success: false,
        error: 'PERMISSIONS_POLICY_DISALLOWED',
        diagnostic:
          'Bluetooth access is disallowed by browser Permissions Policy in this embedded AI Studio preview iframe. Web Bluetooth requires direct top-level window access or the Darzify Android native application for SpeedX Bluetooth Classic/SPP printing.'
      };
    }

    try {
      // Standard ESC/POS BLE UUIDs
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Standard POS
          '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent
          '0000e0ff-0000-1000-8000-00805f9b34fb',
          '0000ae00-0000-1000-8000-00805f9b34fb'
        ]
      });

      if (!device.gatt) {
        throw new Error('GATT server not accessible on device.');
      }

      device.addEventListener('gattserverdisconnected', () => {
        this.connectedDevice = null;
        this.writeChar = null;
      });

      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();

      let targetChar: BluetoothRemoteGATTCharacteristic | null = null;
      for (const service of services) {
        try {
          const chars = await service.getCharacteristics();
          for (const c of chars) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              targetChar = c;
              break;
            }
          }
        } catch {
          continue;
        }
        if (targetChar) break;
      }

      if (!targetChar) {
        throw new Error('No writable GATT characteristic found. SpeedX may be operating in Bluetooth Classic/SPP mode, which requires Android native printing.');
      }

      this.connectedDevice = device;
      this.writeChar = targetChar;

      return {
        success: true,
        deviceName: device.name || 'SpeedX 58mm'
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const isPolicy = msg.toLowerCase().includes('permissions policy') || msg.toLowerCase().includes('disallowed');
      return {
        success: false,
        error: isPolicy ? 'PERMISSIONS_POLICY_DISALLOWED' : msg,
        diagnostic: isPolicy
          ? 'Browser Permissions Policy disallows Web Bluetooth in this embedded environment. Please use the Darzify Android App for SpeedX Bluetooth Classic printing.'
          : msg
      };
    }
  }

  public async disconnect(): Promise<void> {
    if (this.connectedDevice?.gatt?.connected) {
      this.connectedDevice.gatt.disconnect();
    }
    this.connectedDevice = null;
    this.writeChar = null;
  }

  public async sendBytes(data: Uint8Array): Promise<{ success: boolean; error?: string }> {
    if (!this.isConnected() || !this.writeChar) {
      return { success: false, error: 'PRINTER_DISCONNECTED' };
    }

    try {
      const chunkSize = 100;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        if (this.writeChar.properties.writeWithoutResponse) {
          await this.writeChar.writeValueWithoutResponse(chunk);
        } else {
          await this.writeChar.writeValueWithResponse(chunk);
        }
        await new Promise((r) => setTimeout(r, 15));
      }
      return { success: true };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
