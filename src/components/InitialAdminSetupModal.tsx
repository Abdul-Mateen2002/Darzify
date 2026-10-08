import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Mail,
  Phone,
  RefreshCw,
  Lock,
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';
import { adminAuthService, DispatchNotification } from '../services/adminAuthService';

interface InitialAdminSetupModalProps {
  isOpen: boolean;
  onSetupSuccess: () => void;
}

export const InitialAdminSetupModal: React.FC<InitialAdminSetupModalProps> = ({
  isOpen,
  onSetupSuccess
}) => {
  const { isRtl } = useLanguage();

  // PIN inputs
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Contacts
  const [emailInput, setEmailInput] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [isEmailOtpSent, setIsEmailOtpSent] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [emailToken, setEmailToken] = useState<string | null>(null);
  const [emailCooldown, setEmailCooldown] = useState(0);

  const [phoneInput, setPhoneInput] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [isPhoneOtpSent, setIsPhoneOtpSent] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [phoneToken, setPhoneToken] = useState<string | null>(null);
  const [phoneCooldown, setPhoneCooldown] = useState(0);

  // Status & Feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingEmailOtp, setIsSendingEmailOtp] = useState(false);
  const [isSendingPhoneOtp, setIsSendingPhoneOtp] = useState(false);
  const [isVerifyingEmailOtp, setIsVerifyingEmailOtp] = useState(false);
  const [isVerifyingPhoneOtp, setIsVerifyingPhoneOtp] = useState(false);

  // Dispatches audit feed for UI transparency
  const [recentDispatches, setRecentDispatches] = useState<DispatchNotification[]>([]);

  // Refresh recent dispatches
  const refreshDispatches = async () => {
    try {
      const logs = await adminAuthService.getDispatches();
      setRecentDispatches(logs);
    } catch {
      // ignore
    }
  };

  // Cooldown countdowns
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (emailCooldown > 0) {
      timer = setInterval(() => setEmailCooldown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [emailCooldown]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (phoneCooldown > 0) {
      timer = setInterval(() => setPhoneCooldown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [phoneCooldown]);

  useEffect(() => {
    if (isOpen) {
      refreshDispatches();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // --- Step A: Request OTP for Email ---
  const handleSendEmailOtp = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    const trimmed = emailInput.trim();
    if (!trimmed.includes('@') || !trimmed.includes('.')) {
      setErrorMsg(isRtl ? 'درست ای میل پتہ درج کریں۔' : 'Please enter a valid email address.');
      return;
    }

    setIsSendingEmailOtp(true);
    const res = await adminAuthService.requestInitialSetupOtp('email', trimmed);
    setIsSendingEmailOtp(false);

    if (res.success) {
      setIsEmailOtpSent(true);
      setEmailCooldown(res.waitSeconds || 60);
      setStatusMsg({
        type: 'success',
        text: res.message || (isRtl ? 'تصدیقی کوڈ ای میل پر بھیج دیا گیا ہے۔' : 'Verification code sent to email.')
      });
      await refreshDispatches();
    } else {
      setErrorMsg(res.error || (isRtl ? 'کوڈ بھیجنے میں خرابی۔' : 'Failed to send OTP code.'));
      if (res.waitSeconds) setEmailCooldown(res.waitSeconds);
    }
  };

  // --- Step B: Verify OTP for Email ---
  const handleVerifyEmailOtp = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    const trimmed = emailInput.trim();
    const otp = emailOtp.trim();
    if (!otp || otp.length !== 6) {
      setErrorMsg(isRtl ? '6 ہندسوں کا درست تصدیقی کوڈ درج کریں۔' : 'Please enter the 6-digit verification code.');
      return;
    }

    setIsVerifyingEmailOtp(true);
    const res = await adminAuthService.verifyInitialSetupOtp('email', trimmed, otp);
    setIsVerifyingEmailOtp(false);

    if (res.success && res.verificationToken) {
      setIsEmailVerified(true);
      setEmailToken(res.verificationToken);
      setStatusMsg({
        type: 'success',
        text: isRtl ? 'ای میل کامیابی کے ساتھ تصدیق ہو گئی! ✓' : 'Email verified successfully! ✓'
      });
    } else {
      setErrorMsg(res.error || (isRtl ? 'غلط تصدیقی کوڈ۔' : 'Incorrect verification code.'));
    }
  };

  // --- Step C: Request OTP for Phone ---
  const handleSendPhoneOtp = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    const trimmed = phoneInput.trim();
    if (!/^03\d{9}$/.test(trimmed)) {
      setErrorMsg(
        isRtl
          ? 'فون نمبر 11 ہندسوں پر مشتمل ہونا چاہیے جو 03 سے شروع ہو (مثلاً 03426454541)'
          : 'Phone number must be a valid 11-digit mobile number starting with 03 (e.g. 03426454541).'
      );
      return;
    }

    setIsSendingPhoneOtp(true);
    const res = await adminAuthService.requestInitialSetupOtp('phone', trimmed);
    setIsSendingPhoneOtp(false);

    if (res.success) {
      setIsPhoneOtpSent(true);
      setPhoneCooldown(res.waitSeconds || 60);
      setStatusMsg({
        type: 'success',
        text: res.message || (isRtl ? 'تصدیقی کوڈ فون نمبر پر بھیج دیا گیا ہے۔' : 'Verification code sent to phone number.')
      });
      await refreshDispatches();
    } else {
      setErrorMsg(res.error || (isRtl ? 'کوڈ بھیجنے میں خرابی۔' : 'Failed to send OTP code.'));
      if (res.waitSeconds) setPhoneCooldown(res.waitSeconds);
    }
  };

  // --- Step D: Verify OTP for Phone ---
  const handleVerifyPhoneOtp = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    const trimmed = phoneInput.trim();
    const otp = phoneOtp.trim();
    if (!otp || otp.length !== 6) {
      setErrorMsg(isRtl ? '6 ہندسوں کا درست تصدیقی کوڈ درج کریں۔' : 'Please enter the 6-digit verification code.');
      return;
    }

    setIsVerifyingPhoneOtp(true);
    const res = await adminAuthService.verifyInitialSetupOtp('phone', trimmed, otp);
    setIsVerifyingPhoneOtp(false);

    if (res.success && res.verificationToken) {
      setIsPhoneVerified(true);
      setPhoneToken(res.verificationToken);
      setStatusMsg({
        type: 'success',
        text: isRtl ? 'فون نمبر کامیابی کے ساتھ تصدیق ہو گیا! ✓' : 'Phone number verified successfully! ✓'
      });
    } else {
      setErrorMsg(res.error || (isRtl ? 'غلط تصدیقی کوڈ۔' : 'Incorrect verification code.'));
    }
  };

  // --- Step E: Complete Setup ---
  const handleCompleteSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);

    // 1. PIN checks
    const trimmedPin = pin.trim();
    const trimmedConfirm = confirmPin.trim();

    if (trimmedPin.length !== 6 || !/^\d{6}$/.test(trimmedPin)) {
      setErrorMsg(isRtl ? 'ایڈمنسٹریٹر پن لازماً ٹھیک 6 ہندسوں پر مشتمل ہونی چاہیے۔' : 'Administrator PIN must be exactly 6 numeric digits.');
      return;
    }

    if (trimmedPin === '1234') {
      setErrorMsg(isRtl ? '1234 کی اجازت نہیں ہے۔ 6 ہندسوں کا پن کوڈ استعمال کریں۔' : '1234 is not permitted. Please use a 6-digit PIN.');
      return;
    }

    if (trimmedPin !== trimmedConfirm) {
      setErrorMsg(isRtl ? 'پن اور تصدیقی پن آپس میں نہیں ملتے۔' : 'PIN and confirmation PIN do not match.');
      return;
    }

    // 2. Recovery check
    if (!isEmailVerified && !isPhoneVerified) {
      setErrorMsg(
        isRtl
          ? 'ایڈمنسٹریٹر پن فعال کرنے سے پہلے کم از کم ایک رابطہ (ای میل یا فون) کی تصدیق لازمی ہے۔'
          : 'You must verify at least one recovery contact (Email or Phone) before activating the Administrator PIN.'
      );
      return;
    }

    const verifiedContacts: Array<{ type: 'email' | 'phone'; contact: string; token: string }> = [];
    if (isEmailVerified && emailToken) {
      verifiedContacts.push({ type: 'email', contact: emailInput.trim(), token: emailToken });
    }
    if (isPhoneVerified && phoneToken) {
      verifiedContacts.push({ type: 'phone', contact: phoneInput.trim(), token: phoneToken });
    }

    setIsSubmitting(true);
    const res = await adminAuthService.completeInitialSetup({
      newPin: trimmedPin,
      confirmPin: trimmedConfirm,
      verifiedContacts
    });
    setIsSubmitting(false);

    if (res.success) {
      setStatusMsg({
        type: 'success',
        text: isRtl ? 'ایڈمنسٹریٹر پن کامیابی سے بن گیا اور تصدیق ہو گئی! ✓' : 'Administrator PIN created and activated successfully! ✓'
      });
      setTimeout(() => {
        onSetupSuccess();
      }, 1000);
    } else {
      setErrorMsg(res.error || (isRtl ? 'سیٹ اپ مکمل نہ ہو سکا۔' : 'Failed to finalize administrator setup.'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-teal-950/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-[#faf7f2] rounded-3xl shadow-2xl max-w-xl w-full my-6 flex flex-col overflow-hidden border border-[#ede7dc]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#ede7dc] bg-[#f4efe6] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-700 text-white flex items-center justify-center shadow-md shadow-teal-950/20">
              <KeyRound className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-stone-900">
                {isRtl ? 'ایڈمنسٹریٹر سیٹ اپ ضروری ہے' : 'Create Administrator PIN'}
              </h2>
              <p className="text-xs text-stone-600 mt-0.5">
                {isRtl
                  ? 'دکان کی حفاظت کے لیے 6 ہندسوں کا نیا ایڈمن پن بنائیں اور کم از کم ایک ریکوری رابطہ کی تصدیق کریں۔'
                  : 'Configure your 6-digit Administrator PIN and verify at least one recovery contact (email or phone) to protect shop settings.'}
              </p>
            </div>
          </div>
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={() => {
                setPin('000000');
                setConfirmPin('000000');
                setEmailInput('admin@darzify.pk');
                setPhoneInput('03338889973');
                setErrorMsg(null);
              }}
              className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-xs font-bold border border-amber-300 transition-colors cursor-pointer shrink-0"
              title="Development only: Auto-fill test values"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              <span>{isRtl ? 'ڈیمو ڈیٹا (Dev)' : 'Quick Fill (Dev)'}</span>
            </button>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleCompleteSetup} className="p-6 space-y-6">
          {/* Section 1: 6-Digit PIN Setup */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#ede7dc] shadow-2xs space-y-4">
            <div className="flex items-center gap-2 text-stone-800 font-bold text-xs uppercase tracking-wider">
              <Lock className="w-4 h-4 text-teal-700" />
              <span>{isRtl ? '1. ایڈمنسٹریٹر پن (6 ہندسے)' : '1. Administrator PIN (6 Digits)'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  {isRtl ? 'ایڈمنسٹریٹر پن بنائیں' : 'Create Administrator PIN'}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '');
                    setPin(digits);
                    setErrorMsg(null);
                  }}
                  placeholder="••••••"
                  required
                  autoFocus
                  className="w-full h-11 px-3 bg-[#faf7f2] border border-[#ede7dc] rounded-xl text-center text-lg font-mono tracking-widest font-bold focus:border-teal-700 focus:bg-white outline-none"
                />
                <span className="text-[10px] text-stone-500 mt-0.5 block">
                  {isRtl ? 'کوئی بھی 6 ہندسے (مثلاً 000000 یا 123456)' : 'Any 6 numeric digits (e.g. 000000, 123456)'}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  {isRtl ? 'ایڈمنسٹریٹر پن کی تصدیق کریں' : 'Confirm Administrator PIN'}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '');
                    setConfirmPin(digits);
                    setErrorMsg(null);
                  }}
                  placeholder="••••••"
                  required
                  className="w-full h-11 px-3 bg-[#faf7f2] border border-[#ede7dc] rounded-xl text-center text-lg font-mono tracking-widest font-bold focus:border-teal-700 focus:bg-white outline-none"
                />
                <span className="text-[10px] text-stone-500 mt-0.5 block">
                  {isRtl ? 'دوبارہ وہی 6 ہندسے درج کریں' : 'Re-enter the exact 6 digits'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Recovery Contact Verification */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#ede7dc] shadow-2xs space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-stone-800 font-bold text-xs uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>{isRtl ? '2. ریکوری رابطہ (لازمی تصدیق)' : '2. Recovery Contact (Verification Required)'}</span>
                </div>
                {(isEmailVerified || isPhoneVerified) && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{isRtl ? 'تصدیق شدہ ✓' : 'Verified ✓'}</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-600 mt-1">
                {isRtl
                  ? 'ای میل، فون نمبر یا دونوں درج کریں۔ پن بھول جانے کی صورت میں ریکوری صرف تصدیق شدہ رابطے کے ذریعے ہی ممکن ہوگی۔'
                  : 'Configure Email, Phone, or Both. You must verify the contact with a real OTP before activating your PIN.'}
              </p>
            </div>

            {/* Sub-A: Recovery Email */}
            <div className="p-3.5 rounded-xl border border-[#ede7dc] bg-[#fbf9f5] space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-stone-500" />
                  <span>{isRtl ? 'ریکوری ای میل' : 'Recovery Email'}</span>
                </label>
                {isEmailVerified && (
                  <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    {isRtl ? 'تصدیق شدہ ✓' : 'Verified ✓'}
                  </span>
                )}
              </div>

              {!isEmailVerified ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={e => {
                        setEmailInput(e.target.value);
                        setErrorMsg(null);
                      }}
                      placeholder="admin@darzify.pk"
                      disabled={isEmailVerified}
                      className="flex-1 h-9 px-3 text-xs bg-white border border-[#ede7dc] rounded-lg focus:border-teal-700 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSendEmailOtp}
                      disabled={isSendingEmailOtp || emailCooldown > 0 || !emailInput.includes('@')}
                      className="px-3 h-9 bg-stone-800 hover:bg-stone-900 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold cursor-pointer transition-colors shrink-0 flex items-center gap-1"
                    >
                      {isSendingEmailOtp ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <span>{emailCooldown > 0 ? `${emailCooldown}s` : (isRtl ? 'تصدیقی کوڈ بھیجیں' : 'Send OTP')}</span>
                      )}
                    </button>
                  </div>

                  {isEmailOtpSent && (
                    <div className="flex gap-2 pt-1 animate-in fade-in">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={emailOtp}
                        onChange={e => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder={isRtl ? '6 ہندسوں کا کوڈ' : '6-digit OTP'}
                        className="w-32 h-9 px-3 text-center text-xs font-mono font-bold tracking-widest bg-white border border-teal-600 rounded-lg outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyEmailOtp}
                        disabled={isVerifyingEmailOtp || emailOtp.length !== 6}
                        className="px-3 h-9 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                      >
                        {isVerifyingEmailOtp ? '...' : (isRtl ? 'تصدیق کریں' : 'Verify Code')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs font-mono text-emerald-800 font-semibold bg-emerald-50/70 p-2 rounded-lg border border-emerald-200/60">
                  {emailInput}
                </div>
              )}
            </div>

            {/* Sub-B: Recovery Phone */}
            <div className="p-3.5 rounded-xl border border-[#ede7dc] bg-[#fbf9f5] space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-stone-500" />
                  <span>{isRtl ? 'ریکوری فون نمبر' : 'Recovery Phone'}</span>
                </label>
                {isPhoneVerified && (
                  <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    {isRtl ? 'تصدیق شدہ ✓' : 'Verified ✓'}
                  </span>
                )}
              </div>

              {!isPhoneVerified ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={phoneInput}
                      onChange={e => {
                        setPhoneInput(e.target.value);
                        setErrorMsg(null);
                      }}
                      placeholder="03426454541"
                      disabled={isPhoneVerified}
                      className="flex-1 h-9 px-3 text-xs bg-white border border-[#ede7dc] rounded-lg focus:border-teal-700 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSendPhoneOtp}
                      disabled={isSendingPhoneOtp || phoneCooldown > 0 || phoneInput.length < 10}
                      className="px-3 h-9 bg-stone-800 hover:bg-stone-900 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold cursor-pointer transition-colors shrink-0 flex items-center gap-1"
                    >
                      {isSendingPhoneOtp ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <span>{phoneCooldown > 0 ? `${phoneCooldown}s` : (isRtl ? 'تصدیقی کوڈ بھیجیں' : 'Send OTP')}</span>
                      )}
                    </button>
                  </div>

                  {isPhoneOtpSent && (
                    <div className="flex gap-2 pt-1 animate-in fade-in">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={phoneOtp}
                        onChange={e => setPhoneOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder={isRtl ? '6 ہندسوں کا کوڈ' : '6-digit OTP'}
                        className="w-32 h-9 px-3 text-center text-xs font-mono font-bold tracking-widest bg-white border border-teal-600 rounded-lg outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyPhoneOtp}
                        disabled={isVerifyingPhoneOtp || phoneOtp.length !== 6}
                        className="px-3 h-9 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                      >
                        {isVerifyingPhoneOtp ? '...' : (isRtl ? 'تصدیق کریں' : 'Verify Code')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs font-mono text-emerald-800 font-semibold bg-emerald-50/70 p-2 rounded-lg border border-emerald-200/60">
                  {phoneInput}
                </div>
              )}
            </div>
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {statusMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Real Provider Notification Dispatch Monitor */}
          {recentDispatches.length > 0 && (
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200/70 text-[11px] text-stone-600 space-y-1.5">
              <div className="flex items-center justify-between font-bold text-stone-700">
                <span className="flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-teal-700" />
                  <span>Gateway Dispatch Activity</span>
                </span>
                <span className="text-[10px] text-stone-500 font-mono">
                  {recentDispatches[0].provider}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 bg-white p-2 rounded border border-stone-200/50">
                <p className="text-[11px] leading-tight text-stone-700 font-mono flex-1">
                  {recentDispatches[0].message}
                </p>
                {import.meta.env.DEV && (() => {
                  const match = recentDispatches[0].message.match(/\b(\d{6})\b/);
                  if (!match) return null;
                  const code = match[1];
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (isEmailOtpSent && !isEmailVerified) {
                          setEmailOtp(code);
                        } else if (isPhoneOtpSent && !isPhoneVerified) {
                          setPhoneOtp(code);
                        } else {
                          setEmailOtp(code);
                          setPhoneOtp(code);
                        }
                      }}
                      className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded font-bold text-[10px] shrink-0 cursor-pointer transition-colors"
                      title="Development only: Insert simulated code"
                    >
                      Fill {code} (Dev)
                    </button>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Submit Action */}
          <button
            type="submit"
            disabled={isSubmitting || pin.length !== 6 || confirmPin.length !== 6 || (!isEmailVerified && !isPhoneVerified)}
            className="w-full h-12 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-lg shadow-teal-950/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>{isRtl ? 'ایڈمنسٹریٹر پن فعال کریں' : 'Activate Administrator PIN'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
