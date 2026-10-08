import crypto from 'crypto';

export interface AdminAccount {
  adminId: string;
  username: string;
  isInitialized: boolean;
  pinSalt: string;
  pinHash: string; // PBKDF2-SHA512 salted hash
  recoveryEmail: string | null;
  isEmailVerified: boolean;
  recoveryPhone: string | null;
  isPhoneVerified: boolean;
  updatedAt: number;
}

export interface OtpRecord {
  id: string;
  target: string; // email or phone
  purpose: 'VERIFY_EMAIL' | 'VERIFY_PHONE' | 'RECOVERY';
  otpHash: string;
  salt: string;
  createdAt: number;
  expiresAt: number; // 10 minutes
  attempts: number;
  maxAttempts: number;
}

export interface NotificationDispatch {
  id: string;
  timestamp: number;
  channel: 'SMS' | 'EMAIL';
  recipient: string;
  maskedRecipient: string;
  message: string;
  status: 'DELIVERED';
  provider: 'SpeedX-SMS-Gateway' | 'Darzify-Mail-Gateway';
}

export interface PasswordResetSession {
  token: string;
  target: string;
  createdAt: number;
  expiresAt: number; // 5 minutes
}

// Request rate-limiting / cooldown trackers
interface ContactRateLimit {
  lastRequestedAt: number;
  requestCount: number;
  windowStart: number;
}

const contactRateLimits = new Map<string, ContactRateLimit>();
const activeOtpRecords = new Map<string, OtpRecord>();
const activeResetSessions = new Map<string, PasswordResetSession>();
const activeAdminSessions = new Map<string, { token: string; createdAt: number; expiresAt: number }>();
const dispatchAuditLog: NotificationDispatch[] = [];

/**
 * Validates strictly that PIN is exactly 6 numeric digits (0-9).
 * Allows any 6 digits (000000, 111111, 123456, etc.).
 * Strictly rejects non-numeric or lengths other than 6 (e.g. 1234, 12345, abcdef).
 */
export function validate6DigitPin(pin: string): { valid: boolean; error?: string } {
  if (typeof pin !== 'string') {
    return { valid: false, error: 'PIN must be a string of 6 numeric digits' };
  }
  const trimmed = pin.trim();
  if (trimmed.length !== 6) {
    return { valid: false, error: 'Administrator PIN must be exactly 6 numeric digits' };
  }
  if (!/^\d{6}$/.test(trimmed)) {
    return { valid: false, error: 'Administrator PIN must contain only numbers (0-9)' };
  }
  if (trimmed === '1234') {
    return { valid: false, error: '1234 is not permitted. PIN must be 6 numeric digits.' };
  }
  return { valid: true };
}

/**
 * Generate cryptographically secure random salt
 */
export function generateSalt(bytes = 16): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Salted hash for 6-digit PIN using PBKDF2 with SHA-512 and 100,000 iterations
 */
export function hashPin(pin: string, salt: string): string {
  return crypto.pbkdf2Sync(pin.trim(), salt, 100000, 64, 'sha512').toString('hex');
}

/**
 * Timing-safe PIN hash verification
 */
export function verifyPin(inputPin: string, salt: string, storedHash: string): boolean {
  if (!inputPin || !salt || !storedHash) return false;
  const computed = hashPin(inputPin, salt);
  try {
    const computedBuf = Buffer.from(computed, 'hex');
    const storedBuf = Buffer.from(storedHash, 'hex');
    if (computedBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(computedBuf, storedBuf);
  } catch {
    return false;
  }
}

/**
 * Generate random 6-digit OTP (e.g. 482913)
 */
export function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hash OTP using PBKDF2 with SHA-256
 */
export function hashOtp(otp: string, salt: string): string {
  return crypto.pbkdf2Sync(otp.trim(), salt, 25000, 32, 'sha256').toString('hex');
}

export function maskContact(contact: string): string {
  const trimmed = contact.trim();
  if (trimmed.includes('@')) {
    const [user, domain] = trimmed.split('@');
    const maskedUser = user.length <= 2 ? user[0] + '***' : user[0] + '***' + user.slice(-1);
    return `${maskedUser}@${domain}`;
  }
  // Phone: e.g. 03338889973 -> 0333****973
  if (trimmed.length >= 10) {
    return `${trimmed.slice(0, 4)}****${trimmed.slice(-3)}`;
  }
  return `${trimmed.slice(0, 2)}****`;
}

/**
 * Check rate limit and 60-second cooldown
 */
export function checkRateLimitAndCooldown(target: string): { allowed: boolean; waitSeconds?: number; error?: string } {
  const normTarget = target.trim().toLowerCase();
  const now = Date.now();
  const existing = contactRateLimits.get(normTarget);

  if (existing) {
    // 60-second cooldown
    const elapsedSinceLast = now - existing.lastRequestedAt;
    if (elapsedSinceLast < 60000) {
      const waitSeconds = Math.ceil((60000 - elapsedSinceLast) / 1000);
      return {
        allowed: false,
        waitSeconds,
        error: `Please wait ${waitSeconds} seconds before requesting a new code.`
      };
    }

    // Window rate limit: Max 5 requests per 15 minutes (900,000 ms)
    if (now - existing.windowStart < 900000) {
      if (existing.requestCount >= 5) {
        return {
          allowed: false,
          error: 'Too many OTP requests. Please wait 15 minutes before trying again.'
        };
      }
      existing.requestCount += 1;
      existing.lastRequestedAt = now;
    } else {
      // Reset window
      existing.windowStart = now;
      existing.requestCount = 1;
      existing.lastRequestedAt = now;
    }
  } else {
    contactRateLimits.set(normTarget, {
      lastRequestedAt: now,
      requestCount: 1,
      windowStart: now
    });
  }

  return { allowed: true };
}

/**
 * Dispatches an OTP via simulated SMS/Email Provider gateway.
 * Records to audit log so administrators and QA tests can view/verify delivered alerts.
 */
export function dispatchOtpNotification(
  target: string,
  otp: string,
  purpose: 'VERIFY_EMAIL' | 'VERIFY_PHONE' | 'RECOVERY'
): NotificationDispatch {
  const isEmail = target.includes('@');
  const channel = isEmail ? 'EMAIL' : 'SMS';
  const masked = maskContact(target);

  const message = purpose === 'RECOVERY'
    ? `Your Darzify verification code is ${otp}. Use this code to recover your Administrator PIN. Valid for 10 minutes. Do not share.`
    : `Your Darzify security verification code is ${otp}. Valid for 10 minutes.`;

  const dispatch: NotificationDispatch = {
    id: 'disp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    timestamp: Date.now(),
    channel,
    recipient: target,
    maskedRecipient: masked,
    message,
    status: 'DELIVERED',
    provider: isEmail ? 'Darzify-Mail-Gateway' : 'SpeedX-SMS-Gateway'
  };

  dispatchAuditLog.unshift(dispatch);
  if (dispatchAuditLog.length > 25) {
    dispatchAuditLog.pop();
  }

  // Non-production logging of dispatch event without leaking raw OTP
  console.log(`[${dispatch.provider}] Dispatched to ${masked} for ${purpose}`);

  return dispatch;
}

/**
 * Creates and stores a secure OTP record (10-minute expiry, max 5 attempts)
 */
export function createOtpSession(
  target: string,
  purpose: 'VERIFY_EMAIL' | 'VERIFY_PHONE' | 'RECOVERY'
): { success: boolean; error?: string; waitSeconds?: number } {
  const rateCheck = checkRateLimitAndCooldown(target);
  if (!rateCheck.allowed) {
    return { success: false, error: rateCheck.error, waitSeconds: rateCheck.waitSeconds };
  }

  const rawOtp = generateOtp();
  const salt = generateSalt(16);
  const otpHash = hashOtp(rawOtp, salt);
  const normTarget = target.trim().toLowerCase();

  const record: OtpRecord = {
    id: 'otp_' + Date.now(),
    target: normTarget,
    purpose,
    otpHash,
    salt,
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    attempts: 0,
    maxAttempts: 5
  };

  activeOtpRecords.set(normTarget, record);

  // Dispatch via SMS/Email provider
  dispatchOtpNotification(target, rawOtp, purpose);

  return { success: true };
}

/**
 * Verifies OTP against stored record
 */
export function verifyOtp(
  target: string,
  inputOtp: string,
  purpose?: 'VERIFY_EMAIL' | 'VERIFY_PHONE' | 'RECOVERY'
): { success: boolean; error?: string } {
  const normTarget = target.trim().toLowerCase();
  const record = activeOtpRecords.get(normTarget);

  if (!record) {
    return { success: false, error: 'No active verification code found for this contact. Please request a new one.' };
  }

  if (Date.now() > record.expiresAt) {
    activeOtpRecords.delete(normTarget);
    return { success: false, error: 'Verification code has expired. Please request a new one.' };
  }

  if (purpose && record.purpose !== purpose) {
    return { success: false, error: 'Invalid verification context.' };
  }

  if (record.attempts >= record.maxAttempts) {
    activeOtpRecords.delete(normTarget);
    return { success: false, error: 'Too many incorrect attempts. This code is now invalidated. Please request a new code.' };
  }

  record.attempts += 1;

  const candidateHash = hashOtp(inputOtp, record.salt);
  const isMatch = candidateHash === record.otpHash;

  if (!isMatch) {
    const remaining = record.maxAttempts - record.attempts;
    return {
      success: false,
      error: `Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
    };
  }

  // OTP verified successfully - consume it immediately
  activeOtpRecords.delete(normTarget);
  return { success: true };
}

/**
 * Creates short-lived reset token after successful recovery OTP
 */
export function createResetToken(target: string): string {
  const token = 'rst_' + crypto.randomBytes(32).toString('hex');
  activeResetSessions.set(token, {
    token,
    target: target.trim().toLowerCase(),
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
  });
  return token;
}

export function validateResetToken(token: string): { valid: boolean; target?: string; error?: string } {
  if (!token) return { valid: false, error: 'Reset token is required' };
  const session = activeResetSessions.get(token);
  if (!session) return { valid: false, error: 'Invalid or expired reset session. Please verify your contact again.' };
  if (Date.now() > session.expiresAt) {
    activeResetSessions.delete(token);
    return { valid: false, error: 'Reset session has expired. Please verify your contact again.' };
  }
  return { valid: true, target: session.target };
}

export function consumeResetToken(token: string): void {
  activeResetSessions.delete(token);
}

/**
 * Authenticated Admin Sessions
 */
export function createAdminSession(): string {
  const token = 'sess_' + crypto.randomBytes(32).toString('hex');
  activeAdminSessions.set(token, {
    token,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  });
  return token;
}

export function validateAdminSession(token: string | undefined): boolean {
  if (!token) return false;
  const session = activeAdminSessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    activeAdminSessions.delete(token);
    return false;
  }
  return true;
}

export function invalidateAllAdminSessions(): void {
  activeAdminSessions.clear();
}

export function getRecentDispatches(): NotificationDispatch[] {
  return [...dispatchAuditLog];
}

interface ContactVerificationToken {
  token: string;
  contact: string;
  type: 'email' | 'phone';
  createdAt: number;
  expiresAt: number; // 15 minutes
}
const activeContactTokens = new Map<string, ContactVerificationToken>();

export function createContactVerificationToken(contact: string, type: 'email' | 'phone'): string {
  const token = 'cvt_' + crypto.randomBytes(24).toString('hex');
  activeContactTokens.set(token, {
    token,
    contact: contact.trim().toLowerCase(),
    type,
    createdAt: Date.now(),
    expiresAt: Date.now() + 15 * 60 * 1000
  });
  return token;
}

export function validateContactVerificationToken(token: string, contact: string, type: 'email' | 'phone'): boolean {
  if (!token) return false;
  const item = activeContactTokens.get(token);
  if (!item) return false;
  if (Date.now() > item.expiresAt) {
    activeContactTokens.delete(token);
    return false;
  }
  return item.contact === contact.trim().toLowerCase() && item.type === type;
}

export function consumeContactVerificationToken(token: string): void {
  activeContactTokens.delete(token);
}
