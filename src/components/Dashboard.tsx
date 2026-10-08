import React, { useState, useMemo } from 'react';
import { Plus, Search, Calendar, Phone, Clock, CheckCircle2, Scissors, Printer, ChevronDown } from 'lucide-react';
import { Order, ShopProfile, OrderStatus } from '../types';
import { useLanguage } from '../i18n/useLanguage';
import { db } from '../db/database';

interface DashboardProps {
  orders: Order[];
  shop: ShopProfile;
  onNewBookingClick: () => void;
  onOpenPrintHub: (order: Order) => void;
  onSelectOrder: (order: Order) => void;
  onRefreshOrders: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  orders,
  shop,
  onNewBookingClick,
  onOpenPrintHub,
  onSelectOrder,
  onRefreshOrders
}) => {
  const { t, isRtl } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'overdue' | 'active'>('all');

  // Helper date parsing (DD/MM/YYYY or YYYY-MM-DD)
  const parseDate = (dStr: string): Date | null => {
    if (!dStr) return null;
    if (dStr.includes('/')) {
      const [d, m, y] = dStr.split('/').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date(dStr);
  };

  // Real-time KPI Metric Calculations
  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let todayDue = 0;
    let late = 0;
    let ready = 0;
    let inShop = 0;

    orders.forEach(order => {
      if (order.status === 'DELIVERED') return;

      const rDate = parseDate(order.returnDate);
      if (rDate) {
        rDate.setHours(0, 0, 0, 0);
        if (rDate.getTime() === today.getTime()) {
          todayDue++;
        } else if (rDate.getTime() < today.getTime()) {
          late++;
        }
      }

      if (order.status === 'READY') {
        ready++;
      } else if (order.status === 'IN_PROGRESS' || order.status === 'BOOKED') {
        inShop++;
      }
    });

    return { todayDue, late, ready, inShop };
  }, [orders]);

  // Filtered & Searched Orders List
  const filteredOrders = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return orders.filter(order => {
      // 1. Search Query
      const q = searchTerm.toLowerCase().trim();
      if (q) {
        const matchesSlip = String(order.slipNumber).includes(q);
        const matchesPhone = order.customerPhone.toLowerCase().includes(q);
        const matchesName = order.customerName.toLowerCase().includes(q);
        if (!matchesSlip && !matchesPhone && !matchesName) return false;
      }

      // 2. Tab Filter
      if (filterTab === 'active') {
        return order.status !== 'DELIVERED';
      }
      if (filterTab === 'overdue') {
        const rDate = parseDate(order.returnDate);
        return order.status !== 'DELIVERED' && rDate && rDate.getTime() < today.getTime();
      }

      return true; // 'all'
    });
  }, [orders, searchTerm, filterTab]);

  // Status Updater
  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    await db.orders.update(orderId, { status: newStatus, updatedAt: Date.now() });
    onRefreshOrders();
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-4 pb-24">
      {/* Title & Primary New Booking Action Bar */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight">{t.dashboard}</h1>
          <p className="text-[11px] text-stone-500 font-medium">{shop.shopName} · {orders.length} {t.slipsCount}</p>
        </div>
        <button
          onClick={onNewBookingClick}
          className="flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-950/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.newBooking}</span>
        </button>
      </div>

      {/* 4 KPI Metric Cards (Teal & Cream Palette matching reference video) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* 1. Today's Due (آج کی واپسی) */}
        <div className="bg-[#e6f4f1] border border-teal-200/90 rounded-2xl p-3.5 shadow-xs">
          <div className="text-[11px] font-bold text-teal-800">{t.todayDue}</div>
          <div className="text-3xl font-extrabold font-mono text-teal-950 mt-1">{metrics.todayDue}</div>
        </div>

        {/* 2. Overdue / Late (لیٹ) */}
        <div className="bg-[#fdf2f0] border border-rose-200/90 rounded-2xl p-3.5 shadow-xs">
          <div className="text-[11px] font-bold text-rose-800">{t.late}</div>
          <div className="text-3xl font-extrabold font-mono text-rose-900 mt-1">{metrics.late}</div>
        </div>

        {/* 3. Ready (تیار) */}
        <div className="bg-[#ecf7ed] border border-emerald-200/90 rounded-2xl p-3.5 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-800">{t.ready}</div>
          <div className="text-3xl font-extrabold font-mono text-emerald-950 mt-1">{metrics.ready}</div>
        </div>

        {/* 4. In Workshop (دکان میں) */}
        <div className="bg-[#f7f3ec] border border-[#ede7dc] rounded-2xl p-3.5 shadow-xs">
          <div className="text-[11px] font-bold text-stone-700">{t.inShop}</div>
          <div className="text-3xl font-extrabold font-mono text-stone-900 mt-1">{metrics.inShop}</div>
        </div>
      </div>

      {/* Search Bar & Filter Tabs */}
      <div className="bg-white p-3 rounded-2xl shadow-xs border border-[#ede7dc] space-y-2.5">
        {/* Search Input */}
        <div className="relative">
          <Search className={`w-4 h-4 text-stone-400 absolute top-3 ${isRtl ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={t.searchPlaceholder}
            className={`w-full h-10 bg-[#faf7f2] border border-[#ede7dc] rounded-xl text-xs font-medium focus:bg-white focus:border-teal-700 outline-none transition-all ${
              isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'
            }`}
          />
        </div>

        {/* Segmented Filter Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-[#f4efe6] rounded-xl">
          <button
            onClick={() => setFilterTab('all')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterTab === 'all' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {t.all}
          </button>
          <button
            onClick={() => setFilterTab('overdue')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterTab === 'overdue' ? 'bg-white text-rose-700 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {t.overdue}
          </button>
          <button
            onClick={() => setFilterTab('active')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              filterTab === 'active' ? 'bg-white text-teal-800 shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            {t.active}
          </button>
        </div>
      </div>

      {/* Order Cards List */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#ede7dc] p-10 text-center text-stone-400">
            <Scissors className="w-8 h-8 mx-auto mb-2 text-stone-300" />
            <p className="text-xs font-medium">{t.noSlips}</p>
          </div>
        ) : (
          filteredOrders.map(order => {
            const firstItem = order.items[0];
            const garmentLabel = firstItem ? t[firstItem.garmentType] || firstItem.garmentType : '';
            const recipientLabel = firstItem?.recipientTag ? ` (${firstItem.recipientTag})` : '';

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl p-4 shadow-xs border border-[#ede7dc] hover:border-teal-700/50 hover:shadow-md transition-all flex flex-col gap-3"
              >
                {/* Header row: Slip No, Status Selector & Print Action */}
                <div className="flex items-center justify-between">
                  <div
                    onClick={() => onSelectOrder(order)}
                    className="flex items-center gap-2 cursor-pointer flex-1"
                  >
                    <span className="font-mono font-bold text-sm text-stone-900 bg-[#f4efe6] px-2.5 py-0.5 rounded-lg border border-[#e5ddcf]">
                      #{order.slipNumber}
                    </span>
                    <span className="font-bold text-sm text-stone-900 hover:text-teal-800 transition-colors">
                      {order.customerName}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Status Dropdown */}
                    <div className="relative inline-block">
                      <select
                        value={order.status}
                        onChange={e => handleUpdateStatus(order.id, e.target.value as OrderStatus)}
                        className={`text-[11px] font-bold py-1 px-2.5 rounded-lg border outline-none cursor-pointer appearance-none pr-5 transition-colors ${
                          order.status === 'READY'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : order.status === 'DELIVERED'
                            ? 'bg-stone-100 text-stone-600 border-stone-300'
                            : order.status === 'IN_PROGRESS'
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-teal-50 text-teal-800 border-teal-300'
                        }`}
                      >
                        <option value="BOOKED">{t.dashboard}</option>
                        <option value="IN_PROGRESS">{t.inShopStatus}</option>
                        <option value="READY">{t.readyStatus}</option>
                        <option value="DELIVERED">{t.deliveredStatus}</option>
                      </select>
                      <ChevronDown className="w-3 h-3 text-stone-400 absolute right-1.5 top-2 pointer-events-none" />
                    </div>

                    {/* Print Hub Trigger Button */}
                    <button
                      onClick={() => onOpenPrintHub(order)}
                      className="p-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 transition-colors cursor-pointer"
                      title={t.customerSlip + ' / ' + t.karigarSlip}
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Details Row: Phone, Garment, Return Date */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-stone-600 pt-2 border-t border-[#f4efe6]">
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-stone-400" />
                    <span className="font-mono text-stone-700">{order.customerPhone}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-stone-400" />
                    <span className="text-stone-700">
                      {garmentLabel}{recipientLabel} × {firstItem?.quantity || 1}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 col-span-2 sm:col-span-1">
                    <Calendar className="w-3.5 h-3.5 text-stone-400" />
                    <span>
                      {t.returnDate}: <strong className="font-mono text-stone-900">{order.returnDate}</strong>
                    </span>
                  </div>
                </div>

                {/* Financial Summary Line */}
                <div className="flex items-center justify-between pt-2 border-t border-[#f4efe6] text-xs">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-stone-500">{t.totalAmount}:</span>
                    <strong className="text-stone-900">Rs. {order.totalAmount.toLocaleString()}</strong>
                  </div>

                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-stone-500">{t.advance}:</span>
                    <span className="text-stone-700">Rs. {order.advanceAmount.toLocaleString()}</span>
                    <span className="text-stone-300">|</span>
                    <span className="text-rose-600 font-bold">
                      {t.balance}: Rs. {order.balanceAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
