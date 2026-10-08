import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { NewBooking } from './components/NewBooking';
import { PrintHubModal } from './components/PrintHubModal';
import { SettingsModal } from './components/SettingsModal';
import { OrderDetailsModal } from './components/OrderDetailsModal';
import { TestRunnerModal } from './components/TestRunnerModal';
import { PrinterConnectModal } from './components/PrinterConnectModal';
import { VerifyReceiptModal } from './components/VerifyReceiptModal';
import { Order, ShopProfile } from './types';
import { db, initializeDatabase, DEFAULT_SHOP_PROFILE } from './db/database';
import { bluetoothPrinter } from './services/bluetoothPrinter';
import { adminAuthService } from './services/adminAuthService';
import { LanguageProvider, useLanguage } from './i18n/useLanguage';
import { WifiOff, Plus, CheckCircle2, X } from 'lucide-react';

function AppContent() {
  const { t } = useLanguage();

  // Application State
  const [shop, setShop] = useState<ShopProfile>(DEFAULT_SHOP_PROFILE);
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentView, setCurrentView] = useState<'dashboard' | 'newBooking'>('dashboard');
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Modals & Feedback State
  const [activePrintOrder, setActivePrintOrder] = useState<Order | null>(null);
  const [activeDetailOrder, setActiveDetailOrder] = useState<Order | null>(null);
  const [isPrintHubOpen, setIsPrintHubOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTestRunnerOpen, setIsTestRunnerOpen] = useState(false);
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [isVerifyReceiptOpen, setIsVerifyReceiptOpen] = useState(false);
  const [dashboardNotice, setDashboardNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [detailSuccessMessage, setDetailSuccessMessage] = useState<string | null>(null);

  // Bluetooth State
  const [isPrinterConnected, setIsPrinterConnected] = useState(false);

  // Online / Offline Detection
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Load database data and safely synchronize with online server
  const loadData = useCallback(async () => {
    await initializeDatabase();
    const loadedShop = await db.shopProfile.get('default_shop');
    if (loadedShop) setShop(loadedShop);

    const loadedOrders = await db.orders.orderBy('createdAt').reverse().toArray();
    setOrders(loadedOrders);

    // Safe online database synchronization / migration
    if (loadedShop) {
      const loadedCustomers = await db.customers.toArray();
      adminAuthService.migrateLocalData(loadedOrders, loadedCustomers, loadedShop).catch(() => {});
    }
  }, []);

  useEffect(() => {
    loadData();

    // Check live printer status on mount
    setIsPrinterConnected(bluetoothPrinter.isConnected());

    // Register service worker for offline capability
    if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'development') {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.log('SW registration error:', err);
      });
    }

    // Connectivity listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadData]);

  // Open SpeedX Thermal Printer Diagnostic & Connection Hub
  const handleConnectPrinter = () => {
    setIsPrinterModalOpen(true);
  };

  // Callback when a new order is saved in NewBooking form
  const handleOrderSaved = (newOrder: Order) => {
    loadData();
    adminAuthService.syncOrder(newOrder);
    setActivePrintOrder(newOrder);
    setIsPrintHubOpen(true);
    setCurrentView('dashboard');
  };

  // Start editing existing order
  const handleStartEditBooking = (orderToEdit: Order) => {
    setActiveDetailOrder(null);
    setDetailSuccessMessage(null);
    setEditingOrder(orderToEdit);
    setCurrentView('newBooking');
  };

  // Cancel editing or new booking
  const handleCancelBooking = () => {
    if (editingOrder) {
      const prevOrder = editingOrder;
      setEditingOrder(null);
      setCurrentView('dashboard');
      setActiveDetailOrder(prevOrder);
    } else {
      setCurrentView('dashboard');
    }
  };

  // When an edited order is saved
  const handleOrderUpdated = async (updatedOrder: Order) => {
    await loadData();
    adminAuthService.syncOrder(updatedOrder);
    setEditingOrder(null);
    setCurrentView('dashboard');
    setDetailSuccessMessage(t.bookingUpdatedSuccess);
    setActiveDetailOrder(updatedOrder);
  };

  // When an order is permanently deleted
  const handleOrderDeleted = async () => {
    setActiveDetailOrder(null);
    await loadData();
    setDashboardNotice({ message: t.bookingDeletedSuccess, type: 'success' });
    setTimeout(() => setDashboardNotice(null), 4000);
  };

  return (
    <div className="min-h-screen bg-[#faf7f2] flex flex-col font-sans text-stone-900">
      {/* Top Header Bar */}
      <Header
        shop={shop}
        isPrinterConnected={isPrinterConnected}
        onConnectPrinter={handleConnectPrinter}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenTestRunner={() => setIsTestRunnerOpen(true)}
        onOpenVerifyReceipt={() => setIsVerifyReceiptOpen(true)}
        onNewBookingClick={() => {
          setEditingOrder(null);
          setCurrentView('newBooking');
        }}
        currentView={currentView}
        onNavigateHome={() => {
          setEditingOrder(null);
          setCurrentView('dashboard');
        }}
      />

      {/* Offline Mode Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-white text-xs font-semibold px-4 py-1.5 flex items-center justify-center gap-2 shadow-xs">
          <WifiOff className="w-3.5 h-3.5" />
          <span>{t.offlineActive}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {/* Banner for Deletion / System Feedback */}
        {dashboardNotice && currentView === 'dashboard' && (
          <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-3">
            <div
              className={`p-3.5 rounded-2xl flex items-center justify-between shadow-xs border animate-in fade-in duration-150 ${
                dashboardNotice.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{dashboardNotice.message}</span>
              </div>
              <button
                onClick={() => setDashboardNotice(null)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {currentView === 'dashboard' ? (
          <Dashboard
            orders={orders}
            shop={shop}
            onNewBookingClick={() => {
              setEditingOrder(null);
              setCurrentView('newBooking');
            }}
            onOpenPrintHub={order => {
              setActivePrintOrder(order);
              setIsPrintHubOpen(true);
            }}
            onSelectOrder={order => {
              setDetailSuccessMessage(null);
              setActiveDetailOrder(order);
            }}
            onRefreshOrders={loadData}
          />
        ) : (
          <NewBooking
            shop={shop}
            editingOrder={editingOrder}
            onCancel={handleCancelBooking}
            onOrderSaved={handleOrderSaved}
            onOrderUpdated={handleOrderUpdated}
          />
        )}
      </main>

      {/* Floating Action Button for New Booking on Mobile */}
      {currentView === 'dashboard' && (
        <button
          onClick={() => {
            setEditingOrder(null);
            setCurrentView('newBooking');
          }}
          className="sm:hidden fixed bottom-5 right-5 z-20 w-14 h-14 rounded-full bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white shadow-xl shadow-teal-950/30 flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
          aria-label={t.newBooking}
        >
          <Plus className="w-7 h-7" />
        </button>
      )}

      {/* Order Completion Print Dispatch Hub */}
      {activePrintOrder && (
        <PrintHubModal
          order={activePrintOrder}
          shop={shop}
          isOpen={isPrintHubOpen}
          onClose={() => setIsPrintHubOpen(false)}
          onNewBooking={() => {
            setIsPrintHubOpen(false);
            setEditingOrder(null);
            setCurrentView('newBooking');
          }}
          onConnectPrinter={handleConnectPrinter}
          isPrinterConnected={isPrinterConnected}
        />
      )}

      {/* Order Details & Lifecycle Modal */}
      {activeDetailOrder && (
        <OrderDetailsModal
          order={activeDetailOrder}
          shop={shop}
          isOpen={!!activeDetailOrder}
          onClose={() => {
            setActiveDetailOrder(null);
            setDetailSuccessMessage(null);
          }}
          onOpenPrintHub={order => {
            setActiveDetailOrder(null);
            setDetailSuccessMessage(null);
            setActivePrintOrder(order);
            setIsPrintHubOpen(true);
          }}
          onOrderUpdated={loadData}
          onEditBooking={handleStartEditBooking}
          onOrderDeleted={handleOrderDeleted}
          initialMessage={detailSuccessMessage}
        />
      )}

      {/* Shop Settings & Profile Modal */}
      <SettingsModal
        shop={shop}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onShopUpdated={updatedShop => setShop(updatedShop)}
        isPrinterConnected={isPrinterConnected}
        onConnectPrinter={handleConnectPrinter}
        onReloadData={loadData}
      />

      {/* QA Test Runner Modal */}
      <TestRunnerModal
        isOpen={isTestRunnerOpen}
        onClose={() => setIsTestRunnerOpen(false)}
        shop={shop}
      />

      {/* SpeedX Thermal Printer Connection & Diagnostics Hub */}
      <PrinterConnectModal
        isOpen={isPrinterModalOpen}
        onClose={() => setIsPrinterModalOpen(false)}
        isPrinterConnected={isPrinterConnected}
        onStatusChange={connected => setIsPrinterConnected(connected)}
      />

      {/* Verify Receipt & Tamper Detection Modal */}
      <VerifyReceiptModal
        isOpen={isVerifyReceiptOpen}
        onClose={() => setIsVerifyReceiptOpen(false)}
        shop={shop}
        onSelectOrder={order => {
          setIsVerifyReceiptOpen(false);
          setActiveDetailOrder(order);
        }}
        onOpenPrintHub={order => {
          setIsVerifyReceiptOpen(false);
          setActivePrintOrder(order);
          setIsPrintHubOpen(true);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
