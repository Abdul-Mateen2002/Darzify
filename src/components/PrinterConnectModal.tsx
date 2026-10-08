import React, { useState, useEffect } from 'react';
import {
  Bluetooth,
  BluetoothConnected,
  Printer,
  X,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Smartphone,
  Cpu,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { printerService } from '../services/printer/printerService';
import { useLanguage } from '../i18n/useLanguage';
import { PrinterDevice, PrinterDiagnostic } from '../types';

interface PrinterConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPrinterConnected: boolean;
  onStatusChange: (connected: boolean) => void;
}

export const PrinterConnectModal: React.FC<PrinterConnectModalProps> = ({
  isOpen,
  onClose,
  isPrinterConnected,
  onStatusChange
}) => {
  const { t, isRtl } = useLanguage();
  const [diagnostic, setDiagnostic] = useState<PrinterDiagnostic | null>(null);
  const [pairedPrinters, setPairedPrinters] = useState<PrinterDevice[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const diag = printerService.getDiagnostic();
      setDiagnostic(diag);
      setFeedback(null);

      // Load paired printers if available
      printerService.getAvailablePrinters().then(list => setPairedPrinters(list));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConnect = async (preferredTransport?: 'android' | 'serial' | 'bluetooth', address?: string) => {
    setIsConnecting(true);
    setFeedback(null);

    const res = await printerService.connect(address, preferredTransport);
    setIsConnecting(false);

    if (res.success) {
      onStatusChange(true);
      setFeedback({
        message: `${res.deviceName || 'SpeedX 58mm'} ${t.connected}!`,
        type: 'success'
      });
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      onStatusChange(false);
      if (res.error === 'PERMISSIONS_POLICY_DISALLOWED') {
        setFeedback({
          message: t.bluetoothBlockedNotice,
          type: 'error'
        });
      } else {
        setFeedback({
          message: res.diagnostic || res.error || t.printerDisconnectedError,
          type: 'error'
        });
      }
    }
  };

  const handleDisconnect = async () => {
    await printerService.disconnect();
    onStatusChange(false);
    setFeedback({
      message: t.disconnected,
      type: 'info'
    });
  };

  const handleTestPrint = async () => {
    if (!printerService.isConnected()) {
      setFeedback({
        message: t.printerNotSelected,
        type: 'error'
      });
      return;
    }

    setIsTestPrinting(true);
    const res = await printerService.testPrint();
    setIsTestPrinting(false);

    if (res.success) {
      setFeedback({
        message: t.testPrintSuccess,
        type: 'success'
      });
    } else {
      setFeedback({
        message: res.error || t.printFailedNotice,
        type: 'error'
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-teal-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#faf7f2] rounded-3xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden border border-[#ede7dc]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#ede7dc] bg-[#f4efe6]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-700 text-white flex items-center justify-center shadow-xs">
              <Printer className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h2 className="font-bold text-stone-900 text-sm sm:text-base">
                {t.printerStatus} — SpeedX 58mm
              </h2>
              <div className="text-[11px] text-teal-800 font-mono font-medium">
                {printerService.isConnected()
                  ? `✓ ${t.connected} (${printerService.getConnectedDeviceName() || 'SpeedX'})`
                  : `✗ ${t.disconnected}`}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Status Feedback Banner */}
          {feedback && (
            <div
              className={`p-3.5 rounded-2xl text-xs flex items-start gap-2.5 ${
                feedback.type === 'error'
                  ? 'bg-rose-50 border border-rose-200 text-rose-800'
                  : feedback.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-teal-50 border border-teal-200 text-teal-800'
              }`}
            >
              {feedback.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              )}
              <div className="flex-1 font-medium leading-relaxed">{feedback.message}</div>
            </div>
          )}

          {/* 1. Diagnostic Box */}
          {diagnostic && (
            <div className="p-4 bg-white border border-[#ede7dc] rounded-2xl space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-bold text-stone-800">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-teal-700" />
                  <span>{t.printerDiagnostic}</span>
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#f4efe6] text-stone-700 border border-[#e5ddcf]">
                  {diagnostic.activePlatform}
                </span>
              </div>

              {diagnostic.isPermissionsPolicyBlocked && (
                <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl text-xs space-y-1.5">
                  <div className="font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>{t.bluetoothBlockedTitle}</span>
                  </div>
                  <p className="text-stone-700 leading-relaxed text-[11px]">
                    {t.bluetoothBlockedNotice}
                  </p>
                </div>
              )}

              <div className="text-[11px] text-stone-600 space-y-1 pt-1 border-t border-[#f4efe6]">
                <div className="flex items-center justify-between">
                  <span>{t.activeTransportLabel}:</span>
                  <span className="font-semibold text-stone-800">{diagnostic.recommendedTransport}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Target Hardware:</span>
                  <span className="font-mono text-stone-800">SpeedX 58mm Thermal (ESC/POS 384px)</span>
                </div>
              </div>
            </div>
          )}

          {/* 2. Connection Controls */}
          {printerService.isConnected() ? (
            /* Connected View */
            <div className="p-4 bg-[#f4efe6] border border-[#ede7dc] rounded-2xl space-y-3 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center">
                <BluetoothConnected className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  {printerService.getConnectedDeviceName() || 'SpeedX 58mm'}
                </h3>
                <p className="text-xs text-emerald-800 font-medium mt-0.5">
                  ✓ Ready for 58mm ESC/POS Receipts
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleTestPrint}
                  disabled={isTestPrinting}
                  className="flex-1 py-2.5 px-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isTestPrinting ? t.saving : t.testPrint}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="py-2.5 px-4 bg-white border border-[#ede7dc] text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {t.disconnectPrinter}
                </button>
              </div>
            </div>
          ) : (
            /* Disconnected View — Multi-Transport Action Hub */
            <div className="space-y-3">
              {/* Android Native Bridge Option */}
              {diagnostic?.isAndroidBridge ? (
                <div className="p-4 bg-white border border-[#ede7dc] rounded-2xl space-y-3 shadow-xs">
                  <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-teal-700" />
                    <span>{t.pairedDevices} (Android Native Bridge)</span>
                  </span>

                  {pairedPrinters.length === 0 ? (
                    <p className="text-xs text-stone-500">{t.noPairedPrintersFound}</p>
                  ) : (
                    <div className="space-y-2">
                      {pairedPrinters.map(p => (
                        <div
                          key={p.id}
                          className="p-2.5 bg-[#faf7f2] border border-[#ede7dc] rounded-xl flex items-center justify-between"
                        >
                          <div>
                            <div className="text-xs font-bold text-stone-900">{p.name}</div>
                            <div className="text-[10px] text-stone-500 font-mono">{p.address}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleConnect('android', p.address)}
                            disabled={isConnecting}
                            className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-lg cursor-pointer"
                          >
                            {isConnecting ? '...' : t.connectPrinter}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {/* Web Serial Option (For Desktop Chrome on Windows with Paired SpeedX COM port) */}
              {diagnostic?.hasWebSerial && !diagnostic?.isAndroidBridge && (
                <div className="p-4 bg-white border border-[#ede7dc] rounded-2xl space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-teal-700" />
                      <span>Windows Bluetooth Serial (COM Port)</span>
                    </span>
                    <span className="text-[10px] bg-teal-50 text-teal-800 font-semibold px-2 py-0.5 rounded border border-teal-200">
                      Recommended on PC
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 leading-normal">
                    SpeedX is paired in Windows Bluetooth settings. Select its virtual COM port directly to print.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleConnect('serial')}
                    disabled={isConnecting}
                    className="w-full py-2.5 px-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>{isConnecting ? t.saving : t.connectViaSerial}</span>
                  </button>
                </div>
              )}

              {/* Standard Web Bluetooth Button */}
              {diagnostic?.hasWebBluetooth && !diagnostic?.isPermissionsPolicyBlocked && (
                <div className="p-4 bg-white border border-[#ede7dc] rounded-2xl space-y-2.5 shadow-xs">
                  <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Bluetooth className="w-4 h-4 text-teal-700" />
                    <span>Web Bluetooth (GATT)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleConnect('bluetooth')}
                    disabled={isConnecting}
                    className="w-full py-2.5 px-3 bg-[#faf7f2] border border-[#ede7dc] text-stone-800 hover:bg-[#f4efe6] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Bluetooth className="w-4 h-4 text-teal-700" />
                    <span>{isConnecting ? t.saving : t.connectViaBluetooth}</span>
                  </button>
                </div>
              )}

              {/* Android Native Production App Recommendation */}
              <div className="p-4 bg-[#f5f0e6] border border-[#e5ddcf] rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-stone-900 font-bold text-xs">
                  <Smartphone className="w-4 h-4 text-teal-800" />
                  <span>SpeedX 58mm Production Recommendation</span>
                </div>
                <p className="text-[11px] text-stone-700 leading-relaxed">
                  SpeedX thermal printers communicate via <strong>Bluetooth Classic (RFCOMM / SPP)</strong>. The <strong>Darzify Android native APK</strong> connects directly with zero browser security restrictions and instant paper output.
                </p>
                <div className="text-[10px] text-teal-800 font-mono bg-white/70 p-2 rounded-lg border border-[#ede7dc]">
                  Android Bridge UUID: 00001101-0000-1000-8000-00805F9B34FB
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#f4efe6] border-t border-[#ede7dc] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-[#ede7dc] text-stone-700 rounded-xl text-xs font-semibold hover:bg-stone-50 transition-colors cursor-pointer"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
