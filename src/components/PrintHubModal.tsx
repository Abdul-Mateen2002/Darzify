import React, { useState } from 'react';
import { CheckCircle2, Printer, Tag, Share2, Plus, ArrowRight, X } from 'lucide-react';
import { Order, ShopProfile, TicketType } from '../types';
import { useLanguage } from '../i18n/useLanguage';
import { ReceiptViewerModal } from './ReceiptViewerModal';
import { PdfService } from '../services/pdfService';
import { renderTicketToCanvas } from '../services/ticketRenderer';
import { bluetoothPrinter } from '../services/bluetoothPrinter';

interface PrintHubModalProps {
  order: Order;
  shop: ShopProfile;
  isOpen: boolean;
  onClose: () => void;
  onNewBooking: () => void;
  onConnectPrinter: () => void;
  isPrinterConnected: boolean;
}

export const PrintHubModal: React.FC<PrintHubModalProps> = ({
  order,
  shop,
  isOpen,
  onClose,
  onNewBooking,
  onConnectPrinter,
  isPrinterConnected
}) => {
  const { t, language, isRtl } = useLanguage();
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [quickPrintFeedback, setQuickPrintFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOpenTicketViewer = (type: TicketType) => {
    setSelectedTicket(type);
    setIsViewerOpen(true);
  };

  const handleQuickBluetoothPrint = async (type: TicketType) => {
    if (!isPrinterConnected) {
      setSelectedTicket(type);
      setIsViewerOpen(true);
      return;
    }

    try {
      setQuickPrintFeedback('Printing to SpeedX...');
      const canvas = renderTicketToCanvas(order, shop, type, language);
      const res = await bluetoothPrinter.printCanvas(canvas);
      if (res.success) {
        setQuickPrintFeedback(`${t[type === 'CUSTOMER' ? 'customerSlip' : type === 'KARIGAR' ? 'karigarSlip' : 'fabricTag']} ${t.printSuccess}`);
        setTimeout(() => setQuickPrintFeedback(null), 3000);
      } else {
        setSelectedTicket(type);
        setIsViewerOpen(true);
      }
    } catch {
      setSelectedTicket(type);
      setIsViewerOpen(true);
    }
  };

  const handleQuickPdfShare = async () => {
    try {
      await PdfService.shareOrDownloadPdf(order, shop, language);
    } catch {
      setSelectedTicket('CUSTOMER');
      setIsViewerOpen(true);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-3 bg-teal-950/70 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-[#faf7f2] rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center border border-[#ede7dc] relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-stone-400 hover:text-stone-700 rounded-full bg-[#f4efe6] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Success Badge */}
          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          {/* Slip # & Customer Title */}
          <h2 className="text-2xl font-bold text-stone-900 tracking-tight">
            {t.slipNo} {order.slipNumber}
          </h2>
          <p className="text-base font-semibold text-stone-700 mt-0.5">{order.customerName}</p>

          {/* Financial Summary Pill */}
          <div className="mt-3 py-1.5 px-4 bg-white border border-[#ede7dc] rounded-xl inline-flex items-center gap-3 text-xs font-mono shadow-2xs">
            <span className="text-stone-600">
              {t.totalAmount}: <strong className="text-stone-900">Rs. {order.totalAmount.toLocaleString()}</strong>
            </span>
            <span className="text-stone-300">|</span>
            <span className="text-rose-600 font-bold">
              {t.balance}: <strong>Rs. {order.balanceAmount.toLocaleString()}</strong>
            </span>
          </div>

          {quickPrintFeedback && (
            <div className="mt-2 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 py-1 px-2 rounded-lg">
              {quickPrintFeedback}
            </div>
          )}

          {/* 4 Core Action Buttons from Video Screen 4 */}
          <div className="grid grid-cols-2 gap-2.5 mt-5">
            {/* 1. Customer Slip */}
            <button
              onClick={() => handleOpenTicketViewer('CUSTOMER')}
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border border-[#ede7dc] bg-white hover:bg-[#fcfbf9] hover:border-teal-700/40 active:scale-95 transition-all text-stone-800 shadow-xs cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center">
                <Printer className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold leading-tight">{t.customerSlip}</span>
            </button>

            {/* 2. Karigar Slip */}
            <button
              onClick={() => handleOpenTicketViewer('KARIGAR')}
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border border-[#ede7dc] bg-white hover:bg-[#fcfbf9] hover:border-teal-700/40 active:scale-95 transition-all text-stone-800 shadow-xs cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center">
                <Printer className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold leading-tight">{t.karigarSlip}</span>
            </button>

            {/* 3. Fabric Tag */}
            <button
              onClick={() => handleOpenTicketViewer('FABRIC_TAG')}
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border border-[#ede7dc] bg-white hover:bg-[#fcfbf9] hover:border-teal-700/40 active:scale-95 transition-all text-stone-800 shadow-xs cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 text-amber-800 flex items-center justify-center">
                <Tag className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold leading-tight">{t.fabricTag}</span>
            </button>

            {/* 4. Send PDF */}
            <button
              onClick={handleQuickPdfShare}
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border border-[#ede7dc] bg-white hover:bg-[#fcfbf9] hover:border-teal-700/40 active:scale-95 transition-all text-stone-800 shadow-xs cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center">
                <Share2 className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold leading-tight">{t.sendPdf}</span>
            </button>
          </div>

          {/* Bottom Navigation */}
          <div className="mt-5 pt-3 border-t border-[#ede7dc] flex items-center gap-2">
            <button
              onClick={onNewBooking}
              className="flex-1 py-2.5 px-3 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.newBooking}</span>
            </button>

            <button
              onClick={onClose}
              className="flex-1 py-2.5 px-3 bg-[#f4efe6] hover:bg-[#eae4d8] text-stone-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>{t.dashboard}</span>
              <ArrowRight className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Ticket Viewer Modal */}
      {selectedTicket && (
        <ReceiptViewerModal
          order={order}
          shop={shop}
          initialTicketType={selectedTicket}
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          onConnectPrinter={onConnectPrinter}
          isPrinterConnected={isPrinterConnected}
        />
      )}
    </>
  );
};
