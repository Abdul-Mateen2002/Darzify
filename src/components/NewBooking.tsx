import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Plus, Minus, Calendar, Scissors, Sparkles, Check, AlertCircle } from 'lucide-react';
import { GarmentType, CollarStyle, CuffStyle, DamanStyle, PocketType, ExtraOption, PaymentMethod, ShopProfile, Order, Customer } from '../types';
import { useLanguage } from '../i18n/useLanguage';
import { db } from '../db/database';
import { TailorKeypad } from './TailorKeypad';
import { ReceiptSecurityService } from '../services/receiptSecurityService';

interface NewBookingProps {
  shop: ShopProfile;
  editingOrder?: Order | null;
  onCancel: () => void;
  onOrderSaved: (order: Order) => void;
  onOrderUpdated?: (order: Order) => void;
}

// Measurement field ordering for Next > button sequence
const MEASUREMENT_KEYS: Array<{ key: string; labelKey: string; section: 'kameez' | 'shalwar' | 'detail' }> = [
  { key: 'lambai', labelKey: 'lambai', section: 'kameez' },
  { key: 'asteen', labelKey: 'asteen', section: 'kameez' },
  { key: 'teera', labelKey: 'teera', section: 'kameez' },
  { key: 'collar', labelKey: 'collar', section: 'kameez' },
  { key: 'chaati', labelKey: 'chaati', section: 'kameez' },
  { key: 'kamar', labelKey: 'kamar', section: 'kameez' },
  { key: 'ghera', labelKey: 'ghera', section: 'kameez' },
  { key: 'shalwarLambai', labelKey: 'shalwarLambai', section: 'shalwar' },
  { key: 'paicha', labelKey: 'paicha', section: 'shalwar' },
  { key: 'cuffWidth', labelKey: 'cuffWidth', section: 'detail' },
  { key: 'pattiWidth', labelKey: 'pattiWidth', section: 'detail' }
];

export const NewBooking: React.FC<NewBookingProps> = ({
  shop,
  editingOrder,
  onCancel,
  onOrderSaved,
  onOrderUpdated
}) => {
  const { t, isRtl } = useLanguage();

  const firstItem = editingOrder?.items[0];
  const initialM = firstItem?.measurements || {};
  const initialD = firstItem?.design;

  // Customer State
  const [customerPhone, setCustomerPhone] = useState(editingOrder?.customerPhone || '');
  const [customerName, setCustomerName] = useState(editingOrder?.customerName || '');
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);

  // Garment & Recipient State
  const [garmentType, setGarmentType] = useState<GarmentType>(firstItem?.garmentType || 'SHALWAR_KAMEEZ');
  const [recipientTag, setRecipientTag] = useState(firstItem?.recipientTag || t.recipient_myself);

  // Measurements State (Numeric strings for in-app keypad)
  const [measurements, setMeasurements] = useState<Record<string, string>>({
    lambai: initialM.lambai ? String(initialM.lambai) : '',
    asteen: initialM.asteen ? String(initialM.asteen) : '',
    teera: initialM.teera ? String(initialM.teera) : '',
    collar: initialM.collar ? String(initialM.collar) : '',
    chaati: initialM.chaati ? String(initialM.chaati) : '',
    kamar: initialM.kamar ? String(initialM.kamar) : '',
    ghera: initialM.ghera ? String(initialM.ghera) : '',
    shalwarLambai: initialM.shalwarLambai ? String(initialM.shalwarLambai) : '',
    paicha: initialM.paicha ? String(initialM.paicha) : '',
    cuffWidth: initialM.cuffWidth ? String(initialM.cuffWidth) : '',
    pattiWidth: initialM.pattiWidth ? String(initialM.pattiWidth) : ''
  });

  // Active Keypad State
  const [activeMeasureKey, setActiveMeasureKey] = useState<string | null>(null);

  // Design State
  const [collarStyle, setCollarStyle] = useState<CollarStyle>(initialD?.collarStyle || 'BAIN');
  const [cuffStyle, setCuffStyle] = useState<CuffStyle>(initialD?.cuffStyle || 'SQUARE');
  const [damanStyle, setDamanStyle] = useState<DamanStyle>(initialD?.damanStyle || 'SQUARE');
  const [pockets, setPockets] = useState<PocketType[]>(initialD?.pockets || ['FRONT', 'SIDE', 'SHALWAR']);
  const [extras, setExtras] = useState<ExtraOption[]>(initialD?.extras || ['DOUBLE_STITCH']);

  // Notes State (Strictly Separated)
  const [specialInstructions, setSpecialInstructions] = useState(editingOrder?.specialInstructions || '');
  const [tailoringNotes, setTailoringNotes] = useState(editingOrder?.tailoringNotes || '');

  // Financials State
  const [quantity, setQuantity] = useState(firstItem?.quantity || 1);
  const [unitRate, setUnitRate] = useState<string>(firstItem?.unitRate ? String(firstItem.unitRate) : '');
  const [advanceAmount, setAdvanceAmount] = useState<string>(
    editingOrder ? (editingOrder.advanceAmount !== undefined ? String(editingOrder.advanceAmount) : '') : ''
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(editingOrder?.paymentMethod || 'CASH');

  // Dates
  const [returnDate, setReturnDate] = useState(() => {
    if (editingOrder?.returnDate) return editingOrder.returnDate;
    const d = new Date();
    d.setDate(d.getDate() + (shop.defaultDeliveryDays || 7));
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  });

  // Discard Confirmation Modal State
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Errors & Saving State
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculated Financials
  const unitRateNum = parseFloat(unitRate) || 0;
  const totalAmount = quantity * unitRateNum;
  const advanceNum = parseFloat(advanceAmount) || 0;
  const balanceAmount = Math.max(0, totalAmount - advanceNum);

  // Track if any changes have been made compared to initial values
  const isDirty = React.useMemo(() => {
    if (!editingOrder) {
      return !!(
        customerPhone ||
        customerName ||
        unitRate ||
        advanceAmount ||
        specialInstructions ||
        tailoringNotes ||
        Object.values(measurements).some(v => v !== '')
      );
    }
    const origItem = editingOrder.items[0];
    const origM = origItem?.measurements || {};
    const origD = origItem?.design;

    if (customerPhone !== editingOrder.customerPhone) return true;
    if (customerName !== editingOrder.customerName) return true;
    if (garmentType !== (origItem?.garmentType || 'SHALWAR_KAMEEZ')) return true;
    if (recipientTag !== (origItem?.recipientTag || t.recipient_myself)) return true;
    if (quantity !== (origItem?.quantity || 1)) return true;
    if (unitRate !== (origItem?.unitRate ? String(origItem.unitRate) : '')) return true;
    if (advanceAmount !== (editingOrder.advanceAmount !== undefined ? String(editingOrder.advanceAmount) : '')) return true;
    if (paymentMethod !== editingOrder.paymentMethod) return true;
    if (returnDate !== editingOrder.returnDate) return true;
    if (specialInstructions !== (editingOrder.specialInstructions || '')) return true;
    if (tailoringNotes !== (editingOrder.tailoringNotes || '')) return true;
    if (collarStyle !== (origD?.collarStyle || 'BAIN')) return true;
    if (cuffStyle !== (origD?.cuffStyle || 'SQUARE')) return true;
    if (damanStyle !== (origD?.damanStyle || 'SQUARE')) return true;
    if (JSON.stringify(pockets.slice().sort()) !== JSON.stringify((origD?.pockets || []).slice().sort())) return true;
    if (JSON.stringify(extras.slice().sort()) !== JSON.stringify((origD?.extras || []).slice().sort())) return true;

    for (const { key } of MEASUREMENT_KEYS) {
      const origVal = (origM as Record<string, number | undefined>)[key];
      const curVal = measurements[key] || '';
      const origStr = origVal !== undefined && origVal !== null ? String(origVal) : '';
      if (curVal !== origStr) return true;
    }
    return false;
  }, [
    editingOrder, customerPhone, customerName, garmentType, recipientTag, quantity, unitRate,
    advanceAmount, paymentMethod, returnDate, specialInstructions, tailoringNotes,
    collarStyle, cuffStyle, damanStyle, pockets, extras, measurements, t.recipient_myself
  ]);

  const handleCancelClick = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onCancel();
    }
  };

  // Strict Phone Sanitization (Digits only, max 11)
  const handlePhoneChange = (val: string) => {
    const digitsOnly = val.replace(/\D/g, '').slice(0, 11);
    setCustomerPhone(digitsOnly);
  };

  // Strict Name Sanitization (Alphabetic characters & spaces only, max 30)
  const handleNameChange = (val: string) => {
    // Only letters (English, Urdu, Arabic) and spaces
    const sanitized = val.replace(/[^\u0600-\u06FF\u0750-\u077Fa-zA-Z\s]/g, '').slice(0, 30);
    setCustomerName(sanitized);
  };

  // Auto-search returning customers by phone (disabled during editing)
  useEffect(() => {
    if (editingOrder) return;
    const trimmed = customerPhone.trim();
    if (trimmed.length >= 7) {
      db.customers.where('phone').equals(trimmed).first().then(cust => {
        if (cust) {
          setFoundCustomer(cust);
          if (!customerName) setCustomerName(cust.name);
          // Look up latest order for previous measurements
          db.orders.where('customerPhone').equals(trimmed).reverse().sortBy('createdAt').then(orders => {
            const lastOrder = orders[0];
            if (lastOrder && lastOrder.items[0]?.measurements) {
              const lastM = lastOrder.items[0].measurements;
              setMeasurements(prev => ({
                ...prev,
                lambai: lastM.lambai ? String(lastM.lambai) : prev.lambai,
                asteen: lastM.asteen ? String(lastM.asteen) : prev.asteen,
                teera: lastM.teera ? String(lastM.teera) : prev.teera,
                collar: lastM.collar ? String(lastM.collar) : prev.collar,
                chaati: lastM.chaati ? String(lastM.chaati) : prev.chaati,
                kamar: lastM.kamar ? String(lastM.kamar) : prev.kamar,
                ghera: lastM.ghera ? String(lastM.ghera) : prev.ghera,
                shalwarLambai: lastM.shalwarLambai ? String(lastM.shalwarLambai) : prev.shalwarLambai,
                paicha: lastM.paicha ? String(lastM.paicha) : prev.paicha,
                cuffWidth: lastM.cuffWidth ? String(lastM.cuffWidth) : prev.cuffWidth,
                pattiWidth: lastM.pattiWidth ? String(lastM.pattiWidth) : prev.pattiWidth,
              }));
            }
          });
        } else {
          setFoundCustomer(null);
        }
      });
    }
  }, [customerPhone, editingOrder]);

  // Keypad Handlers
  const handleKeypadPress = (val: string) => {
    if (!activeMeasureKey) return;
    setMeasurements(prev => {
      const cur = prev[activeMeasureKey] || '';
      // Fraction shortcuts replace or append
      if (val.startsWith('.')) {
        if (cur.includes('.')) return prev;
        return { ...prev, [activeMeasureKey]: cur ? `${cur.split('.')[0]}${val}` : val };
      }
      return { ...prev, [activeMeasureKey]: cur + val };
    });
  };

  const handleKeypadBackspace = () => {
    if (!activeMeasureKey) return;
    setMeasurements(prev => ({
      ...prev,
      [activeMeasureKey]: (prev[activeMeasureKey] || '').slice(0, -1)
    }));
  };

  const handleKeypadClear = () => {
    if (!activeMeasureKey) return;
    setMeasurements(prev => ({ ...prev, [activeMeasureKey]: '' }));
  };

  const handleKeypadNext = () => {
    if (!activeMeasureKey) {
      setActiveMeasureKey(MEASUREMENT_KEYS[0].key);
      return;
    }
    const idx = MEASUREMENT_KEYS.findIndex(m => m.key === activeMeasureKey);
    if (idx !== -1 && idx < MEASUREMENT_KEYS.length - 1) {
      setActiveMeasureKey(MEASUREMENT_KEYS[idx + 1].key);
    } else {
      setActiveMeasureKey(null); // Finished all measurements
    }
  };

  // Toggle Pockets
  const togglePocket = (p: PocketType) => {
    setPockets(prev => (prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]));
  };

  // Toggle Extras
  const toggleExtra = (e: ExtraOption) => {
    setExtras(prev => (prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]));
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Strict Pakistani Phone Validation: Exactly 11 digits starting with 03
    const pakPhoneRegex = /^03[0-9]{9}$/;
    if (!pakPhoneRegex.test(customerPhone.trim())) {
      setErrorMessage(t.invalidPhoneError);
      return;
    }

    // 2. Strict Customer Name Validation: 1 to 30 characters, letters only (English/Urdu/Arabic), no numbers
    const cleanName = customerName.trim();
    const nameRegex = /^[\u0600-\u06FF\u0750-\u077Fa-zA-Z\s]{1,30}$/;
    if (!cleanName || cleanName.length > 30 || !nameRegex.test(cleanName)) {
      setErrorMessage(t.invalidNameError);
      return;
    }

    // 3. Suit Quantity Validation: Max 10 suits
    if (quantity < 1 || quantity > 10) {
      setErrorMessage(t.quantityExceededError);
      return;
    }

    // 4. Rate per suit validation: Required and must be positive
    if (!unitRateNum || unitRateNum <= 0) {
      setErrorMessage(t.rateRequiredError);
      return;
    }

    // 5. Advance validation: Advance cannot exceed Total
    if (advanceNum > totalAmount) {
      setErrorMessage(t.advanceExceedsTotalError);
      return;
    }

    try {
      setIsSubmitting(true);

      if (editingOrder) {
        // Atomic update of existing booking - retain authoritative verificationCode!
        const verificationCode = editingOrder.verificationCode || (await ReceiptSecurityService.generateUniqueVerificationCode());
        const updatedOrder: Order = {
          ...editingOrder,
          customerPhone: customerPhone.trim(),
          customerName: cleanName,
          returnDate,
          items: [
            {
              ...(editingOrder.items[0] || { id: 'item_' + Date.now() }),
              garmentType,
              recipientTag: recipientTag.trim() || t.recipient_myself,
              quantity,
              unitRate: unitRateNum,
              measurements: {
                lambai: parseFloat(measurements.lambai) || undefined,
                asteen: parseFloat(measurements.asteen) || undefined,
                teera: parseFloat(measurements.teera) || undefined,
                collar: parseFloat(measurements.collar) || undefined,
                chaati: parseFloat(measurements.chaati) || undefined,
                kamar: parseFloat(measurements.kamar) || undefined,
                ghera: parseFloat(measurements.ghera) || undefined,
                shalwarLambai: parseFloat(measurements.shalwarLambai) || undefined,
                paicha: parseFloat(measurements.paicha) || undefined,
                cuffWidth: parseFloat(measurements.cuffWidth) || undefined,
                pattiWidth: parseFloat(measurements.pattiWidth) || undefined
              },
              design: {
                collarStyle,
                cuffStyle,
                damanStyle,
                pockets,
                extras
              }
            }
          ],
          totalAmount,
          advanceAmount: advanceNum,
          balanceAmount,
          paymentMethod,
          specialInstructions: specialInstructions.trim(),
          tailoringNotes: tailoringNotes.trim(),
          // Preserve original identity, verification code & timestamps
          id: editingOrder.id,
          slipNumber: editingOrder.slipNumber,
          verificationCode,
          createdAt: editingOrder.createdAt,
          bookingDate: editingOrder.bookingDate,
          updatedAt: Date.now()
        };

        // Recompute cryptographic hash for updated authoritative data
        updatedOrder.tamperHash = await ReceiptSecurityService.computeTamperHash(updatedOrder);

        // Update customer in database if name or phone changed
        if (editingOrder.customerId) {
          await db.customers.update(editingOrder.customerId, {
            name: cleanName,
            phone: customerPhone.trim()
          });
        }

        // Commit atomically to IndexedDB
        await db.orders.put(updatedOrder);

        if (onOrderUpdated) {
          onOrderUpdated(updatedOrder);
        } else {
          onOrderSaved(updatedOrder);
        }
        return;
      }

      // Save customer record
      let customerId = foundCustomer?.id;
      if (!customerId) {
        customerId = 'cust_' + Date.now();
        await db.customers.put({
          id: customerId,
          phone: customerPhone.trim(),
          name: cleanName,
          createdAt: Date.now(),
          totalOrders: 1
        });
      } else {
        await db.customers.update(customerId, {
          name: cleanName,
          totalOrders: (foundCustomer?.totalOrders || 0) + 1
        });
      }

      // Generate incremental slip number
      const highestSlipOrder = await db.orders.orderBy('slipNumber').last();
      const nextSlipNumber = (highestSlipOrder?.slipNumber || 0) + 1;

      const bookingDateStr = (() => {
        const d = new Date();
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      })();

      // Generate unique, unpredictable verification code (e.g. DZ-7K4P92)
      const verificationCode = await ReceiptSecurityService.generateUniqueVerificationCode();

      // Construct order object
      const newOrder: Order = {
        id: 'ord_' + Date.now(),
        slipNumber: nextSlipNumber,
        verificationCode,
        customerId,
        customerPhone: customerPhone.trim(),
        customerName: cleanName,
        bookingDate: bookingDateStr,
        returnDate,
        status: 'BOOKED',
        items: [
          {
            id: 'item_' + Date.now(),
            garmentType,
            recipientTag: recipientTag.trim() || t.recipient_myself,
            quantity,
            unitRate: unitRateNum,
            measurements: {
              lambai: parseFloat(measurements.lambai) || undefined,
              asteen: parseFloat(measurements.asteen) || undefined,
              teera: parseFloat(measurements.teera) || undefined,
              collar: parseFloat(measurements.collar) || undefined,
              chaati: parseFloat(measurements.chaati) || undefined,
              kamar: parseFloat(measurements.kamar) || undefined,
              ghera: parseFloat(measurements.ghera) || undefined,
              shalwarLambai: parseFloat(measurements.shalwarLambai) || undefined,
              paicha: parseFloat(measurements.paicha) || undefined,
              cuffWidth: parseFloat(measurements.cuffWidth) || undefined,
              pattiWidth: parseFloat(measurements.pattiWidth) || undefined
            },
            design: {
              collarStyle,
              cuffStyle,
              damanStyle,
              pockets,
              extras
            }
          }
        ],
        totalAmount,
        advanceAmount: advanceNum,
        balanceAmount,
        paymentMethod,
        specialInstructions: specialInstructions.trim(),
        tailoringNotes: tailoringNotes.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Compute cryptographic hash of core receipt data
      newOrder.tamperHash = await ReceiptSecurityService.computeTamperHash(newOrder);

      // Atomic commit to IndexedDB
      await db.orders.put(newOrder);

      // Trigger completion callback
      onOrderSaved(newOrder);
    } catch (err: unknown) {
      setErrorMessage('Failed to save order: ' + String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeMeasureObj = MEASUREMENT_KEYS.find(m => m.key === activeMeasureKey);

  return (
    <div className="pb-36 max-w-xl mx-auto px-3 sm:px-4 py-3">
      {/* Top Bar with Back Action */}
      <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-[#ede7dc]">
        <button
          type="button"
          onClick={handleCancelClick}
          className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 px-3 py-1.5 rounded-xl bg-[#f4efe6] hover:bg-[#eae4d8] border border-[#e5ddcf] transition-colors cursor-pointer"
        >
          <ArrowLeft className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
          <span>{editingOrder ? t.cancel : t.back}</span>
        </button>
        <div className="text-center">
          <h1 className="text-lg font-bold text-stone-900 tracking-tight">
            {editingOrder ? t.editBooking : t.newBooking}
          </h1>
          {editingOrder && (
            <span className="font-mono text-[11px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200 inline-block mt-0.5">
              #{editingOrder.slipNumber}
            </span>
          )}
        </div>
        <div className="w-12" />
      </div>

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* SECTION 1: Customer Contact Info */}
        <div className="bg-[#fefcf9] p-3.5 rounded-2xl shadow-xs border border-[#ede7dc] space-y-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {t.customerPhone} <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              value={customerPhone}
              onChange={e => handlePhoneChange(e.target.value)}
              onPaste={e => {
                e.preventDefault();
                const pasted = e.clipboardData.getData('text');
                handlePhoneChange(pasted);
              }}
              placeholder={t.phonePlaceholder}
              maxLength={11}
              required
              className="w-full h-11 px-3 bg-white border border-stone-300 rounded-xl text-base font-mono font-medium focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none transition-all"
            />
            {foundCustomer && (
              <span className="text-[11px] text-teal-700 font-medium mt-1 inline-block">
                ✓ {t.foundCustomerNotice} {foundCustomer.name} ({foundCustomer.totalOrders} {t.slipsCount})
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {t.customerName} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={customerName}
              onChange={e => handleNameChange(e.target.value)}
              onPaste={e => {
                e.preventDefault();
                const pasted = e.clipboardData.getData('text');
                handleNameChange(pasted);
              }}
              placeholder={t.namePlaceholder}
              maxLength={30}
              required
              className="w-full h-11 px-3 bg-white border border-stone-300 rounded-xl text-sm font-medium focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-none transition-all"
            />
          </div>
        </div>

        {/* SECTION 2: Garment Type & Recipient Person */}
        <div className="bg-[#fefcf9] p-3.5 rounded-2xl shadow-xs border border-[#ede7dc] space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-stone-700">{t.whatToMake}</label>
            <span className="text-xs font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
              {t[garmentType]} × {quantity}
            </span>
          </div>

          {/* Garment Selection Chips */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
            {(['SHALWAR_KAMEEZ', 'KURTA_SHALWAR', 'WAISTCOAT', 'SHIRT', 'PANT'] as GarmentType[]).map(g => (
              <button
                key={g}
                type="button"
                onClick={() => setGarmentType(g)}
                className={`py-2 px-1.5 rounded-xl text-xs font-bold text-center border transition-all ${
                  garmentType === g
                    ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                    : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                }`}
              >
                {t[g]}
              </button>
            ))}
          </div>

          {/* Recipient Field ("کس کا") */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">{t.forWhom}</label>
            <input
              type="text"
              value={recipientTag}
              onChange={e => setRecipientTag(e.target.value)}
              placeholder={t.forWhomPlaceholder}
              maxLength={30}
              className="w-full h-10 px-3 bg-white border border-stone-300 rounded-xl text-xs font-medium focus:border-teal-600 outline-none"
            />
            {/* Standard Relationship Suggestions (No fake names) */}
            <div className="flex items-center gap-1.5 mt-1.5 overflow-x-auto no-scrollbar py-1">
              {[
                t.recipient_myself,
                t.recipient_father,
                t.recipient_son,
                t.recipient_brother,
                t.recipient_daughter
              ].map(sugg => (
                <button
                  key={sugg}
                  type="button"
                  onClick={() => setRecipientTag(sugg)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                    recipientTag === sugg
                      ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                      : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {sugg}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 3: Measurements Grid with In-App Touch Keypad Trigger */}
        <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5 text-teal-600" />
              <span>{t.measurements}</span>
            </h3>
            <span className="text-[11px] text-slate-400">انچ (Inches)</span>
          </div>

          {/* Kameez / Kurta Measurements Grid */}
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">{t.kameezSection}</span>
            <div className="grid grid-cols-4 gap-2">
              {MEASUREMENT_KEYS.filter(m => m.section === 'kameez').map(({ key, labelKey }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveMeasureKey(key)}
                  className={`p-2 rounded-xl text-center border transition-all flex flex-col items-center justify-center min-h-[58px] ${
                    activeMeasureKey === key
                      ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-400/50 shadow'
                      : measurements[key]
                      ? 'bg-teal-50/60 border-teal-300 text-slate-800'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-[11px] font-medium leading-tight text-slate-600 truncate w-full">
                    {t[labelKey as keyof typeof t] || labelKey}
                  </span>
                  <span className="text-base font-bold font-mono mt-0.5 text-slate-900">
                    {measurements[key] || '-'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Shalwar Measurements Grid */}
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">{t.shalwarSection}</span>
            <div className="grid grid-cols-4 gap-2">
              {MEASUREMENT_KEYS.filter(m => m.section === 'shalwar').map(({ key, labelKey }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveMeasureKey(key)}
                  className={`p-2 rounded-xl text-center border transition-all flex flex-col items-center justify-center min-h-[58px] ${
                    activeMeasureKey === key
                      ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-400/50 shadow'
                      : measurements[key]
                      ? 'bg-teal-50/60 border-teal-300 text-slate-800'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-[11px] font-medium leading-tight text-slate-600 truncate w-full">
                    {t[labelKey as keyof typeof t] || labelKey}
                  </span>
                  <span className="text-base font-bold font-mono mt-0.5 text-slate-900">
                    {measurements[key] || '-'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Detail Measurements Grid (Cuff & Placket) */}
          <div>
            <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">{t.detailSection}</span>
            <div className="grid grid-cols-4 gap-2">
              {MEASUREMENT_KEYS.filter(m => m.section === 'detail').map(({ key, labelKey }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveMeasureKey(key)}
                  className={`p-2 rounded-xl text-center border transition-all flex flex-col items-center justify-center min-h-[58px] ${
                    activeMeasureKey === key
                      ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-400/50 shadow'
                      : measurements[key]
                      ? 'bg-teal-50/60 border-teal-300 text-slate-800'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-[11px] font-medium leading-tight text-slate-600 truncate w-full">
                    {t[labelKey as keyof typeof t] || labelKey}
                  </span>
                  <span className="text-base font-bold font-mono mt-0.5 text-slate-900">
                    {measurements[key] || '-'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 4: Styling & Design Selectors */}
        <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              <span>{t.design}</span>
            </h3>
          </div>

          {/* 1. Collar Style */}
          <div>
            <span className="text-xs font-semibold text-slate-600 block mb-1.5">{t.collarCategory}</span>
            <div className="grid grid-cols-3 gap-2">
              {(['COLLAR', 'BAIN', 'CUT_BAIN'] as CollarStyle[]).map(style => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setCollarStyle(style)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                    collarStyle === style
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {/* Collar Line Art Icon */}
                  <div className="w-7 h-5 border-t-2 border-x-2 border-current rounded-t-sm flex items-center justify-center opacity-80" />
                  <span>{t[`style_${style}` as keyof typeof t]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Cuff Style */}
          <div>
            <span className="text-xs font-semibold text-slate-600 block mb-1.5">{t.cuffCategory}</span>
            <div className="grid grid-cols-3 gap-2">
              {(['ROUND', 'SQUARE', 'PLAIN_SLEEVE'] as CuffStyle[]).map(style => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setCuffStyle(style)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                    cuffStyle === style
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className={`w-6 h-5 border-2 border-current opacity-80 ${style === 'ROUND' ? 'rounded-b-md' : 'rounded-none'}`} />
                  <span>{t[`style_${style}` as keyof typeof t]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Daman Style */}
          <div>
            <span className="text-xs font-semibold text-slate-600 block mb-1.5">{t.damanCategory}</span>
            <div className="grid grid-cols-2 gap-2">
              {(['ROUND', 'SQUARE'] as DamanStyle[]).map(style => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setDamanStyle(style)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                    damanStyle === style
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className={`w-8 h-4 border-b-2 border-x-2 border-current opacity-80 ${style === 'ROUND' ? 'rounded-b-lg' : 'rounded-none'}`} />
                  <span>{t[`style_DAMAN_${style}` as keyof typeof t]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Pockets (Multi-Select) */}
          <div>
            <span className="text-xs font-semibold text-slate-600 block mb-1.5">{t.pocketsCategory}</span>
            <div className="grid grid-cols-3 gap-2">
              {(['FRONT', 'SIDE', 'SHALWAR'] as PocketType[]).map(p => {
                const isSelected = pockets.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePocket(p)}
                    className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-teal-50 border-teal-600 text-teal-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${isSelected ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300'}`}>
                      {isSelected && <Check className="w-2.5 h-2.5" />}
                    </div>
                    <span>{t[`pocket_${p}` as keyof typeof t]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Extras (Multi-Select) */}
          <div>
            <span className="text-xs font-semibold text-slate-600 block mb-1.5">{t.extrasCategory}</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(['PATTI', 'DOUBLE_STITCH', 'EMBROIDERY', 'STEEL_BUTTON', 'FANCY_BUTTON'] as ExtraOption[]).map(e => {
                const isSelected = extras.includes(e);
                return (
                  <button
                    key={e}
                    type="button"
                    onClick={() => toggleExtra(e)}
                    className={`p-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-teal-50 border-teal-600 text-teal-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${isSelected ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300'}`}>
                      {isSelected && <Check className="w-2.5 h-2.5" />}
                    </div>
                    <span>{t[`extra_${e}` as keyof typeof t]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* SECTION 5: Separate Notes Fields */}
        <div className="bg-[#fefcf9] p-3.5 rounded-2xl shadow-xs border border-[#ede7dc] space-y-3">
          {/* Note 1: دیگر تفصیل (Customer Occasion / Urgency) */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {t.specialInstructions}
            </label>
            <textarea
              rows={2}
              value={specialInstructions}
              onChange={e => setSpecialInstructions(e.target.value)}
              placeholder={t.specialInstructionsPlaceholder}
              className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-xs font-medium focus:border-teal-600 outline-none resize-none"
            />
          </div>

          {/* Note 2: نوٹ (Master Tailor Fitting Directives) */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              {t.tailoringNotes}
            </label>
            <textarea
              rows={2}
              value={tailoringNotes}
              onChange={e => setTailoringNotes(e.target.value)}
              placeholder={t.tailoringNotesPlaceholder}
              className="w-full p-2.5 bg-white border border-stone-300 rounded-xl text-xs font-medium focus:border-teal-600 outline-none resize-none"
            />
          </div>
        </div>

        {/* SECTION 6: Pricing, Payment & Delivery Date */}
        <div className="bg-[#fefcf9] p-3.5 rounded-2xl shadow-xs border border-[#ede7dc] space-y-3.5">
          {/* Quantity Counter (Max 10) */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-700">{t.suitCount}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={quantity <= 1}
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className={`w-9 h-9 rounded-xl font-bold flex items-center justify-center transition-colors ${
                  quantity <= 1
                    ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                    : 'bg-white border border-stone-300 hover:bg-stone-100 text-stone-800'
                }`}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="font-mono font-bold text-base w-7 text-center text-stone-900">{quantity}</span>
              <button
                type="button"
                disabled={quantity >= 10}
                onClick={() => setQuantity(Math.min(10, quantity + 1))}
                className={`w-9 h-9 rounded-xl font-bold flex items-center justify-center transition-colors ${
                  quantity >= 10
                    ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                    : 'bg-white border border-stone-300 hover:bg-stone-100 text-stone-800'
                }`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Rate per suit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                {t.ratePerSuit} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-stone-400 font-mono">Rs.</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={unitRate}
                  onChange={e => setUnitRate(e.target.value.replace(/\D/g, ''))}
                  placeholder={t.ratePlaceholder}
                  required
                  className="w-full h-10 pl-9 pr-3 bg-white border border-stone-300 rounded-xl text-sm font-mono font-bold focus:border-teal-600 outline-none"
                />
              </div>
            </div>

            {/* Total Amount Display */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">{t.totalAmount}</label>
              <div className="w-full h-10 px-3 bg-stone-100 border border-stone-200 rounded-xl text-sm font-mono font-bold flex items-center text-stone-900">
                Rs. {totalAmount.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Return Date */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-teal-600" />
              <span>{t.returnDate}</span>
            </label>
            <input
              type="text"
              value={returnDate}
              onChange={e => setReturnDate(e.target.value)}
              placeholder="DD/MM/YYYY"
              className="w-full h-10 px-3 bg-white border border-stone-300 rounded-xl text-sm font-mono font-bold focus:border-teal-600 outline-none"
            />
          </div>

          {/* Payment Method Toggle & Advance Payment */}
          <div className="grid grid-cols-2 gap-3 pt-1 border-t border-stone-200/60">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">{t.advance}</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-stone-400 font-mono">Rs.</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={advanceAmount}
                  onChange={e => setAdvanceAmount(e.target.value.replace(/\D/g, ''))}
                  placeholder="0"
                  className="w-full h-10 pl-9 pr-3 bg-white border border-stone-300 rounded-xl text-sm font-mono font-bold focus:border-teal-600 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">{t.paymentMode}</label>
              <div className="flex rounded-xl bg-stone-100 p-1 border border-stone-200">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    paymentMethod === 'CASH' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                  }`}
                >
                  {t.cash}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('ONLINE')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    paymentMethod === 'ONLINE' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'
                  }`}
                >
                  {t.online}
                </button>
              </div>
            </div>
          </div>

          {/* Prominent Balance Output in Red Font */}
          <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-xl flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800">{t.balance}:</span>
            <span className="text-xl font-mono font-extrabold text-rose-600 tracking-tight">
              Rs. {balanceAmount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* SECTION 7: Main Action Button */}
        <div className="sticky bottom-3 z-20 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-13 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-teal-950/20 transition-all cursor-pointer"
          >
            <span>
              {isSubmitting
                ? editingOrder
                  ? t.savingChanges
                  : t.saving
                : editingOrder
                ? t.saveChanges
                : t.saveAndPrint}
            </span>
          </button>
        </div>
      </form>

      {/* Discard Changes Confirmation Modal */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-teal-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#faf7f2] rounded-3xl shadow-2xl max-w-sm w-full p-5 border border-[#ede7dc] text-stone-900 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">{t.discardChangesQuestion}</h3>
                <p className="text-xs text-stone-500 mt-0.5">{t.discardChangesWarning}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-[#ede7dc]">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-stone-700 bg-white border border-[#ede7dc] hover:bg-stone-100 transition-colors cursor-pointer"
              >
                {t.continueEditing}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  onCancel();
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
              >
                {t.discardChanges}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Docked Keypad Overlay for Measurements */}
      {activeMeasureKey && (
        <div className="fixed bottom-0 left-0 right-0 z-40 max-w-xl mx-auto">
          <TailorKeypad
            currentFieldLabel={t[activeMeasureObj?.labelKey as keyof typeof t] || activeMeasureObj?.labelKey || ''}
            currentValue={measurements[activeMeasureKey] || ''}
            onKeyPress={handleKeypadPress}
            onBackspace={handleKeypadBackspace}
            onClear={handleKeypadClear}
            onNext={handleKeypadNext}
            onClose={() => setActiveMeasureKey(null)}
          />
        </div>
      )}
    </div>
  );
};
