import jsPDF from 'jspdf';
import { Order, ShopProfile, Language } from '../types';
import { renderTicketToCanvas } from './ticketRenderer';
import { ReceiptSecurityService } from './receiptSecurityService';

export class PdfService {
  /**
   * Generates a high-resolution, tamper-evident PDF document representing the customer receipt.
   * Renders the finalized canvas into a non-editable raster image stream (no editable form fields).
   * File name convention: [Shop_Name] - parchi-[Slip_Number].pdf
   */
  public static async generateCustomerReceiptPdf(
    order: Order,
    shop: ShopProfile,
    lang: Language = 'ur'
  ): Promise<{ doc: jsPDF; filename: string; blob: Blob }> {
    // Ensure order has verification code and cryptographic hash
    let secureOrder = order;
    if (!secureOrder.verificationCode || !secureOrder.tamperHash) {
      secureOrder = await ReceiptSecurityService.ensureOrderSecurity(order);
    }

    // Render high-fidelity canvas with verification code
    const canvas = renderTicketToCanvas(secureOrder, shop, 'CUSTOMER', lang);
    const imgData = canvas.toDataURL('image/png');

    // Create jsPDF document matching the exact 58mm width ratio
    const widthMm = 58;
    const heightMm = (canvas.height * widthMm) / canvas.width;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [widthMm, heightMm]
    });

    // Embed authoritative verification metadata
    doc.setProperties({
      title: `${shop.shopName} - parchi-${secureOrder.slipNumber}`,
      subject: `Tailoring Customer Receipt - Verification Code: ${secureOrder.verificationCode}`,
      creator: 'Darzify Secure Receipt Engine',
      author: 'Darzify',
      keywords: `VerificationCode:${secureOrder.verificationCode}, SlipNumber:${secureOrder.slipNumber}, TamperHash:${secureOrder.tamperHash}`
    });

    // Embed raster content - no editable form fields exist
    doc.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm);

    // Clean filename: e.g. "Darzify - parchi-1.pdf"
    const safeShopName = shop.shopName.replace(/[/\\?%*:|"<>]/g, '').trim() || 'Darzify';
    const filename = `${safeShopName} - parchi-${secureOrder.slipNumber}.pdf`;

    const blob = doc.output('blob');

    return { doc, filename, blob };
  }

  /**
   * Shares the generated PDF via native Android Share Sheet (targeting WhatsApp)
   * or triggers browser download if Web Share is not supported.
   */
  public static async shareOrDownloadPdf(
    order: Order,
    shop: ShopProfile,
    lang: Language = 'ur'
  ): Promise<{ shared: boolean; method: 'share' | 'download' }> {
    const { doc, filename, blob } = await this.generateCustomerReceiptPdf(order, shop, lang);

    const file = new File([blob], filename, { type: 'application/pdf' });

    // Check if Web Share API with files is supported (e.g. Android Chrome / Mobile)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: filename,
          text: `${shop.shopName} - پرچی نمبر ${order.slipNumber} (${order.customerName}) [Verification: ${order.verificationCode || 'DZ-' + order.slipNumber}]`
        });
        return { shared: true, method: 'share' };
      } catch (err: unknown) {
        // User cancelled or share failed, fallback to download
        console.log('Share dismissed, triggering download fallback', err);
      }
    }

    // Direct download fallback
    doc.save(filename);
    return { shared: true, method: 'download' };
  }

  /**
   * Generates a direct WhatsApp link with order receipt summary text and verification code
   */
  public static getWhatsAppDirectUrl(order: Order, shop: ShopProfile): string {
    const cleanPhone = order.customerPhone.replace(/[^0-9]/g, '');
    // Pakistani numbers starting with 03xx converted to 923xx for international WhatsApp link
    let intlPhone = cleanPhone;
    if (intlPhone.startsWith('03')) {
      intlPhone = '92' + intlPhone.slice(1);
    }

    const vCode = order.verificationCode || `DZ-${order.slipNumber}`;
    const message = `السلام علیکم ${order.customerName} صاحب!\nآپ کا آرڈر *${shop.shopName}* میں بک ہو چکا ہے۔\n\n📄 *پرچی نمبر:* ${order.slipNumber}\n🔒 *تصدیقی کوڈ:* ${vCode}\n📅 *تاریخ واپسی:* ${order.returnDate}\n💵 *کل رقم:* Rs. ${order.totalAmount.toLocaleString()}\n✅ *وصول (ایڈوانس):* Rs. ${order.advanceAmount.toLocaleString()}\n🔴 *بقایا رقم:* Rs. ${order.balanceAmount.toLocaleString()}\n\nشکریہ!\n${shop.shopName}\nرابطہ: ${shop.phone}`;

    return `https://wa.me/${intlPhone}?text=${encodeURIComponent(message)}`;
  }
}
