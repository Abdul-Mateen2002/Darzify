// Backward compatibility layer proxying to the new multi-transport PrinterService
import { printerService } from './printer/printerService';

export const bluetoothPrinter = {
  isSupported: () => printerService.getPlatform() !== 'unsupported-browser',
  isConnected: () => printerService.isConnected(),
  getDeviceName: () => printerService.getConnectedDeviceName(),
  connect: (address?: string) => printerService.connect(address),
  disconnect: () => printerService.disconnect(),
  printCanvas: (canvas: HTMLCanvasElement) => printerService.printCanvas(canvas),
  canvasToEscPosRaster: (canvas: HTMLCanvasElement) => printerService.canvasToEscPosRaster(canvas),
  testPrint: (lang?: 'ur' | 'en') => printerService.testPrint(lang),
  getDiagnostic: () => printerService.getDiagnostic(),
  getAvailablePrinters: () => printerService.getAvailablePrinters()
};

export { printerService };
