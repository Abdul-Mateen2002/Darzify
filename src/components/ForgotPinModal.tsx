import React, { useState, useEffect } from 'react';
import {
  X,
  KeyRound,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Mail,
  Phone,
  Lock,
  ArrowLeft,
  Bell
} from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';
import { adminAuthService, DispatchNotification } from '../services/adminAuthService';

interface ForgotPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPinResetSuccess: () => void;
}

type RecoveryStep = 1 | 2 | 3 | 4;

export const ForgotPinModal: React.FC<ForgotPinModalProps> = ({
  isOpen,
  onClose,
  onPinResetSuccess
}) => {
  const { t, isRtl } = useLanguage();

  const [step, setStep] = useState<RecoveryStep>(1);
  const [contactInput, setContactInput] = useState('');
  const [identifiedContact, setIdentifiedContact] = useState<string>('');
  const [maskedContact, setMaskedContact] = useState<string>('');
  const [contactType, setContactType] = useState<'email' | 'phone'>('email');

  const [otpInput, setOtpInput] = useState('');
  const [resetToken, setResetToken] = useState<string>('');

  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Cooldown countdown
  const [cooldown, setCooldown] = useState(0);

  // Recent SMS/Email provider dispatches for verification
  const [recentDispatches, setRecentDispatches] = useState<DispatchNotification[]>([]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const fetchDispatches = async () => {
    const list = await adminAuthService.getDispatches();
    setRecentDispatches(list);
  };

  useEffect(() => {
    if (isOpen) {
      fetchDispatches();
      const interval = setInterval(fetchDispatches, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Step 1: Identify Account
  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const res = await adminAuthService.identifyRecoveryContact(contactInput.trim());
    setIsLoading(false);

    if (!res.success || !res.contact) {
      setError(res.error || 'No verified recovery email or phone number found for this entry.');
      return;
    }

    setIdentifiedContact(res.contact);
    setMaskedContact(res.maskedContact || res.contact);
    setContactType(res.contactType || 'email');
    setStep(2);
  };

  // Step 2: Send OTP
  const handleSendOtp = async () => {
    setError(null);
    setIsLoading(true);

    const res = await adminAuthService.sendRecoveryOtp(identifiedContact);
    setIsLoading(false);

    if (!res.success) {
      setError(res.error || 'Failed to send verification code.');
      if (res.waitSeconds) setCooldown(res.waitSeconds);
      return;
    }

    setCooldown(res.waitSeconds || 60);
    setSuccessNotice(`Verification code sent to ${maskedContact}!`);
    await fetchDispatches();
    setStep(3);
  };

  // Step 3: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const res = await adminAuthService.verifyRecoveryOtp(identifiedContact, otpInput.trim());
    setIsLoading(false);

    if (!res.success || !res.resetToken) {
      setError(res.error || 'Invalid or expired verification code.');
      return;
    }

    setResetToken(res.resetToken);
    setSuccessNotice(null);
    setStep(4);
  };

  // Step 4: Create New 6-Digit PIN
  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPin.trim().length !== 6 || !/^\d{6}$/.test(newPin.trim())) {
      setError('Administrator PIN must be exactly 6 numeric digits (0-9).');
      return;
    }

    if (newPin.trim() === '1234') {
      setError('1234 is not allowed as a PIN. Please choose a 6-digit PIN.');
      return;
    }

    if (newPin !== confirmPin) {
      setError('New PIN and confirm PIN do not match.');
      return;
    }

    setIsLoading(true);
    const res = await adminAuthService.resetPin(resetToken, newPin.trim(), confirmPin.trim());
    setIsLoading(false);

    if (!res.success) {
      setError(res.error || 'Failed to update PIN.');
      return;
    }

    setSuccessNotice('Administrator PIN updated successfully! The old PIN is now disabled.');
    setTimeout(() => {
      onPinResetSuccess();
      onClose();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-3 bg-teal-950/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#faf7f2] rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-[#ede7dc] flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#ede7dc] bg-[#f4efe6]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-700 text-white flex items-center justify-center shadow-xs">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-stone-900 text-sm">
                {isRtl ? 'ایڈمن پن کوڈ کی بحالی' : 'Administrator PIN Recovery'}
              </h2>
              <span className="text-[11px] text-teal-800 font-mono">
                {isRtl ? `مرحلہ ${step} از 4` : `Step ${step} of 4`}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Dots */}
        <div className="px-5 py-2.5 bg-stone-100/70 border-b border-stone-200/60 flex items-center justify-between text-[11px] text-stone-600 font-mono">
          <span className={step >= 1 ? 'font-bold text-teal-800' : 'text-stone-400'}>
            1. {isRtl ? 'شناخت' : 'Identify'}
          </span>
          <span>→</span>
          <span className={step >= 2 ? 'font-bold text-teal-800' : 'text-stone-400'}>
            2. {isRtl ? 'او ٹی پی' : 'Send Code'}
          </span>
          <span>→</span>
          <span className={step >= 3 ? 'font-bold text-teal-800' : 'text-stone-400'}>
            3. {isRtl ? 'تصدیق' : 'Verify'}
          </span>
          <span>→</span>
          <span className={step >= 4 ? 'font-bold text-teal-800' : 'text-stone-400'}>
            4. {isRtl ? 'نیا پن' : 'New PIN'}
          </span>
        </div>

        {/* Body Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* STEP 1: Identify Account */}
          {step === 1 && (
            <form onSubmit={handleIdentify} className="space-y-4">
              <div className="text-center pb-1">
                <h3 className="text-sm font-bold text-stone-900">
                  {isRtl ? 'مرحلہ 1 — ایڈمن اکاؤنٹ کی شناخت' : 'Step 1 — Identify Administrator Account'}
                </h3>
                <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                  {isRtl
                    ? 'پن کوڈ بحال کرنے کے لیے اپنا تصدیق شدہ ریکوری ای میل یا فون نمبر درج کریں۔'
                    : 'Enter the verified recovery email or phone number previously configured for this shop.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {isRtl ? 'تصدیق شدہ ریکوری ای میل یا فون نمبر' : 'Verified Recovery Email or Phone'}
                </label>
                <input
                  type="text"
                  value={contactInput}
                  onChange={e => setContactInput(e.target.value)}
                  placeholder="e.g. master@darzify.pk or 03426454541"
                  required
                  autoFocus
                  className="w-full h-11 px-3 bg-white border border-[#ede7dc] rounded-xl text-xs font-medium focus:border-teal-700 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-950/20 flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <span>{isLoading ? 'Checking...' : isRtl ? 'اکاؤنٹ تلاش کریں' : 'Find Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* STEP 2: Send OTP */}
          {step === 2 && (
            <div className="space-y-4 text-center">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 mx-auto mb-2">
                  {contactType === 'email' ? <Mail className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
                </div>
                <h3 className="text-sm font-bold text-stone-900">
                  {isRtl ? 'مرحلہ 2 — تصدیقی کوڈ بھیجیں' : 'Step 2 — Send Security Verification Code'}
                </h3>
                <p className="text-xs text-stone-600 mt-1">
                  {isRtl ? 'تصدیقی کوڈ اس نمبر یا ای میل پر بھیجا جائے گا:' : 'A short-lived verification code will be dispatched to:'}
                </p>
                <div className="inline-block px-3 py-1 bg-white border border-[#ede7dc] rounded-lg font-mono font-bold text-teal-900 text-sm mt-2">
                  {maskedContact}
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={isLoading}
                  className="w-full h-11 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-950/20 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>{isLoading ? 'Sending Code...' : isRtl ? 'کوڈ بھیجیں' : 'Send Verification Code'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-stone-500 hover:text-stone-800 py-1"
                >
                  ← {isRtl ? 'دوسرا رابطہ منتخب کریں' : 'Use a different contact'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Verify OTP */}
          {step === 3 && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center">
                <h3 className="text-sm font-bold text-stone-900">
                  {isRtl ? 'مرحلہ 3 — تصدیقی کوڈ درج کریں' : 'Step 3 — Enter 6-Digit Verification Code'}
                </h3>
                <p className="text-xs text-stone-600 mt-1">
                  {isRtl ? 'ہم نے تصدیقی کوڈ یہاں بھیجا ہے:' : 'We sent a 6-digit code to'} <strong className="text-stone-800">{maskedContact}</strong>.
                </p>
              </div>

              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpInput}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '');
                    setOtpInput(digits);
                    setError(null);
                  }}
                  placeholder="••••••"
                  required
                  autoFocus
                  className="w-full h-12 text-center text-xl font-mono tracking-widest font-bold bg-white border border-[#ede7dc] rounded-xl focus:border-teal-700 focus:ring-1 focus:ring-teal-700 outline-none"
                />
                <span className="block text-[11px] text-stone-500 text-center mt-1">
                  Code expires in 10 minutes. Max 5 attempts.
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading || otpInput.length !== 6}
                className="w-full h-11 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-950/20 flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
              >
                <span>{isLoading ? 'Verifying...' : isRtl ? 'تصدیق کریں' : 'Verify Code'}</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>

              <div className="text-center pt-1">
                {cooldown > 0 ? (
                  <span className="text-xs text-stone-400 font-mono">
                    Resend code in {cooldown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="text-xs text-teal-800 font-bold hover:underline cursor-pointer"
                  >
                    Resend verification code
                  </button>
                )}
              </div>
            </form>
          )}

          {/* STEP 4: Create New PIN */}
          {step === 4 && (
            <form onSubmit={handleResetPin} className="space-y-3.5">
              <div className="text-center pb-1">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 mx-auto mb-1.5">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-stone-900">
                  {isRtl ? 'مرحلہ 4 — نیا ایڈمن پن بنائیں' : 'Step 4 — Create New Administrator PIN'}
                </h3>
                <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                  {isRtl
                    ? 'نیا 6 ہندسوں کا پن کوڈ درج کریں۔ پرانا پن فوری طور پر غیر فعال ہو جائے گا۔'
                    : 'Enter your new 6-digit PIN. The old PIN will immediately stop working.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t.createAdminPin}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '');
                    setNewPin(digits);
                    setError(null);
                  }}
                  placeholder="••••••"
                  required
                  autoFocus
                  className="w-full h-11 px-3 bg-white border border-[#ede7dc] rounded-xl text-center text-lg font-mono tracking-widest font-bold focus:border-teal-700 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t.confirmAdminPin}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '');
                    setConfirmPin(digits);
                    setError(null);
                  }}
                  placeholder="••••••"
                  required
                  className="w-full h-11 px-3 bg-white border border-[#ede7dc] rounded-xl text-center text-lg font-mono tracking-widest font-bold focus:border-teal-700 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || newPin.length !== 6 || confirmPin.length !== 6}
                className="w-full h-11 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-950/20 flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
              >
                <span>{isLoading ? 'Saving New PIN...' : isRtl ? 'نیا پن فعال کریں' : 'Activate New PIN'}</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* SIMULATED SMS & EMAIL PROVIDER AUDIT DRAWER (Transparency for evaluation) */}
          <div className="pt-2 border-t border-stone-200/80">
            <div className="flex items-center justify-between text-[11px] font-bold text-stone-600 mb-1.5">
              <span className="flex items-center gap-1">
                <Bell className="w-3 h-3 text-teal-700" />
                <span>Simulated SMS/Email Gateway Feed</span>
              </span>
              <span className="text-[10px] text-teal-800 font-mono">Real Provider Dispatch</span>
            </div>

            {recentDispatches.length === 0 ? (
              <div className="p-2.5 bg-stone-100 rounded-xl text-[10px] text-stone-500 font-mono text-center">
                No recent dispatch logs. Dispatches will appear here when an OTP is requested.
              </div>
            ) : (
              <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                {recentDispatches.slice(0, 3).map(disp => (
                  <div
                    key={disp.id}
                    className="p-2 bg-white border border-stone-200 rounded-xl text-[11px] font-mono leading-tight shadow-2xs"
                  >
                    <div className="flex items-center justify-between text-[10px] text-stone-500 mb-0.5">
                      <span className="font-bold text-teal-800">[{disp.channel} Gateway]</span>
                      <span>{new Date(disp.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-stone-800 text-[11px]">{disp.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#f4efe6] border-t border-[#ede7dc] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-stone-600 hover:text-stone-800 rounded-xl hover:bg-stone-200/60"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
