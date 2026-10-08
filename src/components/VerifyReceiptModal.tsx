import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Lock,
  Calendar,
  Phone,
  User,
  Scissors,
  DollarSign,
  Copy,
  Check,
  ExternalLink,
  Printer
} from 'lucide-react';
import { Order, ShopProfile } from '../types';
import { useLanguage } from '../i18n/useLanguage';
import { ReceiptSecurityService, DiscrepancyItem } from '../services/receiptSecurityService';

interface VerifyReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  shop: ShopProfile;
  initialQuery?: string;
  onSelectOrder?: (order: Order) => void;
  onOpenPrintHub?: (order: Order) => void;
}

export const VerifyReceiptModal: React.FC<VerifyReceiptModalProps> = ({
  isOpen,
  onClose,
  shop,
  initialQuery = '',
  onSelectOrder,
  onOpenPrintHub
}) => {
  const { t, isRtl } = useLanguage();

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [matchedOrder, setMatchedOrder] = useState<Order | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Tamper Comparison Inputs
  const [presentedTotal, setPresentedTotal] = useState('');
  const [presentedAdvance, setPresentedAdvance] = useState('');
  const [presentedBalance, setPresentedBalance] = useState('');
  const [presentedReturnDate, setPresentedReturnDate] = useState('');
  const [presentedName, setPresentedName] = useState('');

  const resetComparison = () => {
    setPresentedTotal('');
    setPresentedAdvance('');
    setPresentedBalance('');
    setPresentedReturnDate('');
    setPresentedName('');
  };

  const handlePerformVerify = async (queryToSearch: string) => {
    const q = queryToSearch.trim();
    if (!q) return;

    setIsSearching(true);
    setSearched(true);
    resetComparison();

    try {
      const order = await ReceiptSecurityService.findOrderForVerification(q);
      setMatchedOrder(order);
    } catch (err) {
      console.error('Receipt verification search error', err);
      setMatchedOrder(null);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    if (initialQuery) {
      setSearchQuery(initialQuery);
      handlePerformVerify(initialQuery);
    } else {
      setSearchQuery('');
      setSearched(false);
      setMatchedOrder(null);
      resetComparison();
    }
  }, [isOpen, initialQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handlePerformVerify(searchQuery);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Evaluate discrepancy against presented customer PDF values
  const comparisonResult = matchedOrder
    ? ReceiptSecurityService.compareReceiptData(matchedOrder, {
        totalAmount: presentedTotal,
        advanceAmount: presentedAdvance,
        balanceAmount: presentedBalance,
        returnDate: presentedReturnDate,
        customerName: presentedName
      })
    : null;

  const firstItem = matchedOrder?.items[0];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-teal-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#faf7f2] rounded-3xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden border border-[#ede7dc]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#ede7dc] bg-[#f4efe6]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-800 text-teal-100 flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-stone-900 text-sm sm:text-base leading-tight">
                {t.verifyReceiptTitle}
              </h2>
              <p className="text-[11px] text-stone-500 font-mono">
                {shop.shopName} · Tamper-Evident Security
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="p-4 bg-white border-b border-[#ede7dc]">
          <form onSubmit={handleSearchSubmit} className="space-y-2">
            <label className="block text-xs font-bold text-stone-700">
              {t.verificationCode} / {t.slipNo}:
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className={`w-4 h-4 text-stone-400 absolute top-3 ${isRtl ? 'right-3' : 'left-3'}`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t.verificationPlaceholder}
                  autoFocus
                  className={`w-full h-10 bg-[#faf7f2] border border-[#ede7dc] rounded-xl text-xs font-mono font-bold uppercase focus:bg-white focus:border-teal-700 outline-none transition-all ${
                    isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'
                  }`}
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="px-4 h-10 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{t.verifyReceipt}</span>
              </button>
            </div>
            {/* Quick Demo Sample Button */}
            <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1">
              <span>Try test verification:</span>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('DZ-7K4P92');
                  handlePerformVerify('DZ-7K4P92');
                }}
                className="font-mono text-teal-700 hover:underline cursor-pointer font-bold"
              >
                DZ-7K4P92 (Demo Slip #1)
              </button>
            </div>
          </form>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* State 1: Idle guidance before search */}
          {!searched && (
            <div className="p-6 text-center text-stone-500 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-stone-800 text-sm">{t.verifyReceipt}</h3>
              <p className="text-xs text-stone-600 max-w-sm mx-auto leading-relaxed">
                Enter the unique <strong>Verification Code</strong> (e.g. <code>DZ-7K4P92</code>) or <strong>Slip Number</strong> printed on the customer's PDF to verify genuine booking authenticity and detect potential alterations.
              </p>
              <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 font-medium">
                🛡️ {t.authoritativeNotice}
              </div>
            </div>
          )}

          {/* State 2: Verification Failed (No Matching Receipt) */}
          {searched && !matchedOrder && (
            <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl text-stone-800 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5 text-rose-700">
                <ShieldAlert className="w-6 h-6 shrink-0" />
                <div>
                  <h3 className="font-bold text-sm">{t.verificationFailed}</h3>
                  <p className="text-xs font-semibold">{t.noMatchingReceipt}</p>
                </div>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed bg-white/70 p-3 rounded-xl border border-rose-200/60">
                Query: <code className="font-mono font-bold text-rose-800">{searchQuery}</code> was not found in your authoritative Darzify database. The document may be forged, modified, or from an unauthorized shop.
              </p>
              <div className="text-[11px] font-bold text-rose-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{t.claimedVsOriginalNotice}</span>
              </div>
            </div>
          )}

          {/* State 3: Genuine / Verified Order Found */}
          {searched && matchedOrder && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Genuine Header Banner */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 block">
                        AUTHENTICATED STATUS
                      </span>
                      <h3 className="font-extrabold text-sm sm:text-base text-emerald-900">
                        {t.verifiedGenuine}
                      </h3>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-lg">
                    #{matchedOrder.slipNumber}
                  </span>
                </div>

                {/* Verification Code Display */}
                <div className="flex items-center justify-between bg-white/90 p-2.5 rounded-xl border border-emerald-200 text-xs">
                  <div>
                    <span className="text-[10px] text-stone-500 block uppercase font-mono">
                      {t.verificationCode}
                    </span>
                    <strong className="font-mono text-base font-extrabold text-teal-900 tracking-wider">
                      {matchedOrder.verificationCode || `DZ-${matchedOrder.slipNumber}`}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(matchedOrder.verificationCode || '')}
                    className="p-1.5 text-stone-500 hover:text-teal-800 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
                    title="Copy Code"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Authoritative Booking Information Grid */}
              <div className="p-3.5 bg-white border border-[#ede7dc] rounded-2xl shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-[#f4efe6] pb-2">
                  <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-teal-700" />
                    <span>{t.originalBookingInfo}</span>
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                    matchedOrder.status === 'DELIVERED'
                      ? 'bg-stone-100 text-stone-700 border-stone-300'
                      : matchedOrder.status === 'READY'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-teal-50 text-teal-800 border-teal-300'
                  }`}>
                    {matchedOrder.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-[#faf7f2] rounded-xl border border-[#f0eae1]">
                    <span className="text-[10px] text-stone-500 block">{t.customerName}</span>
                    <strong className="text-stone-900">{matchedOrder.customerName}</strong>
                  </div>
                  <div className="p-2 bg-[#faf7f2] rounded-xl border border-[#f0eae1]">
                    <span className="text-[10px] text-stone-500 block">{t.customerPhone}</span>
                    <span className="font-mono text-stone-800">{matchedOrder.customerPhone}</span>
                  </div>
                  <div className="p-2 bg-[#faf7f2] rounded-xl border border-[#f0eae1]">
                    <span className="text-[10px] text-stone-500 block">{t.bookingDate}</span>
                    <span className="font-mono text-stone-800">{matchedOrder.bookingDate}</span>
                  </div>
                  <div className="p-2 bg-[#faf7f2] rounded-xl border border-[#f0eae1]">
                    <span className="text-[10px] text-stone-500 block">{t.returnDate}</span>
                    <strong className="font-mono text-stone-900">{matchedOrder.returnDate}</strong>
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div className="pt-2 border-t border-[#f4efe6] grid grid-cols-3 gap-2 text-xs font-mono text-center">
                  <div className="p-2 bg-[#faf7f2] rounded-xl border border-[#ede7dc]">
                    <span className="text-[10px] text-stone-500 block">{t.totalAmount}</span>
                    <strong className="text-stone-900 text-sm">Rs. {matchedOrder.totalAmount.toLocaleString()}</strong>
                  </div>
                  <div className="p-2 bg-[#faf7f2] rounded-xl border border-[#ede7dc]">
                    <span className="text-[10px] text-stone-500 block">{t.advance}</span>
                    <span className="text-stone-800 font-bold">Rs. {matchedOrder.advanceAmount.toLocaleString()}</span>
                  </div>
                  <div className="p-2 bg-rose-50/70 rounded-xl border border-rose-200">
                    <span className="text-[10px] text-rose-700 block font-bold">{t.balance}</span>
                    <strong className="text-rose-600 text-sm">Rs. {matchedOrder.balanceAmount.toLocaleString()}</strong>
                  </div>
                </div>

                {/* Cryptographic SHA-256 Hash */}
                {matchedOrder.tamperHash && (
                  <div className="pt-2 border-t border-[#f4efe6] text-[10px] text-stone-500">
                    <span className="font-bold text-stone-600 block mb-0.5">{t.tamperHashLabel}:</span>
                    <code className="block bg-[#faf7f2] p-1.5 rounded-lg border border-[#ede7dc] font-mono break-all text-[9px] text-stone-700 select-all">
                      {matchedOrder.tamperHash}
                    </code>
                  </div>
                )}
              </div>

              {/* Section 4 & 5: Interactive Tamper Detection / PDF Comparison Tool */}
              <div className="p-3.5 bg-white border border-[#ede7dc] rounded-2xl shadow-xs space-y-3">
                <div className="flex items-center gap-1.5 border-b border-[#f4efe6] pb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-bold text-stone-800">
                    {t.tamperDetection}
                  </h4>
                </div>
                <p className="text-[11px] text-stone-500 leading-normal">
                  {t.compareCustomerReceipt}. Enter values shown on the customer's shared PDF to instantly verify if any number has been modified:
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-stone-600 mb-1">
                      {t.presentedTotal} (Rs.):
                    </label>
                    <input
                      type="number"
                      value={presentedTotal}
                      onChange={e => setPresentedTotal(e.target.value)}
                      placeholder={String(matchedOrder.totalAmount)}
                      className="w-full h-8.5 px-2.5 bg-[#faf7f2] border border-[#ede7dc] rounded-lg font-mono text-xs font-bold focus:border-teal-700 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-600 mb-1">
                      {t.presentedAdvance} (Rs.):
                    </label>
                    <input
                      type="number"
                      value={presentedAdvance}
                      onChange={e => setPresentedAdvance(e.target.value)}
                      placeholder={String(matchedOrder.advanceAmount)}
                      className="w-full h-8.5 px-2.5 bg-[#faf7f2] border border-[#ede7dc] rounded-lg font-mono text-xs font-bold focus:border-teal-700 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-600 mb-1">
                      {t.presentedBalance} (Rs.):
                    </label>
                    <input
                      type="number"
                      value={presentedBalance}
                      onChange={e => setPresentedBalance(e.target.value)}
                      placeholder={String(matchedOrder.balanceAmount)}
                      className="w-full h-8.5 px-2.5 bg-[#faf7f2] border border-[#ede7dc] rounded-lg font-mono text-xs font-bold focus:border-teal-700 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-stone-600 mb-1">
                      {t.presentedReturnDate}:
                    </label>
                    <input
                      type="text"
                      value={presentedReturnDate}
                      onChange={e => setPresentedReturnDate(e.target.value)}
                      placeholder={matchedOrder.returnDate}
                      className="w-full h-8.5 px-2.5 bg-[#faf7f2] border border-[#ede7dc] rounded-lg font-mono text-xs font-bold focus:border-teal-700 outline-none"
                    />
                  </div>
                </div>

                {/* Discrepancy Evaluation Output */}
                {comparisonResult && comparisonResult.discrepancies.length > 0 && (
                  <div className="pt-2 border-t border-[#f4efe6] space-y-1.5">
                    {comparisonResult.hasTampering ? (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>{t.tamperingDetected}</span>
                        </div>
                        <div className="space-y-1 text-[11px]">
                          {comparisonResult.discrepancies.map(d => (
                            <div
                              key={d.field}
                              className={`p-1.5 rounded-lg flex items-center justify-between ${
                                d.isMatch
                                  ? 'bg-emerald-50/70 text-emerald-800'
                                  : 'bg-rose-100 text-rose-900 font-bold border border-rose-200'
                              }`}
                            >
                              <span>{d.label}:</span>
                              <span>
                                {d.isMatch ? (
                                  `✓ ${d.authoritativeValue}`
                                ) : (
                                  <>
                                    <span className="line-through opacity-75 mr-1.5">{d.presentedValue}</span>
                                    <span className="text-emerald-800 underline">Original: {d.authoritativeValue}</span>
                                  </>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-rose-900 font-semibold pt-1">
                          🛡️ Do NOT accept the altered PDF. The original Darzify database record is the only valid reality.
                        </p>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{t.allFieldsMatch}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 bg-[#f4efe6] border-t border-[#ede7dc] flex items-center justify-between gap-2">
          {matchedOrder ? (
            <div className="flex items-center gap-2">
              {onSelectOrder && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectOrder(matchedOrder);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View Booking</span>
                </button>
              )}
              {onOpenPrintHub && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenPrintHub(matchedOrder);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#ede7dc] hover:bg-stone-50 text-stone-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Official Slip</span>
                </button>
              )}
            </div>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-[#ede7dc] text-stone-700 rounded-xl text-xs font-semibold hover:bg-stone-100 cursor-pointer transition-colors"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
