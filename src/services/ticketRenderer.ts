import { Order, ShopProfile, TicketType, Language } from '../types';
import { translations } from '../i18n/translations';

/**
 * High-performance 2D Canvas renderer that creates 58mm (384px) thermal tickets
 * with flawless Urdu Nastaliq/Naskh typography and crisp line work.
 */
export function renderTicketToCanvas(
  order: Order,
  shop: ShopProfile,
  ticketType: TicketType,
  lang: Language = 'ur'
): HTMLCanvasElement {
  const t = translations[lang];
  const width = 384; // Standard 58mm thermal printer dot width
  
  // Calculate dynamic height based on content
  let estimatedHeight = 520;
  if (ticketType === 'CUSTOMER') estimatedHeight = 780;
  if (ticketType === 'KARIGAR') estimatedHeight = 850;
  if (ticketType === 'FABRIC_TAG') estimatedHeight = 320;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = estimatedHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Pure white thermal background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, estimatedHeight);

  // Setup crisp black rendering
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;

  let y = 25;
  const isRtl = lang === 'ur';
  const fontUrdu = "'Noto Sans Arabic', 'Noto Nastaliq Urdu', Arial, sans-serif";
  const fontMono = "'JetBrains Mono', monospace";

  // Helper drawing functions
  const drawDivider = (dashed = false) => {
    ctx.save();
    if (dashed) ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(12, y);
    ctx.lineTo(width - 12, y);
    ctx.stroke();
    ctx.restore();
    y += 18;
  };

  const drawCenteredText = (text: string, font: string, isBold = false) => {
    ctx.font = `${isBold ? 'bold ' : ''}${font}`;
    ctx.textAlign = 'center';
    ctx.fillText(text, width / 2, y);
    y += parseInt(font, 10) * 1.35;
  };

  const drawRow = (leftText: string, rightText: string, font: string, isBold = false) => {
    ctx.font = `${isBold ? 'bold ' : ''}${font}`;
    if (isRtl) {
      // In RTL: right side is label, left side is value
      ctx.textAlign = 'right';
      ctx.fillText(rightText, width - 18, y);
      ctx.textAlign = 'left';
      ctx.fillText(leftText, 18, y);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(leftText, 18, y);
      ctx.textAlign = 'right';
      ctx.fillText(rightText, width - 18, y);
    }
    y += parseInt(font, 10) * 1.4;
  };

  // --- 1. FABRIC TAG TICKET ---
  if (ticketType === 'FABRIC_TAG') {
    y = 35;
    // Header Tag Number: e.g. "1  1/1"
    drawCenteredText(`${order.slipNumber}  1/${order.items.length}`, '36px ' + fontMono, true);
    y += 8;
    drawCenteredText(order.customerName, '24px ' + fontUrdu, true);
    y += 6;

    const firstItem = order.items[0];
    const garmentName = firstItem ? t[firstItem.garmentType] || firstItem.garmentType : '';
    const recipient = firstItem?.recipientTag ? ` - ${firstItem.recipientTag}` : '';
    drawCenteredText(`${garmentName}${recipient}`, '18px ' + fontUrdu);
    y += 8;

    drawCenteredText(`${order.returnDate}`, '22px ' + fontMono, true);
    drawCenteredText(t.tagNotice, '15px ' + fontUrdu);
    y += 12;

    drawDivider(true);
    drawCenteredText('✂ [ PIN / STAPLE ON CLOTH ROLL ]', '11px ' + fontMono);
    
    // Trim canvas to actual height
    return cropCanvas(canvas, y + 20);
  }

  // --- 2. CUSTOMER RECEIPT ---
  if (ticketType === 'CUSTOMER') {
    // Shop Branding Header
    drawCenteredText(shop.shopName, '26px ' + fontUrdu, true);
    
    // Address (auto wrapped)
    ctx.font = '12px ' + fontUrdu;
    ctx.textAlign = 'center';
    wrapText(ctx, shop.address, width / 2, y, width - 36, 17);
    y += 36;

    drawCenteredText(shop.phone, '15px ' + fontMono, true);
    y += 4;
    drawDivider();

    // Slip Number
    drawCenteredText(`${t.slipNo} ${order.slipNumber}`, '24px ' + fontUrdu, true);
    drawDivider();

    // Customer & Dates Info
    drawRow(t.customerName + ':', order.customerName, '15px ' + fontUrdu);
    drawRow(t.customerPhone + ':', order.customerPhone, '14px ' + fontMono);
    drawRow(t.bookingDate + ':', order.bookingDate, '14px ' + fontMono);
    drawRow(t.returnDate + ':', order.returnDate, '15px ' + fontMono, true);
    drawDivider();

    // Items list
    order.items.forEach((item, index) => {
      const gName = t[item.garmentType] || item.garmentType;
      const rTag = item.recipientTag ? ` - ${item.recipientTag}` : '';
      drawRow(`${gName}${rTag}`, `x ${item.quantity}`, '15px ' + fontUrdu, true);
      drawRow(`${t.ratePerSuit}:`, `Rs. ${item.unitRate.toLocaleString()}`, '14px ' + fontMono);
      if (index < order.items.length - 1) drawDivider(true);
    });
    drawDivider();

    // Financials
    drawRow(t.totalAmount + ':', `Rs. ${order.totalAmount.toLocaleString()}`, '16px ' + fontMono, true);
    drawRow(t.advance + ':', `Rs. ${order.advanceAmount.toLocaleString()}`, '15px ' + fontMono);
    y += 2;
    drawRow(t.balance + ':', `Rs. ${order.balanceAmount.toLocaleString()}`, '18px ' + fontMono, true);
    drawDivider();

    // Verification Code Box (Secure & Tamper-Evident)
    const vCode = order.verificationCode || `DZ-${order.slipNumber}`;
    drawCenteredText(`[ ${t.verificationCode || 'Verification Code'} ]`, '11px ' + fontMono, true);
    y += 2;
    drawCenteredText(vCode, '20px ' + fontMono, true);
    y += 3;
    drawCenteredText(t.verifyAtNotice || 'Verify receipt authenticity in Darzify', '11px ' + fontUrdu);
    y += 2;
    drawDivider();

    // Special customer urgency note if present
    if (order.specialInstructions) {
      ctx.font = '12px ' + fontUrdu;
      ctx.textAlign = isRtl ? 'right' : 'left';
      wrapText(ctx, order.specialInstructions, isRtl ? width - 20 : 20, y, width - 40, 18);
      y += 36;
      drawDivider(true);
    }

    // Footer Disclaimer
    drawCenteredText(shop.disclaimer || t.receiptFooter, '13px ' + fontUrdu, true);
    y += 10;

    return cropCanvas(canvas, y + 25);
  }

  // --- 3. KARIGAR / WORKSHOP SLIP ---
  if (ticketType === 'KARIGAR') {
    // Header (Zero Financial Data)
    drawCenteredText(`${t.karigarSlip} : ${order.slipNumber}`, '24px ' + fontUrdu, true);
    drawDivider();

    drawRow(t.customerName + ':', order.customerName, '16px ' + fontUrdu, true);
    drawRow(t.returnDate + ':', order.returnDate, '16px ' + fontMono, true);

    const firstItem = order.items[0];
    const gName = firstItem ? t[firstItem.garmentType] || firstItem.garmentType : '';
    const rTag = firstItem?.recipientTag ? ` - ${firstItem.recipientTag}` : '';
    drawRow(`${gName}${rTag}`, `x ${firstItem?.quantity || 1}`, '15px ' + fontUrdu, true);
    drawDivider();

    // Two-column measurement table
    drawCenteredText(`-- ${t.measurements} --`, '14px ' + fontUrdu, true);
    y += 6;

    const m = firstItem?.measurements || {};
    const measureList: Array<{ label: string; val: number | undefined }> = [
      { label: t.lambai, val: m.lambai },
      { label: t.asteen, val: m.asteen },
      { label: t.teera, val: m.teera },
      { label: t.collar, val: m.collar },
      { label: t.chaati, val: m.chaati },
      { label: t.kamar, val: m.kamar },
      { label: t.ghera, val: m.ghera },
      { label: t.shalwarLambai, val: m.shalwarLambai },
      { label: t.paicha, val: m.paicha },
      { label: t.cuffWidth, val: m.cuffWidth },
      { label: t.pattiWidth, val: m.pattiWidth }
    ].filter(item => item.val !== undefined && item.val !== null);

    // Render pairs in two columns
    for (let i = 0; i < measureList.length; i += 2) {
      const left = measureList[i];
      const right = measureList[i + 1];

      ctx.font = '14px ' + fontUrdu;
      
      // Col 1 (left side)
      if (left) {
        ctx.textAlign = 'left';
        ctx.fillText(`${left.label}: ${left.val}`, 20, y);
      }
      // Col 2 (right side)
      if (right) {
        ctx.textAlign = 'right';
        ctx.fillText(`${right.label}: ${right.val}`, width - 20, y);
      }
      y += 24;
    }

    drawDivider();

    // Design Specs Line
    if (firstItem?.design) {
      drawCenteredText(`-- ${t.design} --`, '14px ' + fontUrdu, true);
      y += 4;

      const d = firstItem.design;
      const designTokens: string[] = [];
      if (d.collarStyle) designTokens.push(t[`style_${d.collarStyle}` as keyof typeof t] || d.collarStyle);
      if (d.cuffStyle) designTokens.push(t[`style_${d.cuffStyle}` as keyof typeof t] || d.cuffStyle);
      if (d.damanStyle) designTokens.push(t[`style_DAMAN_${d.damanStyle}` as keyof typeof t] || d.damanStyle);
      d.pockets.forEach(p => designTokens.push(t[`pocket_${p}` as keyof typeof t] || p));
      d.extras.forEach(e => designTokens.push(t[`extra_${e}` as keyof typeof t] || e));

      const designSummary = designTokens.join(' ، ');
      ctx.font = '13px ' + fontUrdu;
      ctx.textAlign = 'center';
      wrapText(ctx, designSummary, width / 2, y, width - 36, 20);
      y += 42;
      drawDivider();
    }

    // Special Urgency / Event Remarks
    if (order.specialInstructions) {
      drawCenteredText(`-- ${t.specialInstructions} --`, '13px ' + fontUrdu, true);
      ctx.font = '12px ' + fontUrdu;
      ctx.textAlign = isRtl ? 'right' : 'left';
      wrapText(ctx, order.specialInstructions, isRtl ? width - 20 : 20, y, width - 40, 18);
      y += 40;
      drawDivider(true);
    }

    // Master Tailor Fitting Notes
    if (order.tailoringNotes) {
      drawCenteredText(`-- ${t.tailoringNotes} --`, '13px ' + fontUrdu, true);
      ctx.font = '12px ' + fontUrdu;
      ctx.textAlign = isRtl ? 'right' : 'left';
      wrapText(ctx, order.tailoringNotes, isRtl ? width - 20 : 20, y, width - 40, 18);
      y += 48;
    }

    y += 10;
    return cropCanvas(canvas, y + 25);
  }

  return canvas;
}

/**
 * Text wrapper for 2D Canvas
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
}

/**
 * Cleanly crop canvas to actual used height
 */
function cropCanvas(originalCanvas: HTMLCanvasElement, targetHeight: number): HTMLCanvasElement {
  const cropped = document.createElement('canvas');
  cropped.width = originalCanvas.width;
  cropped.height = Math.max(100, Math.min(targetHeight, 1800));
  const ctx = cropped.getContext('2d');
  if (ctx) {
    ctx.drawImage(originalCanvas, 0, 0);
  }
  return cropped;
}
