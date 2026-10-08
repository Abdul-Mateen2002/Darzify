import { Order } from '../types';
import { db } from '../db/database';

/**
 * Unambiguous 32-character base charset (omitting 0, 1, I, O to prevent confusion).
 * 32^6 = 1,073,741,824 possible codes (~1.07 billion).
 */
const VERIFICATION_CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Pure TypeScript fallback implementation of SHA-256
 * Ensures cryptographic hashing works in every context (including non-secure origins or offline test runners).
 */
function fallbackSha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = 'length';
  let i = 0;
  let j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, boolean> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return ''; // Only ASCII
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];

      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] =
        i < 16
          ? w[i]
          : ((w[i - 16] + s0 + w[i - 7] + s1) & 0xffffffff) | 0;

      const s1_h = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + s1_h + ch + k[i] + w[i]) | 0;
      const s0_h = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0_h + maj) | 0;

      hash = [(temp1 + temp2) | 0, hash[0], hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (let b = 3; b >= 0; b--) {
      const byte = (hash[i] >> (b * 8)) & 255;
      result += (byte < 16 ? '0' : '') + byte.toString(16);
    }
  }
  return result;
}

export interface DiscrepancyItem {
  field: string;
  label: string;
  authoritativeValue: string;
  presentedValue: string;
  isMatch: boolean;
}

export interface ReceiptComparisonInput {
  totalAmount?: string | number;
  advanceAmount?: string | number;
  balanceAmount?: string | number;
  returnDate?: string;
  customerName?: string;
  customerPhone?: string;
}

export class ReceiptSecurityService {
  /**
   * Generates a cryptographically strong, unpredictable 6-character code prefixed by "DZ-".
   * Example: "DZ-7K4P92"
   */
  public static generateVerificationCode(): string {
    const bytes = new Uint8Array(6);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < 6; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }

    let code = 'DZ-';
    for (let i = 0; i < 6; i++) {
      const idx = bytes[i] % VERIFICATION_CHARSET.length;
      code += VERIFICATION_CHARSET[idx];
    }
    return code;
  }

  /**
   * Generates a unique verification code not currently present in the database.
   */
  public static async generateUniqueVerificationCode(): Promise<string> {
    let attempts = 0;
    while (attempts < 10) {
      const candidate = this.generateVerificationCode();
      const existing = await db.orders.where('verificationCode').equals(candidate).first();
      if (!existing) {
        return candidate;
      }
      attempts++;
    }
    // Fallback timestamp extension in astronomical collision scenario
    return this.generateVerificationCode() + '-' + Date.now().toString(36).slice(-3).toUpperCase();
  }

  /**
   * Computes a canonical SHA-256 cryptographic hash of authoritative receipt data.
   */
  public static async computeTamperHash(order: Partial<Order>): Promise<string> {
    const firstItem = order.items?.[0];
    const canonical = [
      `SLIP:${order.slipNumber ?? 0}`,
      `CODE:${order.verificationCode ?? ''}`,
      `NAME:${(order.customerName || '').trim()}`,
      `PHONE:${(order.customerPhone || '').replace(/\D/g, '')}`,
      `GARMENT:${firstItem?.garmentType || ''}`,
      `QTY:${firstItem?.quantity || 1}`,
      `RATE:${firstItem?.unitRate || 0}`,
      `TOTAL:${order.totalAmount ?? 0}`,
      `ADV:${order.advanceAmount ?? 0}`,
      `BAL:${order.balanceAmount ?? 0}`,
      `RETURN:${(order.returnDate || '').trim()}`
    ].join('|');

    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(canonical);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (err) {
        console.warn('crypto.subtle failed, falling back to pure JS sha256', err);
      }
    }

    return fallbackSha256(canonical);
  }

  /**
   * Ensures an order has a verification code and tamper hash.
   * If code already exists, preserves it! (Do not regenerate on reprints or edits).
   */
  public static async ensureOrderSecurity(order: Order): Promise<Order> {
    const code = order.verificationCode || (await this.generateUniqueVerificationCode());
    const hash = await this.computeTamperHash({ ...order, verificationCode: code });

    return {
      ...order,
      verificationCode: code,
      tamperHash: hash
    };
  }

  /**
   * Normalizes verification query and searches authoritative IndexedDB records.
   * Supports:
   * - "DZ-7K4P92" (full code)
   * - "7K4P92" (without DZ- prefix)
   * - "#1" or "1" or "DZ-1" (slip numbers)
   */
  public static async findOrderForVerification(rawQuery: string): Promise<Order | null> {
    const query = rawQuery.trim().toUpperCase();
    if (!query) return null;

    // 1. Direct search by verificationCode
    const directCode = await db.orders.where('verificationCode').equals(query).first();
    if (directCode) return directCode;

    // 2. Search by adding DZ- prefix if user typed only the 6 alphanumeric chars
    if (!query.startsWith('DZ-') && query.length >= 5) {
      const withPrefix = `DZ-${query}`;
      const codeWithPrefix = await db.orders.where('verificationCode').equals(withPrefix).first();
      if (codeWithPrefix) return codeWithPrefix;
    }

    // 3. Search case-insensitively across all orders if not found by index
    const allOrders = await db.orders.toArray();
    const matchedByCode = allOrders.find(o => {
      if (!o.verificationCode) return false;
      const v = o.verificationCode.toUpperCase();
      return v === query || v === `DZ-${query}` || v.replace('DZ-', '') === query;
    });
    if (matchedByCode) return matchedByCode;

    // 4. Search by slip number (e.g. "1", "#1", "DZ-1", "SLIP 1")
    const cleanNumeric = query.replace(/[^0-9]/g, '');
    if (cleanNumeric) {
      const slipNum = parseInt(cleanNumeric, 10);
      const matchedBySlip = allOrders.find(o => o.slipNumber === slipNum);
      if (matchedBySlip) return matchedBySlip;
    }

    return null;
  }

  /**
   * Compares values presented on a customer PDF against authoritative Darzify booking data.
   */
  public static compareReceiptData(
    order: Order,
    presented: ReceiptComparisonInput
  ): { hasTampering: boolean; discrepancies: DiscrepancyItem[] } {
    const discrepancies: DiscrepancyItem[] = [];

    // Helper comparison
    const checkNumeric = (field: string, label: string, authVal: number, presValStr?: string | number) => {
      if (presValStr === undefined || presValStr === '') return;
      const presNum = typeof presValStr === 'number' ? presValStr : parseFloat(String(presValStr).replace(/[^0-9.-]/g, ''));
      const isMatch = Math.abs(authVal - presNum) < 0.01;
      discrepancies.push({
        field,
        label,
        authoritativeValue: `Rs. ${authVal.toLocaleString()}`,
        presentedValue: isNaN(presNum) ? String(presValStr) : `Rs. ${presNum.toLocaleString()}`,
        isMatch
      });
    };

    const checkString = (field: string, label: string, authVal: string, presVal?: string) => {
      if (!presVal || !presVal.trim()) return;
      const cleanAuth = authVal.trim().toLowerCase();
      const cleanPres = presVal.trim().toLowerCase();
      const isMatch = cleanAuth === cleanPres;
      discrepancies.push({
        field,
        label,
        authoritativeValue: authVal,
        presentedValue: presVal.trim(),
        isMatch
      });
    };

    checkNumeric('totalAmount', 'Total Amount', order.totalAmount, presented.totalAmount);
    checkNumeric('advanceAmount', 'Advance Paid', order.advanceAmount, presented.advanceAmount);
    checkNumeric('balanceAmount', 'Balance Due', order.balanceAmount, presented.balanceAmount);
    checkString('returnDate', 'Return Date', order.returnDate, presented.returnDate);
    checkString('customerName', 'Customer Name', order.customerName, presented.customerName);
    checkString('customerPhone', 'Customer Phone', order.customerPhone, presented.customerPhone);

    const hasTampering = discrepancies.some(d => !d.isMatch);

    return { hasTampering, discrepancies };
  }
}
