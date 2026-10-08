import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Bluetooth,
  Download,
  Upload,
  RotateCcw,
  Check,
  Lock,
  ShieldCheck,
  KeyRound,
  Mail,
  Phone,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Trash2,
  ShieldAlert,
  Server,
  CloudCheck,
  Sparkles
} from 'lucide-react';
import { ShopProfile } from '../types';
import { useLanguage } from '../i18n/useLanguage';
import { db, loadReferenceVideoData } from '../db/database';
import { adminAuthService, AdminSecurityStatus, DispatchNotification } from '../services/adminAuthService';
import { ForgotPinModal } from './ForgotPinModal';
import { InitialAdminSetupModal } from './InitialAdminSetupModal';

interface SettingsModalProps {
  shop: ShopProfile;
  isOpen: boolean;
  onClose: () => void;
  onShopUpdated: (updatedShop: ShopProfile) => void;
  isPrinterConnected: boolean;
  onConnectPrinter: () => void;
  onReloadData: () => void;
}

type SettingsTab = 'profile' | 'security' | 'hardware' | 'backup';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  shop,
  isOpen,
  onClose,
  onShopUpdated,
  isPrinterConnected,
  onConnectPrinter,
  onReloadData
}) => {
  const { t, isRtl } = useLanguage();

  // Admin PIN Gate State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [isForgotPinOpen, setIsForgotPinOpen] = useState(false);
  const [isInitialSetupOpen, setIsInitialSetupOpen] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // Business Profile Form Fields
  const [shopName, setShopName] = useState(shop.shopName);
  const [ownerName, setOwnerName] = useState(shop.ownerName);
  const [phone, setPhone] = useState(shop.phone);
  const [address, setAddress] = useState(shop.address);
  const [disclaimer, setDisclaimer] = useState(shop.disclaimer);
  const [defaultRate, setDefaultRate] = useState(shop.defaultRate || 2500);
  const [defaultDeliveryDays, setDefaultDeliveryDays] = useState(shop.defaultDeliveryDays || 7);

  // Security Section State
  const [adminStatus, setAdminStatus] = useState<AdminSecurityStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  // Change PIN Sub-flow
  const [showChangePin, setShowChangePin] = useState(false);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinChangeMsg, setPinChangeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Email Config & Verification Sub-flow
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [emailMsg, setEmailMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Phone Config & Verification Sub-flow
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneCooldown, setPhoneCooldown] = useState(0);
  const [phoneMsg, setPhoneMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Feedback banner
  const [feedback, setFeedback] = useState<string | null>(null);

  // Dispatches audit feed for UI transparency
  const [recentDispatches, setRecentDispatches] = useState<DispatchNotification[]>([]);

  // Load Admin Security status on unlock or tab change or modal open
  const fetchAdminStatus = async () => {
    setIsLoadingStatus(true);
    const status = await adminAuthService.getStatus();
    setAdminStatus(status);
    if (!status.isInitialized) {
      setIsInitialSetupOpen(true);
    }
    const dispatches = await adminAuthService.getDispatches();
    setRecentDispatches(dispatches);
    setIsLoadingStatus(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchAdminStatus();
    }
  }, [isOpen, isUnlocked, activeTab]);

  // Cooldown timers
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (emailCooldown > 0) timer = setInterval(() => setEmailCooldown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [emailCooldown]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (phoneCooldown > 0) timer = setInterval(() => setPhoneCooldown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [phoneCooldown]);

  if (!isOpen) return null;

  // Handle PIN verification to unlock settings
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);

    const trimmed = pinInput.trim();
    if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
      setPinError('Administrator PIN must be exactly 6 numeric digits (e.g. 000000).');
      return;
    }

    if (trimmed === '1234') {
      setPinError('1234 is not permitted. Please enter your 6-digit Administrator PIN.');
      return;
    }

    setIsVerifyingPin(true);
    const res = await adminAuthService.verifyPin(trimmed);
    setIsVerifyingPin(false);

    if (res.success) {
      setIsUnlocked(true);
      setPinError(null);
      fetchAdminStatus();
    } else {
      if (res.isInitialized === false) {
        setIsInitialSetupOpen(true);
        return;
      }
      setPinError(res.error || t.incorrectPin);
    }
  };

  // Save General Profile Settings
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated: ShopProfile = {
      ...shop,
      shopName: shopName.trim(),
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      disclaimer: disclaimer.trim(),
      defaultRate: Number(defaultRate) || 2500,
      defaultDeliveryDays: Number(defaultDeliveryDays) || 7
    };
    // Ensure plaintext PIN is never saved in shop profile
    delete (updated as any).adminPin;

    await db.shopProfile.put(updated);
    onShopUpdated(updated);

    // Sync online
    await adminAuthService.migrateLocalData([], [], updated);

    setFeedback(t.saveSettings + ' ✓');
    setTimeout(() => {
      setFeedback(null);
      onClose();
    }, 1200);
  };

  // Handle Change PIN inside Security section
  const handleChangePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeMsg(null);

    if (newPinInput.trim().length !== 6 || !/^\d{6}$/.test(newPinInput.trim())) {
      setPinChangeMsg({ type: 'error', text: 'PIN must be exactly 6 numeric digits.' });
      return;
    }

    if (newPinInput.trim() === '1234') {
      setPinChangeMsg({ type: 'error', text: '1234 is not allowed as a PIN.' });
      return;
    }

    if (newPinInput !== confirmPinInput) {
      setPinChangeMsg({ type: 'error', text: 'New PIN and confirm PIN do not match.' });
      return;
    }

    const res = await adminAuthService.changePin({
      currentPin: currentPinInput.trim(),
      newPin: newPinInput.trim(),
      confirmPin: confirmPinInput.trim()
    });

    if (res.success) {
      setPinChangeMsg({ type: 'success', text: '6-digit PIN changed successfully! Old PIN is invalid.' });
      setCurrentPinInput('');
      setNewPinInput('');
      setConfirmPinInput('');
      setTimeout(() => setShowChangePin(false), 2000);
      fetchAdminStatus();
    } else {
      setPinChangeMsg({ type: 'error', text: res.error || 'Failed to change PIN.' });
    }
  };

  // Request Email OTP
  const handleRequestEmailOtp = async () => {
    setEmailMsg(null);
    if (!emailInput.includes('@') || !emailInput.includes('.')) {
      setEmailMsg({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }
    const res = await adminAuthService.requestContactOtp('email', emailInput.trim());
    if (res.success) {
      setEmailOtpSent(true);
      setEmailCooldown(res.waitSeconds || 60);
      setEmailMsg({ type: 'success', text: res.message || 'Verification code sent to email.' });
      const dispatches = await adminAuthService.getDispatches();
      setRecentDispatches(dispatches);
    } else {
      setEmailMsg({ type: 'error', text: res.error || 'Failed to send OTP.' });
      if (res.waitSeconds) setEmailCooldown(res.waitSeconds);
    }
  };

  // Verify Email OTP
  const handleVerifyEmailOtp = async () => {
    setEmailMsg(null);
    if (emailOtp.trim().length !== 6) {
      setEmailMsg({ type: 'error', text: 'Please enter the 6-digit verification code.' });
      return;
    }
    const res = await adminAuthService.verifyContactOtp('email', emailInput.trim(), emailOtp.trim());
    if (res.success) {
      setEmailMsg({ type: 'success', text: 'Email successfully verified!' });
      setTimeout(() => {
        setIsEmailModalOpen(false);
        setEmailOtpSent(false);
        setEmailOtp('');
        setEmailInput('');
        fetchAdminStatus();
      }, 1500);
    } else {
      setEmailMsg({ type: 'error', text: res.error || 'Incorrect or expired code.' });
    }
  };

  // Request Phone OTP
  const handleRequestPhoneOtp = async () => {
    setPhoneMsg(null);
    const cleaned = phoneInput.trim();
    if (!/^03\d{9}$/.test(cleaned)) {
      setPhoneMsg({ type: 'error', text: 'Enter Pakistani 11-digit mobile number starting with 03 (e.g. 03338889973).' });
      return;
    }
    const res = await adminAuthService.requestContactOtp('phone', cleaned);
    if (res.success) {
      setPhoneOtpSent(true);
      setPhoneCooldown(res.waitSeconds || 60);
      setPhoneMsg({ type: 'success', text: res.message || 'Verification code sent via SMS.' });
      const dispatches = await adminAuthService.getDispatches();
      setRecentDispatches(dispatches);
    } else {
      setPhoneMsg({ type: 'error', text: res.error || 'Failed to send SMS OTP.' });
      if (res.waitSeconds) setPhoneCooldown(res.waitSeconds);
    }
  };

  // Verify Phone OTP
  const handleVerifyPhoneOtp = async () => {
    setPhoneMsg(null);
    if (phoneOtp.trim().length !== 6) {
      setPhoneMsg({ type: 'error', text: 'Please enter the 6-digit verification code.' });
      return;
    }
    const res = await adminAuthService.verifyContactOtp('phone', phoneInput.trim(), phoneOtp.trim());
    if (res.success) {
      setPhoneMsg({ type: 'success', text: 'Phone number successfully verified!' });
      setTimeout(() => {
        setIsPhoneModalOpen(false);
        setPhoneOtpSent(false);
        setPhoneOtp('');
        setPhoneInput('');
        fetchAdminStatus();
      }, 1500);
    } else {
      setPhoneMsg({ type: 'error', text: res.error || 'Incorrect or expired code.' });
    }
  };

  // Remove Recovery Contact
  const handleRemoveContact = async (type: 'email' | 'phone') => {
    if (!adminStatus) return;
    if (!confirm(`Are you sure you want to remove the recovery ${type}?`)) return;
    const res = await adminAuthService.removeContact(type);
    if (res.success) {
      fetchAdminStatus();
    } else {
      alert(res.error || 'Failed to remove recovery contact');
    }
  };

  // Export database backup
  const handleExportBackup = async () => {
    const allCustomers = await db.customers.toArray();
    const allOrders = await db.orders.toArray();
    const shopConfig = await db.shopProfile.get('default_shop');

    const backupData = {
      version: 2,
      appName: 'Darzify',
      system: 'Online POS Architecture',
      timestamp: new Date().toISOString(),
      shopConfig,
      customers: allCustomers,
      orders: allOrders
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `darzify_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import database backup
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.customers) await db.customers.bulkPut(json.customers);
        if (json.orders) await db.orders.bulkPut(json.orders);
        if (json.shopConfig) {
          const safe = { ...json.shopConfig };
          delete safe.adminPin;
          await db.shopProfile.put(safe);
          onShopUpdated(safe);
        }
        await adminAuthService.migrateLocalData(json.orders || [], json.customers || [], json.shopConfig);
        setFeedback('Backup restored and synchronized successfully!');
        onReloadData();
      } catch (err: unknown) {
        alert('Invalid backup file: ' + String(err));
      }
    };
    reader.readAsText(file);
  };

  const handleResetDemoData = async () => {
    if (confirm('Load reference demo data from the video? This adds order #1 (Rameez Gondal).')) {
      await loadReferenceVideoData();
      const allOrders = await db.orders.toArray();
      const allCust = await db.customers.toArray();
      const prof = await db.shopProfile.get('default_shop');
      if (prof) await adminAuthService.migrateLocalData(allOrders, allCust, prof);
      onReloadData();
      setFeedback(t.loadVideoDemoData + ' ✓');
      setTimeout(() => setFeedback(null), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-teal-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#faf7f2] rounded-3xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden border border-[#ede7dc]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#ede7dc] bg-[#f4efe6]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-700 text-cream flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-4 h-4 text-teal-100" />
            </div>
            <div>
              <h2 className="font-bold text-stone-900 text-sm">{t.shopSettings}</h2>
              <span className="text-[11px] text-teal-800 font-mono font-medium flex items-center gap-1">
                <span>Darzify · Online Admin Console</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-500 hover:text-stone-800 rounded-xl hover:bg-stone-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* LOCKED SCREEN: 6-DIGIT ADMIN PIN GATE WITH FORGOT PIN RECOVERY */}
        {!isUnlocked ? (
          <div className="p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-xs">
              <Lock className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">{t.adminSecurityTitle}</h3>
              <p className="text-xs text-stone-600 mt-1 max-w-xs">
                {isRtl
                  ? 'دکان کی ترتیبات اور سیکیورٹی تک رسائی کے لیے 6 ہندسوں کا ایڈمن پن کوڈ درج کریں۔'
                  : 'Enter your 6-digit Administrator PIN to access shop settings and security controls.'}
              </p>
            </div>

            <form onSubmit={handleUnlock} className="w-full max-w-xs space-y-3">
              <div className="relative">
                <input
                  type="password"
                  inputMode="numeric"
                  value={pinInput}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '');
                    setPinInput(digits);
                    if (pinError) setPinError(null);
                  }}
                  placeholder="••••••"
                  maxLength={6}
                  autoFocus
                  className="w-full h-12 text-center text-xl font-mono tracking-widest font-bold bg-white border border-[#ede7dc] rounded-xl focus:border-teal-700 focus:ring-1 focus:ring-teal-700 outline-none"
                />
              </div>

              {pinError && <p className="text-xs font-semibold text-rose-600 leading-tight">{pinError}</p>}

              <button
                type="submit"
                disabled={isVerifyingPin || pinInput.length !== 6}
                className="w-full h-11 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-950/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isVerifyingPin ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                <span>{isVerifyingPin ? 'Verifying...' : t.unlock}</span>
              </button>

              {/* FORGOT ADMIN PIN LINK */}
              <div className="pt-2 text-center flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsForgotPinOpen(true)}
                  className="text-xs text-teal-800 font-bold hover:text-teal-950 hover:underline cursor-pointer"
                >
                  {isRtl ? 'پن کوڈ بھول گئے؟ (Forgot PIN?)' : 'Forgot Admin PIN?'}
                </button>
                {adminStatus && !adminStatus.isInitialized && (
                  <button
                    type="button"
                    onClick={() => setIsInitialSetupOpen(true)}
                    className="text-[11px] text-amber-700 font-bold hover:underline cursor-pointer"
                  >
                    {isRtl ? 'ایڈمنسٹریٹر سیٹ اپ ضروری ہے (Setup Admin PIN)' : 'Administrator Initialization Required'}
                  </button>
                )}
              </div>
            </form>
          </div>
        ) : (
          /* UNLOCKED ADMIN CONSOLE */
          <>
            {/* Top Navigation Tabs */}
            <div className="flex border-b border-[#ede7dc] bg-[#faf7f2] px-3 pt-2 gap-1 overflow-x-auto text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`px-3 py-2 rounded-t-xl transition-colors cursor-pointer ${
                  activeTab === 'profile'
                    ? 'bg-white text-teal-800 border-t border-x border-[#ede7dc] shadow-2xs font-extrabold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {t.shopSettings}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('security')}
                className={`px-3 py-2 rounded-t-xl transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'security'
                    ? 'bg-white text-teal-800 border-t border-x border-[#ede7dc] shadow-2xs font-extrabold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
                <span>Security</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('hardware')}
                className={`px-3 py-2 rounded-t-xl transition-colors cursor-pointer ${
                  activeTab === 'hardware'
                    ? 'bg-white text-teal-800 border-t border-x border-[#ede7dc] shadow-2xs font-extrabold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                Printer
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('backup')}
                className={`px-3 py-2 rounded-t-xl transition-colors cursor-pointer ${
                  activeTab === 'backup'
                    ? 'bg-white text-teal-800 border-t border-x border-[#ede7dc] shadow-2xs font-extrabold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                Sync & Backup
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {feedback && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>{feedback}</span>
                </div>
              )}

              {/* TAB 1: BUSINESS PROFILE */}
              {activeTab === 'profile' && (
                <form id="settings-profile-form" onSubmit={handleSaveProfile} className="space-y-3.5">
                  {/* Protected Brand Info */}
                  <div className="p-3.5 bg-[#f5f1e8] border border-[#e5ddcf] rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-teal-700 text-white flex items-center justify-center font-bold text-xs">
                        D
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                          Application System Brand
                        </div>
                        <div className="text-sm font-extrabold text-stone-900 font-sans">Darzify</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 px-2.5 py-1 bg-white/80 border border-stone-200 rounded-lg text-[10px] font-mono font-semibold text-stone-600">
                      <Lock className="w-3 h-3 text-stone-500" />
                      <span>System Protected</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">{t.shopName}</label>
                    <input
                      type="text"
                      value={shopName}
                      onChange={e => setShopName(e.target.value)}
                      required
                      className="w-full h-10 px-3 bg-white border border-[#ede7dc] rounded-xl text-xs font-medium focus:border-teal-700 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">{t.ownerName}</label>
                    <input
                      type="text"
                      value={ownerName}
                      onChange={e => setOwnerName(e.target.value)}
                      required
                      className="w-full h-10 px-3 bg-white border border-[#ede7dc] rounded-xl text-xs font-medium focus:border-teal-700 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">{t.shopPhone}</label>
                      <input
                        type="text"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="w-full h-10 px-3 bg-white border border-[#ede7dc] rounded-xl text-xs font-mono font-medium focus:border-teal-700 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">{t.defaultRateText}</label>
                      <input
                        type="number"
                        value={defaultRate}
                        onChange={e => setDefaultRate(Number(e.target.value))}
                        className="w-full h-10 px-3 bg-white border border-[#ede7dc] rounded-xl text-xs font-mono font-medium focus:border-teal-700 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">{t.defaultDaysText}</label>
                    <input
                      type="number"
                      value={defaultDeliveryDays}
                      onChange={e => setDefaultDeliveryDays(Number(e.target.value))}
                      className="w-full h-10 px-3 bg-white border border-[#ede7dc] rounded-xl text-xs font-mono font-medium focus:border-teal-700 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">{t.shopAddress}</label>
                    <input
                      type="text"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-[#ede7dc] rounded-xl text-xs font-medium focus:border-teal-700 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">{t.disclaimerText}</label>
                    <input
                      type="text"
                      value={disclaimer}
                      onChange={e => setDisclaimer(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-[#ede7dc] rounded-xl text-xs font-medium focus:border-teal-700 outline-none"
                    />
                  </div>
                </form>
              )}

              {/* TAB 2: SECURITY (ADMIN ACCOUNT, 6-DIGIT PIN, RECOVERY EMAIL & PHONE) */}
              {activeTab === 'security' && (
                <div className="space-y-4">
                  {/* Administrator Account Card */}
                  <div className="p-4 bg-white border border-[#ede7dc] rounded-2xl space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-teal-800 text-white flex items-center justify-center font-bold text-xs">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-stone-900">Administrator Account</h4>
                          <span className="text-[10px] text-teal-800 font-mono">Backend Authenticated Session</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Active
                      </span>
                    </div>

                    <div className="p-3 bg-[#faf7f2] rounded-xl border border-[#ede7dc] flex items-center justify-between text-xs">
                      <div>
                        <div className="text-[11px] font-bold text-stone-700">Administrator PIN</div>
                        <div className="text-[11px] text-stone-500 font-mono">
                          Protected by Salted PBKDF2-SHA512 hash on server
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowChangePin(!showChangePin)}
                        className="px-3 py-1.5 bg-teal-700 text-white rounded-lg text-xs font-bold hover:bg-teal-800 transition-colors cursor-pointer"
                      >
                        {showChangePin ? 'Cancel' : 'Change PIN'}
                      </button>
                    </div>

                    {/* Change PIN Form */}
                    {showChangePin && (
                      <form onSubmit={handleChangePinSubmit} className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl space-y-2.5 animate-in fade-in duration-150">
                        <h5 className="text-xs font-bold text-teal-950">Change 6-Digit Administrator PIN</h5>

                        {pinChangeMsg && (
                          <div
                            className={`p-2 rounded-lg text-[11px] font-bold flex items-center gap-1.5 ${
                              pinChangeMsg.type === 'success'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            <span>{pinChangeMsg.text}</span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Current PIN</label>
                            <input
                              type="password"
                              inputMode="numeric"
                              maxLength={6}
                              value={currentPinInput}
                              onChange={e => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                              placeholder="••••••"
                              required
                              className="w-full h-8.5 px-2 bg-white border border-stone-300 rounded-lg text-xs font-mono text-center font-bold outline-none focus:border-teal-700"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-stone-600 mb-0.5">New 6-Digit PIN</label>
                            <input
                              type="password"
                              inputMode="numeric"
                              maxLength={6}
                              value={newPinInput}
                              onChange={e => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                              placeholder="••••••"
                              required
                              className="w-full h-8.5 px-2 bg-white border border-stone-300 rounded-lg text-xs font-mono text-center font-bold outline-none focus:border-teal-700"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-stone-600 mb-0.5">Confirm New PIN</label>
                            <input
                              type="password"
                              inputMode="numeric"
                              maxLength={6}
                              value={confirmPinInput}
                              onChange={e => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                              placeholder="••••••"
                              required
                              className="w-full h-8.5 px-2 bg-white border border-stone-300 rounded-lg text-xs font-mono text-center font-bold outline-none focus:border-teal-700"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          className="w-full py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
                        >
                          Save New Administrator PIN
                        </button>
                      </form>
                    )}
                  </div>

                  {/* Recovery Contacts Setup Card */}
                  <div className="p-4 bg-white border border-[#ede7dc] rounded-2xl space-y-3 shadow-2xs">
                    <div>
                      <h4 className="text-xs font-bold text-stone-900">PIN Recovery Contacts</h4>
                      <p className="text-[11px] text-stone-600 mt-0.5 leading-relaxed">
                        Configure recovery contact options: <strong>Email only</strong>, <strong>Phone only</strong>, or <strong>Both email and phone</strong>. Contacts must be verified via OTP to enable PIN recovery.
                      </p>
                    </div>

                    {/* Recovery Email */}
                    <div className="p-3 bg-[#faf7f2] rounded-xl border border-[#ede7dc] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-teal-700 shrink-0" />
                        <div>
                          <div className="text-[11px] font-bold text-stone-800">Recovery Email</div>
                          <div className="text-xs font-mono text-stone-600">
                            {adminStatus?.recoveryEmail || 'No recovery email configured'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {adminStatus?.hasRecoveryEmail ? (
                          <>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                              Verified ✓
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEmailInput('');
                                setEmailOtpSent(false);
                                setEmailMsg(null);
                                setIsEmailModalOpen(true);
                              }}
                              className="text-[11px] text-teal-800 font-bold hover:underline cursor-pointer"
                            >
                              Change
                            </button>
                            {adminStatus?.hasRecoveryPhone && (
                              <button
                                type="button"
                                onClick={() => handleRemoveContact('email')}
                                className="p-1 text-stone-400 hover:text-rose-600 cursor-pointer"
                                title="Remove Email"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEmailInput('');
                              setEmailOtpSent(false);
                              setEmailMsg(null);
                              setIsEmailModalOpen(true);
                            }}
                            className="px-3 py-1 bg-teal-700 text-white rounded-lg text-xs font-bold hover:bg-teal-800 cursor-pointer"
                          >
                            + Add Email
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Recovery Phone */}
                    <div className="p-3 bg-[#faf7f2] rounded-xl border border-[#ede7dc] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-teal-700 shrink-0" />
                        <div>
                          <div className="text-[11px] font-bold text-stone-800">Recovery Phone Number</div>
                          <div className="text-xs font-mono text-stone-600">
                            {adminStatus?.recoveryPhone || 'No recovery phone configured'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {adminStatus?.hasRecoveryPhone ? (
                          <>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                              Verified ✓
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setPhoneInput('');
                                setPhoneOtpSent(false);
                                setPhoneMsg(null);
                                setIsPhoneModalOpen(true);
                              }}
                              className="text-[11px] text-teal-800 font-bold hover:underline cursor-pointer"
                            >
                              Change
                            </button>
                            {adminStatus?.hasRecoveryEmail && (
                              <button
                                type="button"
                                onClick={() => handleRemoveContact('phone')}
                                className="p-1 text-stone-400 hover:text-rose-600 cursor-pointer"
                                title="Remove Phone"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setPhoneInput('');
                              setPhoneOtpSent(false);
                              setPhoneMsg(null);
                              setIsPhoneModalOpen(true);
                            }}
                            className="px-3 py-1 bg-teal-700 text-white rounded-lg text-xs font-bold hover:bg-teal-800 cursor-pointer"
                          >
                            + Add Phone
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* SMS / EMAIL GATEWAY DISPATCH FEED DRAWER */}
                  <div className="p-4 bg-white border border-[#ede7dc] rounded-2xl space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-teal-700" />
                        <span>SMS / Email Gateway Provider Feed</span>
                      </span>
                      <button
                        type="button"
                        onClick={fetchAdminStatus}
                        className="text-[11px] text-teal-800 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className={`w-3 h-3 ${isLoadingStatus ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                      </button>
                    </div>
                    {recentDispatches.length === 0 ? (
                      <div className="p-3 bg-stone-50 rounded-xl text-center text-stone-400 text-xs font-mono">
                        No recent dispatches logged. Requesting an OTP will log provider notifications here.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {recentDispatches.slice(0, 4).map(disp => (
                          <div key={disp.id} className="p-2 bg-[#faf7f2] border border-[#ede7dc] rounded-xl text-xs font-mono">
                            <div className="flex items-center justify-between text-[10px] text-stone-500 mb-0.5">
                              <span className="font-bold text-teal-800">[{disp.channel} · {disp.provider}]</span>
                              <span>{new Date(disp.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-stone-800">{disp.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Testing & Reset to Initial Setup (Dev Mode Only) */}
                  {import.meta.env.DEV && (
                    <div className="p-3.5 bg-stone-50 border border-dashed border-stone-300 rounded-2xl flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                          <span>Onboarding Wizard Testing (Dev)</span>
                        </div>
                        <p className="text-[11px] text-stone-600 mt-0.5">
                          Reset administrator status to test the Initial Admin Setup Onboarding modal.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm('Reset administrator credentials to uninitialized state to test the setup wizard?')) {
                            await adminAuthService.resetAdminToUninitialized();
                            setIsUnlocked(false);
                            setIsInitialSetupOpen(true);
                            await fetchAdminStatus();
                          }
                        }}
                        className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                      >
                        Reset & Launch Wizard
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: HARDWARE / SPEEDX THERMAL PRINTER */}
              {activeTab === 'hardware' && (
                <div className="space-y-3.5">
                  <div className="p-3.5 bg-white border border-[#ede7dc] rounded-2xl space-y-2">
                    <span className="text-xs font-bold text-stone-800 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Bluetooth className="w-4 h-4 text-teal-700" />
                        <span>{t.printerStatus} (SpeedX 58mm)</span>
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                          isPrinterConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-[#f4efe6] text-stone-600'
                        }`}
                      >
                        {isPrinterConnected ? t.connected : t.disconnected}
                      </span>
                    </span>
                    <div className="flex items-center justify-between text-xs pt-1 gap-2">
                      <span className="text-stone-600 font-medium truncate text-[11px]">
                        {isPrinterConnected ? 'SpeedX 58mm ESC/POS' : 'SpeedX Bluetooth Classic / SPP'}
                      </span>
                      <button
                        type="button"
                        onClick={onConnectPrinter}
                        className="px-3 py-1.5 bg-teal-700 text-white rounded-lg font-bold text-xs hover:bg-teal-800 transition-colors cursor-pointer shrink-0"
                      >
                        {isPrinterConnected ? 'پرنٹر سیٹنگز / ٹیسٹ' : t.connectPrinter}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: BACKUP & DATA SYNC */}
              {activeTab === 'backup' && (
                <div className="p-3.5 bg-white border border-[#ede7dc] rounded-2xl space-y-3">
                  <span className="text-xs font-bold text-stone-800">{t.backupRestore}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportBackup}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#faf7f2] border border-[#ede7dc] text-stone-700 hover:bg-[#f4efe6] rounded-xl text-xs font-medium cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-teal-700" />
                      <span>{t.exportData}</span>
                    </button>

                    <label className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#faf7f2] border border-[#ede7dc] text-stone-700 hover:bg-[#f4efe6] rounded-xl text-xs font-medium cursor-pointer">
                      <Upload className="w-3.5 h-3.5 text-teal-700" />
                      <span>{t.importData}</span>
                      <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetDemoData}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-teal-50 border border-teal-200 text-teal-800 hover:bg-teal-100 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t.loadVideoDemoData}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-[#f4efe6] border-t border-[#ede7dc] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-200/60 transition-colors cursor-pointer"
              >
                {t.cancel}
              </button>
              {activeTab === 'profile' && (
                <button
                  type="submit"
                  form="settings-profile-form"
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-950/20 transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{t.saveSettings}</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* INITIAL ADMIN SETUP MODAL */}
      <InitialAdminSetupModal
        isOpen={isInitialSetupOpen}
        onSetupSuccess={() => {
          setIsInitialSetupOpen(false);
          setIsUnlocked(true);
          fetchAdminStatus();
          setFeedback('Administrator PIN successfully configured and verified!');
        }}
      />

      {/* FORGOT PIN RECOVERY MODAL */}
      <ForgotPinModal
        isOpen={isForgotPinOpen}
        onClose={() => setIsForgotPinOpen(false)}
        onPinResetSuccess={() => {
          setIsForgotPinOpen(false);
          setFeedback('New Administrator PIN successfully activated! You may now unlock.');
        }}
      />

      {/* VERIFY EMAIL MODAL */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-teal-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#faf7f2] rounded-3xl shadow-2xl max-w-sm w-full p-5 border border-[#ede7dc] space-y-3.5 text-stone-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-teal-700" />
                <h3 className="text-sm font-bold">Configure Recovery Email</h3>
              </div>
              <button onClick={() => setIsEmailModalOpen(false)} className="p-1 text-stone-400 hover:text-stone-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            {emailMsg && (
              <div
                className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                  emailMsg.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                <span>{emailMsg.text}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Email Address</label>
              <input
                type="email"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                placeholder="e.g. master@darzify.pk"
                disabled={emailOtpSent}
                className="w-full h-10 px-3 bg-white border border-[#ede7dc] rounded-xl text-xs font-medium outline-none focus:border-teal-700"
              />
            </div>

            {!emailOtpSent ? (
              <button
                type="button"
                onClick={handleRequestEmailOtp}
                className="w-full h-10 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Send Verification Code (OTP)
              </button>
            ) : (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Enter 6-Digit Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={emailOtp}
                    onChange={e => setEmailOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="w-full h-11 text-center font-mono text-lg tracking-widest font-bold bg-white border border-[#ede7dc] rounded-xl outline-none focus:border-teal-700"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleVerifyEmailOtp}
                  disabled={emailOtp.length !== 6}
                  className="w-full h-10 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Verify Email on Backend
                </button>
                <div className="text-center">
                  {emailCooldown > 0 ? (
                    <span className="text-[11px] text-stone-400 font-mono">Resend in {emailCooldown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestEmailOtp}
                      className="text-xs text-teal-800 font-bold hover:underline cursor-pointer"
                    >
                      Resend code
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VERIFY PHONE MODAL */}
      {isPhoneModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-teal-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#faf7f2] rounded-3xl shadow-2xl max-w-sm w-full p-5 border border-[#ede7dc] space-y-3.5 text-stone-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="w-5 h-5 text-teal-700" />
                <h3 className="text-sm font-bold">Configure Recovery Phone</h3>
              </div>
              <button onClick={() => setIsPhoneModalOpen(false)} className="p-1 text-stone-400 hover:text-stone-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            {phoneMsg && (
              <div
                className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                  phoneMsg.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                <span>{phoneMsg.text}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Pakistani Mobile Number (03xxxxxxxxx)</label>
              <input
                type="tel"
                value={phoneInput}
                onChange={e => setPhoneInput(e.target.value)}
                placeholder="e.g. 03338889973"
                disabled={phoneOtpSent}
                className="w-full h-10 px-3 bg-white border border-[#ede7dc] rounded-xl text-xs font-mono font-medium outline-none focus:border-teal-700"
              />
            </div>

            {!phoneOtpSent ? (
              <button
                type="button"
                onClick={handleRequestPhoneOtp}
                className="w-full h-10 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Send SMS OTP via Provider
              </button>
            ) : (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Enter 6-Digit SMS Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={phoneOtp}
                    onChange={e => setPhoneOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="w-full h-11 text-center font-mono text-lg tracking-widest font-bold bg-white border border-[#ede7dc] rounded-xl outline-none focus:border-teal-700"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleVerifyPhoneOtp}
                  disabled={phoneOtp.length !== 6}
                  className="w-full h-10 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Verify Phone on Backend
                </button>
                <div className="text-center">
                  {phoneCooldown > 0 ? (
                    <span className="text-[11px] text-stone-400 font-mono">Resend in {phoneCooldown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestPhoneOtp}
                      className="text-xs text-teal-800 font-bold hover:underline cursor-pointer"
                    >
                      Resend SMS
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
