import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadStore,
  getAdminAccount,
  updateAdminAccount,
  getOnlineOrders,
  getOnlineCustomers,
  getOnlineShopProfile,
  saveOnlineOrder,
  deleteOnlineOrder,
  saveOnlineCustomer,
  updateOnlineShopProfile,
  recordMigration,
  getMigrationStatus
} from './src/server/storage.js';
import {
  validate6DigitPin,
  generateSalt,
  hashPin,
  verifyPin,
  createOtpSession,
  verifyOtp,
  createResetToken,
  validateResetToken,
  consumeResetToken,
  createAdminSession,
  validateAdminSession,
  invalidateAllAdminSessions,
  getRecentDispatches,
  maskContact,
  createContactVerificationToken,
  validateContactVerificationToken,
  consumeContactVerificationToken
} from './src/server/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createApp({ serveFrontend = true }: { serveFrontend?: boolean } = {}) {
  loadStore();
  const app = express();

  app.use(express.json({ limit: '15mb' }));

  // Helper auth validator for protected routes
  function authorizeAdmin(req: Request): boolean {
    const sessionToken = req.headers['x-admin-session'] as string | undefined;
    if (sessionToken && validateAdminSession(sessionToken)) return true;

    const authPin = req.headers['x-admin-pin'] as string | undefined || req.body?.currentPin;
    if (authPin) {
      const admin = getAdminAccount();
      return verifyPin(authPin, admin.pinSalt, admin.pinHash);
    }
    return false;
  }

  // --- ADMIN SECURITY & AUTHENTICATION API ---

  // 1. Get Admin Security Status
  app.get('/api/admin/status', (_req: Request, res: Response) => {
    const admin = getAdminAccount();
    const isInit = Boolean(admin.isInitialized && admin.pinHash);
    res.json({
      success: true,
      isOnline: true,
      isInitialized: isInit,
      isConfigured: isInit,
      hasRecoveryEmail: Boolean(admin.recoveryEmail && admin.isEmailVerified),
      recoveryEmail: admin.recoveryEmail && admin.isEmailVerified ? maskContact(admin.recoveryEmail) : null,
      rawRecoveryEmail: admin.recoveryEmail,
      isEmailVerified: Boolean(admin.isEmailVerified),
      hasRecoveryPhone: Boolean(admin.recoveryPhone && admin.isPhoneVerified),
      recoveryPhone: admin.recoveryPhone && admin.isPhoneVerified ? maskContact(admin.recoveryPhone) : null,
      rawRecoveryPhone: admin.recoveryPhone,
      isPhoneVerified: Boolean(admin.isPhoneVerified),
      updatedAt: admin.updatedAt
    });
  });

  // 1B. Request OTP during Initial Administrator Setup
  app.post('/api/admin/initial-setup/request-otp', (req: Request, res: Response) => {
    const { type, contact } = req.body;
    if (!contact || typeof contact !== 'string') {
      res.status(400).json({ success: false, error: 'Valid contact address or phone number is required.' });
      return;
    }

    const trimmed = contact.trim();
    if (type === 'email') {
      if (!trimmed.includes('@') || !trimmed.includes('.')) {
        res.status(400).json({ success: false, error: 'Invalid email address format.' });
        return;
      }
    } else if (type === 'phone') {
      if (!/^03\d{9}$/.test(trimmed)) {
        res.status(400).json({
          success: false,
          error: 'Phone number must be a valid 11-digit mobile number starting with 03 (e.g. 03426454541).'
        });
        return;
      }
    } else {
      res.status(400).json({ success: false, error: 'Type must be email or phone.' });
      return;
    }

    const purpose = type === 'email' ? 'VERIFY_EMAIL' : 'VERIFY_PHONE';
    const otpRes = createOtpSession(trimmed, purpose);
    if (!otpRes.success) {
      res.status(429).json({ success: false, error: otpRes.error, waitSeconds: otpRes.waitSeconds });
      return;
    }

    res.json({
      success: true,
      message: `Verification code sent to ${maskContact(trimmed)} via ${type === 'email' ? 'email' : 'SMS provider'}.`,
      cooldownSeconds: 60
    });
  });

  // 1C. Verify OTP during Initial Administrator Setup
  app.post('/api/admin/initial-setup/verify-otp', (req: Request, res: Response) => {
    const { type, contact, otp } = req.body;
    if (!contact || !otp) {
      res.status(400).json({ success: false, error: 'Contact and OTP are required.' });
      return;
    }

    const purpose = type === 'email' ? 'VERIFY_EMAIL' : 'VERIFY_PHONE';
    const verifyRes = verifyOtp(contact, otp, purpose);
    if (!verifyRes.success) {
      res.status(400).json({ success: false, error: verifyRes.error });
      return;
    }

    const token = createContactVerificationToken(contact, type);
    res.json({
      success: true,
      message: `${type === 'email' ? 'Email' : 'Phone'} verified successfully!`,
      verificationToken: token,
      contact: contact.trim(),
      type
    });
  });

  // 1D. Finalize Initial Administrator Setup
  app.post('/api/admin/initial-setup', (req: Request, res: Response) => {
    const { newPin, confirmPin, verifiedContacts } = req.body;

    const val = validate6DigitPin(newPin);
    if (!val.valid) {
      res.status(400).json({ success: false, error: val.error });
      return;
    }

    if (newPin !== confirmPin) {
      res.status(400).json({ success: false, error: 'New PIN and confirm PIN do not match.' });
      return;
    }

    if (!Array.isArray(verifiedContacts) || verifiedContacts.length === 0) {
      res.status(400).json({
        success: false,
        error: 'At least one verified recovery contact (email or phone) is required.'
      });
      return;
    }

    let emailToSave: string | null = null;
    let phoneToSave: string | null = null;

    for (const vc of verifiedContacts) {
      const isValid = validateContactVerificationToken(vc.token, vc.contact, vc.type);
      if (!isValid) {
        res.status(400).json({
          success: false,
          error: `Verification for ${vc.contact} is invalid or expired. Please verify again.`
        });
        return;
      }
      if (vc.type === 'email') emailToSave = vc.contact.trim();
      if (vc.type === 'phone') phoneToSave = vc.contact.trim();
      consumeContactVerificationToken(vc.token);
    }

    if (!emailToSave && !phoneToSave) {
      res.status(400).json({
        success: false,
        error: 'Please verify at least one recovery contact before completing setup.'
      });
      return;
    }

    const newSalt = generateSalt(16);
    const newHash = hashPin(newPin, newSalt);

    updateAdminAccount({
      isInitialized: true,
      pinSalt: newSalt,
      pinHash: newHash,
      recoveryEmail: emailToSave,
      isEmailVerified: !!emailToSave,
      recoveryPhone: phoneToSave,
      isPhoneVerified: !!phoneToSave
    });

    invalidateAllAdminSessions();
    const sessionToken = createAdminSession();

    res.json({
      success: true,
      message: 'Administrator PIN successfully initialized! You are now authenticated.',
      sessionToken
    });
  });

  // 2. Verify 6-digit Administrator PIN
  app.post('/api/admin/verify-pin', (req: Request, res: Response) => {
    const { pin } = req.body;
    if (!pin) {
      res.status(400).json({ success: false, error: 'PIN is required' });
      return;
    }

    const admin = getAdminAccount();
    if (!admin.isInitialized || !admin.pinHash) {
      res.status(403).json({
        success: false,
        isInitialized: false,
        error: 'Administrator PIN has not been initialized. Please complete initial setup.'
      });
      return;
    }

    const valCheck = validate6DigitPin(pin);
    if (!valCheck.valid) {
      res.status(400).json({ success: false, error: valCheck.error });
      return;
    }

    const isCorrect = verifyPin(pin, admin.pinSalt, admin.pinHash);

    if (!isCorrect) {
      res.status(401).json({ success: false, error: 'Incorrect 6-digit Administrator PIN. Please try again.' });
      return;
    }

    const sessionToken = createAdminSession();
    res.json({
      success: true,
      message: 'Administrator PIN verified',
      sessionToken
    });
  });

  // 3. Change Administrator PIN
  app.post('/api/admin/change-pin', (req: Request, res: Response) => {
    const { currentPin, sessionToken, newPin, confirmPin } = req.body;

    const isAuthorized =
      (sessionToken && validateAdminSession(sessionToken)) ||
      (currentPin && verifyPin(currentPin, getAdminAccount().pinSalt, getAdminAccount().pinHash));

    if (!isAuthorized) {
      res.status(401).json({ success: false, error: 'Unauthorized: Current PIN or active session required.' });
      return;
    }

    const val = validate6DigitPin(newPin);
    if (!val.valid) {
      res.status(400).json({ success: false, error: val.error });
      return;
    }

    if (newPin !== confirmPin) {
      res.status(400).json({ success: false, error: 'New PIN and confirm PIN do not match.' });
      return;
    }

    const newSalt = generateSalt(16);
    const newHash = hashPin(newPin, newSalt);

    updateAdminAccount({
      pinSalt: newSalt,
      pinHash: newHash
    });

    invalidateAllAdminSessions();
    const freshSession = createAdminSession();

    res.json({
      success: true,
      message: 'Administrator PIN changed successfully. Old PIN is now inactive.',
      sessionToken: freshSession
    });
  });

  // 4. Request OTP for Recovery Contact (Email or Phone setup/change)
  app.post('/api/admin/recovery-contact/request-otp', (req: Request, res: Response) => {
    const { type, contact } = req.body;

    if (!authorizeAdmin(req)) {
      res.status(401).json({ success: false, error: 'Unauthorized: Authenticated admin session or PIN required to configure recovery.' });
      return;
    }

    if (!contact || typeof contact !== 'string') {
      res.status(400).json({ success: false, error: 'Valid contact address or phone number is required.' });
      return;
    }

    const trimmed = contact.trim();
    if (type === 'email') {
      if (!trimmed.includes('@') || !trimmed.includes('.')) {
        res.status(400).json({ success: false, error: 'Invalid email address format.' });
        return;
      }
    } else if (type === 'phone') {
      if (!/^03\d{9}$/.test(trimmed) && trimmed.replace(/\D/g, '').length < 10) {
        res.status(400).json({ success: false, error: 'Phone number must be a valid 11-digit mobile number starting with 03 (e.g. 03338889973).' });
        return;
      }
    } else {
      res.status(400).json({ success: false, error: 'Type must be email or phone.' });
      return;
    }

    const purpose = type === 'email' ? 'VERIFY_EMAIL' : 'VERIFY_PHONE';
    const otpRes = createOtpSession(trimmed, purpose);

    if (!otpRes.success) {
      res.status(429).json({ success: false, error: otpRes.error, waitSeconds: otpRes.waitSeconds });
      return;
    }

    res.json({
      success: true,
      message: `Verification code sent to ${maskContact(trimmed)} via ${type === 'email' ? 'email' : 'SMS provider'}.`,
      cooldownSeconds: 60
    });
  });

  // 5. Verify OTP and Save Recovery Contact
  app.post('/api/admin/recovery-contact/verify-otp', (req: Request, res: Response) => {
    const { type, contact, otp } = req.body;

    if (!authorizeAdmin(req)) {
      res.status(401).json({ success: false, error: 'Unauthorized admin session.' });
      return;
    }

    if (!contact || !otp) {
      res.status(400).json({ success: false, error: 'Contact and OTP are required.' });
      return;
    }

    const purpose = type === 'email' ? 'VERIFY_EMAIL' : 'VERIFY_PHONE';
    const verifyRes = verifyOtp(contact, otp, purpose);

    if (!verifyRes.success) {
      res.status(400).json({ success: false, error: verifyRes.error });
      return;
    }

    const trimmed = contact.trim();
    if (type === 'email') {
      updateAdminAccount({
        recoveryEmail: trimmed,
        isEmailVerified: true
      });
    } else {
      updateAdminAccount({
        recoveryPhone: trimmed,
        isPhoneVerified: true
      });
    }

    res.json({
      success: true,
      message: `${type === 'email' ? 'Recovery email' : 'Recovery phone number'} successfully verified and activated!`
    });
  });

  // 6. Remove a recovery contact (if both configured)
  app.post('/api/admin/recovery-contact/remove', (req: Request, res: Response) => {
    const { type } = req.body;

    if (!authorizeAdmin(req)) {
      res.status(401).json({ success: false, error: 'Unauthorized admin session.' });
      return;
    }

    const admin = getAdminAccount();
    if (type === 'email') {
      updateAdminAccount({ recoveryEmail: null, isEmailVerified: false });
    } else {
      updateAdminAccount({ recoveryPhone: null, isPhoneVerified: false });
    }

    res.json({ success: true, message: 'Recovery contact removed.' });
  });

  // 7. Forgot PIN Step 1: Identify Account via verified contact
  app.post('/api/admin/forgot-pin/identify', (req: Request, res: Response) => {
    const { contact } = req.body;
    if (!contact || typeof contact !== 'string') {
      res.status(400).json({ success: false, error: 'Please enter your recovery email or phone number.' });
      return;
    }

    const trimmed = contact.trim().toLowerCase();
    const admin = getAdminAccount();

    const emailMatch = admin.recoveryEmail && admin.isEmailVerified && admin.recoveryEmail.toLowerCase() === trimmed;
    const phoneNorm = trimmed.replace(/\D/g, '');
    const adminPhoneNorm = admin.recoveryPhone ? admin.recoveryPhone.replace(/\D/g, '') : '';
    const phoneMatch = admin.recoveryPhone && admin.isPhoneVerified && adminPhoneNorm === phoneNorm;

    if (!emailMatch && !phoneMatch) {
      res.status(404).json({
        success: false,
        error: 'No verified recovery email or phone number matches this entry. Please verify your contact information.'
      });
      return;
    }

    const matchedContact = emailMatch ? admin.recoveryEmail! : admin.recoveryPhone!;
    const contactType = emailMatch ? 'email' : 'phone';

    res.json({
      success: true,
      contactType,
      maskedContact: maskContact(matchedContact),
      contact: matchedContact
    });
  });

  // 8. Forgot PIN Step 2: Send OTP to verified contact
  app.post('/api/admin/forgot-pin/send-otp', (req: Request, res: Response) => {
    const { contact } = req.body;
    if (!contact) {
      res.status(400).json({ success: false, error: 'Contact is required.' });
      return;
    }

    const trimmed = contact.trim().toLowerCase();
    const admin = getAdminAccount();
    const emailMatch = admin.recoveryEmail && admin.isEmailVerified && admin.recoveryEmail.toLowerCase() === trimmed;
    const phoneNorm = trimmed.replace(/\D/g, '');
    const adminPhoneNorm = admin.recoveryPhone ? admin.recoveryPhone.replace(/\D/g, '') : '';
    const phoneMatch = admin.recoveryPhone && admin.isPhoneVerified && adminPhoneNorm === phoneNorm;

    if (!emailMatch && !phoneMatch) {
      res.status(403).json({ success: false, error: 'Recovery contact is not verified on this administrator account.' });
      return;
    }

    const target = emailMatch ? admin.recoveryEmail! : admin.recoveryPhone!;
    const otpRes = createOtpSession(target, 'RECOVERY');

    if (!otpRes.success) {
      res.status(429).json({ success: false, error: otpRes.error, waitSeconds: otpRes.waitSeconds });
      return;
    }

    res.json({
      success: true,
      message: `Darzify verification code sent to ${maskContact(target)}.`,
      cooldownSeconds: 60
    });
  });

  // 9. Forgot PIN Step 3: Verify OTP for PIN Recovery
  app.post('/api/admin/forgot-pin/verify-otp', (req: Request, res: Response) => {
    const { contact, otp } = req.body;
    if (!contact || !otp) {
      res.status(400).json({ success: false, error: 'Contact and OTP code are required.' });
      return;
    }

    const verifyRes = verifyOtp(contact, otp, 'RECOVERY');
    if (!verifyRes.success) {
      res.status(400).json({ success: false, error: verifyRes.error });
      return;
    }

    const resetToken = createResetToken(contact);
    res.json({
      success: true,
      message: 'Verification successful. You may now create a new 6-digit Administrator PIN.',
      resetToken
    });
  });

  // 10. Forgot PIN Step 4: Create New Administrator PIN
  app.post('/api/admin/forgot-pin/reset-pin', (req: Request, res: Response) => {
    const { resetToken, newPin, confirmPin } = req.body;

    const tokenValidation = validateResetToken(resetToken);
    if (!tokenValidation.valid) {
      res.status(401).json({ success: false, error: tokenValidation.error });
      return;
    }

    const val = validate6DigitPin(newPin);
    if (!val.valid) {
      res.status(400).json({ success: false, error: val.error });
      return;
    }

    if (newPin !== confirmPin) {
      res.status(400).json({ success: false, error: 'New PIN and confirm PIN do not match.' });
      return;
    }

    // Hash with fresh salt
    const newSalt = generateSalt(16);
    const newHash = hashPin(newPin, newSalt);

    updateAdminAccount({
      pinSalt: newSalt,
      pinHash: newHash
    });

    consumeResetToken(resetToken);
    invalidateAllAdminSessions();

    res.json({
      success: true,
      message: 'New 6-digit Administrator PIN configured successfully. Old PIN is permanently disabled.'
    });
  });

  // 11. Provider Dispatch Audit Log (for simulator/preview/testing)
  app.get('/api/admin/dispatches', (_req: Request, res: Response) => {
    res.json({
      success: true,
      dispatches: getRecentDispatches()
    });
  });

  // --- ONLINE DATA PERSISTENCE & MIGRATION API ---

  // 12. Migration and Sync Status
  app.get('/api/sync/status', (_req: Request, res: Response) => {
    res.json({
      success: true,
      isOnline: true,
      migrationStatus: getMigrationStatus(),
      counts: {
        orders: getOnlineOrders().length,
        customers: getOnlineCustomers().length
      }
    });
  });

  // 13. Safe Migration from local IndexedDB to Online Server
  app.post('/api/sync/migrate', (req: Request, res: Response) => {
    const { orders, customers, shopProfile } = req.body;
    recordMigration(orders || [], customers || [], shopProfile);
    res.json({
      success: true,
      message: 'Local data safely synchronized and persisted to online Darzify database.',
      migrationStatus: getMigrationStatus(),
      counts: {
        orders: getOnlineOrders().length,
        customers: getOnlineCustomers().length
      }
    });
  });

  // 14. Online Orders CRUD
  app.get('/api/orders', (_req: Request, res: Response) => {
    res.json({ success: true, orders: getOnlineOrders() });
  });

  app.post('/api/orders', (req: Request, res: Response) => {
    const order = req.body;
    if (!order || !order.id) {
      res.status(400).json({ success: false, error: 'Invalid order data' });
      return;
    }
    const saved = saveOnlineOrder(order);
    res.json({ success: true, order: saved });
  });

  app.delete('/api/orders/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    if (!authorizeAdmin(req)) {
      res.status(401).json({ success: false, error: 'Admin PIN required to delete booking.' });
      return;
    }
    const deleted = deleteOnlineOrder(id);
    res.json({ success: deleted });
  });

  // 15. Online Customers
  app.get('/api/customers', (_req: Request, res: Response) => {
    res.json({ success: true, customers: getOnlineCustomers() });
  });

  app.post('/api/customers', (req: Request, res: Response) => {
    const customer = req.body;
    if (!customer || !customer.id) {
      res.status(400).json({ success: false, error: 'Invalid customer data' });
      return;
    }
    const saved = saveOnlineCustomer(customer);
    res.json({ success: true, customer: saved });
  });

  // 16. Online Shop Profile
  app.get('/api/shop-profile', (_req: Request, res: Response) => {
    res.json({ success: true, shopProfile: getOnlineShopProfile() });
  });

  app.put('/api/shop-profile', (req: Request, res: Response) => {
    const profile = req.body;
    if (!authorizeAdmin(req)) {
      res.status(401).json({ success: false, error: 'Admin authorization required' });
      return;
    }
    const updated = updateOnlineShopProfile(profile);
    res.json({ success: true, shopProfile: updated });
  });

  // 17. Dev / Testing Endpoints for QA & Onboarding Reset (Isolated to Development)
  app.post('/api/admin/dev-seed', (_req: Request, res: Response) => {
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({ success: false, error: 'Dev seed endpoint is strictly disabled in production.' });
      return;
    }
    const salt = generateSalt(16);
    const hash = hashPin('000000', salt);
    updateAdminAccount({
      isInitialized: true,
      pinSalt: salt,
      pinHash: hash,
      recoveryEmail: 'admin@darzify.pk',
      isEmailVerified: true,
      recoveryPhone: '03338889973',
      isPhoneVerified: true
    });
    res.json({ success: true, message: 'Admin seeded with PIN 000000, recovery email and phone.' });
  });

  app.post('/api/admin/dev-reset', (_req: Request, res: Response) => {
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({ success: false, error: 'Dev reset endpoint is strictly disabled in production.' });
      return;
    }
    updateAdminAccount({
      isInitialized: false,
      pinSalt: '',
      pinHash: '',
      recoveryEmail: null,
      isEmailVerified: false,
      recoveryPhone: null,
      isPhoneVerified: false
    });
    invalidateAllAdminSessions();
    res.json({ success: true, message: 'Admin reset to uninitialized state.' });
  });

  // --- VITE MIDDLEWARE / STATIC ASSETS ---
  if (serveFrontend) {
    if (process.env.NODE_ENV === 'production') {
      app.use(express.static(path.resolve(__dirname, 'dist')));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
      });
    } else {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa'
      });
      app.use(vite.middlewares);
    }
  }

  return app;
}

async function startServer() {
  const app = await createApp();
  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Darzify Online POS] Server running on http://0.0.0.0:${PORT}`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer().catch(err => {
    console.error('[Darzify Server] Failed to initialize:', err);
    process.exit(1);
  });
}
