import React, { useEffect, useRef, useState } from 'react';
import { Printer, Share2, Download, X, AlertCircle, CheckCircle2, MessageSquare } from 'lucide-react';
import { Order, ShopProfile, TicketType } from '../types';
import { useLanguage } from '../i18n/useLanguage';
import { renderTicketToCanvas } from '../services/ticketRenderer';
import { bluetoothPrinter } from '../services/bluetoothPrinter';
import { PdfService } from '../services/pdfService';

interface ReceiptViewerModalProps {
  order: Order;
  shop: ShopProfile;
  initialTicketType: TicketType;
  isOpen: boolean;
  onClose: () => void;
  onConnectPrinter: () => void;
  isPrinterConnected: boolean;
}

export const ReceiptViewerModal: React.FC<ReceiptViewerModalProps> = ({
  order,
  shop,
  initialTicketType,
  isOpen,
  onClose,
  onConnectPrinter,
  isPrinterConnected
}) => {
  const { t, language, isRtl } = useLanguage();
  const [activeTab, setActiveTab] = useState<TicketType>(initialTicketType);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printStatus, setPrintStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const activeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setActiveTab(initialTicketType);
  }, [initialTicketType]);

  useEffect(() => {
    if (!isOpen) {
      setPrintStatus(null);
      return;
    }

    // Render ticket to canvas
    const canvas = renderTicketToCanvas(order, shop, activeTab, language);
    activeCanvasRef.current = canvas;

    if (canvasContainerRef.current) {
      canvasContainerRef.current.innerHTML = '';
      canvas.className = 'w-full max-w-[340px] shadow-lg rounded-sm border border-stone-300 mx-auto';
      canvasContainerRef.current.appendChild(canvas);
    }
  }, [isOpen, activeTab, order, shop, language]);

  if (!isOpen) return null;

  const handleBluetoothPrint = async () => {
    if (!activeCanvasRef.current) return;

    if (!isPrinterConnected) {
      setPrintStatus({
        message: t.printerDisconnectedError,
        type: 'error'
      });
      onConnectPrinter();
      return;
    }

    try {
      setIsPrinting(true);
      setPrintStatus({ message: 'Sending to SpeedX thermal printer...', type: 'info' });
      const res = await bluetoothPrinter.printCanvas(activeCanvasRef.current);
      if (res.success) {
        setPrintStatus({ message: t.printSuccess, type: 'success' });
      } else {
        setPrintStatus({
          message: res.error === 'PRINTER_DISCONNECTED' ? t.printerDisconnectedError : `${t.printFailedNotice} (${res.error || 'Check printer connection'})`,
          type: 'error'
        });
      }
    } catch (err: unknown) {
      setPrintStatus({ message: `${t.printFailedNotice} (${String(err)})`, type: 'error' });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  const handleSharePdf = async () => {
    try {
      const res = await PdfService.shareOrDownloadPdf(order, shop, language);
      if (res.method === 'download') {
        setPrintStatus({ message: 'PDF downloaded successfully', type: 'success' });
      }
    } catch (err: unknown) {
      setPrintStatus({ message: 'PDF generation failed: ' + String(err), type: 'error' });
    }
  };

  const handleDirectWhatsApp = () => {
    const url = PdfService.getWhatsAppDirectUrl(order, shop);
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-teal-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#faf7f2] rounded-3xl shadow-2xl max-w-md w-full max-h-[92vh] flex flex-col overflow-hidden border border-[#ede7dc]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#ede7dc] bg-[#f4efe6]">
          <div>
            <h3 className="font-bold text-stone-900 text-sm">
              {t.slipNo} {order.slipNumber} — {order.customerName}
            </h3>
            <p className="text-[11px] text-stone-500 font-mono">{order.bookingDate} · {shop.shopName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Ticket Selector Tabs */}
        <div className="flex items-center p-1.5 bg-[#eae4d8] border-b border-[#ede7dc] gap-1 text-xs font-bold">
          <button
            onClick={() => setActiveTab('CUSTOMER')}
            className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'CUSTOMER' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {t.customerSlip}
          </button>
          <button
            onClick={() => setActiveTab('KARIGAR')}
            className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'KARIGAR' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {t.karigarSlip}
          </button>
          <button
            onClick={() => setActiveTab('FABRIC_TAG')}
            className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'FABRIC_TAG' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {t.fabricTag}
          </button>
        </div>

        {/* Thermal Canvas Viewer Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#ece5d8] flex flex-col items-center">
          <div ref={canvasContainerRef} className="w-full flex justify-center py-2" />

          {/* Status Message */}
          {printStatus && (
            <div
              className={`w-full max-w-[340px] mt-3 p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                printStatus.type === 'error'
                  ? 'bg-rose-50 border border-rose-200 text-rose-800'
                  : printStatus.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-teal-50 border border-teal-200 text-teal-800'
              }`}
            >
              {printStatus.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span className="flex-1 font-semibold">{printStatus.message}</span>
              {printStatus.type === 'error' && !isPrinterConnected && (
                <button
                  onClick={onConnectPrinter}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                >
                  {t.retry}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons Bar */}
        <div className="p-3.5 bg-[#f4efe6] border-t border-[#ede7dc] flex flex-col gap-2">
          {/* Primary Action: Direct Bluetooth Print to SpeedX */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleBluetoothPrint}
              disabled={isPrinting}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs text-white transition-all shadow-xs cursor-pointer ${
                isPrinterConnected
                  ? 'bg-teal-700 hover:bg-teal-800 active:bg-teal-900'
                  : 'bg-stone-700 hover:bg-stone-800'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? t.saving : 'SpeedX 58mm پرنٹ'}</span>
            </button>

            <button
              onClick={handleBrowserPrint}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs text-stone-700 bg-white border border-[#ede7dc] hover:bg-stone-50 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-stone-500" />
              <span>{t.browserPrint}</span>
            </button>
          </div>

          {/* Secondary Actions: PDF Share & Direct WhatsApp */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleSharePdf}
              className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-semibold text-xs text-stone-800 bg-white border border-[#ede7dc] hover:bg-stone-50 transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-stone-600" />
              <span>{t.sendPdf}</span>
            </button>

            <button
              onClick={handleDirectWhatsApp}
              className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs text-emerald-900 bg-emerald-100/80 border border-emerald-300 hover:bg-emerald-200/80 transition-colors cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
              <span>WhatsApp میسج</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
