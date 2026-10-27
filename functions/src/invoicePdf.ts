import PDFDocument from "pdfkit";

export interface InvoiceDetails {
  invoiceNumber: string;
  invoiceDate: string;
  status: "PAID" | "TRIAL ACTIVE" | "CANCELLED" | "ACTIVE";
  clinicName: string;
  customerEmail: string;
  customerPhone?: string;
  clinicAddress?: string;
  planName: string;
  tier: string;
  cycle: string;
  amount: number | string;
  paymentId?: string;
  paymentMethod?: string;
  isTrial?: boolean;
  notes?: string;
}

export async function generateSubscriptionInvoicePdf(data: InvoiceDetails): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0, size: 'A4' });
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const rawAmount = typeof data.amount === 'number' 
        ? data.amount 
        : parseFloat(String(data.amount).replace(/[^0-9.]/g, '') || '0');

      const isTrial = Boolean(data.isTrial || data.status === 'TRIAL ACTIVE');
      const isCancelled = data.status === 'CANCELLED';

      const priceDisplay = isTrial 
        ? '0.00' 
        : rawAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // 1. TOP ACCENT GRADIENT BAR (matching SubscriptionInvoiceView header)
      const topGrad = doc.linearGradient(0, 0, 595.28, 0);
      topGrad.stop(0, '#05C994').stop(0.5, '#04b081').stop(1, '#0f766e');
      doc.rect(0, 0, 595.28, 14).fill(topGrad);

      // 2. HEADER SECTION (Left: Logo Tile & Brand)
      // Logo tile: rounded square with gradient & white "V"
      const tileGrad = doc.linearGradient(45, 36, 97, 88);
      tileGrad.stop(0, '#05C994').stop(1, '#0f766e');
      doc.roundedRect(45, 36, 52, 52, 12).fill(tileGrad);

      doc.fontSize(28).font('Helvetica-Bold').fillColor('#FFFFFF')
        .text('V', 45, 48, { width: 52, align: 'center' });

      // Brand Title next to logo
      doc.fontSize(24).font('Helvetica-Bold').fillColor('#05C994')
        .text('VIITSA', 108, 40);

      const tierLabel = (data.tier || 'clinic').toUpperCase() === 'SOLO'
        ? 'SOLO PLAN'
        : (data.tier || '').toUpperCase() === 'MULTISPECIALTY'
          ? 'MULTI-SPECIALTY'
          : 'CLINIC PRO';

      doc.fontSize(10).font('Helvetica-Bold').fillColor('#64748b')
        .text(tierLabel, 109, 66);

      doc.fontSize(8.5).font('Helvetica').fillColor('#94a3b8')
        .text('Smarter Healthcare, For Everyone', 109, 79);

      // HEADER RIGHT: Subtle "INVOICE" Watermark & Metadata Card
      doc.fontSize(36).font('Helvetica-Bold').fillColor('#f1f5f9')
        .text('INVOICE', 320, 26, { width: 230, align: 'right' });

      // Clean Metadata Box
      doc.roundedRect(335, 48, 215, 66, 10)
        .fillAndStroke('#f8fafc', '#e2e8f0');

      // Invoice Number row
      doc.fontSize(8.5).font('Helvetica').fillColor('#64748b')
        .text('Invoice No', 348, 58);
      const cleanInvNum = data.invoiceNumber.replace(/^VIITSA-/, '');
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a')
        .text(`#${cleanInvNum.slice(0, 12).toUpperCase()}`, 420, 58, { width: 118, align: 'right' });

      // Date row
      doc.fontSize(8.5).font('Helvetica').fillColor('#64748b')
        .text('Date', 348, 73);
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a')
        .text(data.invoiceDate, 420, 73, { width: 118, align: 'right' });

      // Status row with Pill Badge
      doc.fontSize(8.5).font('Helvetica').fillColor('#64748b')
        .text('Status', 348, 88);

      if (isTrial) {
        doc.roundedRect(440, 85, 98, 18, 9)
          .fillAndStroke('#ecfdf5', '#a7f3d0');
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#047857')
          .text('TRIAL ACTIVE', 440, 89.5, { width: 98, align: 'center' });
      } else if (isCancelled) {
        doc.roundedRect(445, 85, 93, 18, 9)
          .fillAndStroke('#fff1f2', '#fecdd3');
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#be123c')
          .text('CANCELLED', 445, 89.5, { width: 93, align: 'center' });
      } else {
        doc.roundedRect(465, 85, 73, 18, 9)
          .fillAndStroke('#ecfdf5', '#a7f3d0');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#047857')
          .text('PAID', 465, 89.5, { width: 73, align: 'center' });
      }

      // 3. BILLED TO & PAYMENT DETAILS (Y: 136)
      // Left: Billed To Pill Badge
      doc.roundedRect(45, 136, 76, 18, 9).fill('#0f172a');
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#ffffff')
        .text('BILLED TO', 45, 140, { width: 76, align: 'center' });

      doc.fontSize(13).font('Helvetica-Bold').fillColor('#0f172a')
        .text(data.clinicName || 'Clinic Partner', 45, 160);

      doc.fontSize(8.5).font('Helvetica').fillColor('#64748b')
        .text(data.clinicAddress || 'Registered Medical Practice Partner', 45, 176);

      // Contact details
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#05C994').text('Phone: ', 45, 192);
      doc.font('Helvetica').fillColor('#334155').text(data.customerPhone || '—', 84, 192);

      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#05C994').text('Email: ', 45, 206);
      doc.font('Helvetica').fillColor('#334155').text(data.customerEmail, 80, 206);

      // Right: Subscription Details Pill Badge
      doc.roundedRect(335, 136, 135, 18, 9).fill('#0f172a');
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#ffffff')
        .text('SUBSCRIPTION DETAILS', 335, 140, { width: 135, align: 'center' });

      doc.fontSize(8.5).font('Helvetica').fillColor('#64748b').text('Plan:', 335, 160);
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(data.planName || `${data.tier.toUpperCase()} Plan`, 400, 160);

      doc.fontSize(8.5).font('Helvetica').fillColor('#64748b').text('Billing Cycle:', 335, 175);
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(data.cycle.toUpperCase(), 400, 175);

      doc.fontSize(8.5).font('Helvetica').fillColor('#64748b').text('Method:', 335, 190);
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(data.paymentMethod || 'Online (UPI / Card)', 400, 190);

      doc.fontSize(8.5).font('Helvetica').fillColor('#64748b').text('Reference ID:', 335, 205);
      const cleanRef = (data.paymentId || 'Mandate Active').replace(/[^a-zA-Z0-9_-]/g, '');
      doc.font('Helvetica').fillColor('#475569').text(cleanRef.slice(0, 24), 400, 205);

      // 4. LINE ITEMS TABLE (Y: 232)
      // Outer card
      doc.roundedRect(45, 232, 505.28, 142, 14).stroke('#e2e8f0');

      // Table Header row (top of card)
      doc.save();
      doc.roundedRect(45, 232, 505.28, 30, 14).clip();
      doc.rect(45, 232, 505.28, 30).fill('#f8fafc');
      doc.restore();
      doc.moveTo(45, 262).lineTo(550.28, 262).stroke('#e2e8f0');

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b')
        .text('DESCRIPTION', 65, 243);
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b')
        .text('AMOUNT', 420, 243, { width: 115, align: 'right' });

      // Table Row
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a')
        .text(`Viitsa Clinic — ${data.planName || data.tier.toUpperCase() + ' Plan'}`, 65, 276);

      const subDesc = isTrial
        ? '30-Day Free Trial Period (₹0 charged today • Auto-renew mandate registered via UPI/Card)'
        : `${data.cycle.toUpperCase()} access to all premium clinic management tools, doctor seats, and AI triage.`;

      doc.fontSize(8.5).font('Helvetica').fillColor('#64748b')
        .text(subDesc, 65, 292, { width: 340, lineGap: 2 });

      doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a')
        .text(`Rs. ${priceDisplay}`, 420, 280, { width: 115, align: 'right' });

      // Summary Bar (bottom of table card)
      doc.save();
      doc.roundedRect(45, 328, 505.28, 46, 14).clip();
      doc.rect(45, 328, 505.28, 46).fill('#f8fafc');
      doc.restore();
      doc.moveTo(45, 328).lineTo(550.28, 328).stroke('#e2e8f0');

      // Shield & Security Tag
      const securityMsg = isTrial
        ? '🔒 30-Day Free Trial Mandate Active via Razorpay'
        : '🔒 Secure Payment Processed via Razorpay Subscriptions';
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f766e')
        .text(securityMsg, 65, 345);

      // Total Paid
      doc.fontSize(10).font('Helvetica').fillColor('#64748b')
        .text('Total Paid', 350, 346);
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#05C994')
        .text(`Rs. ${priceDisplay}`, 420, 339, { width: 115, align: 'right' });

      // 5. TERMS & MANDATE INSTRUCTIONS (Y: 392)
      doc.roundedRect(45, 392, 505.28, 76, 10)
        .fillAndStroke('#f8fafc', '#e2e8f0');

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#334155')
        .text('TERMS & MANDATE INSTRUCTIONS:', 60, 403);

      let termsText = '';
      if (data.notes) {
        termsText = data.notes;
      } else if (isTrial) {
        termsText = `30-Day Free Trial Activated: ₹0 charged today. Your auto-debit mandate is securely registered with Razorpay and will automatically commence billing for ${data.planName || data.tier.toUpperCase()} (${data.cycle}) on Day 31. You may cancel anytime before Day 30 at zero charge from your clinic billing settings.`;
      } else if (isCancelled) {
        termsText = 'Subscription Cancelled: Future automatic recurring billing is terminated. Existing clinical records remain permanently preserved in your account.';
      } else {
        termsText = `Payment received successfully. Your clinic operational quotas, AI triage, and doctor seats are live across all connected devices in real time. Auto-renews per ${data.cycle} cycle.`;
      }

      doc.fontSize(8.5).font('Helvetica').fillColor('#64748b')
        .text(termsText, 60, 417, { width: 475, lineGap: 3 });

      // 6. FOOTER SECTION (Y: 765)
      doc.moveTo(45, 765).lineTo(550.28, 765).stroke('#e2e8f0');

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#334155')
        .text('Thank you for choosing Viitsa to manage your practice.', 45, 778, { width: 505.28, align: 'center' });

      doc.fontSize(8).font('Helvetica').fillColor('#94a3b8')
        .text('🔒 This is a computer-generated tax invoice and does not require a physical signature.', 45, 792, { width: 505.28, align: 'center' });

      doc.fontSize(7.5).font('Helvetica').fillColor('#94a3b8')
        .text('Viitsa Healthcare Technologies Pvt Ltd • support@viitsa.com • www.viitsa.com', 45, 804, { width: 505.28, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
