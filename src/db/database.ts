import Dexie, { type EntityTable } from 'dexie';
import { Customer, Order, ShopProfile } from '../types';
import { ReceiptSecurityService } from '../services/receiptSecurityService';

export const DEFAULT_SHOP_PROFILE: ShopProfile = {
  id: 'default_shop',
  shopName: 'Darzify',
  ownerName: 'Abdul Mateen Khan',
  phone: '03426454541',
  address: 'The Vector Limited, Peshawar',
  disclaimer: 'سوٹ لینے آئیں تو یہ پرچی ساتھ لائیں۔',
  defaultRate: 0,
  defaultDeliveryDays: 7,
  printerName: 'SpeedX 58mm'
};

class TailorDatabase extends Dexie {
  shopProfile!: EntityTable<ShopProfile, 'id'>;
  customers!: EntityTable<Customer, 'id'>;
  orders!: EntityTable<Order, 'id'>;

  constructor() {
    super('RMG_Darzi_POS_DB');
    this.version(1).stores({
      shopProfile: 'id',
      customers: 'id, phone, name, createdAt',
      orders: 'id, slipNumber, customerPhone, customerName, bookingDate, returnDate, status, createdAt'
    });
    this.version(2).stores({
      orders: 'id, slipNumber, verificationCode, customerPhone, customerName, bookingDate, returnDate, status, createdAt'
    });
  }
}

export const db = new TailorDatabase();

// Initialize and seed default shop profile and video demo data if empty
export async function initializeDatabase() {
  const profile = await db.shopProfile.get('default_shop');
  if (!profile) {
    await db.shopProfile.put(DEFAULT_SHOP_PROFILE);
  }

  const orderCount = await db.orders.count();
  if (orderCount === 0) {
    await loadReferenceVideoData();
  } else {
    // Backfill any existing orders missing verification codes or tamper hashes
    const allOrders = await db.orders.toArray();
    for (const ord of allOrders) {
      if (!ord.verificationCode || !ord.tamperHash) {
        const secured = await ReceiptSecurityService.ensureOrderSecurity(ord);
        await db.orders.put(secured);
      }
    }
  }
}

// Function to seed or reset to the exact video demo scenario
export async function loadReferenceVideoData() {
  const customerId = 'cust_rameez_gondal';
  const customer: Customer = {
    id: customerId,
    phone: '03338889973',
    name: 'رمیز گوندل',
    createdAt: Date.now() - 86400000 * 5,
    totalOrders: 1
  };
  await db.customers.put(customer);

  const sampleOrder: Order = {
    id: 'ord_sample_video_1',
    slipNumber: 1,
    verificationCode: 'DZ-7K4P92',
    customerId: customerId,
    customerPhone: '03338889973',
    customerName: 'رمیز گوندل',
    bookingDate: '27/09/2026',
    returnDate: '04/10/2026',
    status: 'BOOKED',
    items: [
      {
        id: 'item_1',
        garmentType: 'SHALWAR_KAMEEZ',
        recipientTag: 'اپنے لیے',
        quantity: 1,
        unitRate: 2500,
        measurements: {
          lambai: 43,
          asteen: 24.5,
          teera: 17.5,
          collar: 15.5,
          chaati: 44,
          kamar: 42,
          ghera: 46,
          shalwarLambai: 40,
          paicha: 8,
          cuffWidth: 6,
          pattiWidth: 2.5
        },
        design: {
          collarStyle: 'BAIN',
          cuffStyle: 'SQUARE',
          damanStyle: 'SQUARE',
          pockets: ['FRONT', 'SIDE', 'SHALWAR'],
          extras: ['DOUBLE_STITCH']
        }
      }
    ],
    totalAmount: 2500,
    advanceAmount: 500,
    balanceAmount: 2000,
    paymentMethod: 'CASH',
    specialInstructions: 'بھائی کی شادی ہے، اس لیے سوٹ جلدی چاہیے، براہ کرم دیر نہ ہو۔',
    tailoringNotes: 'کرتا اسمارٹ فٹ، صاف ستھری سلائی، مناسب کف و پٹی اور شلوار نارمل فٹنگ میں ہو۔ مجموعی فٹنگ جسم کے مطابق ہو۔',
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 86400000 * 5
  };

  sampleOrder.tamperHash = await ReceiptSecurityService.computeTamperHash(sampleOrder);

  await db.orders.put(sampleOrder);
}
