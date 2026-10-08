export type Language = 'ur' | 'en';

export type OrderStatus = 'DRAFT' | 'BOOKED' | 'IN_PROGRESS' | 'READY' | 'DELIVERED';

export type GarmentType = 
  | 'SHALWAR_KAMEEZ'
  | 'KURTA_SHALWAR'
  | 'WAISTCOAT'
  | 'SHIRT'
  | 'PANT';

export type CollarStyle = 'COLLAR' | 'BAIN' | 'CUT_BAIN';
export type CuffStyle = 'ROUND' | 'SQUARE' | 'PLAIN_SLEEVE';
export type DamanStyle = 'ROUND' | 'SQUARE';

export type PocketType = 'FRONT' | 'SIDE' | 'SHALWAR';
export type ExtraOption = 'PATTI' | 'DOUBLE_STITCH' | 'EMBROIDERY' | 'STEEL_BUTTON' | 'FANCY_BUTTON';

export type PaymentMethod = 'CASH' | 'ONLINE';

export interface ShopProfile {
  id: string;
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
  logoUrl?: string;
  disclaimer: string;
  defaultRate?: number;
  defaultDeliveryDays: number;
  printerName?: string;
  adminPin?: string;
}

export interface Customer {
  id: string;
  phone: string;
  name: string;
  createdAt: number;
  totalOrders: number;
}

export interface MeasurementSet {
  // Kameez / Kurta
  lambai?: number;         // Length (لمبائی)
  asteen?: number;         // Sleeves (آستین)
  teera?: number;          // Across Shoulder (تیرہ)
  collar?: number;         // Neck / Collar (کالر)
  chaati?: number;         // Chest (چھاتی)
  kamar?: number;          // Waist (کمر)
  ghera?: number;          // Daman / Hem flare (گھیرا)
  
  // Shalwar
  shalwarLambai?: number;  // Shalwar Length (شلوار لمبائی)
  paicha?: number;         // Ankle Opening (پانچہ)
  
  // Details
  cuffWidth?: number;      // Cuff Width (کف چوڑائی)
  pattiWidth?: number;     // Placket Width (پٹی چوڑائی)

  // Waistcoat / Shirt / Pant specific
  waistcoatLength?: number;
  pantWaist?: number;
  pantInseam?: number;
  pantOutseam?: number;
  pantHip?: number;
}

export interface DesignSpec {
  collarStyle: CollarStyle;
  cuffStyle: CuffStyle;
  damanStyle: DamanStyle;
  pockets: PocketType[];
  extras: ExtraOption[];
}

export interface OrderItem {
  id: string;
  garmentType: GarmentType;
  recipientTag: string; // e.g. "اپنے لیے", "خود", "ابو", "بیٹا", "علی"
  quantity: number;
  unitRate: number;
  measurements: MeasurementSet;
  design: DesignSpec;
}

export interface Order {
  id: string;
  slipNumber: number;
  customerId: string;
  customerPhone: string;
  customerName: string;
  bookingDate: string;     // YYYY-MM-DD or DD/MM/YYYY
  returnDate: string;      // YYYY-MM-DD or DD/MM/YYYY
  status: OrderStatus;
  items: OrderItem[];
  
  // Financials
  totalAmount: number;
  advanceAmount: number;
  balanceAmount: number;
  paymentMethod: PaymentMethod;
  
  // Two distinct notes strictly separated
  specialInstructions: string; // دیگر تفصیل (Customer occasion / urgency note)
  tailoringNotes: string;      // نوٹ (Craftsman / fitting guidelines)
  
  // Security & Tamper-Evident Verification
  verificationCode?: string;   // e.g. "DZ-7K4P92" (Cryptographically strong & unique)
  tamperHash?: string;         // SHA-256 fingerprint of authoritative receipt data

  createdAt: number;
  updatedAt: number;
}

export type TicketType = 'CUSTOMER' | 'KARIGAR' | 'FABRIC_TAG';

export type PrinterPlatform = 'android-native' | 'web-bluetooth' | 'web-serial' | 'unsupported-browser';

export type PrinterConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'PRINTING' | 'ERROR';

export interface PrinterDevice {
  id: string;
  name: string;
  address?: string; // MAC address on Android
  type?: 'bluetooth-classic' | 'ble' | 'serial';
}

export interface PrinterDiagnostic {
  isIframe: boolean;
  hasWebBluetooth: boolean;
  hasWebSerial: boolean;
  isAndroidBridge: boolean;
  isPermissionsPolicyBlocked: boolean;
  activePlatform: PrinterPlatform;
  recommendedTransport: string;
  diagnosticMessage: string;
}
