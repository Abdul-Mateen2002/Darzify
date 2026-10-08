import React, { useState, useEffect } from 'react';
import { X, Printer, Calendar, Phone, Scissors, CheckCircle2, DollarSign, Sparkles, MessageSquare, AlertCircle, Pencil, Trash2, Lock, RefreshCw } from 'lucide-react';
import { Order, ShopProfile, OrderStatus } from '../types';
import { useLanguage } from '../i18n/useLanguage';
import { db } from '../db/database';
import { adminAuthService } from '../services/adminAuthService';
import { ForgotPinModal } from './ForgotPinModal';

interface OrderDetailsModalProps {
  order: Order;
  shop: ShopProfile;
  isOpen: boolean;
  onClose: () => void;
  onOpenPrintHub: (order: Order) => void;
  onOrderUpdated: () => void;
  onEditBooking: (order: Order) => void;
  onOrderDeleted: () => void;
  initialMessage?: string | null;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  shop,
  isOpen,
  onClose,
  onOpenPrintHub,
  onOrderUpdated,
  onEditBooking,
  onOrderDeleted,
  initialMessage
}) => {
  const { t, isRtl } = useLanguage();
  const [currentStatus, setCurrentStatus] = useState<OrderStatus>(order.status);
  const [payAmount, setPayAmount] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(initialMessage || null);

  useEffect(() => {
    if (initialMessage) {
      setMessage(initialMessage);
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [initialMessage]);

  // Delete Booking Dialog & Admin PIN State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isForgotPinOpen, setIsForgotPinOpen] = useState(false);

  if (!isOpen) return null;

  const firstItem = order.items[0];
  const m = firstItem?.measurements || {};
  const d = firstItem?.design;

  // Status Change Handler
  const handleStatusChange = async (newStatus: OrderStatus) => {
    setCurrentStatus(newStatus);
    await db.orders.update(order.id, { status: newStatus, updatedAt: Date.now() });
    onOrderUpdated();
    setMessage(`Status updated to ${newStatus}`);
    setTimeout(() => setMessage(null), 2000);
  };

  // Record additional balance payment upon delivery
  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const addAmt = parseFloat(payAmount) || 0;
    if (addAmt <= 0) return;

    const newAdvance = order.advanceAmount + addAmt;
    const newBalance = Math.max(0, order.totalAmount - newAdvance);
    const newStatus: OrderStatus = newBalance === 0 ? 'DELIVERED' : order.status;

    setIsUpdating(true);
    await db.orders.update(order.id, {
      advanceAmount: newAdvance,
      balanceAmount: newBalance,
      status: newStatus,
      updatedAt: Date.now()
    });

    setIsUpdating(false);
    setPayAmount('');
    onOrderUpdated();
    setMessage(`Payment of Rs. ${addAmt.toLocaleString()} recorded!`);
    setTimeout(() => setMessage(null), 2500);
  };

  // Delete Order Handler with Admin PIN Security
  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setDeleteError(null);

    const trimmed = adminPinInput.trim();
    if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
      setPinError('Administrator PIN must be exactly 6 numeric digits.');
      return;
    }
    if (trimmed === '1234') {
      setPinError('1234 is not permitted. Please enter your 6-digit PIN.');
      return;
    }

    try {
      setIsDeleting(true);
      const authRes = await adminAuthService.verifyPin(trimmed);
      if (!authRes.success) {
        setIsDeleting(false);
        setPinError(authRes.error || t.incorrectPin);
        return;
      }

      await db.orders.delete(order.id);
      await adminAuthService.deleteOrderOnline(order.id, trimmed);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      onOrderDeleted();
    } catch (err: unknown) {
      setIsDeleting(false);
      setDeleteError(t.bookingDeleteFailed + ': ' + String(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-teal-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#faf7f2] rounded-3xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden border border-[#ede7dc]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#ede7dc] bg-[#f4efe6]">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm bg-white border border-[#e5ddcf] px-2.5 py-0.5 rounded-lg text-stone-900 shadow-2xs">
                #{order.slipNumber}
              </span>
              <h2 className="font-bold text-stone-900 text-base">{order.customerName}</h2>
            </div>
            <p className="text-[11px] text-stone-500 font-mono mt-0.5">{order.customerPhone}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {message && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {/* Status Workflow Selector Bar */}
          <div className="p-3 bg-white rounded-2xl border border-[#ede7dc] shadow-xs">
            <span className="text-xs font-semibold text-stone-600 block mb-2">Order Lifecycle Status:</span>
            <div className="grid grid-cols-4 gap-1.5 text-xs font-bold">
              {(['BOOKED', 'IN_PROGRESS', 'READY', 'DELIVERED'] as OrderStatus[]).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => handleStatusChange(st)}
                  className={`py-2 px-1 rounded-xl text-center border transition-all cursor-pointer ${
                    currentStatus === st
                      ? st === 'DELIVERED'
                        ? 'bg-stone-800 text-white border-stone-800 shadow-xs'
                        : st === 'READY'
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : st === 'IN_PROGRESS'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-teal-700 text-white border-teal-700 shadow-xs'
                      : 'bg-[#faf7f2] text-stone-700 border-[#ede7dc] hover:bg-white'
                  }`}
                >
                  {st === 'BOOKED'
                    ? t.dashboard
                    : st === 'IN_PROGRESS'
                    ? t.inShopStatus
                    : st === 'READY'
                    ? t.readyStatus
                    : t.deliveredStatus}
                </button>
              ))}
            </div>
          </div>

          {/* Measurements Table */}
          <div className="p-3.5 bg-white border border-[#ede7dc] rounded-2xl shadow-xs space-y-2">
            <div className="flex items-center justify-between border-b border-[#f4efe6] pb-2">
              <h3 className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-teal-700" />
                <span>{t.measurements}</span>
              </h3>
              <span className="text-[11px] font-mono text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-lg">
                {firstItem ? t[firstItem.garmentType] || firstItem.garmentType : ''} ({firstItem?.recipientTag})
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-xs pt-1">
              {m.lambai && <div className="p-2 bg-[#faf7f2] border border-[#f0eae1] rounded-xl"><span className="text-stone-500 block text-[10px]">{t.lambai}</span><strong className="font-mono text-sm text-stone-900">{m.lambai}</strong></div>}
              {m.asteen && <div className="p-2 bg-[#faf7f2] border border-[#f0eae1] rounded-xl"><span className="text-stone-500 block text-[10px]">{t.asteen}</span><strong className="font-mono text-sm text-stone-900">{m.asteen}</strong></div>}
              {m.teera && <div className="p-2 bg-[#faf7f2] border border-[#f0eae1] rounded-xl"><span className="text-stone-500 block text-[10px]">{t.teera}</span><strong className="font-mono text-sm text-stone-900">{m.teera}</strong></div>}
              {m.collar && <div className="p-2 bg-[#faf7f2] border border-[#f0eae1] rounded-xl"><span className="text-stone-500 block text-[10px]">{t.collar}</span><strong className="font-mono text-sm text-stone-900">{m.collar}</strong></div>}
              {m.chaati && <div className="p-2 bg-[#faf7f2] border border-[#f0eae1] rounded-xl"><span className="text-stone-500 block text-[10px]">{t.chaati}</span><strong className="font-mono text-sm text-stone-900">{m.chaati}</strong></div>}
              {m.kamar && <div className="p-2 bg-[#faf7f2] border border-[#f0eae1] rounded-xl"><span className="text-stone-500 block text-[10px]">{t.kamar}</span><strong className="font-mono text-sm text-stone-900">{m.kamar}</strong></div>}
              {m.ghera && <div className="p-2 bg-[#faf7f2] border border-[#f0eae1] rounded-xl"><span className="text-stone-500 block text-[10px]">{t.ghera}</span><strong className="font-mono text-sm text-stone-900">{m.ghera}</strong></div>}
              {m.shalwarLambai && <div className="p-2 bg-[#faf7f2] border border-[#f0eae1] rounded-xl"><span className="text-stone-500 block text-[10px]">{t.shalwarLambai}</span><strong className="font-mono text-sm text-stone-900">{m.shalwarLambai}</strong></div>}
              {m.paicha && <div className="p-2 bg-[#faf7f2] border border-[#f0eae1] rounded-xl"><span className="text-stone-500 block text-[10px]">{t.paicha}</span><strong className="font-mono text-sm text-stone-900">{m.paicha}</strong></div>}
              {m.cuffWidth && <div className="p-2 bg-[#faf7f2] border border-[#f0eae1] rounded-xl"><span className="text-stone-500 block text-[10px]">{t.cuffWidth}</span><strong className="font-mono text-sm text-stone-900">{m.cuffWidth}</strong></div>}
              {m.pattiWidth && <div className="p-2 bg-[#faf7f2] border border-[#f0eae1] rounded-xl"><span className="text-stone-500 block text-[10px]">{t.pattiWidth}</span><strong className="font-mono text-sm text-stone-900">{m.pattiWidth}</strong></div>}
            </div>
          </div>

          {/* Design & Styling Specs */}
          {d && (
            <div className="p-3.5 bg-white border border-[#ede7dc] rounded-2xl shadow-xs space-y-1.5">
              <h3 className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                <span>{t.design}</span>
              </h3>
              <div className="flex flex-wrap gap-1.5 text-[11px] pt-1">
                {d.collarStyle && <span className="px-2 py-1 bg-[#f4efe6] border border-[#e5ddcf] rounded-md font-semibold text-stone-800">{t[`style_${d.collarStyle}` as keyof typeof t]}</span>}
                {d.cuffStyle && <span className="px-2 py-1 bg-[#f4efe6] border border-[#e5ddcf] rounded-md font-semibold text-stone-800">{t[`style_${d.cuffStyle}` as keyof typeof t]}</span>}
                {d.damanStyle && <span className="px-2 py-1 bg-[#f4efe6] border border-[#e5ddcf] rounded-md font-semibold text-stone-800">{t[`style_DAMAN_${d.damanStyle}` as keyof typeof t]}</span>}
                {d.pockets.map(p => <span key={p} className="px-2 py-1 bg-teal-50 text-teal-800 border border-teal-200 rounded-md font-semibold">{t[`pocket_${p}` as keyof typeof t]}</span>)}
                {d.extras.map(e => <span key={e} className="px-2 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-md font-semibold">{t[`extra_${e}` as keyof typeof t]}</span>)}
              </div>
            </div>
          )}

          {/* Separate Notes */}
          <div className="space-y-2">
            {order.specialInstructions && (
              <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs">
                <span className="font-bold text-amber-900 block mb-0.5">{t.specialInstructions}:</span>
                <p className="text-stone-800 font-medium">{order.specialInstructions}</p>
              </div>
            )}
            {order.tailoringNotes && (
              <div className="p-3 bg-teal-50/60 border border-teal-200/60 rounded-xl text-xs">
                <span className="font-bold text-teal-900 block mb-0.5">{t.tailoringNotes}:</span>
                <p className="text-stone-800 font-medium">{order.tailoringNotes}</p>
              </div>
            )}
          </div>

          {/* Financial Breakdown & Balance Settlement */}
          <div className="p-3.5 bg-white border border-[#ede7dc] rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-stone-500">{t.totalAmount}:</span>
              <strong className="text-stone-900 text-sm">Rs. {order.totalAmount.toLocaleString()}</strong>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-stone-500">{t.advance}:</span>
              <span className="text-stone-800">Rs. {order.advanceAmount.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-[#f4efe6]">
              <span className="font-bold text-rose-700">{t.balance}:</span>
              <strong className="text-base font-bold text-rose-600">Rs. {order.balanceAmount.toLocaleString()}</strong>
            </div>

            {/* Quick Balance Collection Field */}
            {order.balanceAmount > 0 && (
              <form onSubmit={handleCollectPayment} className="pt-2 border-t border-[#f4efe6] flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-2 text-xs text-stone-400 font-mono">Rs.</span>
                  <input
                    type="number"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    placeholder={String(order.balanceAmount)}
                    className="w-full h-8.5 pl-8 pr-2 bg-[#faf7f2] border border-[#ede7dc] rounded-lg text-xs font-mono font-bold focus:border-teal-700 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="h-8.5 px-3.5 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer transition-colors"
                >
                  {t.collectPayment}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 bg-[#f4efe6] border-t border-[#ede7dc] flex flex-wrap items-center justify-between gap-2">
          {/* Delete Booking Action (Safe & Protected) */}
          <button
            type="button"
            onClick={() => {
              setAdminPinInput('');
              setPinError(null);
              setDeleteError(null);
              setShowDeleteConfirm(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-rose-700 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t.deleteBooking}</span>
          </button>

          <div className="flex items-center gap-2">
            {/* Edit Booking Action */}
            <button
              type="button"
              onClick={() => onEditBooking(order)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>{t.editBooking}</span>
            </button>

            {/* Print Slip / PDF Action */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPrintHub(order);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-[#ede7dc] hover:bg-stone-50 text-stone-800 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>{t.customerSlip} / PDF</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-stone-500 hover:text-stone-800 text-xs font-semibold rounded-xl hover:bg-stone-200/50 cursor-pointer transition-colors"
            >
              {t.close}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Booking Confirmation & Admin PIN Protection Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-teal-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#faf7f2] rounded-3xl shadow-2xl max-w-sm w-full p-5 border border-[#ede7dc] text-stone-900 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">{t.deleteBookingQuestion}</h3>
                <span className="text-[11px] font-mono text-stone-500">#{order.slipNumber} · {order.customerName}</span>
              </div>
            </div>

            <p className="text-xs text-stone-600 mb-4 bg-white p-3 rounded-xl border border-[#ede7dc] leading-relaxed">
              {t.deleteBookingWarning}
            </p>

            <form onSubmit={handleConfirmDelete} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-stone-500" />
                    <span>6-Digit Administrator PIN</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsForgotPinOpen(true)}
                    className="text-[11px] text-teal-800 font-bold hover:underline cursor-pointer"
                  >
                    Forgot PIN?
                  </button>
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={adminPinInput}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '');
                    setAdminPinInput(digits);
                    setPinError(null);
                  }}
                  placeholder="••••••"
                  autoFocus
                  required
                  className="w-full h-10 px-3 bg-white border border-[#ede7dc] rounded-xl text-center text-base font-mono tracking-widest font-bold focus:border-rose-600 outline-none"
                />
                {pinError && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{pinError}</span>
                  </p>
                )}
                {deleteError && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{deleteError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#ede7dc]">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setAdminPinInput('');
                    setPinError(null);
                    setDeleteError(null);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-stone-700 bg-white border border-[#ede7dc] hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isDeleting || adminPinInput.length !== 6}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeleting ? '...' : t.delete}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Forgot PIN Recovery Modal */}
      <ForgotPinModal
        isOpen={isForgotPinOpen}
        onClose={() => setIsForgotPinOpen(false)}
        onPinResetSuccess={() => {
          setIsForgotPinOpen(false);
          setAdminPinInput('');
          setPinError(null);
        }}
      />
    </div>
  );
};
