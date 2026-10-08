import fs from 'fs';
import path from 'path';
import { AdminAccount, generateSalt, hashPin } from './security.js';
import { Order, Customer, ShopProfile } from '../types/index.js';

interface BackendStore {
  admin: AdminAccount;
  shopProfile: ShopProfile;
  orders: Order[];
  customers: Customer[];
  migrationStatus: {
    migrated: boolean;
    migratedAt: number;
    totalOrders: number;
    totalCustomers: number;
  };
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'darzify_online.json');

const DEFAULT_BACKEND_STORE: BackendStore = {
  admin: {
    adminId: 'admin_darzify',
    username: 'admin',
    isInitialized: false,
    pinSalt: '',
    pinHash: '',
    recoveryEmail: null,
    isEmailVerified: false,
    recoveryPhone: null,
    isPhoneVerified: false,
    updatedAt: Date.now()
  },
  shopProfile: {
    id: 'default_shop',
    shopName: 'Darzify',
    ownerName: 'Abdul Mateen Khan',
    phone: '03426454541',
    address: 'The Vector Limited, Peshawar',
    disclaimer: 'سوٹ لینے آئیں تو یہ پرچی ساتھ لائیں۔',
    defaultRate: 2500,
    defaultDeliveryDays: 7,
    printerName: 'SpeedX 58mm'
  },
  orders: [],
  customers: [],
  migrationStatus: {
    migrated: false,
    migratedAt: 0,
    totalOrders: 0,
    totalCustomers: 0
  }
};

let memoryStore: BackendStore = { ...DEFAULT_BACKEND_STORE };

export function loadStore(): BackendStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const isAdminInit = Boolean(parsed.admin && parsed.admin.isInitialized && parsed.admin.pinHash);
      memoryStore = {
        ...DEFAULT_BACKEND_STORE,
        ...parsed,
        admin: {
          ...DEFAULT_BACKEND_STORE.admin,
          ...(parsed.admin || {}),
          isInitialized: isAdminInit
        }
      };
      return memoryStore;
    }
  } catch (err) {
    console.warn('[Storage] Failed to read store file, using in-memory default:', err);
  }
  saveStore(memoryStore);
  return memoryStore;
}

export function saveStore(store: BackendStore): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Storage] Error persisting to disk:', err);
  }
}

export function getAdminAccount(): AdminAccount {
  return memoryStore.admin;
}

export function updateAdminAccount(updater: Partial<AdminAccount>): AdminAccount {
  memoryStore.admin = {
    ...memoryStore.admin,
    ...updater,
    updatedAt: Date.now()
  };
  saveStore(memoryStore);
  return memoryStore.admin;
}

export function getOnlineOrders(): Order[] {
  return memoryStore.orders;
}

export function getOnlineCustomers(): Customer[] {
  return memoryStore.customers;
}

export function getOnlineShopProfile(): ShopProfile {
  return memoryStore.shopProfile;
}

export function saveOnlineOrder(order: Order): Order {
  const index = memoryStore.orders.findIndex(o => o.id === order.id);
  if (index >= 0) {
    memoryStore.orders[index] = order;
  } else {
    memoryStore.orders.push(order);
  }
  saveStore(memoryStore);
  return order;
}

export function deleteOnlineOrder(orderId: string): boolean {
  const initialLen = memoryStore.orders.length;
  memoryStore.orders = memoryStore.orders.filter(o => o.id !== orderId);
  saveStore(memoryStore);
  return memoryStore.orders.length < initialLen;
}

export function saveOnlineCustomer(customer: Customer): Customer {
  const index = memoryStore.customers.findIndex(c => c.id === customer.id);
  if (index >= 0) {
    memoryStore.customers[index] = customer;
  } else {
    memoryStore.customers.push(customer);
  }
  saveStore(memoryStore);
  return customer;
}

export function updateOnlineShopProfile(profile: ShopProfile): ShopProfile {
  // Ensure plaintext adminPin is NOT saved in profile
  const safeProfile = { ...profile };
  delete safeProfile.adminPin;
  memoryStore.shopProfile = safeProfile;
  saveStore(memoryStore);
  return safeProfile;
}

export function recordMigration(orders: Order[], customers: Customer[], shopProfile?: ShopProfile): void {
  if (orders && orders.length > 0) {
    // Merge without duplicates
    const orderMap = new Map<string, Order>();
    memoryStore.orders.forEach(o => orderMap.set(o.id, o));
    orders.forEach(o => orderMap.set(o.id, o));
    memoryStore.orders = Array.from(orderMap.values());
  }

  if (customers && customers.length > 0) {
    const custMap = new Map<string, Customer>();
    memoryStore.customers.forEach(c => custMap.set(c.id, c));
    customers.forEach(c => custMap.set(c.id, c));
    memoryStore.customers = Array.from(custMap.values());
  }

  if (shopProfile) {
    const safe = { ...shopProfile };
    delete safe.adminPin;
    memoryStore.shopProfile = safe;
  }

  memoryStore.migrationStatus = {
    migrated: true,
    migratedAt: Date.now(),
    totalOrders: memoryStore.orders.length,
    totalCustomers: memoryStore.customers.length
  };

  saveStore(memoryStore);
}

export function getMigrationStatus() {
  return memoryStore.migrationStatus;
}

// Initial load
loadStore();
