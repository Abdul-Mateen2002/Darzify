import { Order, Customer, ShopProfile } from '../types';

export interface AdminSecurityStatus {
  success: boolean;
  isOnline: boolean;
  isInitialized: boolean;
  isConfigured: boolean;
  hasRecoveryEmail: boolean;
  recoveryEmail: string | null;
  rawRecoveryEmail?: string | null;
  isEmailVerified: boolean;
  hasRecoveryPhone: boolean;
  recoveryPhone: string | null;
  rawRecoveryPhone?: string | null;
  isPhoneVerified: boolean;
  updatedAt: number;
}

export interface DispatchNotification {
  id: string;
  timestamp: number;
  channel: 'SMS' | 'EMAIL';
  recipient: string;
  maskedRecipient: string;
  message: string;
  status: 'DELIVERED';
  provider: string;
}

class AdminAuthService {
  private sessionToken: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.sessionToken = sessionStorage.getItem('darzify_admin_session');
    }
  }

  public getSessionToken(): string | null {
    return this.sessionToken;
  }

  public setSessionToken(token: string | null) {
    this.sessionToken = token;
    if (typeof window !== 'undefined') {
      if (token) {
        sessionStorage.setItem('darzify_admin_session', token);
      } else {
        sessionStorage.removeItem('darzify_admin_session');
      }
    }
  }

  public clearSession() {
    this.setSessionToken(null);
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.sessionToken) {
      headers['x-admin-session'] = this.sessionToken;
    }
    return headers;
  }

  /**
   * Fetch online admin security status (never exposes PIN or hash)
   */
  async getStatus(): Promise<AdminSecurityStatus> {
    try {
      const res = await fetch('/api/admin/status');
      if (!res.ok) throw new Error('Status check failed');
      return await res.json();
    } catch {
      // Fallback if offline
      return {
        success: true,
        isOnline: false,
        isInitialized: true,
        isConfigured: true,
        hasRecoveryEmail: false,
        recoveryEmail: null,
        isEmailVerified: false,
        hasRecoveryPhone: false,
        recoveryPhone: null,
        isPhoneVerified: false,
        updatedAt: Date.now()
      };
    }
  }

  /**
   * Verifies 6-digit administrator PIN against server salted hash
   */
  async verifyPin(pin: string): Promise<{ success: boolean; sessionToken?: string; isInitialized?: boolean; error?: string }> {
    const trimmed = pin.trim();
    if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
      return { success: false, error: 'PIN must be exactly 6 numeric digits' };
    }
    if (trimmed === '1234') {
      return { success: false, error: '1234 is not permitted. Please enter your 6-digit PIN.' };
    }

    try {
      const res = await fetch('/api/admin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: trimmed })
      });
      const data = await res.json();
      if (data.success && data.sessionToken) {
        this.setSessionToken(data.sessionToken);
      }
      return data;
    } catch {
      // Offline fallback: reject 1234, require exactly 6 digits
      return { success: false, error: 'Unable to reach authentication server. Please check connection.' };
    }
  }

  /**
   * Request OTP during initial administrator setup
   */
  async requestInitialSetupOtp(
    type: 'email' | 'phone',
    contact: string
  ): Promise<{ success: boolean; message?: string; error?: string; waitSeconds?: number }> {
    try {
      const res = await fetch('/api/admin/initial-setup/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, contact })
      });
      return await res.json();
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Verify OTP during initial administrator setup
   */
  async verifyInitialSetupOtp(
    type: 'email' | 'phone',
    contact: string,
    otp: string
  ): Promise<{ success: boolean; verificationToken?: string; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/admin/initial-setup/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, contact, otp })
      });
      return await res.json();
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Complete initial administrator setup
   */
  async completeInitialSetup(params: {
    newPin: string;
    confirmPin: string;
    verifiedContacts: Array<{ type: 'email' | 'phone'; contact: string; token: string }>;
  }): Promise<{ success: boolean; sessionToken?: string; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/admin/initial-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const data = await res.json();
      if (data.success && data.sessionToken) {
        this.setSessionToken(data.sessionToken);
      }
      return data;
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Change Administrator PIN
   */
  async changePin(params: {
    currentPin?: string;
    newPin: string;
    confirmPin: string;
  }): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/admin/change-pin', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          ...params,
          sessionToken: this.sessionToken
        })
      });
      const data = await res.json();
      if (data.success && data.sessionToken) {
        this.setSessionToken(data.sessionToken);
      }
      return data;
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Request OTP to verify an email or phone for recovery contact setup
   */
  async requestContactOtp(
    type: 'email' | 'phone',
    contact: string,
    currentPin?: string
  ): Promise<{ success: boolean; message?: string; error?: string; waitSeconds?: number }> {
    try {
      const res = await fetch('/api/admin/recovery-contact/request-otp', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          type,
          contact,
          currentPin,
          sessionToken: this.sessionToken
        })
      });
      return await res.json();
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Verify entered OTP and activate recovery contact
   */
  async verifyContactOtp(
    type: 'email' | 'phone',
    contact: string,
    otp: string,
    currentPin?: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/admin/recovery-contact/verify-otp', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          type,
          contact,
          otp,
          currentPin,
          sessionToken: this.sessionToken
        })
      });
      return await res.json();
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Remove a recovery contact
   */
  async removeContact(type: 'email' | 'phone'): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/admin/recovery-contact/remove', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ type, sessionToken: this.sessionToken })
      });
      return await res.json();
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Forgot PIN - Step 1: Identify Account
   */
  async identifyRecoveryContact(
    contact: string
  ): Promise<{ success: boolean; contactType?: 'email' | 'phone'; maskedContact?: string; contact?: string; error?: string }> {
    try {
      const res = await fetch('/api/admin/forgot-pin/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact })
      });
      return await res.json();
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Forgot PIN - Step 2: Send OTP
   */
  async sendRecoveryOtp(
    contact: string
  ): Promise<{ success: boolean; message?: string; error?: string; waitSeconds?: number }> {
    try {
      const res = await fetch('/api/admin/forgot-pin/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact })
      });
      return await res.json();
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Forgot PIN - Step 3: Verify OTP
   */
  async verifyRecoveryOtp(
    contact: string,
    otp: string
  ): Promise<{ success: boolean; resetToken?: string; error?: string }> {
    try {
      const res = await fetch('/api/admin/forgot-pin/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, otp })
      });
      return await res.json();
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Forgot PIN - Step 4: Reset PIN
   */
  async resetPin(
    resetToken: string,
    newPin: string,
    confirmPin: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/admin/forgot-pin/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetToken, newPin, confirmPin })
      });
      return await res.json();
    } catch (err: unknown) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Get recent simulated SMS/Email dispatches (for demo and verification in UI)
   */
  async getDispatches(): Promise<DispatchNotification[]> {
    try {
      const res = await fetch('/api/admin/dispatches');
      const data = await res.json();
      return data.dispatches || [];
    } catch {
      return [];
    }
  }

  /**
   * Data Migration & Online Synchronizer
   */
  async migrateLocalData(orders: Order[], customers: Customer[], shopProfile: ShopProfile) {
    try {
      const res = await fetch('/api/sync/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders, customers, shopProfile })
      });
      return await res.json();
    } catch (err) {
      console.warn('[Sync] Offline migration deferred:', err);
      return { success: false };
    }
  }

  async syncOrder(order: Order) {
    try {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });
    } catch (err) {
      console.warn('[Sync] Order sync deferred:', err);
    }
  }

  async deleteOrderOnline(orderId: string, pin?: string) {
    try {
      const headers = this.getAuthHeaders();
      if (pin) headers['x-admin-pin'] = pin;
      await fetch(`/api/orders/${orderId}`, {
        method: 'DELETE',
        headers
      });
    } catch (err) {
      console.warn('[Sync] Delete order sync deferred:', err);
    }
  }

  /**
   * Seeds demo credentials (PIN 000000, recovery email and phone) for testing
   */
  async seedTestAdmin(): Promise<{ success: boolean }> {
    try {
      const res = await fetch('/api/admin/dev-seed', { method: 'POST' });
      return await res.json();
    } catch {
      return { success: false };
    }
  }

  /**
   * Resets admin account to uninitialized state to re-test onboarding flow
   */
  async resetAdminToUninitialized(): Promise<{ success: boolean }> {
    try {
      const res = await fetch('/api/admin/dev-reset', { method: 'POST' });
      this.clearSession();
      return await res.json();
    } catch {
      return { success: false };
    }
  }
}

export const adminAuthService = new AdminAuthService();
