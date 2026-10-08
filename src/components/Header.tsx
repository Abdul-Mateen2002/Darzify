import React from 'react';
import { Bluetooth, BluetoothConnected, Settings, Globe, Plus, Scissors, Download, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';
import { ShopProfile } from '../types';

interface HeaderProps {
  shop: ShopProfile;
  isPrinterConnected: boolean;
  onConnectPrinter: () => void;
  onOpenSettings: () => void;
  onOpenTestRunner: () => void;
  onOpenVerifyReceipt: () => void;
  onNewBookingClick: () => void;
  currentView: 'dashboard' | 'newBooking';
  onNavigateHome: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  shop,
  isPrinterConnected,
  onConnectPrinter,
  onOpenSettings,
  onOpenTestRunner,
  onOpenVerifyReceipt,
  onNewBookingClick,
  currentView,
  onNavigateHome
}) => {
  const { language, setLanguage, t, isRtl } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'ur' ? 'en' : 'ur');
  };

  return (
    <header className="sticky top-0 z-30 bg-[#0a3b37] text-white border-b border-teal-800/60 shadow-md">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-2.5">
        {/* Zone 1: Brand & Shop Identity */}
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={onNavigateHome}>
          <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white font-bold shadow-md shadow-teal-950/40 border border-teal-400/30">
            <Scissors className="w-5 h-5 text-amber-200" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-wide text-white">Darzify</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-teal-900/80 text-teal-300 border border-teal-700/60">
                {t.admin}
              </span>
            </div>
            <div className="text-[11px] text-teal-200/80 leading-tight truncate max-w-[150px] sm:max-w-[240px]">
              {shop.shopName} {shop.ownerName ? `· ${shop.ownerName}` : ''}
            </div>
          </div>
        </div>

        {/* Zone 2: Action Controls & Status */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Quick New Booking Button if on dashboard */}
          {currentView === 'dashboard' && (
            <button
              onClick={onNewBookingClick}
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow transition-all border border-teal-500/40"
            >
              <Plus className="w-4 h-4" />
              <span>{t.newBooking}</span>
            </button>
          )}

          {/* Bluetooth Status & Quick Connect */}
          <button
            onClick={onConnectPrinter}
            title={isPrinterConnected ? t.connected : t.connectPrinter}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
              isPrinterConnected
                ? 'bg-emerald-900/80 border-emerald-400/40 text-emerald-200'
                : 'bg-teal-900/60 border-teal-700/60 text-teal-200 hover:bg-teal-800'
            }`}
          >
            {isPrinterConnected ? (
              <>
                <BluetoothConnected className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
                <span className="hidden md:inline font-mono">SpeedX 58mm</span>
              </>
            ) : (
              <>
                <Bluetooth className="w-3.5 h-3.5 text-teal-300" />
                <span className="hidden md:inline">{t.connectPrinter}</span>
              </>
            )}
          </button>

          {/* Bilingual Language Switcher */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-teal-900/70 hover:bg-teal-800 text-xs font-semibold text-teal-100 border border-teal-700/60 transition-colors"
            title="Switch Language / زبان تبدیل کریں"
          >
            <Globe className="w-3.5 h-3.5 text-teal-300" />
            <span className="font-mono">{language === 'ur' ? 'English' : 'اردو'}</span>
          </button>

          {/* QA Test Runner Trigger */}
          <button
            onClick={onOpenTestRunner}
            className="px-2 py-1.5 rounded-xl bg-teal-900/70 hover:bg-teal-800 text-teal-200 border border-teal-700/60 transition-colors"
            title="Automated Test Suite (TC-001 - TC-030)"
          >
            <span className="text-[11px] font-bold font-mono">QA</span>
          </button>

          {/* Settings Trigger */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-xl bg-teal-900/70 hover:bg-teal-800 text-teal-200 border border-teal-700/60 transition-colors"
            title={t.settings}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
