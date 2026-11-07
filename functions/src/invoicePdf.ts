import PDFDocument from "pdfkit";
import * as admin from "firebase-admin";

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


// ============================================================================
// PATIENT CONSULTATION & TREATMENT INVOICE GENERATOR
// ============================================================================

export interface PatientInvoiceItem {
  description: string;
  amount: number | string;
  quantity?: number;
}

export interface PatientInvoicePdfDetails {
  invoiceNumber: string;
  invoiceDate: string;
  clinicName: string;
  clinicAddress?: string;
  clinicPhone?: string;
  patientName: string;
  patientPhone?: string;
  items?: PatientInvoiceItem[];
  subtotal?: number | string;
  discount?: number | string;
  totalAmount: number | string;
  paymentStatus: string;
  paymentMethod?: string;
  doctorName?: string;
  notes?: string;
  pdfUrl?: string;
}

export async function generatePatientInvoicePdf(data: PatientInvoicePdfDetails): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0, size: 'A4' });
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const rawAmount = typeof data.totalAmount === 'number'
        ? data.totalAmount
        : parseFloat(String(data.totalAmount).replace(/[^0-9.]/g, '') || '0');

      const isPaid = String(data.paymentStatus || 'PAID').toUpperCase() === 'PAID';
      const cleanInvNum = (data.invoiceNumber || 'BILL').replace(/^INV-?/i, '');

      // 1. Top Gradient Accent Bar
      const topGrad = doc.linearGradient(0, 0, 595.28, 0);
      topGrad.stop(0, '#05C994').stop(0.5, '#04b081').stop(1, '#0f766e');
      doc.rect(0, 0, 595.28, 14).fill(topGrad);

      // 2. Header Brand & Logo Tile
      const tileGrad = doc.linearGradient(45, 36, 97, 88);
      tileGrad.stop(0, '#05C994').stop(1, '#0f766e');
      doc.roundedRect(45, 36, 52, 52, 12).fill(tileGrad);
      doc.fontSize(28).font('Helvetica-Bold').fillColor('#FFFFFF')
        .text('V', 45, 48, { width: 52, align: 'center' });

      // Clinic Name and Platform
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#0f172a')
        .text(data.clinicName || 'VIITSA Healthcare', 108, 40);

      doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#05C994')
        .text('HEALTHCARE & MEDICAL SERVICES', 109, 64);

      const clinicSub = [data.clinicAddress, data.clinicPhone].filter(Boolean).join(' • ');
      doc.fontSize(8.5).font('Helvetica').fillColor('#64748b')
        .text(clinicSub || 'VIITSA Connected Clinical Partner', 109, 78);

      // Header Right: Invoice Watermark & Box
      doc.fontSize(36).font('Helvetica-Bold').fillColor('#f1f5f9')
        .text('INVOICE', 320, 26, { width: 230, align: 'right' });

      doc.roundedRect(335, 48, 215, 66, 10).fillAndStroke('#f8fafc', '#e2e8f0');

      doc.fontSize(8.5).font('Helvetica').fillColor('#64748b').text('Invoice No', 348, 58);
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a')
        .text(`#${cleanInvNum.toUpperCase()}`, 420, 58, { width: 118, align: 'right' });

      doc.fontSize(8.5).font('Helvetica').fillColor('#64748b').text('Date', 348, 73);
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a')
        .text(data.invoiceDate || new Date().toLocaleDateString('en-IN'), 420, 73, { width: 118, align: 'right' });

      doc.fontSize(8.5).font('Helvetica').fillColor('#64748b').text('Status', 348, 88);
      if (isPaid) {
        doc.roundedRect(450, 85, 88, 18, 9).fillAndStroke('#ecfdf5', '#a7f3d0');
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#047857')
          .text('PAID', 450, 89.5, { width: 88, align: 'center' });
      } else {
        doc.roundedRect(450, 85, 88, 18, 9).fillAndStroke('#fffbeb', '#fde68a');
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#b45309')
          .text('BALANCE DUE', 450, 89.5, { width: 88, align: 'center' });
      }

      // 3. Bill To / Patient Details
      doc.roundedRect(45, 126, 505.28, 58, 10).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#94a3b8').text('PATIENT / BILLED TO:', 58, 136);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text(data.patientName || 'Patient', 58, 149);

      if (data.patientPhone) {
        doc.fontSize(8.5).font('Helvetica').fillColor('#64748b')
          .text(`Phone: ${data.patientPhone}`, 58, 165);
      }

      if (data.doctorName) {
        doc.fontSize(8.5).font('Helvetica').fillColor('#64748b')
          .text(`Consultant: Dr. ${data.doctorName.replace(/^(Dr\.?|Doctor)\s+/i, '')}`, 300, 149);
      }

      // 4. Line Items Table
      doc.roundedRect(45, 196, 505.28, 28, 6).fill('#f1f5f9');
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#475569')
        .text('DESCRIPTION', 58, 205)
        .text('QTY', 380, 205, { width: 40, align: 'center' })
        .text('AMOUNT (INR)', 430, 205, { width: 105, align: 'right' });

      let currentY = 232;
      const items = (data.items && data.items.length > 0) ? data.items : [
        { description: 'Doctor Consultation & Clinical Assessment', amount: rawAmount, quantity: 1 }
      ];

      items.forEach((item, index) => {
        const itemAmt = typeof item.amount === 'number' ? item.amount : parseFloat(String(item.amount) || '0');
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#1e293b')
          .text(item.description, 58, currentY);

        doc.fontSize(9).font('Helvetica').fillColor('#64748b')
          .text(String(item.quantity || 1), 380, currentY, { width: 40, align: 'center' })
          .text(`Rs. ${itemAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 430, currentY, { width: 105, align: 'right' });

        currentY += 24;
        if (index < items.length - 1) {
          doc.moveTo(58, currentY - 6).lineTo(535, currentY - 6).stroke('#f1f5f9');
        }
      });

      // 5. Total & Payment Summary Card
      const summaryY = Math.max(currentY + 12, 340);
      doc.roundedRect(45, summaryY, 505.28, 62, 10).fillAndStroke('#f8fafc', '#e2e8f0');

      doc.fontSize(9).font('Helvetica').fillColor('#64748b').text('Payment Method', 60, summaryY + 16);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a')
        .text(String(data.paymentMethod || 'UPI / CASH').toUpperCase(), 60, summaryY + 32);

      doc.fontSize(9).font('Helvetica').fillColor('#64748b').text('Total Amount', 340, summaryY + 16);
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#05C994')
        .text(`Rs. ${rawAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 410, summaryY + 24, { width: 125, align: 'right' });

      // 6. Notes & Instructions
      const notesY = summaryY + 76;
      doc.roundedRect(45, notesY, 505.28, 54, 8).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#475569').text('IMPORTANT CLINICAL & BILLING NOTE:', 58, notesY + 10);
      doc.fontSize(8).font('Helvetica').fillColor('#64748b')
        .text(data.notes || 'This invoice serves as an official proof of payment for medical services rendered. Please present this invoice or your registration token upon your next visit.', 58, notesY + 24, { width: 480, lineGap: 2 });

      // 7. Footer
      doc.moveTo(45, 765).lineTo(550.28, 765).stroke('#e2e8f0');
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#334155')
        .text('Thank you for trusting us with your health and care.', 45, 778, { width: 505.28, align: 'center' });
      doc.fontSize(7.5).font('Helvetica').fillColor('#94a3b8')
        .text('🔒 Computer-generated official clinical tax invoice • Verified by VIITSA Healthcare Platform', 45, 792, { width: 505.28, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function ensurePatientInvoicePdfUrl(data: PatientInvoicePdfDetails, clinicId?: string): Promise<string> {
  // If caller already uploaded a real, live HTTPS invoice URL (from client pdf.ts), use it
  if (
    data.pdfUrl &&
    data.pdfUrl.startsWith('https://') &&
    !data.pdfUrl.includes('dummy') &&
    !data.pdfUrl.includes('example.com')
  ) {
    return data.pdfUrl;
  }

  // Otherwise, automatically generate the authentic VIITSA clinical PDF
  const buffer = await generatePatientInvoicePdf(data);

  if (!admin.apps.length) admin.initializeApp();
  const bucket = admin.storage().bucket();
  const cleanInv = (data.invoiceNumber || `BILL-${Date.now()}`).replace(/[^\w-]/g, '_');
  const filePath = `invoices/${clinicId || 'general'}/Invoice_${cleanInv}_${Date.now()}.pdf`;
  const file = bucket.file(filePath);

  await file.save(buffer, {
    metadata: {
      contentType: 'application/pdf',
      metadata: {
        invoiceNumber: data.invoiceNumber,
        clinicName: data.clinicName,
        patientName: data.patientName,
      },
    },
  });

  try {
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: '01-01-2035',
    });
    return signedUrl;
  } catch (err) {
    console.warn('[ensurePatientInvoicePdfUrl] getSignedUrl fallback to direct media URL:', err);
    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media`;
  }
}

export async function ensureSubscriptionInvoicePdfUrl(data: InvoiceDetails, clinicId?: string): Promise<string> {
  const buffer = await generateSubscriptionInvoicePdf(data);

  if (!admin.apps.length) admin.initializeApp();
  const bucket = admin.storage().bucket();
  const cleanInv = (data.invoiceNumber || `SUB-${Date.now()}`).replace(/[^\w-]/g, '_');
  const filePath = `invoices/${clinicId || 'subscriptions'}/Sub_Invoice_${cleanInv}_${Date.now()}.pdf`;
  const file = bucket.file(filePath);

  await file.save(buffer, {
    metadata: {
      contentType: 'application/pdf',
      metadata: {
        invoiceNumber: data.invoiceNumber,
        clinicName: data.clinicName,
        planName: data.planName,
      },
    },
  });

  try {
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: '01-01-2035',
    });
    return signedUrl;
  } catch (err) {
    console.warn('[ensureSubscriptionInvoicePdfUrl] getSignedUrl fallback to direct media URL:', err);
    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media`;
  }
}
