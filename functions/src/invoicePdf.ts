import PDFDocument from "pdfkit";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

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

      // Medical Emerald Brand Colors
      const EMERALD = '#059669'; // Medical Emerald 600
      const EMERALD_DARK = '#047857'; // Medical Emerald 700
      const EMERALD_LIGHT_BG = '#ecfdf5'; // Emerald 50
      const EMERALD_BORDER = '#a7f3d0'; // Emerald 200

      // 1. TOP HEADER BRAND & TAGLINE (Y: 34)
      doc.fontSize(22).font('Helvetica-Bold').fillColor(EMERALD)
        .text('VIITSA', 36, 34);

      doc.fontSize(9.5).font('Helvetica-Bold').fillColor(EMERALD)
        .text('Clinic-paid Healthcare SaaS', 36, 58);

      doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#64748b')
        .text('Simplifying Care. Stronger Patients.', 36, 71);

      // Top Right Mission Tagline
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#475569')
        .text('CONNECTED CLINICS', 380, 36, { width: 179, align: 'right' })
        .text('HEALTHIER PATIENTS', 380, 47, { width: 179, align: 'right' })
        .text('BRIGHTER TOMORROW', 380, 58, { width: 179, align: 'right' });

      // Subtle emerald accent underline under mission tagline
      doc.moveTo(505, 71).lineTo(559, 71).lineWidth(2).strokeColor(EMERALD).stroke();

      // 2. DOCUMENT TITLE & SUBTITLE (Y: 88)
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#0f172a')
        .text('Subscription Tax Invoice', 36, 88);

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b')
        .text('OFFICIAL SAAS BILLING STATEMENT', 36, 112);

      // 3. TWO SIDE-BY-SIDE CARDS (Y: 126, Height: 96)
      // LEFT CARD: Clinic & Subscriber Profile
      doc.roundedRect(36, 126, 260, 96, 8)
        .fillAndStroke('#ffffff', '#e2e8f0');

      // Square Avatar Tile with Emerald Background
      doc.roundedRect(48, 138, 36, 36, 8).fill(EMERALD);
      const initialLetter = (data.clinicName || 'V').trim().charAt(0).toUpperCase() || 'V';
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#ffffff')
        .text(initialLetter, 48, 146, { width: 36, align: 'center' });

      // Clinic Name & Address next to Avatar
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a')
        .text(data.clinicName || 'Clinic Partner', 92, 140, { width: 195 });

      doc.fontSize(8).font('Helvetica').fillColor('#64748b')
        .text(data.clinicAddress || 'Registered Medical Practice Partner', 92, 155, { width: 195 });

      // Divider inside Left Card
      doc.moveTo(48, 184).lineTo(284, 184).lineWidth(1).strokeColor('#f1f5f9').stroke();

      // Contact row: Phone & Email
      const cleanPhone = data.customerPhone || '—';
      const cleanEmail = data.customerEmail || '—';
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor(EMERALD).text('Phone: ', 48, 194);
      doc.font('Helvetica').fillColor('#334155').text(cleanPhone, 78, 194, { width: 80 });

      doc.font('Helvetica-Bold').fillColor(EMERALD).text('Email: ', 155, 194);
      doc.font('Helvetica').fillColor('#334155').text(cleanEmail, 182, 194, { width: 104 });

      // RIGHT CARD: Official Invoice Metadata
      doc.roundedRect(308, 126, 251, 96, 8)
        .fillAndStroke('#f8fafc', '#e2e8f0');

      const cleanInvNum = data.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
      const cleanTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      const metaRows = [
        { label: 'Invoice No.', value: cleanInvNum.toUpperCase(), bold: true },
        { label: 'Date', value: data.invoiceDate || new Date().toLocaleDateString('en-IN'), bold: true },
        { label: 'Time', value: cleanTime, bold: false },
        { label: 'Receipt No.', value: `RCP-${cleanInvNum.replace(/\D/g, '').slice(-4) || '8921'}`, bold: true },
        { label: 'Payment Mode', value: String(data.paymentMethod || 'UPI / Mandate').toUpperCase(), bold: true },
        { label: 'Status', value: isTrial ? 'TRIAL ACTIVE' : isCancelled ? 'CANCELLED' : 'PAID', isStatus: true },
      ];

      let metaY = 132;
      for (const row of metaRows) {
        doc.fontSize(7.5).font('Helvetica').fillColor('#64748b')
          .text(row.label, 320, metaY);

        if (row.isStatus) {
          if (isTrial) {
            doc.roundedRect(480, metaY - 2, 70, 14, 7)
              .fillAndStroke(EMERALD_LIGHT_BG, EMERALD_BORDER);
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor(EMERALD_DARK)
              .text('TRIAL ACTIVE', 480, metaY + 1.5, { width: 70, align: 'center' });
          } else if (isCancelled) {
            doc.roundedRect(485, metaY - 2, 65, 14, 7)
              .fillAndStroke('#fff1f2', '#fecdd3');
            doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#be123c')
              .text('CANCELLED', 485, metaY + 1.5, { width: 65, align: 'center' });
          } else {
            doc.roundedRect(495, metaY - 2, 55, 14, 7)
              .fillAndStroke(EMERALD_LIGHT_BG, EMERALD_BORDER);
            doc.fontSize(7).font('Helvetica-Bold').fillColor(EMERALD_DARK)
              .text('PAID', 495, metaY + 1.5, { width: 55, align: 'center' });
          }
        } else {
          doc.fontSize(7.5).font(row.bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#0f172a')
            .text(row.value, 410, metaY, { width: 140, align: 'right' });
        }
        metaY += 14;
      }

      // 4. SUBSCRIPTION & ACCOUNT INFORMATION BOX (Y: 230, Height: 68)
      doc.roundedRect(36, 230, 523, 68, 8)
        .fillAndStroke('#ffffff', '#e2e8f0');

      // Top title bar inside Account Box
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a')
        .text('Subscription & Account Information', 48, 238);

      const refId = data.paymentId || `UHID-${cleanInvNum.replace(/\D/g, '').slice(-6) || '2026-918'}`;
      doc.fontSize(7.5).font('Helvetica').fillColor('#64748b')
        .text('UHID / REF:', 360, 238);
      doc.font('Helvetica-Bold').fillColor('#0f172a')
        .text(refId, 420, 238, { width: 130, align: 'right' });

      doc.moveTo(36, 250).lineTo(559, 250).lineWidth(1).strokeColor('#f1f5f9').stroke();

      // Two columns of subscriber details
      const planTierTitle = (data.tier || 'clinic').toUpperCase() === 'SOLO'
        ? 'Solo Doctor Tier'
        : (data.tier || '').toUpperCase() === 'MULTISPECIALTY'
          ? 'Multispecialty Clinic Tier'
          : (data.tier || '').toUpperCase() === 'TEST'
            ? 'Test Tier (Rs. 1)'
            : 'Small Clinic Tier';

      const cycleLabel = (data.cycle || 'monthly').toUpperCase();

      // Col 1 (x: 48)
      doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text('Clinic Name', 48, 257);
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(`:  ${data.clinicName || 'Clinic Partner'}`, 120, 257);

      doc.font('Helvetica').fillColor('#64748b').text('Attending Doctor', 48, 270);
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(`:  Dr. ${data.clinicName?.replace(/^(Dr\.?|Doctor)\s+/i, '') || 'Admin'}`, 120, 270);

      doc.font('Helvetica').fillColor('#64748b').text('Contact Phone', 48, 283);
      doc.font('Helvetica').fillColor('#334155').text(`:  ${cleanPhone}`, 120, 283);

      // Col 2 (x: 308)
      doc.font('Helvetica').fillColor('#64748b').text('Attending Doctor', 308, 257);
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(`:  Dr. ${data.clinicName?.replace(/^(Dr\.?|Doctor)\s+/i, '') || 'Admin'}`, 390, 257);

      doc.font('Helvetica').fillColor('#64748b').text('Specialization', 308, 270);
      doc.font('Helvetica').fillColor('#334155').text(':  Internal Medicine & Healthcare', 390, 270);

      doc.font('Helvetica').fillColor('#64748b').text('Visit Category', 308, 283);
      doc.font('Helvetica-Bold').fillColor(EMERALD).text(`:  ${planTierTitle} (${cycleLabel} Tier)`, 390, 283);

      // 5. SERVICE & SUBSCRIPTION CHARGES TABLE (Y: 306)
      // Header Banner (Solid Medical Emerald `#059669`)
      doc.save();
      doc.roundedRect(36, 306, 523, 22, 6).fill(EMERALD);
      doc.restore();

      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#ffffff')
        .text('SERVICE & SUBSCRIPTION CHARGES', 48, 313);

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff')
        .text('Cur: INR (Rs.)', 450, 313, { width: 99, align: 'right' });

      // Table Column Headers Bar
      doc.rect(36, 328, 523, 20).fillAndStroke('#f8fafc', '#e2e8f0');

      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#475569')
        .text('#', 44, 334, { width: 16, align: 'center' })
        .text('Category', 68, 334, { width: 85 })
        .text('Item Description', 160, 334, { width: 190 })
        .text('Qty', 360, 334, { width: 25, align: 'center' })
        .text('Unit Price', 395, 334, { width: 70, align: 'right' })
        .text('Total Amount', 475, 334, { width: 75, align: 'right' });

      // Table Item Row (Y: 348, Height: 54)
      doc.rect(36, 348, 523, 54).strokeColor('#e2e8f0').stroke();

      // Row #1
      doc.fontSize(8).font('Helvetica').fillColor('#64748b')
        .text('1', 44, 358, { width: 16, align: 'center' });

      doc.fontSize(8).font('Helvetica-Bold').fillColor(EMERALD)
        .text('Subscription', 68, 358);

      const displayPlanHeader = `Viitsa Clinic — ${data.planName || planTierTitle}`;
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a')
        .text(displayPlanHeader, 160, 358);

      const subDesc = isTrial
        ? '30-Day Free Trial Period (Rs. 0 charged today • Auto-renew mandate registered via UPI/Card)'
        : `${cycleLabel} access to full clinic management tools, AI intake, unlimited records & doctor seats.`;

      doc.fontSize(7.5).font('Helvetica').fillColor('#64748b')
        .text(subDesc, 160, 372, { width: 190, lineGap: 1.5 });

      doc.fontSize(8).font('Helvetica').fillColor('#0f172a')
        .text('1', 360, 358, { width: 25, align: 'center' });

      doc.fontSize(8).font('Helvetica').fillColor('#0f172a')
        .text(`Rs. ${priceDisplay}`, 395, 358, { width: 70, align: 'right' });

      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a')
        .text(`Rs. ${priceDisplay}`, 475, 358, { width: 75, align: 'right' });

      // Summary Box (bottom of charges section, Y: 408)
      doc.roundedRect(36, 408, 523, 64, 8)
        .fillAndStroke('#f8fafc', '#e2e8f0');

      // Left Security Shield note
      const securityMsg = isTrial
        ? '30-Day Free Trial Mandate Active via Razorpay'
        : 'Secure Payment Processed via Razorpay Subscriptions';
      doc.fontSize(8).font('Helvetica-Bold').fillColor(EMERALD_DARK)
        .text(securityMsg, 48, 432);

      // Right Calculation lines
      doc.fontSize(7.5).font('Helvetica').fillColor('#64748b')
        .text('Subtotal:', 360, 416)
        .text(`Rs. ${priceDisplay}`, 440, 416, { width: 110, align: 'right' });

      doc.fontSize(7.5).font('Helvetica').fillColor('#64748b')
        .text('Tax / GST (Included):', 360, 429)
        .text('Rs. 0.00', 440, 429, { width: 110, align: 'right' });

      doc.moveTo(360, 442).lineTo(550, 442).lineWidth(1).strokeColor('#e2e8f0').stroke();

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a')
        .text('Total Amount:', 360, 449);

      doc.fontSize(14).font('Helvetica-Bold').fillColor(EMERALD)
        .text(`Rs. ${priceDisplay}`, 440, 446, { width: 110, align: 'right' });

      // 6. TERMS & MANDATE INSTRUCTIONS (Y: 480, Height: 70)
      doc.roundedRect(36, 480, 523, 70, 8)
        .fillAndStroke('#ffffff', '#e2e8f0');

      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#334155')
        .text('TERMS & MANDATE INSTRUCTIONS:', 48, 490);

      let termsText = '';
      if (data.notes) {
        termsText = data.notes;
      } else if (isTrial) {
        termsText = `30-Day Free Trial Activated: Rs. 0 charged today. Your auto-debit mandate is securely registered with Razorpay and will automatically commence billing for ${data.planName || planTierTitle} (${cycleLabel}) on Day 31. You may cancel anytime before Day 30 at zero charge from your clinic billing settings.`;
      } else if (isCancelled) {
        termsText = 'Subscription Cancelled: Future automatic recurring billing is terminated. Existing clinical records remain permanently preserved in your account.';
      } else {
        termsText = `Payment received successfully. Your clinic operational quotas, AI triage, and doctor seats are live across all connected devices in real time. Auto-renews per ${cycleLabel} cycle.`;
      }

      doc.fontSize(7.5).font('Helvetica').fillColor('#64748b')
        .text(termsText, 48, 504, { width: 499, lineGap: 2.5 });

      // 7. FOOTER SECTION (Y: 765)
      doc.moveTo(36, 765).lineTo(559, 765).lineWidth(1).strokeColor('#e2e8f0').stroke();

      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#334155')
        .text('Thank you for choosing Viitsa to manage your practice.', 36, 778, { width: 523, align: 'center' });

      doc.fontSize(7.5).font('Helvetica').fillColor('#64748b')
        .text('This is a computer-generated official SaaS tax invoice and does not require a physical signature.', 36, 792, { width: 523, align: 'center' });

      doc.fontSize(7).font('Helvetica').fillColor('#94a3b8')
        .text('Viitsa Healthcare Technologies Pvt Ltd • support@viitsa.com • +91 73961 11081 • www.viitsa.com', 36, 805, { width: 523, align: 'center' });

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
      topGrad.stop(0, '#047857').stop(0.5, '#059669').stop(1, '#10b981');
      doc.rect(0, 0, 595.28, 14).fill(topGrad);

      // 2. Header Brand & Logo Tile
      const tileGrad = doc.linearGradient(45, 36, 97, 88);
      tileGrad.stop(0, '#059669').stop(1, '#047857');
      doc.roundedRect(45, 36, 52, 52, 12).fill(tileGrad);
      doc.fontSize(28).font('Helvetica-Bold').fillColor('#FFFFFF')
        .text('V', 45, 48, { width: 52, align: 'center' });

      // Clinic Name and Platform
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#0f172a')
        .text(data.clinicName || 'VIITSA Healthcare', 108, 40);

      doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#059669')
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
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#059669')
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
  const bucketName = process.env.STORAGE_BUCKET_NAME || process.env.FIREBASE_STORAGE_BUCKET || "viitsadb.firebasestorage.app";
  let bucket: any;
  try {
    bucket = admin.storage().bucket(bucketName);
  } catch (_e) {
    bucket = admin.storage().bucket();
  }
  const cleanInv = (data.invoiceNumber || `BILL-${Date.now()}`).replace(/[^\w-]/g, '_');
  const filePath = `invoices/${clinicId || 'general'}/Invoice_${cleanInv}_${Date.now()}.pdf`;
  const file = bucket.file(filePath);

  const downloadToken = crypto.randomUUID();

  await file.save(buffer, {
    metadata: {
      contentType: 'application/pdf',
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
        invoiceNumber: data.invoiceNumber,
        clinicName: data.clinicName,
        patientName: data.patientName,
      },
    },
  });

  await file.makePublic().catch(() => {});
  const publicMediaUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`;

  return publicMediaUrl;
}

export async function ensureSubscriptionInvoicePdfUrl(data: InvoiceDetails, clinicId?: string): Promise<string> {
  // Automatically enrich missing clinic metadata from Firestore if clinicId is present
  if (clinicId && (!data.clinicAddress || !data.customerEmail || !data.customerPhone)) {
    try {
      if (!admin.apps.length) admin.initializeApp();
      const db = admin.firestore();
      const clinicSnap = await db.collection('clinics').doc(clinicId).get();
      if (clinicSnap.exists) {
        const cData = clinicSnap.data() || {};
        if (!data.clinicAddress && cData.address) data.clinicAddress = cData.address;
        if (!data.customerEmail && cData.email) data.customerEmail = cData.email;
        if (!data.customerPhone && (cData.phone || cData.contact_phone)) {
          data.customerPhone = cData.phone || cData.contact_phone;
        }
        if ((!data.clinicName || data.clinicName === 'Clinic' || data.clinicName === 'Clinic Partner') && cData.name) {
          data.clinicName = cData.name;
        }
      }
    } catch (_enrichErr) {
      console.warn('[ensureSubscriptionInvoicePdfUrl] Non-fatal notice enriching clinic metadata:', _enrichErr);
    }
  }

  const buffer = await generateSubscriptionInvoicePdf(data);

  if (!admin.apps.length) admin.initializeApp();
  const bucketName = process.env.STORAGE_BUCKET_NAME || process.env.FIREBASE_STORAGE_BUCKET || "viitsadb.firebasestorage.app";
  let bucket: any;
  try {
    bucket = admin.storage().bucket(bucketName);
  } catch (_e) {
    bucket = admin.storage().bucket();
  }
  const cleanInv = (data.invoiceNumber || `SUB-${Date.now()}`).replace(/[^\w-]/g, '_');
  const filePath = `invoices/${clinicId || 'subscriptions'}/Sub_Invoice_${cleanInv}_${Date.now()}.pdf`;
  const file = bucket.file(filePath);

  const downloadToken = crypto.randomUUID();

  await file.save(buffer, {
    metadata: {
      contentType: 'application/pdf',
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
        invoiceNumber: data.invoiceNumber,
        clinicName: data.clinicName,
        planName: data.planName,
      },
    },
  });

  await file.makePublic().catch(() => {});
  const publicMediaUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`;
  return publicMediaUrl;
}
