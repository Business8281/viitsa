import { httpsCallable } from 'firebase/functions';
import { getDoc, doc } from 'firebase/firestore';
import { functions, db, auth } from './firebase';
import { formatDate } from './format';

export interface SendEmailParams {
  to: string;
  template: "clinic_pending" | "clinic_approved" | "clinic_rejected" | "appointment_confirmed" | "appointment_cancelled" | "appointment_rescheduled" | "prescription" | "invoice" | "sub_change" | "sub_cancelled" | "generic";
  subject?: string;
  data?: any;
  attachments?: Array<{
    filename: string;
    content: string; // base64 string
    contentType?: string;
  }>;
}

export function wrapEmailShell(content: string, options?: { subtitle?: string; title?: string }): string {
  const currentYear = new Date().getFullYear();
  const sub = options?.subtitle || 'Official Communication';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${options?.title || 'Viitsa Healthcare'}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 680px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);">
          <tr>
            <td style="padding: 32px 32px 28px 32px;">

              <!-- Header: Left Branding & Right Connected Clinics -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td valign="top" align="left">
                    <div style="font-size: 32px; font-weight: 900; color: #059669; letter-spacing: -0.5px; line-height: 1;">VIITSA</div>
                    <div style="font-size: 11px; font-weight: 700; color: #059669; margin-top: 4px; letter-spacing: 0.2px;">${sub}</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px; font-style: italic;">Simplifying Care. Stronger Patients.</div>
                  </td>
                  <td valign="top" align="right">
                    <div style="font-size: 9px; font-weight: 800; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; line-height: 1.5; text-align: right;">
                      CONNECTED CLINICS<br/>HEALTHIER PATIENTS<br/>BRIGHTER TOMORROW
                    </div>
                    <div style="width: 40px; height: 2px; background-color: #059669; margin-top: 8px; margin-left: auto;"></div>
                  </td>
                </tr>
              </table>

              <!-- Main Content -->
              <div style="font-size: 14px; line-height: 1.6; color: #334155;">
                ${content}
              </div>

              <!-- Platform Footer Badges -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                <tr>
                  <td width="35%" valign="middle" align="left">
                    <div style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Healthcare Platform</div>
                    <div style="font-size: 20px; font-weight: 900; color: #059669; line-height: 1.1;">VIITSA</div>
                    <div style="font-size: 8px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase;">Better Care Together</div>
                  </td>
                  <td width="65%" valign="middle" align="right">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="right">
                      <tr>
                        <td align="center" style="padding: 0 10px; border-right: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">🛡️</div>
                          Secure Patient<br/>Records
                        </td>
                        <td align="center" style="padding: 0 10px; border-right: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">👥</div>
                          Seamless Clinic<br/>Experience
                        </td>
                        <td align="center" style="padding: 0 10px; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">📈</div>
                          Better Health<br/>Outcomes
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Footer -->
              <div style="text-align: center; margin-top: 18px; padding-top: 14px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8;">
                <p style="margin: 0 0 6px 0; color: #64748b;">
                  Automated notification from <strong style="color: #334155;">Viitsa Healthcare Systems</strong>.<br/>
                  Support: <a href="mailto:support@viitsa.com" style="color: #059669; text-decoration: none; font-weight: 600;">support@viitsa.com</a>
                </p>
                <p style="margin: 0; color: #94a3b8;">
                  © ${currentYear} Viitsa Healthcare Technologies. 256-Bit SSL Encrypted Healthcare Infrastructure.
                </p>
              </div>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export interface SubscriptionActivatedEmailData {
  clinicName: string;
  planName: string;
  cycle?: string;
  isTrial?: boolean;
  trialEndsAt?: string;
  paymentId?: string;
  amount?: number | string;
  clinicAddress?: string;
  clinicPhone?: string;
  clinicEmail?: string;
  doctorName?: string;
  doctorSpecialization?: string;
  uhid?: string;
  invoiceNo?: string;
  receiptNo?: string;
  date?: string;
  time?: string;
  paymentMethod?: string;
  notes?: string;
  lineItems?: Array<{
    category: string;
    description: string;
    quantity: number;
    unitPrice: string | number;
    amount: string | number;
  }>;
}

function formatInvoiceAmount(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '0.00';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
  if (isNaN(num)) return String(val);
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function buildSubscriptionActivatedHtml(data?: SubscriptionActivatedEmailData): string {
  const d = data || ({} as SubscriptionActivatedEmailData);
  const clinicName = d.clinicName || 'XR';
  const clinicInitial = (clinicName || 'X').trim().charAt(0).toUpperCase() || 'X';
  const clinicAddress = d.clinicAddress || 'Kukatpally';
  const clinicPhone = d.clinicPhone || '7075545960';
  const clinicEmail = d.clinicEmail || 'business8281@gmail.com';
  const doctorName = d.doctorName || 'Dr. XR';
  const doctorSpecialization = d.doctorSpecialization || 'Internal Medicine & Cardiology';
  const uhid = d.uhid || 'UHID-2026-918';
  const invoiceNo = d.invoiceNo || 'INV-2026-08492';
  const receiptNo = d.receiptNo || 'RCP-8921';
  const dateStr = d.date || '20 Nov 2026';
  const timeStr = d.time || '09:49';
  const paymentMethod = (d.paymentMethod || (d.isTrial ? 'UPI Mandate' : 'UPI')).toUpperCase();
  const planName = d.planName || 'Small Clinic Tier';
  const cycle = (d.cycle || 'monthly').toLowerCase();
  const cycleDisplay = cycle === 'annual' ? 'Annual Tier' : 'Monthly Tier';
  const isTrial = Boolean(d.isTrial);
  const paymentId = d.paymentId || 'mandate_9941a82e';

  // Amount parsing
  let rawAmount = 1999;
  if (d.amount !== undefined && d.amount !== null) {
    rawAmount = typeof d.amount === 'number' ? d.amount : parseFloat(String(d.amount).replace(/[^0-9.-]+/g, '')) || 0;
  }
  const displayAmount = isTrial ? 0 : rawAmount;
  const subtotalStr = formatInvoiceAmount(rawAmount > 0 ? rawAmount : 1999);
  const grandTotalStr = formatInvoiceAmount(displayAmount);
  const discountStr = isTrial ? subtotalStr : '';
  const amountPaidStr = grandTotalStr;
  const paymentStatus = isTrial ? 'TRIAL ACTIVE' : 'PAID';

  const items = d.lineItems || [
    {
      category: 'Software License',
      description: `Viitsa Clinic Pro — ${planName} (${cycle === 'annual' ? 'Annual Access & Cloud Sync' : 'Monthly Access & Cloud Sync'})`,
      quantity: 1,
      unitPrice: isTrial ? '₹0.00 (Trial)' : `₹${subtotalStr}`,
      amount: isTrial ? '₹0.00' : `₹${subtotalStr}`,
    },
    {
      category: 'AI Clinical Navigator',
      description: 'Automated Clinical Triage & Patient Intake Quota',
      quantity: 1,
      unitPrice: 'Included',
      amount: '₹0.00',
    },
    {
      category: 'WhatsApp Patient CRM',
      description: 'Official Meta Cloud API Digital Prescriptions & Reminders Quota',
      quantity: 1,
      unitPrice: 'Included',
      amount: '₹0.00',
    },
    {
      category: 'Cloud EHR & Storage',
      description: 'HIPAA-Ready Encrypted Patient Health Records Storage',
      quantity: 1,
      unitPrice: 'Included',
      amount: '₹0.00',
    },
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Subscription Tax Invoice - ${invoiceNo} | Viitsa</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 680px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);">
          <tr>
            <td style="padding: 32px 32px 28px 32px;">

              <!-- Header: Left Branding & Right Connected Clinics -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td valign="top" align="left">
                    <div style="font-size: 32px; font-weight: 900; color: #059669; letter-spacing: -0.5px; line-height: 1;">VIITSA</div>
                    <div style="font-size: 11px; font-weight: 700; color: #059669; margin-top: 4px; letter-spacing: 0.2px;">Clinic-paid Healthcare SaaS</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px; font-style: italic;">Simplifying Care. Stronger Patients.</div>
                  </td>
                  <td valign="top" align="right">
                    <div style="font-size: 9px; font-weight: 800; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; line-height: 1.5; text-align: right;">
                      CONNECTED CLINICS<br/>HEALTHIER PATIENTS<br/>BRIGHTER TOMORROW
                    </div>
                    <div style="width: 40px; height: 2px; background-color: #059669; margin-top: 8px; margin-left: auto;"></div>
                  </td>
                </tr>
              </table>

              <!-- Document Title -->
              <div style="margin-bottom: 20px;">
                <h1 style="font-size: 26px; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.1; letter-spacing: -0.3px;">Subscription Tax Invoice</h1>
                <div style="font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px;">OFFICIAL SAAS BILLING STATEMENT</div>
              </div>

              <!-- Two Cards: Clinic Details & Invoice Details -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
                <tr>
                  <!-- Left Card: Billed To / Clinic -->
                  <td width="55%" valign="top" style="padding-right: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; box-sizing: border-box;">
                      <tr>
                        <td>
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td width="50" valign="top">
                                <div style="width: 44px; height: 44px; border-radius: 8px; background-color: #059669; color: #ffffff; font-size: 20px; font-weight: 800; text-align: center; line-height: 44px;">
                                  ${clinicInitial}
                                </div>
                              </td>
                              <td valign="top" style="padding-left: 8px;">
                                <div style="font-size: 15px; font-weight: 800; color: #0f172a; line-height: 1.2;">${clinicName}</div>
                                <div style="font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.4;">${clinicAddress}</div>
                              </td>
                            </tr>
                          </table>
                          <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b;">
                            <span style="color: #059669; font-weight: 700; margin-right: 4px;">📞</span>
                            <span style="font-weight: 600; color: #334155;">${clinicPhone}</span>
                            <span style="color: #cbd5e1; margin: 0 8px;">|</span>
                            <span style="color: #059669; font-weight: 700; margin-right: 4px;">✉</span>
                            <span style="font-weight: 600; color: #334155;">${clinicEmail}</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Right Card: Invoice Details -->
                  <td width="45%" valign="top" style="padding-left: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; box-sizing: border-box;">
                      <tr>
                        <td>
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 11px; line-height: 1.7;">
                            <tr>
                              <td style="color: #64748b;" width="42%">Invoice No.</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;" width="58%">${invoiceNo}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Date</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;">${dateStr}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Time</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;">${timeStr}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Receipt No.</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;">${receiptNo}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Payment Mode</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0; text-transform: uppercase;">${paymentMethod}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Status</td>
                              <td style="padding-left: 10px; border-left: 1px solid #e2e8f0;">
                                <span style="background-color: #dcfce7; color: #166534; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase;">${paymentStatus}</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Middle Card: Subscription & Account Information -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; border-collapse: separate; border-spacing: 0;">
                <tr>
                  <td style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="left" style="font-size: 11px; font-weight: 700; color: #0f172a;">
                          👤 Subscription & Account Information
                        </td>
                        <td align="right" style="font-size: 10px; color: #64748b; font-family: monospace;">
                          UHID: <strong style="color: #0f172a;">${uhid}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 11px;">
                      <tr>
                        <td width="48%" valign="top">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="line-height: 1.8;">
                            <tr>
                              <td width="115" style="color: #64748b;">Clinic Name</td>
                              <td width="10" style="color: #94a3b8;">:</td>
                              <td style="font-weight: 700; color: #0f172a;">${clinicName}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Attending Doctor</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 600; color: #0f172a;">${doctorName}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Contact Phone</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 600; color: #0f172a;">+91 ${clinicPhone.replace(/^\+91\s*/, '')}</td>
                            </tr>
                          </table>
                        </td>
                        <td width="4%" align="center" valign="middle">
                          <div style="width: 1px; height: 50px; background-color: #e2e8f0;"></div>
                        </td>
                        <td width="48%" valign="top">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="line-height: 1.8;">
                            <tr>
                              <td width="115" style="color: #64748b;">Attending Doctor</td>
                              <td width="10" style="color: #94a3b8;">:</td>
                              <td style="font-weight: 700; color: #0f172a;">${doctorName}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Specialization</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 600; color: #0f172a;">${doctorSpecialization}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Visit Category</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 600; color: #059669;">${planName} (${cycleDisplay})</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Charges Table: Solid Medical Emerald Header -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; border-collapse: separate; border-spacing: 0;">
                <tr>
                  <td colspan="6" style="background-color: #059669; padding: 10px 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="left" style="font-size: 11px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">
                          SERVICE & SUBSCRIPTION CHARGES
                        </td>
                        <td align="right" style="font-size: 10px; font-weight: 600; color: #ecfdf5;">
                          Cur: INR (₹)
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr style="background-color: #f8fafc; font-size: 11px; font-weight: 700; color: #1e293b;">
                  <td style="padding: 9px 8px; text-align: center; border-bottom: 1px solid #e2e8f0;" width="6%">#</td>
                  <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0;" width="22%">Category</td>
                  <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0;" width="38%">Item Description</td>
                  <td style="padding: 9px 8px; text-align: center; border-bottom: 1px solid #e2e8f0;" width="8%">Qty</td>
                  <td style="padding: 9px 12px; text-align: right; border-bottom: 1px solid #e2e8f0;" width="13%">Unit Price</td>
                  <td style="padding: 9px 12px; text-align: right; border-bottom: 1px solid #e2e8f0;" width="13%">Total Amount</td>
                </tr>
                ${items.map((item, index) => `
                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px;">
                  <td style="padding: 10px 8px; text-align: center; color: #94a3b8; font-family: monospace; border-bottom: 1px solid #f1f5f9;">${index + 1}</td>
                  <td style="padding: 10px 12px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #f1f5f9;">
                    <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #059669; margin-right: 6px; vertical-align: middle;"></span>
                    ${item.category}
                  </td>
                  <td style="padding: 10px 12px; color: #334155; line-height: 1.4; border-bottom: 1px solid #f1f5f9;">${item.description}</td>
                  <td style="padding: 10px 8px; text-align: center; color: #475569; font-family: monospace; border-bottom: 1px solid #f1f5f9;">${item.quantity}</td>
                  <td style="padding: 10px 12px; text-align: right; color: #475569; font-family: monospace; border-bottom: 1px solid #f1f5f9;">${typeof item.unitPrice === 'number' ? `₹${formatInvoiceAmount(item.unitPrice)}` : item.unitPrice}</td>
                  <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #0f172a; font-family: monospace; border-bottom: 1px solid #f1f5f9;">${typeof item.amount === 'number' ? `₹${formatInvoiceAmount(item.amount)}` : item.amount}</td>
                </tr>
                `).join('')}
              </table>

              <!-- Totals & Notes Section -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
                <tr>
                  <!-- Left: Notes -->
                  <td width="52%" valign="top" style="padding-right: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background-color: #ffffff;">
                      <tr>
                        <td style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px 12px; font-size: 11px; font-weight: 700; color: #0f172a;">
                          📄 Subscription & Payment Notes
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px; font-size: 11px; color: #64748b; line-height: 1.5;">
                          <div style="font-family: monospace; color: #94a3b8; font-size: 10px; margin-bottom: 4px;">REF: ${invoiceNo} · Mandate: ${paymentId}</div>
                          <div style="color: #334155; font-style: italic; margin-bottom: 8px;">
                            ${d.notes || (isTrial 
                              ? '30-Day Free Trial Activated. Full access to doctor seats, AI Clinical Navigator, and patient CRM records.' 
                              : 'Official cloud subscription license. Real-time patient sync & multi-doctor access enabled.')}
                          </div>
                          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; font-size: 10px; color: #64748b;">
                            Thank you for partnering with Viitsa. Computer-generated tax invoice. No signature required.
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Right: Financial Breakdown -->
                  <td width="48%" valign="top" style="padding-left: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; font-size: 11px; background-color: #ffffff;">
                      <tr>
                        <td style="padding: 12px 14px; line-height: 1.8;">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td style="color: #64748b;">Subtotal</td>
                              <td align="right" style="font-family: monospace; font-weight: 600; color: #0f172a;">₹${subtotalStr}</td>
                            </tr>
                            ${discountStr ? `
                            <tr>
                              <td style="color: #059669;">Discount / Trial Credit</td>
                              <td align="right" style="font-family: monospace; font-weight: 600; color: #059669;">- ₹${discountStr}</td>
                            </tr>` : ''}
                            <tr>
                              <td style="color: #64748b;">GST (0% Healthcare Exemption)</td>
                              <td align="right" style="font-family: monospace; color: #64748b;">₹0.00</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="background-color: #059669; padding: 10px 14px;">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td style="color: #ffffff; font-size: 12px; font-weight: 800; text-transform: uppercase;">Grand Total</td>
                              <td align="right" style="color: #ffffff; font-family: monospace; font-size: 16px; font-weight: 900;">₹${grandTotalStr}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="background-color: #f8fafc; padding: 10px 14px; line-height: 1.8;">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td style="color: #334155;">Amount Paid</td>
                              <td align="right" style="font-family: monospace; font-weight: 700; color: #0f172a;">₹${amountPaidStr}</td>
                            </tr>
                            <tr>
                              <td style="color: #059669; font-weight: 700; border-top: 1px solid #e2e8f0; padding-top: 4px;">Balance Due</td>
                              <td align="right" style="font-family: monospace; font-weight: 800; color: #059669; border-top: 1px solid #e2e8f0; padding-top: 4px;">₹0.00</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Authorised Signatory -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 16px; padding-top: 14px; border-top: 1px solid #f1f5f9; font-size: 10px; color: #64748b;">
                <tr>
                  <td valign="bottom" align="left">
                    <div style="font-weight: 700; color: #334155;">Viitsa Healthcare Technologies Pvt. Ltd.</div>
                    <div style="font-size: 9px; color: #94a3b8;">Authorised Medical SaaS Provider</div>
                  </td>
                  <td valign="bottom" align="right">
                    <div style="width: 140px; border-bottom: 1px solid #94a3b8; margin-bottom: 4px; margin-left: auto;"></div>
                    <div style="font-weight: 700; color: #334155;">Authorised Signatory</div>
                    <div style="font-size: 9px; color: #94a3b8;">Doctor / Billing Executive</div>
                  </td>
                </tr>
              </table>

              <!-- Platform Footer Badges -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                <tr>
                  <td width="35%" valign="middle" align="left">
                    <div style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Connected Clinic</div>
                    <div style="font-size: 20px; font-weight: 900; color: #059669; line-height: 1.1;">VIITSA</div>
                    <div style="font-size: 8px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase;">Better Care Together</div>
                  </td>
                  <td width="65%" valign="middle" align="right">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="right">
                      <tr>
                        <td align="center" style="padding: 0 10px; border-right: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">🛡️</div>
                          Secure Patient<br/>Records
                        </td>
                        <td align="center" style="padding: 0 10px; border-right: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">👥</div>
                          Seamless Clinic<br/>Experience
                        </td>
                        <td align="center" style="padding: 0 10px; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">📈</div>
                          Better Health<br/>Outcomes
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Button & Links -->
              <div style="text-align: center; margin-top: 22px; padding-top: 16px; border-top: 1px solid #f1f5f9;">
                <a href="https://viitsa.com/clinic/dashboard" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff; padding: 12px 32px; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);">
                  Go to Clinic Dashboard
                </a>
                <div style="font-size: 10px; color: #94a3b8; margin-top: 10px;">
                  Official Portal: <a href="https://viitsa.com" target="_blank" style="color: #059669; text-decoration: none; font-weight: 600;">www.viitsa.com</a> · Support: <a href="mailto:support@viitsa.com" style="color: #059669; text-decoration: none; font-weight: 600;">support@viitsa.com</a>
                </div>
              </div>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export interface SubscriptionCancelledEmailData {
  clinicName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
  clinicEmail?: string;
  planName?: string;
  effectiveDate?: string;
  requestDate?: string;
  scheduleId?: string;
  reason?: string;
  lineItems?: Array<{
    category: string;
    description: string;
    status: string;
    policy: string;
  }>;
}

export function buildSubscriptionCancelledHtml(data?: SubscriptionCancelledEmailData): string {
  const d = data || {};
  const clinicName = d.clinicName || 'Apollo Health Center';
  const clinicInitial = clinicName.trim().charAt(0).toUpperCase() || 'A';
  const clinicAddress = d.clinicAddress || 'Plot 42, Road No. 36, Jubilee Hills, Hyderabad';
  const clinicPhone = d.clinicPhone || '+91 90148 65154';
  const clinicEmail = d.clinicEmail || 'billing@apollohealth.com';
  const planName = d.planName || 'CLINIC Plan';
  const effectiveDate = d.effectiveDate || '26 Nov 2026';
  const requestDate = d.requestDate || '20 Nov 2026';
  const scheduleId = d.scheduleId || 'SCHED-CANC-2026-8812';
  const reasonText = d.reason || 'Temporary restructuring of clinic operations.';

  const items = d.lineItems || [
    {
      category: 'Practice Management & Cloud EHR',
      description: 'Patient records, digital charts, and appointment management',
      status: 'Fully Active & Operational',
      policy: `Access active through ${effectiveDate}; 100% data safely preserved`,
    },
    {
      category: 'Doctor & Staff Logins',
      description: 'All active doctor seats and administrative permissions',
      status: 'Unrestricted Access',
      policy: `Valid through ${effectiveDate}; no disruption to active consultations`,
    },
    {
      category: 'AI Clinical Intelligence',
      description: 'Automated triage, voice prescriptions, and intake summaries',
      status: 'Active',
      policy: `Full capabilities enabled until end of billing cycle (${effectiveDate})`,
    },
    {
      category: 'WhatsApp Patient CRM',
      description: 'Meta Cloud API digital prescription delivery and automated reminders',
      status: 'Active',
      policy: `Direct patient PDF delivery remains fully functional until ${effectiveDate}`,
    },
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Cancellation Scheduled - ${planName} | ${clinicName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 680px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);">
          <tr>
            <td style="padding: 32px 32px 28px 32px;">

              <!-- Header: Left Branding & Right Connected Clinics -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td valign="top" align="left">
                    <div style="font-size: 32px; font-weight: 900; color: #059669; letter-spacing: -0.5px; line-height: 1;">VIITSA</div>
                    <div style="font-size: 11px; font-weight: 700; color: #059669; margin-top: 4px; letter-spacing: 0.2px;">Clinic-paid Healthcare SaaS</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px; font-style: italic;">Simplifying Care. Stronger Patients.</div>
                  </td>
                  <td valign="top" align="right">
                    <div style="font-size: 9px; font-weight: 800; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; line-height: 1.5; text-align: right;">
                      CONNECTED CLINICS<br/>HEALTHIER PATIENTS<br/>BRIGHTER TOMORROW
                    </div>
                    <div style="width: 40px; height: 2px; background-color: #059669; margin-top: 8px; margin-left: auto;"></div>
                  </td>
                </tr>
              </table>

              <!-- Document Title -->
              <div style="margin-bottom: 20px;">
                <h1 style="font-size: 26px; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.1; letter-spacing: -0.3px;">Cancellation Scheduled</h1>
                <div style="font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px;">SUBSCRIPTION LIFECYCLE &amp; SERVICE CONTINUITY NOTICE</div>
              </div>

              <!-- Two Cards: Clinic Details & Cancellation Schedule Details -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
                <tr>
                  <!-- Left Card: Clinic Info -->
                  <td width="55%" valign="top" style="padding-right: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; box-sizing: border-box;">
                      <tr>
                        <td>
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td width="50" valign="top">
                                <div style="width: 44px; height: 44px; border-radius: 8px; background-color: #059669; color: #ffffff; font-size: 20px; font-weight: 800; text-align: center; line-height: 44px;">
                                  ${clinicInitial}
                                </div>
                              </td>
                              <td valign="top" style="padding-left: 8px;">
                                <div style="font-size: 15px; font-weight: 800; color: #0f172a; line-height: 1.2;">${clinicName}</div>
                                <div style="font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.4;">${clinicAddress}</div>
                              </td>
                            </tr>
                          </table>
                          <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b;">
                            <span style="color: #059669; font-weight: 700; margin-right: 4px;">📞</span>
                            <span style="font-weight: 600; color: #334155;">${clinicPhone}</span>
                            <span style="color: #cbd5e1; margin: 0 8px;">|</span>
                            <span style="color: #059669; font-weight: 700; margin-right: 4px;">✉</span>
                            <span style="font-weight: 600; color: #334155;">${clinicEmail}</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Right Card: Cancellation Metadata -->
                  <td width="45%" valign="top" style="padding-left: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; box-sizing: border-box;">
                      <tr>
                        <td>
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 11px; line-height: 1.7;">
                            <tr>
                              <td style="color: #64748b;" width="44%">Request ID</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;" width="56%">${scheduleId}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Request Date</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;">${requestDate}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Active Through</td>
                              <td style="font-weight: 800; color: #059669; padding-left: 10px; border-left: 1px solid #e2e8f0;">${effectiveDate}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Auto-Renewal</td>
                              <td style="font-weight: 700; color: #dc2626; padding-left: 10px; border-left: 1px solid #e2e8f0;">Turned Off</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Future Charges</td>
                              <td style="font-weight: 800; color: #059669; padding-left: 10px; border-left: 1px solid #e2e8f0;">₹0.00 (Zero)</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Status</td>
                              <td style="padding-left: 10px; border-left: 1px solid #e2e8f0;">
                                <span style="background-color: #fef2f2; color: #991b1b; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase;">ACTIVE THROUGH CYCLE END</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Middle Card: Service Continuity & Active Retainment Guarantee -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; border-collapse: separate; border-spacing: 0;">
                <tr>
                  <td style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="left" style="font-size: 11px; font-weight: 700; color: #0f172a;">
                          🛡️ Complete Operational Continuity &amp; Retainment Guarantee
                        </td>
                        <td align="right" style="font-size: 10px; color: #64748b;">
                          Zero Interruption: <strong style="color: #059669;">Guaranteed</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 11px;">
                      <tr>
                        <!-- Current Active Plan Status -->
                        <td width="48%" valign="top">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="line-height: 1.8;">
                            <tr>
                              <td width="105" style="color: #64748b;">Subscription Plan</td>
                              <td width="10" style="color: #94a3b8;">:</td>
                              <td style="font-weight: 700; color: #0f172a;">${planName}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Access Through</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 800; color: #059669;">${effectiveDate}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Operational State</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 600; color: #0f172a;">100% Active &amp; Operational</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Doctor Seats</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 600; color: #334155;">Full Concurrent Logins Active</td>
                            </tr>
                          </table>
                        </td>

                        <td width="4%" align="center" valign="middle">
                          <div style="width: 1px; height: 75px; background-color: #e2e8f0;"></div>
                        </td>

                        <!-- Data Protection & Resume -->
                        <td width="48%" valign="top">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="line-height: 1.8;">
                            <tr>
                              <td width="105" style="color: #64748b;">Patient Records</td>
                              <td width="10" style="color: #94a3b8;">:</td>
                              <td style="font-weight: 700; color: #059669;">100% Protected &amp; Preserved</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Clinical Invoices</td>
                              <td width="10" style="color: #94a3b8;">:</td>
                              <td style="font-weight: 600; color: #0f172a;">Securely Archived in Cloud</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Reactivation</td>
                              <td width="10" style="color: #94a3b8;">:</td>
                              <td style="font-weight: 800; color: #059669;">1-Click Resume Anytime</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Auto-Debit Mandate</td>
                              <td width="10" style="color: #94a3b8;">:</td>
                              <td style="font-weight: 700; color: #dc2626;">Successfully Revoked</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Capabilities & Entitlements Table: Solid Medical Emerald Header -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; border-collapse: separate; border-spacing: 0;">
                <tr>
                  <td colspan="4" style="background-color: #059669; padding: 10px 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="left" style="font-size: 11px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">
                          ACTIVE PLAN CAPABILITIES UNTIL EXPIRY DATE
                        </td>
                        <td align="right" style="font-size: 10px; font-weight: 600; color: #ecfdf5;">
                          Current Status: 100% Active
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr style="background-color: #f8fafc; font-size: 11px; font-weight: 700; color: #1e293b;">
                  <td style="padding: 9px 8px; text-align: center; border-bottom: 1px solid #e2e8f0;" width="5%">#</td>
                  <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0;" width="25%">Module / Feature</td>
                  <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0;" width="35%">Current Operational Status</td>
                  <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0;" width="35%">Lifecycle &amp; Expiry Policy</td>
                </tr>
                ${items.map((item, index) => `
                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px;">
                  <td style="padding: 10px 8px; text-align: center; color: #94a3b8; font-family: monospace; border-bottom: 1px solid #f1f5f9;">${index + 1}</td>
                  <td style="padding: 10px 12px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">
                    <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #059669; margin-right: 6px; vertical-align: middle;"></span>
                    ${item.category}
                  </td>
                  <td style="padding: 10px 12px; color: #334155; line-height: 1.4; border-bottom: 1px solid #f1f5f9;">
                    <div style="font-weight: 600; color: #059669;">${item.status}</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${item.description}</div>
                  </td>
                  <td style="padding: 10px 12px; color: #475569; font-size: 10.5px; line-height: 1.4; border-bottom: 1px solid #f1f5f9;">
                    ${item.policy}
                  </td>
                </tr>
                `).join('')}
              </table>

              <!-- Policy & Data Safety Notice: Dual Card Layout -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
                <tr>
                  <!-- Left: Data Safety Guarantees -->
                  <td width="52%" valign="top" style="padding-right: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background-color: #ffffff; height: 100%;">
                      <tr>
                        <td style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px 12px; font-size: 11px; font-weight: 700; color: #0f172a;">
                          📋 Compliance &amp; Data Preservation Guarantee
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 14px; font-size: 11px; color: #334155; line-height: 1.6;">
                          <div style="margin-bottom: 6px; display: flex; align-items: flex-start;">
                            <span style="color: #059669; font-weight: 800; margin-right: 8px; font-size: 13px; line-height: 1;">•</span>
                            <span><strong>No Data Deletion:</strong> Your patient health records and consultation histories remain fully encrypted and preserved.</span>
                          </div>
                          <div style="margin-bottom: 6px; display: flex; align-items: flex-start;">
                            <span style="color: #059669; font-weight: 800; margin-right: 8px; font-size: 13px; line-height: 1;">•</span>
                            <span><strong>Export Anytime:</strong> Download patient summaries, medical bills, and appointment logs whenever required.</span>
                          </div>
                          <div style="margin-bottom: 6px; display: flex; align-items: flex-start;">
                            <span style="color: #059669; font-weight: 800; margin-right: 8px; font-size: 13px; line-height: 1;">•</span>
                            <span><strong>Zero Billing Surprises:</strong> Auto-renewal mandate is severed. No future debits will occur.</span>
                          </div>
                          <div style="display: flex; align-items: flex-start;">
                            <span style="color: #059669; font-weight: 800; margin-right: 8px; font-size: 13px; line-height: 1;">•</span>
                            <span><strong>Reactivate Instantly:</strong> Changed your mind? Simply resume your plan in Billing Settings before ${effectiveDate}.</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Right: Feedback & Account Assistance -->
                  <td width="48%" valign="top" style="padding-left: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; font-size: 11px; background-color: #ffffff; height: 100%;">
                      <tr>
                        <td style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px 12px; font-size: 11px; font-weight: 700; color: #0f172a;">
                          💬 Feedback &amp; Dedicated Support
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 14px; line-height: 1.6;">
                          <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px;">Reason Recorded:</div>
                          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; font-size: 10.5px; color: #475569; font-style: italic; margin-bottom: 10px;">
                            "${reasonText}"
                          </div>
                          <div style="font-size: 10.5px; color: #64748b; line-height: 1.5;">
                            Need custom doctor seat pricing or tailored multi-clinic billing? Reach our enterprise advisory desk at 
                            <a href="mailto:support@viitsa.com" style="color: #059669; font-weight: 700; text-decoration: none;">support@viitsa.com</a>.
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Authorised Signatory & Governance -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 16px; padding-top: 14px; border-top: 1px solid #f1f5f9; font-size: 10px; color: #64748b;">
                <tr>
                  <td valign="bottom" align="left">
                    <div style="font-weight: 700; color: #334155; font-size: 11px;">${clinicName}</div>
                    <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">Authorised Healthcare Facility — VIITSA Digital Health Network</div>
                    <div style="font-size: 9px; color: #059669; font-weight: 700; margin-top: 4px;">
                      🔒 Official Lifecycle Event — Securely Recorded in Audit Trail
                    </div>
                  </td>
                  <td valign="bottom" align="right">
                    <div style="height: 28px; text-align: right; margin-bottom: 4px;">
                      <svg width="110" height="26" viewBox="0 0 140 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block;">
                        <path d="M12 26 C 30 10, 45 4, 60 18 C 70 28, 85 8, 95 24 C 105 30, 120 12, 130 18" stroke="#1e293b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                        <path d="M40 20 C 55 22, 75 14, 90 26" stroke="#059669" stroke-width="1.8" stroke-linecap="round" />
                      </svg>
                    </div>
                    <div style="width: 140px; border-bottom: 1px solid #94a3b8; margin-bottom: 4px; margin-left: auto;"></div>
                    <div style="font-weight: 700; color: #0f172a; font-size: 11px;">Viitsa Operations</div>
                    <div style="font-size: 9.5px; color: #64748b;">Subscription &amp; Billing Governance</div>
                    <div style="font-size: 9px; color: #94a3b8;">Platform ID: SAAS-2026-IN</div>
                  </td>
                </tr>
              </table>

              <!-- Platform Footer Badges -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                <tr>
                  <td width="35%" valign="middle" align="left">
                    <div style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Connected Clinic</div>
                    <div style="font-size: 20px; font-weight: 900; color: #059669; line-height: 1.1;">VIITSA</div>
                    <div style="font-size: 8px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase;">Better Care Together</div>
                  </td>
                  <td width="65%" valign="middle" align="right">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="right">
                      <tr>
                        <td align="center" style="padding: 0 10px; border-right: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">🛡️</div>
                          Zero Data<br/>Loss
                        </td>
                        <td align="center" style="padding: 0 10px; border-right: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">👥</div>
                          Uninterrupted<br/>Care
                        </td>
                        <td align="center" style="padding: 0 10px; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">📈</div>
                          Safe<br/>Retention
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Button & Links -->
              <div style="text-align: center; margin-top: 22px; padding-top: 16px; border-top: 1px solid #f1f5f9;">
                <a href="https://viitsa.com/clinic/settings?tab=billing" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff; padding: 12px 32px; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);">
                  Resume Subscription (Keep Plan)
                </a>
                <div style="margin-top: 10px;">
                  <a href="https://viitsa.com/clinic/settings?tab=billing" target="_blank" style="color: #059669; text-decoration: underline; font-size: 12px; font-weight: 600;">
                    Manage Billing Settings &amp; Invoices
                  </a>
                </div>
              </div>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export interface SubscriptionPlanChangeScheduledEmailData {
  clinicName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
  clinicEmail?: string;
  currentPlan?: string;
  newPlan?: string;
  cycle?: string;
  effectiveDate?: string;
  requestDate?: string;
  scheduleId?: string;
  newAmount?: string | number;
  paymentMethod?: string;
  transitionType?: string;
  lineItems?: Array<{
    category: string;
    description: string;
    scope: string;
    cycle: string;
    rate: string;
  }>;
}

export function buildSubscriptionPlanChangeScheduledHtml(data?: SubscriptionPlanChangeScheduledEmailData): string {
  const d = data || {};
  const clinicName = d.clinicName || 'Apollo Health Center';
  const clinicInitial = clinicName.trim().charAt(0).toUpperCase() || 'A';
  const clinicAddress = d.clinicAddress || 'Plot 42, Road No. 36, Jubilee Hills, Hyderabad';
  const clinicPhone = d.clinicPhone || '+91 90148 65154';
  const clinicEmail = d.clinicEmail || 'billing@apollohealth.com';
  const currentPlan = d.currentPlan || 'CLINIC Plan';
  const newPlan = d.newPlan || 'MULTISPECIALTY Plan';
  const cycle = (d.cycle || 'annual').toLowerCase();
  const cycleDisplay = cycle === 'annual' ? 'Annual Tier' : 'Monthly Tier';
  const effectiveDate = d.effectiveDate || '26 Nov 2026';
  const requestDate = d.requestDate || '20 Nov 2026';
  const scheduleId = d.scheduleId || 'SCHED-2026-9482';
  const paymentMethod = (d.paymentMethod || 'UPI Auto-Pay').toUpperCase();
  const transitionType = d.transitionType || 'TIER UPGRADE & EXPANSION';
  
  let rawNewAmount = cycle === 'annual' ? 119990 : 11999;
  if (d.newAmount !== undefined && d.newAmount !== null) {
    rawNewAmount = typeof d.newAmount === 'number' ? d.newAmount : parseFloat(String(d.newAmount).replace(/[^0-9.-]+/g, '')) || rawNewAmount;
  }
  const newAmountStr = formatInvoiceAmount(rawNewAmount);

  const items = d.lineItems || [
    {
      category: 'Software License',
      description: `Viitsa Clinic Pro — ${newPlan} (${cycleDisplay})`,
      scope: 'Full multi-department clinical workflow & practice analytics',
      cycle: cycleDisplay,
      rate: `₹${newAmountStr}`,
    },
    {
      category: 'Doctor & Staff Seats',
      description: 'Unlimited Doctor & Practice Staff Concurrent Logins',
      scope: 'Multi-device cloud access with role-based security permissions',
      cycle: 'Included',
      rate: '₹0.00',
    },
    {
      category: 'AI Clinical Intelligence',
      description: 'Automated Clinical Triage, Voice Rx & Intelligent Patient Intake',
      scope: 'Unlimited automated intake summaries & diagnostic suggestions',
      cycle: 'Included',
      rate: '₹0.00',
    },
    {
      category: 'WhatsApp Patient CRM',
      description: 'Official Meta Cloud API Digital Prescriptions & Reminders Quota',
      scope: 'Direct high-resolution PDF delivery & medicine dosage alerts',
      cycle: 'Included',
      rate: '₹0.00',
    },
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Plan Change Scheduled - ${newPlan} | ${clinicName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 680px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);">
          <tr>
            <td style="padding: 32px 32px 28px 32px;">

              <!-- Header: Left Branding & Right Connected Clinics -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td valign="top" align="left">
                    <div style="font-size: 32px; font-weight: 900; color: #059669; letter-spacing: -0.5px; line-height: 1;">VIITSA</div>
                    <div style="font-size: 11px; font-weight: 700; color: #059669; margin-top: 4px; letter-spacing: 0.2px;">Clinic-paid Healthcare SaaS</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px; font-style: italic;">Simplifying Care. Stronger Patients.</div>
                  </td>
                  <td valign="top" align="right">
                    <div style="font-size: 9px; font-weight: 800; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; line-height: 1.5; text-align: right;">
                      CONNECTED CLINICS<br/>HEALTHIER PATIENTS<br/>BRIGHTER TOMORROW
                    </div>
                    <div style="width: 40px; height: 2px; background-color: #059669; margin-top: 8px; margin-left: auto;"></div>
                  </td>
                </tr>
              </table>

              <!-- Document Title -->
              <div style="margin-bottom: 20px;">
                <h1 style="font-size: 26px; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.1; letter-spacing: -0.3px;">Plan Change Scheduled</h1>
                <div style="font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px;">SUBSCRIPTION SCHEDULE &amp; TRANSITION NOTICE</div>
              </div>

              <!-- Two Cards: Clinic Details & Schedule Details -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
                <tr>
                  <!-- Left Card: Clinic Info -->
                  <td width="55%" valign="top" style="padding-right: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; box-sizing: border-box;">
                      <tr>
                        <td>
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td width="50" valign="top">
                                <div style="width: 44px; height: 44px; border-radius: 8px; background-color: #059669; color: #ffffff; font-size: 20px; font-weight: 800; text-align: center; line-height: 44px;">
                                  ${clinicInitial}
                                </div>
                              </td>
                              <td valign="top" style="padding-left: 8px;">
                                <div style="font-size: 15px; font-weight: 800; color: #0f172a; line-height: 1.2;">${clinicName}</div>
                                <div style="font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.4;">${clinicAddress}</div>
                              </td>
                            </tr>
                          </table>
                          <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b;">
                            <span style="color: #059669; font-weight: 700; margin-right: 4px;">📞</span>
                            <span style="font-weight: 600; color: #334155;">${clinicPhone}</span>
                            <span style="color: #cbd5e1; margin: 0 8px;">|</span>
                            <span style="color: #059669; font-weight: 700; margin-right: 4px;">✉</span>
                            <span style="font-weight: 600; color: #334155;">${clinicEmail}</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Right Card: Schedule Details -->
                  <td width="45%" valign="top" style="padding-left: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; box-sizing: border-box;">
                      <tr>
                        <td>
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 11px; line-height: 1.7;">
                            <tr>
                              <td style="color: #64748b;" width="44%">Schedule ID</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;" width="56%">${scheduleId}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Request Date</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;">${requestDate}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Effective Date</td>
                              <td style="font-weight: 800; color: #059669; padding-left: 10px; border-left: 1px solid #e2e8f0;">${effectiveDate}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Billing Cycle</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;">${cycleDisplay}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Status</td>
                              <td style="padding-left: 10px; border-left: 1px solid #e2e8f0;">
                                <span style="background-color: #dcfce7; color: #166534; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase;">CYCLE-END SCHEDULED</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Middle Card: Current Plan vs Upcoming Plan Comparison -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; border-collapse: separate; border-spacing: 0;">
                <tr>
                  <td style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="left" style="font-size: 11px; font-weight: 700; color: #0f172a;">
                          🔄 Current Active Plan vs. Upcoming Scheduled Plan
                        </td>
                        <td align="right" style="font-size: 10px; color: #64748b;">
                          Zero Downtime Migration: <strong style="color: #059669;">Guaranteed</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 11px;">
                      <tr>
                        <!-- Current Active Plan -->
                        <td width="48%" valign="top">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="line-height: 1.8;">
                            <tr>
                              <td width="100" style="color: #64748b;">Current Plan</td>
                              <td width="10" style="color: #94a3b8;">:</td>
                              <td style="font-weight: 700; color: #0f172a;">${currentPlan}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Service Status</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 600; color: #0f172a;">Active &amp; Operational</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Access Through</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 600; color: #059669;">${effectiveDate} (Cycle End)</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Clinical Impact</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 600; color: #334155;">100% Uninterrupted Care</td>
                            </tr>
                          </table>
                        </td>

                        <td width="4%" align="center" valign="middle">
                          <div style="width: 1px; height: 75px; background-color: #e2e8f0;"></div>
                        </td>

                        <!-- Upcoming Scheduled Plan -->
                        <td width="48%" valign="top">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="line-height: 1.8;">
                            <tr>
                              <td width="100" style="color: #64748b;">Upcoming Plan</td>
                              <td width="10" style="color: #94a3b8;">:</td>
                              <td style="font-weight: 800; color: #059669;">${newPlan}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Target Cycle</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 600; color: #0f172a;">${cycleDisplay}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Activation Date</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 800; color: #059669;">${effectiveDate}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Renewal Charge</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 800; color: #0f172a; font-family: monospace;">₹${newAmountStr}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Upcoming Plan Specifications Table: Solid Medical Emerald Header -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; border-collapse: separate; border-spacing: 0;">
                <tr>
                  <td colspan="5" style="background-color: #059669; padding: 10px 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="left" style="font-size: 11px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">
                          UPCOMING PLAN SPECIFICATIONS &amp; CAPABILITIES
                        </td>
                        <td align="right" style="font-size: 10px; font-weight: 600; color: #ecfdf5;">
                          Cur: INR (₹)
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr style="background-color: #f8fafc; font-size: 11px; font-weight: 700; color: #1e293b;">
                  <td style="padding: 9px 8px; text-align: center; border-bottom: 1px solid #e2e8f0;" width="5%">#</td>
                  <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0;" width="22%">Feature / Entitlement</td>
                  <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0;" width="43%">Capability Scope &amp; Allocation</td>
                  <td style="padding: 9px 8px; text-align: center; border-bottom: 1px solid #e2e8f0;" width="14%">Billing Cycle</td>
                  <td style="padding: 9px 12px; text-align: right; border-bottom: 1px solid #e2e8f0;" width="16%">Plan Rate</td>
                </tr>
                ${items.map((item, index) => `
                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px;">
                  <td style="padding: 10px 8px; text-align: center; color: #94a3b8; font-family: monospace; border-bottom: 1px solid #f1f5f9;">${index + 1}</td>
                  <td style="padding: 10px 12px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">
                    <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #059669; margin-right: 6px; vertical-align: middle;"></span>
                    ${item.category}
                  </td>
                  <td style="padding: 10px 12px; color: #334155; line-height: 1.4; border-bottom: 1px solid #f1f5f9;">
                    <div style="font-weight: 600; color: #0f172a;">${item.description}</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${item.scope}</div>
                  </td>
                  <td style="padding: 10px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 1px solid #f1f5f9;">${item.cycle}</td>
                  <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #0f172a; font-family: monospace; border-bottom: 1px solid #f1f5f9;">${item.rate}</td>
                </tr>
                `).join('')}
              </table>

              <!-- Policy & Billing Summary: Dual Card Layout -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
                <tr>
                  <!-- Left: Service Continuity Policy -->
                  <td width="52%" valign="top" style="padding-right: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background-color: #ffffff; height: 100%;">
                      <tr>
                        <td style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px 12px; font-size: 11px; font-weight: 700; color: #0f172a;">
                          📋 Service Continuity &amp; Transition Policy
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 14px; font-size: 11px; color: #334155; line-height: 1.6;">
                          <div style="margin-bottom: 6px; display: flex; align-items: flex-start;">
                            <span style="color: #059669; font-weight: 800; margin-right: 8px; font-size: 13px; line-height: 1;">•</span>
                            <span><strong>Uninterrupted Access:</strong> Your current plan and seats remain fully operational until ${effectiveDate}.</span>
                          </div>
                          <div style="margin-bottom: 6px; display: flex; align-items: flex-start;">
                            <span style="color: #059669; font-weight: 800; margin-right: 8px; font-size: 13px; line-height: 1;">•</span>
                            <span><strong>Zero Downtime Switch:</strong> Your new plan activates automatically on ${effectiveDate} without service restart.</span>
                          </div>
                          <div style="margin-bottom: 6px; display: flex; align-items: flex-start;">
                            <span style="color: #059669; font-weight: 800; margin-right: 8px; font-size: 13px; line-height: 1;">•</span>
                            <span><strong>Patient Data Safe:</strong> All consultation notes, patient histories, and cloud records are strictly preserved.</span>
                          </div>
                          <div style="display: flex; align-items: flex-start;">
                            <span style="color: #059669; font-weight: 800; margin-right: 8px; font-size: 13px; line-height: 1;">•</span>
                            <span><strong>Modify Anytime:</strong> You can cancel or alter this scheduled transition in your billing portal before ${effectiveDate}.</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Right: Scheduled Renewal Billing Summary -->
                  <td width="48%" valign="top" style="padding-left: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; font-size: 11px; background-color: #ffffff; height: 100%;">
                      <tr>
                        <td style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px 12px; font-size: 11px; font-weight: 700; color: #0f172a;">
                          💳 Scheduled Renewal &amp; Billing Summary
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 14px; line-height: 1.8;">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td style="color: #64748b;">Activation Date</td>
                              <td align="right" style="font-weight: 800; color: #059669;">${effectiveDate}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Renewal Frequency</td>
                              <td align="right" style="font-weight: 600; color: #0f172a;">${cycleDisplay}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Scheduled Charge</td>
                              <td align="right" style="font-family: monospace; font-weight: 800; color: #0f172a; font-size: 13px;">₹${newAmountStr}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Payment Method</td>
                              <td align="right" style="font-weight: 600; color: #334155;">${paymentMethod}</td>
                            </tr>
                          </table>
                          <div style="margin-top: 10px; padding: 8px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 10px; color: #64748b; line-height: 1.4;">
                            Official GST tax invoice will be automatically issued and emailed upon successful scheduled payment.
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Authorised Signatory & Governance -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 16px; padding-top: 14px; border-top: 1px solid #f1f5f9; font-size: 10px; color: #64748b;">
                <tr>
                  <td valign="bottom" align="left">
                    <div style="font-weight: 700; color: #334155; font-size: 11px;">${clinicName}</div>
                    <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">Authorised Healthcare Facility — VIITSA Digital Health Network</div>
                    <div style="font-size: 9px; color: #059669; font-weight: 700; margin-top: 4px;">
                      🔒 Automated Subscription Lifecycle Engine — ISO 27001 &amp; HIPAA Ready
                    </div>
                  </td>
                  <td valign="bottom" align="right">
                    <div style="height: 28px; text-align: right; margin-bottom: 4px;">
                      <svg width="110" height="26" viewBox="0 0 140 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block;">
                        <path d="M12 26 C 30 10, 45 4, 60 18 C 70 28, 85 8, 95 24 C 105 30, 120 12, 130 18" stroke="#1e293b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                        <path d="M40 20 C 55 22, 75 14, 90 26" stroke="#059669" stroke-width="1.8" stroke-linecap="round" />
                      </svg>
                    </div>
                    <div style="width: 140px; border-bottom: 1px solid #94a3b8; margin-bottom: 4px; margin-left: auto;"></div>
                    <div style="font-weight: 700; color: #0f172a; font-size: 11px;">Viitsa Operations</div>
                    <div style="font-size: 9.5px; color: #64748b;">Subscription &amp; Billing Governance</div>
                    <div style="font-size: 9px; color: #94a3b8;">Platform ID: SAAS-2026-IN</div>
                  </td>
                </tr>
              </table>

              <!-- Platform Footer Badges -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                <tr>
                  <td width="35%" valign="middle" align="left">
                    <div style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Connected Clinic</div>
                    <div style="font-size: 20px; font-weight: 900; color: #059669; line-height: 1.1;">VIITSA</div>
                    <div style="font-size: 8px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase;">Better Care Together</div>
                  </td>
                  <td width="65%" valign="middle" align="right">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="right">
                      <tr>
                        <td align="center" style="padding: 0 10px; border-right: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">🛡️</div>
                          Uninterrupted<br/>Service
                        </td>
                        <td align="center" style="padding: 0 10px; border-right: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">👥</div>
                          Zero Downtime<br/>Switch
                        </td>
                        <td align="center" style="padding: 0 10px; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">📈</div>
                          Continuous<br/>Care
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Button & Links -->
              <div style="text-align: center; margin-top: 22px; padding-top: 16px; border-top: 1px solid #f1f5f9;">
                <a href="https://viitsa.com/clinic/settings?tab=billing" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff; padding: 12px 32px; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);">
                  Manage Subscription Settings
                </a>
                <div style="margin-top: 10px;">
                  <a href="https://viitsa.com/clinic/settings?tab=billing" target="_blank" style="color: #059669; text-decoration: underline; font-size: 12px; font-weight: 600;">
                    Modify Scheduled Transition or Cancel
                  </a>
                </div>
              </div>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export function buildPasswordResetHtml(data?: {
  email?: string;
  resetLink?: string;
  portal?: 'clinic' | 'admin' | 'patient';
  userName?: string;
  requestedAt?: string;
  ipAddress?: string;
}): string {
  const d = data || {};
  const email = d.email || 'user@example.com';
  const resetLink = d.resetLink || 'https://viitsa.com/reset-password';
  const portal = d.portal || 'clinic';
  const userName = d.userName;
  const requestedAt = d.requestedAt;
  const ipAddress = d.ipAddress;
  const portalTitle = portal === 'admin' ? 'Admin Portal' : (portal === 'clinic' ? 'Clinic Portal' : 'Patient Portal');
  const greeting = userName ? `Hello <strong>${userName}</strong>` : (portal === 'admin' ? 'Hello <strong>Administrator</strong>' : (portal === 'clinic' ? 'Hello <strong>Doctor / Clinic Administrator</strong>' : 'Hello <strong>Patient</strong>'));
  const roleName = portal === 'admin' ? 'Viitsa Administrator' : (portal === 'clinic' ? 'Viitsa Clinic Management' : 'Viitsa Patient Health');
  const reqTime = requestedAt || 'Just now';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Reset Your Password - ${portalTitle} | Viitsa</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 680px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);">
          <tr>
            <td style="padding: 32px 32px 28px 32px;">

              <!-- Header: Left Branding & Right Connected Clinics -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td valign="top" align="left">
                    <div style="font-size: 32px; font-weight: 900; color: #059669; letter-spacing: -0.5px; line-height: 1;">VIITSA</div>
                    <div style="font-size: 11px; font-weight: 700; color: #059669; margin-top: 4px; letter-spacing: 0.2px;">Healthcare Security &amp; Access Management</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px; font-style: italic;">Simplifying Care. Stronger Patients.</div>
                  </td>
                  <td valign="top" align="right">
                    <div style="font-size: 9px; font-weight: 800; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; line-height: 1.5; text-align: right;">
                      CONNECTED CLINICS<br/>HEALTHIER PATIENTS<br/>BRIGHTER TOMORROW
                    </div>
                    <div style="width: 40px; height: 2px; background-color: #059669; margin-top: 8px; margin-left: auto;"></div>
                  </td>
                </tr>
              </table>

              <!-- Document Title -->
              <div style="margin-bottom: 16px;">
                <h1 style="font-size: 26px; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.1; letter-spacing: -0.3px;">Reset Your Password</h1>
                <div style="font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px;">OFFICIAL ${portalTitle.toUpperCase()} SECURITY REQUEST</div>
              </div>

              <!-- Two Cards: Account Details & Security Request Details -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
                <tr>
                  <!-- Left Card: Account Details -->
                  <td width="55%" valign="top" style="padding-right: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; box-sizing: border-box;">
                      <tr>
                        <td>
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td width="50" valign="top">
                                <div style="width: 44px; height: 44px; border-radius: 8px; background-color: #059669; color: #ffffff; font-size: 20px; font-weight: 800; text-align: center; line-height: 44px;">
                                  🔒
                                </div>
                              </td>
                              <td valign="top" style="padding-left: 8px;">
                                <div style="font-size: 15px; font-weight: 800; color: #0f172a; line-height: 1.2;">${roleName}</div>
                                <div style="font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.4;">Target Account: <strong style="color: #0f172a;">${email}</strong></div>
                              </td>
                            </tr>
                          </table>
                          <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b;">
                            <span style="color: #059669; font-weight: 700; margin-right: 4px;">🛡️</span>
                            <span style="font-weight: 600; color: #334155;">256-Bit TLS End-to-End Encrypted Session</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Right Card: Security Request Metadata -->
                  <td width="45%" valign="top" style="padding-left: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; box-sizing: border-box;">
                      <tr>
                        <td>
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 11px; line-height: 1.7;">
                            <tr>
                              <td style="color: #64748b;" width="44%">Request Type</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;" width="56%">Password Reset</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Target Portal</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;">${portalTitle}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Link Validity</td>
                              <td style="font-weight: 800; color: #059669; padding-left: 10px; border-left: 1px solid #e2e8f0;">60 Minutes</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Security Level</td>
                              <td style="font-weight: 600; color: #334155; padding-left: 10px; border-left: 1px solid #e2e8f0;">High (Zero-Knowledge)</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Status</td>
                              <td style="padding-left: 10px; border-left: 1px solid #e2e8f0;">
                                <span style="background-color: #dcfce7; color: #166534; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase;">AWAITING CONFIRMATION</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Middle Card: Request Message & Instructions -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; border-collapse: separate; border-spacing: 0;">
                <tr>
                  <td style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="left" style="font-size: 11px; font-weight: 700; color: #0f172a;">
                          🔐 Security Verification Instructions
                        </td>
                        <td align="right" style="font-size: 10px; color: #64748b;">
                          Session Time: <strong style="color: #0f172a;">${reqTime}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 14px; font-size: 13px; color: #334155; line-height: 1.6;">
                    <p style="margin: 0 0 10px 0;">${greeting},</p>
                    <p style="margin: 0 0 14px 0;">
                      We received a request to reset the access credentials for your <strong>${roleName}</strong> account associated with <strong>${email}</strong>.
                    </p>
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; font-size: 11px; color: #475569;">
                      <strong>Security Tip:</strong> Choose a strong password containing at least 8 characters, with a mix of uppercase letters, lowercase letters, numbers, and symbols.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Primary Call to Action Button -->
              <div style="text-align: center; margin: 24px 0 20px 0;">
                <a href="${resetLink}" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff; padding: 14px 38px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.28);">
                  Reset My Password
                </a>
              </div>

              <!-- Direct Link Fallback Container -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; font-size: 11px;">
                <div style="font-weight: 700; color: #64748b; margin-bottom: 4px; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Direct Link Fallback:</div>
                <a href="${resetLink}" target="_blank" style="color: #059669; word-break: break-all; line-height: 1.4; text-decoration: underline; font-weight: 600;">${resetLink}</a>
              </div>

              <!-- Security Notice -->
              <div style="font-size: 11px; color: #64748b; line-height: 1.5; margin-bottom: 16px; padding: 0 4px;">
                This password reset link is strictly valid for <strong>60 minutes</strong>. If you did not initiate this request, please disregard this notice; your credentials will remain unchanged and your account is secure.
              </div>

              <!-- Authorised Signatory & Governance -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 16px; padding-top: 14px; border-top: 1px solid #f1f5f9; font-size: 10px; color: #64748b;">
                <tr>
                  <td valign="bottom" align="left">
                    <div style="font-weight: 700; color: #334155; font-size: 11px;">VIITSA Identity &amp; Access Governance</div>
                    <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">HIPAA &amp; ISO 27001 Certified Authentication Infrastructure</div>
                    <div style="font-size: 9px; color: #059669; font-weight: 700; margin-top: 4px;">
                      🔒 Zero-Knowledge Cryptographic Token Verification
                    </div>
                  </td>
                  <td valign="bottom" align="right">
                    <div style="width: 140px; border-bottom: 1px solid #94a3b8; margin-bottom: 4px; margin-left: auto;"></div>
                    <div style="font-weight: 700; color: #0f172a; font-size: 11px;">Identity Operations</div>
                    <div style="font-size: 9.5px; color: #64748b;">Platform Security Desk</div>
                    <div style="font-size: 9px; color: #94a3b8;">Auth Protocol: OIDC / OAuth2</div>
                  </td>
                </tr>
              </table>

              <!-- Platform Footer Badges -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                <tr>
                  <td width="35%" valign="middle" align="left">
                    <div style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Connected Clinic</div>
                    <div style="font-size: 20px; font-weight: 900; color: #059669; line-height: 1.1;">VIITSA</div>
                    <div style="font-size: 8px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase;">Better Care Together</div>
                  </td>
                  <td width="65%" valign="middle" align="right">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="right">
                      <tr>
                        <td align="center" style="padding: 0 10px; border-right: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">🛡️</div>
                          Secure Patient<br/>Records
                        </td>
                        <td align="center" style="padding: 0 10px; border-right: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">👥</div>
                          Seamless Clinic<br/>Experience
                        </td>
                        <td align="center" style="padding: 0 10px; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">📈</div>
                          Better Health<br/>Outcomes
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export function buildVerificationHtml(data?: {
  email?: string;
  verifyLink?: string;
  portal?: 'clinic' | 'patient';
  name?: string;
}): string {
  const d = data || {};
  const email = d.email || 'user@example.com';
  const verifyLink = d.verifyLink || 'https://viitsa.com/login';
  const portal = d.portal || 'clinic';
  const name = d.name;
  const isClinic = portal === 'clinic';
  const portalTitle = isClinic ? 'Clinic Portal' : 'Patient Portal';
  const greeting = name ? `Hello <strong>${name}</strong>` : (isClinic ? 'Hello <strong>Doctor / Clinic Administrator</strong>' : 'Hello <strong>Patient</strong>');
  const bodyMessage = isClinic
    ? "Thank you for registering your clinical facility with Viitsa Healthcare. Please verify your email address to complete registration and unlock administrative dashboard capabilities."
    : "Thank you for joining the Viitsa Healthcare Network. Please verify your email address to activate your digital patient portal and access your medical records.";
  const buttonText = isClinic ? "Verify & Activate Clinic Account" : "Verify & Activate Patient Account";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Verify Your Email - ${portalTitle} | Viitsa</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 680px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);">
          <tr>
            <td style="padding: 32px 32px 28px 32px;">

              <!-- Header: Left Branding & Right Connected Clinics -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td valign="top" align="left">
                    <div style="font-size: 32px; font-weight: 900; color: #059669; letter-spacing: -0.5px; line-height: 1;">VIITSA</div>
                    <div style="font-size: 11px; font-weight: 700; color: #059669; margin-top: 4px; letter-spacing: 0.2px;">Healthcare Identity &amp; Portal Verification</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px; font-style: italic;">Simplifying Care. Stronger Patients.</div>
                  </td>
                  <td valign="top" align="right">
                    <div style="font-size: 9px; font-weight: 800; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; line-height: 1.5; text-align: right;">
                      CONNECTED CLINICS<br/>HEALTHIER PATIENTS<br/>BRIGHTER TOMORROW
                    </div>
                    <div style="width: 40px; height: 2px; background-color: #059669; margin-top: 8px; margin-left: auto;"></div>
                  </td>
                </tr>
              </table>

              <!-- Document Title -->
              <div style="margin-bottom: 16px;">
                <h1 style="font-size: 26px; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.1; letter-spacing: -0.3px;">Verify Your Email Address</h1>
                <div style="font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px;">OFFICIAL ${portalTitle.toUpperCase()} ACCOUNT ACTIVATION</div>
              </div>

              <!-- Two Cards: Registered Account Details & Activation Metadata -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
                <tr>
                  <!-- Left Card: Registered Account Details -->
                  <td width="55%" valign="top" style="padding-right: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; box-sizing: border-box;">
                      <tr>
                        <td>
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td width="50" valign="top">
                                <div style="width: 44px; height: 44px; border-radius: 8px; background-color: #059669; color: #ffffff; font-size: 20px; font-weight: 800; text-align: center; line-height: 44px;">
                                  ✓
                                </div>
                              </td>
                              <td valign="top" style="padding-left: 8px;">
                                <div style="font-size: 15px; font-weight: 800; color: #0f172a; line-height: 1.2;">${name || (isClinic ? 'Clinic Administrator' : 'Patient Account')}</div>
                                <div style="font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.4;">Registered Email: <strong style="color: #0f172a;">${email}</strong></div>
                              </td>
                            </tr>
                          </table>
                          <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b;">
                            <span style="color: #059669; font-weight: 700; margin-right: 4px;">🏥</span>
                            <span style="font-weight: 600; color: #334155;">VIITSA Digital Healthcare Network Member</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Right Card: Activation Metadata -->
                  <td width="45%" valign="top" style="padding-left: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; box-sizing: border-box;">
                      <tr>
                        <td>
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 11px; line-height: 1.7;">
                            <tr>
                              <td style="color: #64748b;" width="44%">Action Required</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;" width="56%">Email Verification</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Target Portal</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;">${portalTitle}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Token Expiry</td>
                              <td style="font-weight: 800; color: #059669; padding-left: 10px; border-left: 1px solid #e2e8f0;">24 Hours</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Access Mode</td>
                              <td style="font-weight: 600; color: #334155; padding-left: 10px; border-left: 1px solid #e2e8f0;">Secure Activation</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Status</td>
                              <td style="padding-left: 10px; border-left: 1px solid #e2e8f0;">
                                <span style="background-color: #fef3c7; color: #92400e; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase;">VERIFICATION PENDING</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Middle Card: Welcome & Instructions -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; border-collapse: separate; border-spacing: 0;">
                <tr>
                  <td style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px 14px;">
                    <div style="font-size: 11px; font-weight: 700; color: #0f172a;">
                      ✉️ Account Activation Notice
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 14px; font-size: 13px; color: #334155; line-height: 1.6;">
                    <p style="margin: 0 0 10px 0;">${greeting},</p>
                    <p style="margin: 0 0 14px 0;">
                      ${bodyMessage}
                    </p>
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; font-size: 11px; color: #475569;">
                      Confirming your email address ensures uninterrupted access to appointment scheduling, prescription tracking, and encrypted healthcare records.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Primary Call to Action Button -->
              <div style="text-align: center; margin: 24px 0 20px 0;">
                <a href="${verifyLink}" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff; padding: 14px 38px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.28);">
                  ${buttonText}
                </a>
              </div>

              <!-- Direct Link Fallback Container -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; font-size: 11px;">
                <div style="font-weight: 700; color: #64748b; margin-bottom: 4px; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Direct Link Fallback:</div>
                <a href="${verifyLink}" target="_blank" style="color: #059669; word-break: break-all; line-height: 1.4; text-decoration: underline; font-weight: 600;">${verifyLink}</a>
              </div>

              <!-- Security Notice -->
              <div style="font-size: 11px; color: #64748b; line-height: 1.5; margin-bottom: 16px; padding: 0 4px;">
                If you did not register for an account with Viitsa Healthcare (${email}), you can safely ignore this email.
              </div>

              <!-- Authorised Signatory & Governance -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 16px; padding-top: 14px; border-top: 1px solid #f1f5f9; font-size: 10px; color: #64748b;">
                <tr>
                  <td valign="bottom" align="left">
                    <div style="font-weight: 700; color: #334155; font-size: 11px;">VIITSA Identity &amp; Access Governance</div>
                    <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">HIPAA &amp; ISO 27001 Certified Authentication Infrastructure</div>
                    <div style="font-size: 9px; color: #059669; font-weight: 700; margin-top: 4px;">
                      🔒 Authenticated Registration Token Verification
                    </div>
                  </td>
                  <td valign="bottom" align="right">
                    <div style="width: 140px; border-bottom: 1px solid #94a3b8; margin-bottom: 4px; margin-left: auto;"></div>
                    <div style="font-weight: 700; color: #0f172a; font-size: 11px;">Identity Operations</div>
                    <div style="font-size: 9.5px; color: #64748b;">Platform Security Desk</div>
                    <div style="font-size: 9px; color: #94a3b8;">Auth Protocol: OIDC / OAuth2</div>
                  </td>
                </tr>
              </table>

              <!-- Platform Footer Badges -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                <tr>
                  <td width="35%" valign="middle" align="left">
                    <div style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Connected Clinic</div>
                    <div style="font-size: 20px; font-weight: 900; color: #059669; line-height: 1.1;">VIITSA</div>
                    <div style="font-size: 8px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase;">Better Care Together</div>
                  </td>
                  <td width="65%" valign="middle" align="right">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="right">
                      <tr>
                        <td align="center" style="padding: 0 10px; border-right: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">🛡️</div>
                          Secure Patient<br/>Records
                        </td>
                        <td align="center" style="padding: 0 10px; border-right: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">👥</div>
                          Seamless Clinic<br/>Experience
                        </td>
                        <td align="center" style="padding: 0 10px; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">📈</div>
                          Better Health<br/>Outcomes
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export function buildClinicPendingHtml(data?: {
  clinicName?: string;
  clinicEmail?: string;
  phone?: string;
  address?: string;
  city?: string;
}): string {
  const d = data || {};
  const clinicName = d.clinicName || 'Clinic';
  const clinicEmail = d.clinicEmail || 'contact@apollohealth.org';
  const phone = d.phone || '+91 98765 43210';
  const address = d.address || 'Plot 42, Hitech City';
  const city = d.city || 'Hyderabad';
  const clinicInitial = (clinicName || 'C').trim().charAt(0).toUpperCase() || 'C';
  const fullAddress = `${address}${city ? ', ' + city : ''}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Verification Under Process - ${clinicName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 680px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);">
          <tr>
            <td style="padding: 32px 32px 28px 32px;">

              <!-- Header: Left Branding & Right Connected Clinics -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td valign="top" align="left">
                    <div style="font-size: 32px; font-weight: 900; color: #059669; letter-spacing: -0.5px; line-height: 1;">VIITSA</div>
                    <div style="font-size: 11px; font-weight: 700; color: #059669; margin-top: 4px; letter-spacing: 0.2px;">Clinic Compliance &amp; Credentialing Review</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px; font-style: italic;">Simplifying Care. Stronger Patients.</div>
                  </td>
                  <td valign="top" align="right">
                    <div style="font-size: 9px; font-weight: 800; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; line-height: 1.5; text-align: right;">
                      CONNECTED CLINICS<br/>HEALTHIER PATIENTS<br/>BRIGHTER TOMORROW
                    </div>
                    <div style="width: 40px; height: 2px; background-color: #059669; margin-top: 8px; margin-left: auto;"></div>
                  </td>
                </tr>
              </table>

              <!-- Document Title -->
              <div style="margin-bottom: 16px;">
                <h1 style="font-size: 26px; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.1; letter-spacing: -0.3px;">Verification Under Process</h1>
                <div style="font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px;">CLINICAL REGISTRATION &amp; COMPLIANCE REVIEW</div>
              </div>

              <!-- Two Cards: Clinic Details & Review Schedule -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
                <tr>
                  <!-- Left Card: Clinic Details -->
                  <td width="55%" valign="top" style="padding-right: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; box-sizing: border-box;">
                      <tr>
                        <td>
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td width="50" valign="top">
                                <div style="width: 44px; height: 44px; border-radius: 8px; background-color: #059669; color: #ffffff; font-size: 20px; font-weight: 800; text-align: center; line-height: 44px;">
                                  ${clinicInitial}
                                </div>
                              </td>
                              <td valign="top" style="padding-left: 8px;">
                                <div style="font-size: 15px; font-weight: 800; color: #0f172a; line-height: 1.2;">${clinicName}</div>
                                <div style="font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.4;">${fullAddress}</div>
                              </td>
                            </tr>
                          </table>
                          <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b;">
                            <span style="color: #059669; font-weight: 700; margin-right: 4px;">📞</span>
                            <span style="font-weight: 600; color: #334155;">${phone}</span>
                            <span style="color: #cbd5e1; margin: 0 8px;">|</span>
                            <span style="color: #059669; font-weight: 700; margin-right: 4px;">✉</span>
                            <span style="font-weight: 600; color: #334155;">${clinicEmail}</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Right Card: Review Schedule -->
                  <td width="45%" valign="top" style="padding-left: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; box-sizing: border-box;">
                      <tr>
                        <td>
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 11px; line-height: 1.7;">
                            <tr>
                              <td style="color: #64748b;" width="44%">Stage</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;" width="56%">Credential Audit</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Target Window</td>
                              <td style="font-weight: 800; color: #059669; padding-left: 10px; border-left: 1px solid #e2e8f0;">24 - 48 Hours</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Documents</td>
                              <td style="font-weight: 600; color: #059669; padding-left: 10px; border-left: 1px solid #e2e8f0;">Received ✓</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Audit Protocol</td>
                              <td style="font-weight: 600; color: #334155; padding-left: 10px; border-left: 1px solid #e2e8f0;">Medical Reg. Check</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Status</td>
                              <td style="padding-left: 10px; border-left: 1px solid #e2e8f0;">
                                <span style="background-color: #fef3c7; color: #92400e; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase;">REVIEW IN PROGRESS</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Review Checklist Table: Solid Medical Emerald Header -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; border-collapse: separate; border-spacing: 0;">
                <tr>
                  <td colspan="4" style="background-color: #059669; padding: 10px 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="left" style="font-size: 11px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">
                          CLINIC CREDENTIALING &amp; COMPLIANCE CHECKLIST
                        </td>
                        <td align="right" style="font-size: 10px; font-weight: 600; color: #ecfdf5;">
                          Priority: Standard Clinical
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr style="background-color: #f8fafc; font-size: 11px; font-weight: 700; color: #1e293b;">
                  <td style="padding: 9px 8px; text-align: center; border-bottom: 1px solid #e2e8f0;" width="5%">#</td>
                  <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0;" width="35%">Verification Checkpoint</td>
                  <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0;" width="40%">Audited Details</td>
                  <td style="padding: 9px 12px; text-align: right; border-bottom: 1px solid #e2e8f0;" width="20%">Status</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px;">
                  <td style="padding: 10px 8px; text-align: center; color: #94a3b8; font-family: monospace; border-bottom: 1px solid #f1f5f9;">1</td>
                  <td style="padding: 10px 12px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">Medical Establishment License</td>
                  <td style="padding: 10px 12px; color: #334155; border-bottom: 1px solid #f1f5f9;">Clinic registration certification &amp; local health authority records</td>
                  <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #d97706; border-bottom: 1px solid #f1f5f9;">In Review</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px;">
                  <td style="padding: 10px 8px; text-align: center; color: #94a3b8; font-family: monospace; border-bottom: 1px solid #f1f5f9;">2</td>
                  <td style="padding: 10px 12px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">Doctor Credentials &amp; Council Reg</td>
                  <td style="padding: 10px 12px; color: #334155; border-bottom: 1px solid #f1f5f9;">State Medical Council verification &amp; practitioner identity</td>
                  <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #d97706; border-bottom: 1px solid #f1f5f9;">In Review</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px;">
                  <td style="padding: 10px 8px; text-align: center; color: #94a3b8; font-family: monospace; border-bottom: 1px solid #f1f5f9;">3</td>
                  <td style="padding: 10px 12px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">Physical Facility &amp; Geo-tag</td>
                  <td style="padding: 10px 12px; color: #334155; border-bottom: 1px solid #f1f5f9;">Address validity &amp; patient accessibility mapping</td>
                  <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #059669; border-bottom: 1px solid #f1f5f9;">Verified ✓</td>
                </tr>
                <tr>
                  <td style="padding: 10px 8px; text-align: center; color: #94a3b8; font-family: monospace;">4</td>
                  <td style="padding: 10px 12px; font-weight: 700; color: #0f172a;">Data Security &amp; HIPAA Readiness</td>
                  <td style="padding: 10px 12px; color: #334155;">Encrypted patient records tenancy &amp; isolation setup</td>
                  <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #059669;">Ready ✓</td>
                </tr>
              </table>

              <!-- Review Window Notice -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; margin-bottom: 16px; font-size: 12px; color: #334155; line-height: 1.5;">
                <strong style="color: #059669;">⏱ Next Step:</strong> Our clinical compliance desk will conclude the review within <strong>24 to 48 hours</strong>. Upon approval, your administrator will receive login credentials to launch your clinic dashboard.
              </div>

              <!-- Primary Call to Action Button -->
              <div style="text-align: center; margin: 26px 0 20px 0;">
                <a href="https://viitsa.com/clinic/login" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff; padding: 14px 38px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.28);">
                  Check Application Status
                </a>
              </div>

              <!-- Authorised Signatory & Governance -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 16px; padding-top: 14px; border-top: 1px solid #f1f5f9; font-size: 10px; color: #64748b;">
                <tr>
                  <td valign="bottom" align="left">
                    <div style="font-weight: 700; color: #334155; font-size: 11px;">${clinicName}</div>
                    <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">Applicant Medical Facility — VIITSA Credentialing Desk</div>
                    <div style="font-size: 9px; color: #059669; font-weight: 700; margin-top: 4px;">
                      🔒 Official Compliance Audit Trail Entry
                    </div>
                  </td>
                  <td valign="bottom" align="right">
                    <div style="width: 140px; border-bottom: 1px solid #94a3b8; margin-bottom: 4px; margin-left: auto;"></div>
                    <div style="font-weight: 700; color: #0f172a; font-size: 11px;">Viitsa Compliance Operations</div>
                    <div style="font-size: 9.5px; color: #64748b;">Medical Governance Board</div>
                    <div style="font-size: 9px; color: #94a3b8;">Review SLA: 48h Max</div>
                  </td>
                </tr>
              </table>

              <!-- Platform Footer Badges -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                <tr>
                  <td width="35%" valign="middle" align="left">
                    <div style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Connected Clinic</div>
                    <div style="font-size: 20px; font-weight: 900; color: #059669; line-height: 1.1;">VIITSA</div>
                    <div style="font-size: 8px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase;">Better Care Together</div>
                  </td>
                  <td width="65%" valign="middle" align="right">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="right">
                      <tr>
                        <td align="center" style="padding: 0 10px; border-right: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">🛡️</div>
                          Secure Patient<br/>Records
                        </td>
                        <td align="center" style="padding: 0 10px; border-right: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">👥</div>
                          Seamless Clinic<br/>Experience
                        </td>
                        <td align="center" style="padding: 0 10px; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">📈</div>
                          Better Health<br/>Outcomes
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export function buildClinicApprovedHtml(data?: {
  clinicName?: string;
  clinicEmail?: string;
  phone?: string;
  address?: string;
  city?: string;
}): string {
  const d = data || {};
  const clinicName = d.clinicName || 'Clinic';
  const clinicEmail = d.clinicEmail || 'contact@apollohealth.org';
  const phone = d.phone || '+91 98765 43210';
  const address = d.address || 'Plot 42, Hitech City';
  const city = d.city || 'Hyderabad';
  const clinicInitial = (clinicName || 'C').trim().charAt(0).toUpperCase() || 'C';
  const fullAddress = `${address}${city ? ', ' + city : ''}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Clinic Approved - Welcome to Viitsa, ${clinicName}!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 680px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);">
          <tr>
            <td style="padding: 32px 32px 28px 32px;">

              <!-- Header: Left Branding & Right Connected Clinics -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td valign="top" align="left">
                    <div style="font-size: 32px; font-weight: 900; color: #059669; letter-spacing: -0.5px; line-height: 1;">VIITSA</div>
                    <div style="font-size: 11px; font-weight: 700; color: #059669; margin-top: 4px; letter-spacing: 0.2px;">Official Clinic Accreditation &amp; Onboarding</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px; font-style: italic;">Simplifying Care. Stronger Patients.</div>
                  </td>
                  <td valign="top" align="right">
                    <div style="font-size: 9px; font-weight: 800; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; line-height: 1.5; text-align: right;">
                      CONNECTED CLINICS<br/>HEALTHIER PATIENTS<br/>BRIGHTER TOMORROW
                    </div>
                    <div style="width: 40px; height: 2px; background-color: #059669; margin-top: 8px; margin-left: auto;"></div>
                  </td>
                </tr>
              </table>

              <!-- Document Title -->
              <div style="margin-bottom: 16px;">
                <h1 style="font-size: 26px; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.1; letter-spacing: -0.3px;">Clinic Approved Successfully!</h1>
                <div style="font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px;">OFFICIAL ACCREDITATION &amp; DASHBOARD ACTIVATION</div>
              </div>

              <!-- Two Cards: Clinic Details & Activation Metadata -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
                <tr>
                  <!-- Left Card: Clinic Details -->
                  <td width="55%" valign="top" style="padding-right: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; box-sizing: border-box;">
                      <tr>
                        <td>
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td width="50" valign="top">
                                <div style="width: 44px; height: 44px; border-radius: 8px; background-color: #059669; color: #ffffff; font-size: 20px; font-weight: 800; text-align: center; line-height: 44px;">
                                  ${clinicInitial}
                                </div>
                              </td>
                              <td valign="top" style="padding-left: 8px;">
                                <div style="font-size: 15px; font-weight: 800; color: #0f172a; line-height: 1.2;">${clinicName}</div>
                                <div style="font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.4;">${fullAddress}</div>
                              </td>
                            </tr>
                          </table>
                          <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b;">
                            <span style="color: #059669; font-weight: 700; margin-right: 4px;">📞</span>
                            <span style="font-weight: 600; color: #334155;">${phone}</span>
                            <span style="color: #cbd5e1; margin: 0 8px;">|</span>
                            <span style="color: #059669; font-weight: 700; margin-right: 4px;">✉</span>
                            <span style="font-weight: 600; color: #334155;">${clinicEmail}</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Right Card: Activation Metadata -->
                  <td width="45%" valign="top" style="padding-left: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; box-sizing: border-box;">
                      <tr>
                        <td>
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 11px; line-height: 1.7;">
                            <tr>
                              <td style="color: #64748b;" width="44%">Accreditation</td>
                              <td style="font-weight: 800; color: #059669; padding-left: 10px; border-left: 1px solid #e2e8f0;" width="56%">Approved ✓</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Clinical Access</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;">Full EHR Enabled</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">WhatsApp CRM</td>
                              <td style="font-weight: 700; color: #059669; padding-left: 10px; border-left: 1px solid #e2e8f0;">Connected</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Network Status</td>
                              <td style="font-weight: 600; color: #334155; padding-left: 10px; border-left: 1px solid #e2e8f0;">Active Tenancy</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Status</td>
                              <td style="padding-left: 10px; border-left: 1px solid #e2e8f0;">
                                <span style="background-color: #dcfce7; color: #166534; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase;">ACTIVE &amp; VERIFIED</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Activated Modules Table: Solid Medical Emerald Header -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; border-collapse: separate; border-spacing: 0;">
                <tr>
                  <td colspan="4" style="background-color: #059669; padding: 10px 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="left" style="font-size: 11px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">
                          ACTIVATED CLINICAL MODULES &amp; INFRASTRUCTURE
                        </td>
                        <td align="right" style="font-size: 10px; font-weight: 600; color: #ecfdf5;">
                          All Systems: Live
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr style="background-color: #f8fafc; font-size: 11px; font-weight: 700; color: #1e293b;">
                  <td style="padding: 9px 8px; text-align: center; border-bottom: 1px solid #e2e8f0;" width="5%">#</td>
                  <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0;" width="32%">Module</td>
                  <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0;" width="45%">Feature Scope</td>
                  <td style="padding: 9px 12px; text-align: right; border-bottom: 1px solid #e2e8f0;" width="18%">Status</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px;">
                  <td style="padding: 10px 8px; text-align: center; color: #94a3b8; font-family: monospace; border-bottom: 1px solid #f1f5f9;">1</td>
                  <td style="padding: 10px 12px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">Doctor Prescription Studio</td>
                  <td style="padding: 10px 12px; color: #334155; border-bottom: 1px solid #f1f5f9;">Instant A4 PDF generation, dosages &amp; WhatsApp auto-delivery</td>
                  <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #059669; border-bottom: 1px solid #f1f5f9;">Enabled ✓</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px;">
                  <td style="padding: 10px 8px; text-align: center; color: #94a3b8; font-family: monospace; border-bottom: 1px solid #f1f5f9;">2</td>
                  <td style="padding: 10px 12px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">OPD Appointments &amp; Live Queue</td>
                  <td style="padding: 10px 12px; color: #334155; border-bottom: 1px solid #f1f5f9;">Smart token generation, walk-in QR check-in &amp; TV display integration</td>
                  <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #059669; border-bottom: 1px solid #f1f5f9;">Enabled ✓</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px;">
                  <td style="padding: 10px 8px; text-align: center; color: #94a3b8; font-family: monospace; border-bottom: 1px solid #f1f5f9;">3</td>
                  <td style="padding: 10px 12px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">AI Clinical Intelligence</td>
                  <td style="padding: 10px 12px; color: #334155; border-bottom: 1px solid #f1f5f9;">Patient intake symptom triage, diagnostic hints &amp; lab recommendations</td>
                  <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #059669; border-bottom: 1px solid #f1f5f9;">Enabled ✓</td>
                </tr>
                <tr>
                  <td style="padding: 10px 8px; text-align: center; color: #94a3b8; font-family: monospace;">4</td>
                  <td style="padding: 10px 12px; font-weight: 700; color: #0f172a;">Medical Billing &amp; Invoices</td>
                  <td style="padding: 10px 12px; color: #334155;">GST compliant invoices, receipts &amp; financial reports</td>
                  <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #059669;">Enabled ✓</td>
                </tr>
              </table>

              <!-- Primary Call to Action Button -->
              <div style="text-align: center; margin: 26px 0 20px 0;">
                <a href="https://viitsa.com/clinic/login" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff; padding: 14px 38px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.28);">
                  Log In to Clinic Portal
                </a>
              </div>

              <!-- Authorised Signatory & Governance -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 16px; padding-top: 14px; border-top: 1px solid #f1f5f9; font-size: 10px; color: #64748b;">
                <tr>
                  <td valign="bottom" align="left">
                    <div style="font-weight: 700; color: #334155; font-size: 11px;">${clinicName}</div>
                    <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">Accredited Healthcare Facility — VIITSA Healthcare Network</div>
                    <div style="font-size: 9px; color: #059669; font-weight: 700; margin-top: 4px;">
                      🔒 Clinical Tenancy &amp; HIPAA Shield Activated
                    </div>
                  </td>
                  <td valign="bottom" align="right">
                    <div style="width: 140px; border-bottom: 1px solid #94a3b8; margin-bottom: 4px; margin-left: auto;"></div>
                    <div style="font-weight: 700; color: #0f172a; font-size: 11px;">Viitsa Medical Administration</div>
                    <div style="font-size: 9.5px; color: #64748b;">Accreditation Committee</div>
                    <div style="font-size: 9px; color: #94a3b8;">Certificate ID: VIITSA-2026-OK</div>
                  </td>
                </tr>
              </table>

              <!-- Platform Footer Badges -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                <tr>
                  <td width="35%" valign="middle" align="left">
                    <div style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Connected Clinic</div>
                    <div style="font-size: 20px; font-weight: 900; color: #059669; line-height: 1.1;">VIITSA</div>
                    <div style="font-size: 8px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase;">Better Care Together</div>
                  </td>
                  <td width="65%" valign="middle" align="right">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="right">
                      <tr>
                        <td align="center" style="padding: 0 10px; border-right: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">🛡️</div>
                          Secure Patient<br/>Records
                        </td>
                        <td align="center" style="padding: 0 10px; border-right: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">👥</div>
                          Seamless Clinic<br/>Experience
                        </td>
                        <td align="center" style="padding: 0 10px; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">📈</div>
                          Better Health<br/>Outcomes
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export function buildClinicRejectedHtml(data?: {
  clinicName?: string;
  rejectionReason?: string;
  clinicEmail?: string;
  phone?: string;
  address?: string;
  city?: string;
}): string {
  const d = data || {};
  const clinicName = d.clinicName || 'Clinic';
  const rejectionReason = d.rejectionReason;
  const clinicEmail = d.clinicEmail || 'contact@apollohealth.org';
  const phone = d.phone || '+91 98765 43210';
  const address = d.address || 'Plot 42, Hitech City';
  const city = d.city || 'Hyderabad';
  const clinicInitial = (clinicName || 'C').trim().charAt(0).toUpperCase() || 'C';
  const reasonText = rejectionReason || 'Medical establishment certificate illegible. Please submit a high-resolution PDF or scan showing official seal.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Verification Update Required - ${clinicName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 680px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);">
          <tr>
            <td style="padding: 32px 32px 28px 32px;">

              <!-- Header: Left Branding & Right Connected Clinics -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td valign="top" align="left">
                    <div style="font-size: 32px; font-weight: 900; color: #059669; letter-spacing: -0.5px; line-height: 1;">VIITSA</div>
                    <div style="font-size: 11px; font-weight: 700; color: #059669; margin-top: 4px; letter-spacing: 0.2px;">Clinic Compliance &amp; Document Review</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px; font-style: italic;">Simplifying Care. Stronger Patients.</div>
                  </td>
                  <td valign="top" align="right">
                    <div style="font-size: 9px; font-weight: 800; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; line-height: 1.5; text-align: right;">
                      CONNECTED CLINICS<br/>HEALTHIER PATIENTS<br/>BRIGHTER TOMORROW
                    </div>
                    <div style="width: 40px; height: 2px; background-color: #059669; margin-top: 8px; margin-left: auto;"></div>
                  </td>
                </tr>
              </table>

              <!-- Document Title -->
              <div style="margin-bottom: 16px;">
                <h1 style="font-size: 26px; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.1; letter-spacing: -0.3px;">Verification Update Required</h1>
                <div style="font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px;">ACTION REQUIRED: CLINICAL DOCUMENTATION CORRECTION</div>
              </div>

              <!-- Two Cards: Clinic Details & Status -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
                <tr>
                  <!-- Left Card: Clinic Info -->
                  <td width="55%" valign="top" style="padding-right: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; box-sizing: border-box;">
                      <tr>
                        <td>
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td width="50" valign="top">
                                <div style="width: 44px; height: 44px; border-radius: 8px; background-color: #059669; color: #ffffff; font-size: 20px; font-weight: 800; text-align: center; line-height: 44px;">
                                  ${clinicInitial}
                                </div>
                              </td>
                              <td valign="top" style="padding-left: 8px;">
                                <div style="font-size: 15px; font-weight: 800; color: #0f172a; line-height: 1.2;">${clinicName}</div>
                                <div style="font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.4;">Application ID: <strong style="color: #0f172a;">APP-2026-AUDIT</strong></div>
                              </td>
                            </tr>
                          </table>
                          <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b;">
                            <span style="color: #059669; font-weight: 700; margin-right: 4px;">📞</span>
                            <span style="font-weight: 600; color: #334155;">${phone}</span>
                            <span style="color: #cbd5e1; margin: 0 8px;">|</span>
                            <span style="color: #059669; font-weight: 700; margin-right: 4px;">✉</span>
                            <span style="font-weight: 600; color: #334155;">${clinicEmail}</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Right Card: Status Details -->
                  <td width="45%" valign="top" style="padding-left: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; box-sizing: border-box;">
                      <tr>
                        <td>
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 11px; line-height: 1.7;">
                            <tr>
                              <td style="color: #64748b;" width="44%">Review Stage</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;" width="56%">Document Audit</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Audit Result</td>
                              <td style="font-weight: 800; color: #dc2626; padding-left: 10px; border-left: 1px solid #e2e8f0;">Update Needed</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Account Lock</td>
                              <td style="font-weight: 600; color: #334155; padding-left: 10px; border-left: 1px solid #e2e8f0;">Pending Re-upload</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Status</td>
                              <td style="padding-left: 10px; border-left: 1px solid #e2e8f0;">
                                <span style="background-color: #fef2f2; color: #991b1b; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase;">UPDATE REQUIRED</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Actionable Rejection Feedback Card -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; border-collapse: separate; border-spacing: 0;">
                <tr>
                  <td style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px 14px;">
                    <div style="font-size: 11px; font-weight: 700; color: #0f172a;">
                      ⚠️ Compliance Finding &amp; Specific Action Required
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px; font-size: 12px; line-height: 1.6; color: #334155;">
                    <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px;">Reason for Non-Approval:</div>
                    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 10px 12px; font-size: 11.5px; color: #991b1b; font-weight: 600; margin-bottom: 10px;">
                      ${reasonText}
                    </div>
                    <div style="font-size: 11px; color: #64748b;">
                      Please log in to your clinic onboarding dashboard to re-upload high-resolution scans or PDF certificates showing the official state medical council seal.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Primary Call to Action Button -->
              <div style="text-align: center; margin: 26px 0 20px 0;">
                <a href="https://viitsa.com/clinic/login" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff; padding: 14px 38px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 14px rgba(5, 150, 105, 0.28);">
                  Review &amp; Re-upload Documents
                </a>
              </div>

              <!-- Authorised Signatory & Governance -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 16px; padding-top: 14px; border-top: 1px solid #f1f5f9; font-size: 10px; color: #64748b;">
                <tr>
                  <td valign="bottom" align="left">
                    <div style="font-weight: 700; color: #334155; font-size: 11px;">${clinicName}</div>
                    <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">Applicant Clinical Facility — VIITSA Healthcare Network</div>
                    <div style="font-size: 9px; color: #059669; font-weight: 700; margin-top: 4px;">
                      🔒 Audit Trail Reference: AUDIT-REQ-2026
                    </div>
                  </td>
                  <td valign="bottom" align="right">
                    <div style="width: 140px; border-bottom: 1px solid #94a3b8; margin-bottom: 4px; margin-left: auto;"></div>
                    <div style="font-weight: 700; color: #0f172a; font-size: 11px;">Viitsa Compliance Board</div>
                    <div style="font-size: 9.5px; color: #64748b;">Credentialing Operations</div>
                    <div style="font-size: 9px; color: #94a3b8;">Help Desk: compliance@viitsa.com</div>
                  </td>
                </tr>
              </table>

              <!-- Platform Footer Badges -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                <tr>
                  <td width="35%" valign="middle" align="left">
                    <div style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Connected Clinic</div>
                    <div style="font-size: 20px; font-weight: 900; color: #059669; line-height: 1.1;">VIITSA</div>
                    <div style="font-size: 8px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase;">Better Care Together</div>
                  </td>
                  <td width="65%" valign="middle" align="right">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="right">
                      <tr>
                        <td align="center" style="padding: 0 10px; border-right: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">🛡️</div>
                          Secure Patient<br/>Records
                        </td>
                        <td align="center" style="padding: 0 10px; border-right: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">👥</div>
                          Seamless Clinic<br/>Experience
                        </td>
                        <td align="center" style="padding: 0 10px; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">📈</div>
                          Better Health<br/>Outcomes
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export interface AppointmentEmailData {
  patientName?: string;
  uhid?: string;
  age?: string | number;
  gender?: string;
  contactPhone?: string;
  doctorName?: string;
  doctorSpecialization?: string;
  clinicName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
  clinicEmail?: string;
  date?: string;
  time?: string;
  token?: string;
  department?: string;
  room?: string;
  type?: 'confirmed' | 'cancelled' | 'rescheduled';
}

export function buildAppointmentHtml(data?: AppointmentEmailData): string {
  const d = data || ({} as AppointmentEmailData);
  const type = d.type || 'confirmed';
  const isCancelled = type === 'cancelled';
  const isRescheduled = type === 'rescheduled';

  let title = "Appointment Confirmed";
  let subTitleText = "OFFICIAL CLINICAL BOOKING &amp; TOKEN CONFIRMATION";
  let statusBadgeHtml = '<span style="background-color: #dcfce7; color: #166534; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 6px; letter-spacing: 0.5px; text-transform: uppercase;">CONFIRMED &amp; SCHEDULED</span>';
  let tokenAccentColor = "#059669";
  let tokenBgColor = "#f0fdf4";
  let tokenBorderColor = "#bbf7d0";

  if (isCancelled) {
    title = "Appointment Cancelled";
    subTitleText = "CLINICAL VISIT CANCELLATION NOTICE";
    statusBadgeHtml = '<span style="background-color: #fef2f2; color: #991b1b; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 6px; letter-spacing: 0.5px; text-transform: uppercase;">CANCELLED</span>';
    tokenAccentColor = "#dc2626";
    tokenBgColor = "#fef2f2";
    tokenBorderColor = "#fecaca";
  } else if (isRescheduled) {
    title = "Appointment Rescheduled";
    subTitleText = "OFFICIAL RESCHEDULED VISIT &amp; TOKEN CONFIRMATION";
    statusBadgeHtml = '<span style="background-color: #dbeafe; color: #1e40af; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 6px; letter-spacing: 0.5px; text-transform: uppercase;">RESCHEDULED</span>';
    tokenAccentColor = "#2563eb";
    tokenBgColor = "#eff6ff";
    tokenBorderColor = "#bfdbfe";
  }

  const clinicName = d.clinicName || 'Apollo Health Center';
  const clinicInitial = (clinicName || 'A').trim().charAt(0).toUpperCase() || 'A';
  const clinicAddress = d.clinicAddress || 'Plot 42, Road No. 36, Jubilee Hills, Hyderabad';
  const clinicPhone = d.clinicPhone || '+91 90148 65154';
  const clinicEmail = d.clinicEmail || 'care@apollohealth.com';
  const patientName = d.patientName || 'Alex Morgan';
  const patientAge = d.age || '34 Y';
  const patientGender = d.gender || 'Male';
  const patientPhone = d.contactPhone || '+91 98765 43210';
  const doctorName = d.doctorName || 'Dr. Sarah Jenkins';
  const doctorSpecialization = d.doctorSpecialization || 'Internal Medicine & Cardiology';
  const uhid = d.uhid || 'UHID-2026-918';
  const dateStr = d.date || '28 Oct 2026';
  const timeStr = d.time || '10:30 AM';
  const token = d.token || 'ON-014';
  const department = d.department || 'General Medicine / OPD';
  const room = d.room || 'Consultation Room 3 (OPD Wing)';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title} - ${clinicName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 680px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);">
          <tr>
            <td style="padding: 32px 32px 28px 32px;">

              <!-- Header: Left Branding & Right Connected Clinics -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td valign="top" align="left">
                    <div style="font-size: 32px; font-weight: 900; color: #059669; letter-spacing: -0.5px; line-height: 1;">VIITSA</div>
                    <div style="font-size: 11px; font-weight: 700; color: #059669; margin-top: 4px; letter-spacing: 0.2px;">Digital Medical Appointments</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px; font-style: italic;">Simplifying Care. Stronger Patients.</div>
                  </td>
                  <td valign="top" align="right">
                    <div style="font-size: 9px; font-weight: 800; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; line-height: 1.5; text-align: right;">
                      CONNECTED CLINICS<br/>HEALTHIER PATIENTS<br/>BRIGHTER TOMORROW
                    </div>
                    <div style="width: 40px; height: 2px; background-color: #059669; margin-top: 8px; margin-left: auto;"></div>
                  </td>
                </tr>
              </table>

              <!-- Document Title -->
              <div style="margin-bottom: 16px;">
                <h1 style="font-size: 26px; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.1; letter-spacing: -0.3px;">${title}</h1>
                <div style="font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px;">${subTitleText}</div>
              </div>

              <!-- Queue Token / Priority Banner -->
              <div style="background-color: ${tokenBgColor}; border: 1px solid ${tokenBorderColor}; border-radius: 10px; padding: 14px 18px; margin-bottom: 16px;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td valign="middle">
                      <div style="font-size: 10px; font-weight: 800; color: ${tokenAccentColor}; text-transform: uppercase; letter-spacing: 1.5px;">
                        QUEUE TOKEN / VISIT NUMBER
                      </div>
                      <div style="font-size: 34px; font-weight: 900; color: ${tokenAccentColor}; letter-spacing: 2px; line-height: 1.1; margin-top: 2px;">
                        ${token}
                      </div>
                    </td>
                    <td valign="middle" align="right">
                      ${statusBadgeHtml}
                      <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
                        Show token at reception desk
                      </div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Two Cards: Clinic Details & Appointment Schedule -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
                <tr>
                  <!-- Left Card: Clinic Info -->
                  <td width="55%" valign="top" style="padding-right: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; box-sizing: border-box;">
                      <tr>
                        <td>
                          <table role="presentation" border="0" cellpadding="0" width="100%">
                            <tr>
                              <td width="50" valign="top">
                                <div style="width: 44px; height: 44px; border-radius: 8px; background-color: #059669; color: #ffffff; font-size: 20px; font-weight: 800; text-align: center; line-height: 44px;">
                                  ${clinicInitial}
                                </div>
                              </td>
                              <td valign="top" style="padding-left: 8px;">
                                <div style="font-size: 15px; font-weight: 800; color: #0f172a; line-height: 1.2;">${clinicName}</div>
                                <div style="font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.4;">${clinicAddress}</div>
                              </td>
                            </tr>
                          </table>
                          <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b;">
                            <span style="color: #059669; font-weight: 700; margin-right: 4px;">📞</span>
                            <span style="font-weight: 600; color: #334155;">${clinicPhone}</span>
                            <span style="color: #cbd5e1; margin: 0 8px;">|</span>
                            <span style="color: #059669; font-weight: 700; margin-right: 4px;">✉</span>
                            <span style="font-weight: 600; color: #334155;">${clinicEmail}</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Right Card: Appointment Schedule -->
                  <td width="45%" valign="top" style="padding-left: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; box-sizing: border-box;">
                      <tr>
                        <td>
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 11px; line-height: 1.7;">
                            <tr>
                              <td style="color: #64748b;" width="44%">Appointment Date</td>
                              <td style="font-weight: 800; color: #059669; padding-left: 10px; border-left: 1px solid #e2e8f0;" width="56%">${dateStr}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Time Slot</td>
                              <td style="font-weight: 800; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;">${timeStr}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Department</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;">${department}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Visit Type</td>
                              <td style="font-weight: 600; color: #059669; padding-left: 10px; border-left: 1px solid #e2e8f0;">Consultation (OPD)</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Location / Room</td>
                              <td style="font-weight: 600; color: #334155; padding-left: 10px; border-left: 1px solid #e2e8f0;">${room}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Middle Card: Patient & Doctor Information -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; border-collapse: separate; border-spacing: 0;">
                <tr>
                  <td style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="left" style="font-size: 11px; font-weight: 700; color: #0f172a;">
                          👤 Patient &amp; Doctor Information
                        </td>
                        <td align="right" style="font-size: 10px; color: #64748b; font-family: monospace;">
                          UHID: <strong style="color: #0f172a;">${uhid}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 11px;">
                      <tr>
                        <td width="48%" valign="top">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="line-height: 1.8;">
                            <tr>
                              <td width="105" style="color: #64748b;">Patient Name</td>
                              <td width="10" style="color: #94a3b8;">:</td>
                              <td style="font-weight: 700; color: #0f172a;">${patientName}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Age / Gender</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 600; color: #0f172a;">${patientAge} / ${patientGender}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Contact Phone</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 600; color: #0f172a;">${patientPhone}</td>
                            </tr>
                          </table>
                        </td>
                        <td width="4%" align="center" valign="middle">
                          <div style="width: 1px; height: 50px; background-color: #e2e8f0;"></div>
                        </td>
                        <td width="48%" valign="top">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="line-height: 1.8;">
                            <tr>
                              <td width="105" style="color: #64748b;">Attending Doctor</td>
                              <td width="10" style="color: #94a3b8;">:</td>
                              <td style="font-weight: 700; color: #0f172a;">${doctorName}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Specialization</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 600; color: #0f172a;">${doctorSpecialization}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Booking Status</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 700; color: ${tokenAccentColor};">${title}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Appointment Guidelines Table: Solid Medical Emerald Header -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; border-collapse: separate; border-spacing: 0;">
                <tr>
                  <td colspan="4" style="background-color: #059669; padding: 10px 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="left" style="font-size: 11px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">
                          CLINICAL APPOINTMENT GUIDELINES &amp; ARRIVAL PROTOCOL
                        </td>
                        <td align="right" style="font-size: 10px; font-weight: 600; color: #ecfdf5;">
                          Live Queue Tracking: Enabled
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr style="background-color: #f8fafc; font-size: 11px; font-weight: 700; color: #1e293b;">
                  <td style="padding: 9px 8px; text-align: center; border-bottom: 1px solid #e2e8f0;" width="5%">#</td>
                  <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0;" width="25%">Guideline / Protocol</td>
                  <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0;" width="54%">Instructions &amp; Advice</td>
                  <td style="padding: 9px 12px; text-align: right; border-bottom: 1px solid #e2e8f0;" width="16%">Status</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px;">
                  <td style="padding: 10px 8px; text-align: center; color: #94a3b8; font-family: monospace; border-bottom: 1px solid #f1f5f9;">1</td>
                  <td style="padding: 10px 12px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">
                    <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #059669; margin-right: 6px; vertical-align: middle;"></span>
                    Reporting Time
                  </td>
                  <td style="padding: 10px 12px; color: #334155; line-height: 1.4; border-bottom: 1px solid #f1f5f9;">
                    Please report 10–15 minutes prior to <strong>${timeStr}</strong> for initial triage and vitals registration.
                  </td>
                  <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #059669; border-bottom: 1px solid #f1f5f9;">Recommended</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px;">
                  <td style="padding: 10px 8px; text-align: center; color: #94a3b8; font-family: monospace; border-bottom: 1px solid #f1f5f9;">2</td>
                  <td style="padding: 10px 12px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">
                    <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #059669; margin-right: 6px; vertical-align: middle;"></span>
                    Prior Medical Records
                  </td>
                  <td style="padding: 10px 12px; color: #334155; line-height: 1.4; border-bottom: 1px solid #f1f5f9;">
                    Bring ongoing prescriptions, recent blood work, and relevant prior discharge summaries.
                  </td>
                  <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #334155; border-bottom: 1px solid #f1f5f9;">Important</td>
                </tr>
                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px;">
                  <td style="padding: 10px 8px; text-align: center; color: #94a3b8; font-family: monospace; border-bottom: 1px solid #f1f5f9;">3</td>
                  <td style="padding: 10px 12px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">
                    <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #059669; margin-right: 6px; vertical-align: middle;"></span>
                    Reception Check-in
                  </td>
                  <td style="padding: 10px 12px; color: #334155; line-height: 1.4; border-bottom: 1px solid #f1f5f9;">
                    Display your queue token <strong>${token}</strong> at the reception desk for priority entry into the consultation queue.
                  </td>
                  <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #059669; border-bottom: 1px solid #f1f5f9;">Required</td>
                </tr>
                <tr>
                  <td style="padding: 10px 8px; text-align: center; color: #94a3b8; font-family: monospace;">4</td>
                  <td style="padding: 10px 12px; font-weight: 700; color: #0f172a;">
                    <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #059669; margin-right: 6px; vertical-align: middle;"></span>
                    Portal Management
                  </td>
                  <td style="padding: 10px 12px; color: #334155; line-height: 1.4;">
                    Reschedule or manage your booking anytime directly in the patient portal with zero phone wait times.
                  </td>
                  <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #059669;">Self-Service</td>
                </tr>
              </table>

              <!-- Dual Information Boxes: Directions & Portal Link -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
                <tr>
                  <!-- Left: Facility & Assistance -->
                  <td width="52%" valign="top" style="padding-right: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background-color: #ffffff; height: 100%;">
                      <tr>
                        <td style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px 12px; font-size: 11px; font-weight: 700; color: #0f172a;">
                          📍 Clinic Location &amp; Help Desk
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 14px; font-size: 11px; color: #334155; line-height: 1.6;">
                          <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">${clinicName}</div>
                          <div style="color: #64748b; margin-bottom: 8px;">${clinicAddress}</div>
                          <div style="font-size: 10.5px; color: #475569;">
                            Need assistance finding the clinic or running late? Call us directly at 
                            <a href="tel:${clinicPhone}" style="color: #059669; font-weight: 700; text-decoration: none;">${clinicPhone}</a>.
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Right: Live Queue Status -->
                  <td width="48%" valign="top" style="padding-left: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; font-size: 11px; background-color: #ffffff; height: 100%;">
                      <tr>
                        <td style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px 12px; font-size: 11px; font-weight: 700; color: #0f172a;">
                          ⏱️ Live Queue &amp; Reschedule Options
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 14px; line-height: 1.6;">
                          <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px;">Real-Time Status:</div>
                          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; font-size: 10.5px; color: #475569; margin-bottom: 8px;">
                            Token <strong>${token}</strong> is registered on the live OPD display board for <strong>${dateStr}</strong>.
                          </div>
                          <div style="font-size: 10px; color: #64748b;">
                            Free rescheduling or cancellation available up to 2 hours before the appointment.
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Authorised Signatory & Governance -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 16px; padding-top: 14px; border-top: 1px solid #f1f5f9; font-size: 10px; color: #64748b;">
                <tr>
                  <td valign="bottom" align="left">
                    <div style="font-weight: 700; color: #334155; font-size: 11px;">${clinicName}</div>
                    <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">Authorised Healthcare Facility — VIITSA Digital Health Network</div>
                    <div style="font-size: 9px; color: #059669; font-weight: 700; margin-top: 4px;">
                      🔒 Real-Time Queue Integration via VIITSA Clinical Intelligence
                    </div>
                  </td>
                  <td valign="bottom" align="right">
                    <div style="width: 140px; border-bottom: 1px solid #94a3b8; margin-bottom: 4px; margin-left: auto;"></div>
                    <div style="font-weight: 700; color: #0f172a; font-size: 11px;">${doctorName}</div>
                    <div style="font-size: 9.5px; color: #64748b;">${doctorSpecialization}</div>
                    <div style="font-size: 9px; color: #94a3b8;">Outpatient Consultation Desk</div>
                  </td>
                </tr>
              </table>

              <!-- Platform Footer Badges -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                <tr>
                  <td width="35%" valign="middle" align="left">
                    <div style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Connected Clinic</div>
                    <div style="font-size: 20px; font-weight: 900; color: #059669; line-height: 1.1;">VIITSA</div>
                    <div style="font-size: 8px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase;">Better Care Together</div>
                  </td>
                  <td width="65%" valign="middle" align="right">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="right">
                      <tr>
                        <td align="center" style="padding: 0 10px; border-right: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">🛡️</div>
                          Verified<br/>Booking
                        </td>
                        <td align="center" style="padding: 0 10px; border-right: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">👥</div>
                          Live Queue<br/>Tracking
                        </td>
                        <td align="center" style="padding: 0 10px; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">📈</div>
                          Seamless<br/>Care
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Button & Links -->
              <div style="text-align: center; margin-top: 22px; padding-top: 16px; border-top: 1px solid #f1f5f9;">
                <a href="https://viitsa.com/login" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff; padding: 12px 32px; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);">
                  Manage Appointment in Portal
                </a>
                <div style="margin-top: 10px;">
                  <a href="https://viitsa.com/login" target="_blank" style="color: #059669; text-decoration: underline; font-size: 12px; font-weight: 600;">
                    Check-in Online or Reschedule
                  </a>
                </div>
              </div>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export interface PrescriptionEmailData {
  patientName?: string;
  uhid?: string;
  age?: string | number;
  gender?: string;
  contactPhone?: string;
  patientPhone?: string;
  patientDob?: string;
  clinicName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
  clinicEmail?: string;
  doctorName?: string;
  doctorSpecialization?: string;
  doctorRegNo?: string;
  prescriptionNo?: string;
  date?: string;
  time?: string;
  department?: string;
  visitCategory?: string;
  diagnosis?: string;
  chiefComplaint?: string;
  vitals?: {
    temperature?: string;
    bloodPressure?: string;
    pulse?: string;
    spo2?: string;
  };
  medicines?: Array<{
    category?: string;
    name: string;
    dose?: string;
    timesPerDay?: string;
    intakeTime?: string;
    duration?: string;
    foodInstruction?: string;
    instructions?: string;
  }>;
  advice?: string[];
  tests?: string[];
  followUpDate?: string;
  pdfUrl?: string;
  loginUrl?: string;
}

export function buildPrescriptionHtml(data?: PrescriptionEmailData): string {
  const d = data || {};
  const clinicName = d.clinicName || 'Apollo Health Center';
  const clinicInitial = (clinicName || 'A').trim().charAt(0).toUpperCase() || 'A';
  const clinicAddress = d.clinicAddress || 'Plot 42, Road No. 36, Jubilee Hills, Hyderabad';
  const clinicPhone = d.clinicPhone || '+91 90148 65154';
  const clinicEmail = d.clinicEmail || 'care@apollohealth.com';
  const patientName = d.patientName || 'Alex Morgan';
  const patientAge = d.age || '34 Y';
  const patientGender = d.gender || 'Male';
  const patientPhone = d.contactPhone || d.patientPhone || '+91 98765 43210';
  const doctorName = d.doctorName || 'Dr. Sarah Jenkins';
  const doctorSpecialization = d.doctorSpecialization || 'Consultant Pulmonologist & General Physician';
  const doctorRegNo = d.doctorRegNo || 'MCI-2018-84920';
  const uhid = d.uhid || 'UHID-2026-918';
  const prescriptionNo = d.prescriptionNo || 'RX-9042';
  const dateStr = d.date || '27 Oct 2026';
  const timeStr = d.time || '10:15 AM';
  const department = d.department || 'Pulmonology / OPD';
  const diagnosis = d.diagnosis || 'Acute Bronchitis & Seasonal Allergies';
  const followUpDate = d.followUpDate || '02 Nov 2026';
  const loginLink = d.loginUrl || 'https://viitsa.com/login';
  const pdfUrl = d.pdfUrl || 'https://viitsa.com/login';

  const vitals = d.vitals || {
    temperature: '98.6°F',
    bloodPressure: '120/80 mmHg',
    pulse: '74 bpm',
    spo2: '99%',
  };

  const medicines = (d.medicines && d.medicines.length > 0) ? d.medicines : [
    {
      category: 'Antibiotic',
      name: 'Tab. Augmentin 625mg (Amoxicillin + Clavulanic Acid)',
      dose: '625 mg',
      timesPerDay: '1 - 0 - 1',
      duration: '5 Days',
      instructions: 'After Food (Twice Daily with water)',
    },
    {
      category: 'Analgesic / Antipyretic',
      name: 'Tab. Dolo 650mg (Paracetamol)',
      dose: '650 mg',
      timesPerDay: '1 - 0 - 1 (SOS)',
      duration: '3 Days',
      instructions: 'Post meal as needed for fever or pain',
    },
    {
      category: 'Antiallergic',
      name: 'Tab. Montair-LC (Montelukast + Levocetirizine)',
      dose: '10mg / 5mg',
      timesPerDay: '0 - 0 - 1',
      duration: '7 Days',
      instructions: 'At bedtime (once daily)',
    },
    {
      category: 'Cough Relief',
      name: 'Syp. Ascoril-D Cough Formula (Sugar Free)',
      dose: '10 ml',
      timesPerDay: '1 - 1 - 1',
      duration: '5 Days',
      instructions: 'Thrice daily with warm water gargle',
    },
  ];

  const adviceList = (d.advice && d.advice.length > 0) ? d.advice : [
    'Drink 2.5 - 3 liters of warm water daily to stay well hydrated.',
    'Complete the full 5-day antibiotic course; do not stop early even if symptoms improve.',
    'Avoid cold beverages, deep-fried food, and direct exposure to air conditioning / dust.',
    'Steam inhalation and warm saline gargles twice daily for throat and nasal soothing.',
  ];

  const testsList = (d.tests && d.tests.length > 0) ? d.tests : [
    'Complete Blood Count (CBC) with Platelet Indices',
    'Chest X-Ray (PA View if cough persists beyond 5 days)',
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Doctor Prescription - ${prescriptionNo} | ${clinicName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 680px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);">
          <tr>
            <td style="padding: 32px 32px 28px 32px;">

              <!-- Header: Left Branding & Right Connected Clinics -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td valign="top" align="left">
                    <div style="font-size: 32px; font-weight: 900; color: #059669; letter-spacing: -0.5px; line-height: 1;">VIITSA</div>
                    <div style="font-size: 11px; font-weight: 700; color: #059669; margin-top: 4px; letter-spacing: 0.2px;">Digital Medical Prescription</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px; font-style: italic;">Simplifying Care. Stronger Patients.</div>
                  </td>
                  <td valign="top" align="right">
                    <div style="font-size: 9px; font-weight: 800; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; line-height: 1.5; text-align: right;">
                      CONNECTED CLINICS<br/>HEALTHIER PATIENTS<br/>BRIGHTER TOMORROW
                    </div>
                    <div style="width: 40px; height: 2px; background-color: #059669; margin-top: 8px; margin-left: auto;"></div>
                  </td>
                </tr>
              </table>

              <!-- Document Title -->
              <div style="margin-bottom: 20px;">
                <h1 style="font-size: 26px; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.1; letter-spacing: -0.3px;">Doctor Prescription</h1>
                <div style="font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px;">OFFICIAL MEDICAL CONSULTATION &amp; Rx RECORD</div>
              </div>

              <!-- Two Cards: Clinic Details & Prescription Metadata -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
                <tr>
                  <!-- Left Card: Clinic Info -->
                  <td width="55%" valign="top" style="padding-right: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; box-sizing: border-box;">
                      <tr>
                        <td>
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td width="50" valign="top">
                                <div style="width: 44px; height: 44px; border-radius: 8px; background-color: #059669; color: #ffffff; font-size: 20px; font-weight: 800; text-align: center; line-height: 44px;">
                                  ${clinicInitial}
                                </div>
                              </td>
                              <td valign="top" style="padding-left: 8px;">
                                <div style="font-size: 15px; font-weight: 800; color: #0f172a; line-height: 1.2;">${clinicName}</div>
                                <div style="font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.4;">${clinicAddress}</div>
                              </td>
                            </tr>
                          </table>
                          <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b;">
                            <span style="color: #059669; font-weight: 700; margin-right: 4px;">📞</span>
                            <span style="font-weight: 600; color: #334155;">${clinicPhone}</span>
                            <span style="color: #cbd5e1; margin: 0 8px;">|</span>
                            <span style="color: #059669; font-weight: 700; margin-right: 4px;">✉</span>
                            <span style="font-weight: 600; color: #334155;">${clinicEmail}</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Right Card: Prescription Metadata -->
                  <td width="45%" valign="top" style="padding-left: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; box-sizing: border-box;">
                      <tr>
                        <td>
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 11px; line-height: 1.7;">
                            <tr>
                              <td style="color: #64748b;" width="44%">Prescription No.</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;" width="56%">${prescriptionNo}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Date</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;">${dateStr}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Time</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;">${timeStr}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Department</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;">${department}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Follow-up</td>
                              <td style="font-weight: 700; color: #059669; padding-left: 10px; border-left: 1px solid #e2e8f0;">${followUpDate}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Status</td>
                              <td style="padding-left: 10px; border-left: 1px solid #e2e8f0;">
                                <span style="background-color: #dcfce7; color: #166534; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase;">VERIFIED &amp; ACTIVE</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Middle Card: Patient & Consultation Information -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; border-collapse: separate; border-spacing: 0;">
                <tr>
                  <td style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="left" style="font-size: 11px; font-weight: 700; color: #0f172a;">
                          👤 Patient &amp; Consultation Details
                        </td>
                        <td align="right" style="font-size: 10px; color: #64748b; font-family: monospace;">
                          UHID: <strong style="color: #0f172a;">${uhid}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 11px;">
                      <tr>
                        <td width="48%" valign="top">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="line-height: 1.8;">
                            <tr>
                              <td width="105" style="color: #64748b;">Patient Name</td>
                              <td width="10" style="color: #94a3b8;">:</td>
                              <td style="font-weight: 700; color: #0f172a;">${patientName}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Age / Gender</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 600; color: #0f172a;">${patientAge} / ${patientGender}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Contact Phone</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 600; color: #0f172a;">${patientPhone}</td>
                            </tr>
                          </table>
                        </td>
                        <td width="4%" align="center" valign="middle">
                          <div style="width: 1px; height: 50px; background-color: #e2e8f0;"></div>
                        </td>
                        <td width="48%" valign="top">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="line-height: 1.8;">
                            <tr>
                              <td width="105" style="color: #64748b;">Consulting Doctor</td>
                              <td width="10" style="color: #94a3b8;">:</td>
                              <td style="font-weight: 700; color: #0f172a;">${doctorName}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Specialization</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 600; color: #0f172a;">${doctorSpecialization}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Clinical Diagnosis</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 700; color: #059669;">${diagnosis}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Prescribed Medications & Dosage Schedule Table: Solid Medical Emerald Header -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; border-collapse: separate; border-spacing: 0;">
                <tr>
                  <td colspan="6" style="background-color: #059669; padding: 10px 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="left" style="font-size: 11px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">
                          PRESCRIBED MEDICATIONS &amp; DOSAGE SCHEDULE
                        </td>
                        <td align="right" style="font-size: 10px; font-weight: 600; color: #ecfdf5;">
                          Rx: Official Clinical Schedule
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr style="background-color: #f8fafc; font-size: 11px; font-weight: 700; color: #1e293b;">
                  <td style="padding: 9px 8px; text-align: center; border-bottom: 1px solid #e2e8f0;" width="5%">#</td>
                  <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0;" width="18%">Category</td>
                  <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0;" width="33%">Medicine &amp; Composition</td>
                  <td style="padding: 9px 10px; border-bottom: 1px solid #e2e8f0;" width="18%">Dosage Schedule</td>
                  <td style="padding: 9px 8px; text-align: center; border-bottom: 1px solid #e2e8f0;" width="11%">Duration</td>
                  <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0;" width="15%">Instructions</td>
                </tr>
                ${medicines.map((med, index) => {
                  const categoryName = med.category || 'Medication';
                  const dosageText = med.timesPerDay || med.dose || '1 - 0 - 1';
                  const durationText = med.duration || '5 Days';
                  const instructionsText = med.instructions || med.foodInstruction || 'After Food';
                  return `
                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px;">
                  <td style="padding: 10px 8px; text-align: center; color: #94a3b8; font-family: monospace; border-bottom: 1px solid #f1f5f9;">${index + 1}</td>
                  <td style="padding: 10px 12px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #f1f5f9;">
                    <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #059669; margin-right: 6px; vertical-align: middle;"></span>
                    ${categoryName}
                  </td>
                  <td style="padding: 10px 12px; color: #0f172a; font-weight: 700; line-height: 1.4; border-bottom: 1px solid #f1f5f9;">
                    ${med.name}
                    ${med.dose ? `<div style="font-size: 10px; color: #64748b; font-weight: normal; margin-top: 2px;">Strength: ${med.dose}</div>` : ''}
                  </td>
                  <td style="padding: 10px 10px; color: #059669; font-weight: 700; font-family: monospace; border-bottom: 1px solid #f1f5f9;">${dosageText}</td>
                  <td style="padding: 10px 8px; text-align: center; color: #475569; font-weight: 600; border-bottom: 1px solid #f1f5f9;">${durationText}</td>
                  <td style="padding: 10px 12px; color: #334155; line-height: 1.3; font-size: 10.5px; border-bottom: 1px solid #f1f5f9;">${instructionsText}</td>
                </tr>`;
                }).join('')}
              </table>

              <!-- Advice & Vitals Row: Side-by-Side Cards -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
                <tr>
                  <!-- Left: Advice -->
                  <td width="52%" valign="top" style="padding-right: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background-color: #ffffff; height: 100%;">
                      <tr>
                        <td style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px 12px; font-size: 11px; font-weight: 700; color: #0f172a;">
                          📋 Clinical Advice &amp; Lifestyle Guidelines
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 14px; font-size: 11px; color: #334155; line-height: 1.6;">
                          ${adviceList.map((adv) => `
                          <div style="margin-bottom: 6px; display: flex; align-items: flex-start;">
                            <span style="color: #059669; font-weight: 800; margin-right: 8px; font-size: 13px; line-height: 1;">•</span>
                            <span>${adv}</span>
                          </div>`).join('')}
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Right: Vitals & Recommended Tests -->
                  <td width="48%" valign="top" style="padding-left: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; font-size: 11px; background-color: #ffffff; height: 100%;">
                      <tr>
                        <td style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px 12px; font-size: 11px; font-weight: 700; color: #0f172a;">
                          🩺 Clinical Vitals &amp; Recommended Tests
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 14px; line-height: 1.7;">
                          <!-- Vitals pill box -->
                          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; font-size: 10px; color: #475569;">
                            <strong style="color: #0f172a;">Vitals:</strong> 
                            BP: <strong>${vitals.bloodPressure || '120/80 mmHg'}</strong> | 
                            Temp: <strong>${vitals.temperature || '98.6°F'}</strong> | 
                            SpO₂: <strong>${vitals.spo2 || '99%'}</strong>
                          </div>

                          <div style="font-weight: 700; color: #0f172a; font-size: 10.5px; margin-bottom: 4px;">Recommended Investigations:</div>
                          ${testsList.map((t) => `
                          <div style="margin-bottom: 4px; color: #334155; font-size: 10.5px;">
                            <span style="color: #059669; font-weight: bold; margin-right: 6px;">✓</span>
                            <span>${t}</span>
                          </div>`).join('')}

                          <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #f1f5f9; font-size: 10px; color: #64748b;">
                            Next Review: <strong style="color: #059669;">${followUpDate}</strong>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Authorised Signatory & Digital Verification Block -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 16px; padding-top: 14px; border-top: 1px solid #f1f5f9; font-size: 10px; color: #64748b;">
                <tr>
                  <td valign="bottom" align="left">
                    <div style="font-weight: 700; color: #334155; font-size: 11px;">${clinicName}</div>
                    <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">Authorised Medical Facility &amp; Digital Healthcare Provider</div>
                    <div style="font-size: 9px; color: #059669; font-weight: 700; margin-top: 4px;">
                      🔒 Digitally Signed &amp; Verified via VIITSA Clinical Intelligence
                    </div>
                  </td>
                  <td valign="bottom" align="right">
                    <!-- Stylized digital signature -->
                    <div style="height: 28px; text-align: right; margin-bottom: 4px;">
                      <svg width="110" height="26" viewBox="0 0 140 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block;">
                        <path d="M12 26 C 30 10, 45 4, 60 18 C 70 28, 85 8, 95 24 C 105 30, 120 12, 130 18" stroke="#1e293b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                        <path d="M40 20 C 55 22, 75 14, 90 26" stroke="#059669" stroke-width="1.8" stroke-linecap="round" />
                      </svg>
                    </div>
                    <div style="width: 140px; border-bottom: 1px solid #94a3b8; margin-bottom: 4px; margin-left: auto;"></div>
                    <div style="font-weight: 700; color: #0f172a; font-size: 11px;">${doctorName}</div>
                    <div style="font-size: 9.5px; color: #64748b;">${doctorSpecialization}</div>
                    <div style="font-size: 9px; color: #94a3b8;">Reg. No.: ${doctorRegNo}</div>
                  </td>
                </tr>
              </table>

              <!-- Platform Footer Badges -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                <tr>
                  <td width="35%" valign="middle" align="left">
                    <div style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Connected Clinic</div>
                    <div style="font-size: 20px; font-weight: 900; color: #059669; line-height: 1.1;">VIITSA</div>
                    <div style="font-size: 8px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase;">Better Care Together</div>
                  </td>
                  <td width="65%" valign="middle" align="right">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="right">
                      <tr>
                        <td align="center" style="padding: 0 10px; border-right: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">🛡️</div>
                          Secure Patient<br/>Records
                        </td>
                        <td align="center" style="padding: 0 10px; border-right: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">👥</div>
                          Seamless Clinic<br/>Experience
                        </td>
                        <td align="center" style="padding: 0 10px; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">📈</div>
                          Better Health<br/>Outcomes
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Button & Links -->
              <div style="text-align: center; margin-top: 22px; padding-top: 16px; border-top: 1px solid #f1f5f9;">
                <a href="${loginLink}" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff; padding: 12px 32px; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);">
                  View Prescription in Patient Portal
                </a>
                ${pdfUrl ? `<div style="margin-top: 10px;"><a href="${pdfUrl}" target="_blank" style="color: #059669; text-decoration: underline; font-size: 12px; font-weight: 600;">Download Official Medical PDF</a></div>` : ''}
              </div>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export interface InvoiceEmailData {
  patientName?: string;
  clinicName?: string;
  invoiceNo?: string;
  amount?: string | number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  date?: string;
  time?: string;
  pdfUrl?: string;
  clinicAddress?: string;
  clinicPhone?: string;
  clinicEmail?: string;
  doctorName?: string;
  doctorSpecialization?: string;
  uhid?: string;
  receiptNo?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  age?: number | string;
  gender?: string;
  visitType?: string;
  notes?: string;
  lineItems?: Array<{
    category: string;
    description: string;
    quantity: number;
    unitPrice: string | number;
    amount: string | number;
  }>;
}

export function buildInvoiceHtml(data?: InvoiceEmailData): string {
  const d = data || {};
  const clinicName = d.clinicName || 'XR';
  const clinicInitial = (clinicName || 'X').trim().charAt(0).toUpperCase() || 'X';
  const clinicAddress = d.clinicAddress || 'Kukatpally';
  const clinicPhone = d.clinicPhone || '7075545960';
  const clinicEmail = d.clinicEmail || 'business8281@gmail.com';
  const patientName = d.patientName || 'Aarav Sharma';
  const patientAge = d.age || '34 Y';
  const patientGender = d.gender || 'Male';
  const doctorName = d.doctorName || 'Dr. XR';
  const doctorSpecialization = d.doctorSpecialization || 'Internal Medicine & Cardiology';
  const uhid = d.uhid || 'UHID-2026-918';
  const invoiceNo = d.invoiceNo || 'INV-2026-08492';
  const receiptNo = d.receiptNo || 'RCP-8921';
  const dateStr = d.date || '20 Nov 2026';
  const timeStr = d.time || '09:49';
  const paymentMethod = (d.paymentMethod || 'UPI').toUpperCase();
  const paymentStatus = (d.paymentStatus || 'PAID').toUpperCase();

  // Pricing & line items
  const items = d.lineItems || [
    {
      category: 'Consultation Fee',
      description: 'Specialist General Physician Consultation',
      quantity: 1,
      unitPrice: 500,
      amount: 500,
    },
    {
      category: 'Pharmacy',
      description: 'Tab. Paracetamol 650mg (Strip of 10) + Amoxicillin 500mg',
      quantity: 2,
      unitPrice: 175,
      amount: 350,
    },
    {
      category: 'Diagnostics & Lab',
      description: 'Complete Blood Count (CBC) with Platelet Indices',
      quantity: 1,
      unitPrice: 450,
      amount: 450,
    },
    {
      category: 'Procedure',
      description: 'Digital Vital Signs & Oxygen Saturation Check',
      quantity: 1,
      unitPrice: 150,
      amount: 150,
    },
  ];

  let rawTotal = 1350;
  if (d.amount !== undefined && d.amount !== null) {
    rawTotal = typeof d.amount === 'number' ? d.amount : parseFloat(String(d.amount).replace(/[^0-9.-]+/g, '')) || 1350;
  }
  const discountVal = typeof d.discount === 'number' ? d.discount : (d.discount ? parseFloat(String(d.discount)) : 0);
  const taxVal = typeof d.tax === 'number' ? d.tax : (d.tax ? parseFloat(String(d.tax)) : 0);
  const subtotalVal = typeof d.subtotal === 'number'
    ? d.subtotal
    : (d.subtotal ? parseFloat(String(d.subtotal)) : (discountVal > 0 ? rawTotal + discountVal - taxVal : rawTotal));

  const finalTotal = (d.amount !== undefined && d.amount !== null) ? rawTotal : Math.max(0, subtotalVal - discountVal + taxVal);
  const subtotalStr = formatInvoiceAmount(subtotalVal);
  const discountStr = discountVal > 0 ? formatInvoiceAmount(discountVal) : '';
  const taxStr = formatInvoiceAmount(taxVal);
  const grandTotalStr = formatInvoiceAmount(finalTotal);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Patient Invoice - ${invoiceNo} | ${clinicName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; table-layout: fixed;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 680px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);">
          <tr>
            <td style="padding: 32px 32px 28px 32px;">

              <!-- Header: Left Branding & Right Connected Clinics -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px;">
                <tr>
                  <td valign="top" align="left">
                    <div style="font-size: 32px; font-weight: 900; color: #059669; letter-spacing: -0.5px; line-height: 1;">VIITSA</div>
                    <div style="font-size: 11px; font-weight: 700; color: #059669; margin-top: 4px; letter-spacing: 0.2px;">Clinic-paid Healthcare SaaS</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px; font-style: italic;">Simplifying Care. Stronger Patients.</div>
                  </td>
                  <td valign="top" align="right">
                    <div style="font-size: 9px; font-weight: 800; color: #64748b; letter-spacing: 1.5px; text-transform: uppercase; line-height: 1.5; text-align: right;">
                      CONNECTED CLINICS<br/>HEALTHIER PATIENTS<br/>BRIGHTER TOMORROW
                    </div>
                    <div style="width: 40px; height: 2px; background-color: #059669; margin-top: 8px; margin-left: auto;"></div>
                  </td>
                </tr>
              </table>

              <!-- Document Title -->
              <div style="margin-bottom: 20px;">
                <h1 style="font-size: 26px; font-weight: 800; color: #0f172a; margin: 0; line-height: 1.1; letter-spacing: -0.3px;">Patient Invoice</h1>
                <div style="font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px;">MEDICAL BILLING STATEMENT</div>
              </div>

              <!-- Two Cards: Clinic Details & Invoice Details -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
                <tr>
                  <!-- Left Card: Clinic Info -->
                  <td width="55%" valign="top" style="padding-right: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; box-sizing: border-box;">
                      <tr>
                        <td>
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td width="50" valign="top">
                                <div style="width: 44px; height: 44px; border-radius: 8px; background-color: #059669; color: #ffffff; font-size: 20px; font-weight: 800; text-align: center; line-height: 44px;">
                                  ${clinicInitial}
                                </div>
                              </td>
                              <td valign="top" style="padding-left: 8px;">
                                <div style="font-size: 15px; font-weight: 800; color: #0f172a; line-height: 1.2;">${clinicName}</div>
                                <div style="font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.4;">${clinicAddress}</div>
                              </td>
                            </tr>
                          </table>
                          <div style="margin-top: 14px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b;">
                            <span style="color: #059669; font-weight: 700; margin-right: 4px;">📞</span>
                            <span style="font-weight: 600; color: #334155;">${clinicPhone}</span>
                            <span style="color: #cbd5e1; margin: 0 8px;">|</span>
                            <span style="color: #059669; font-weight: 700; margin-right: 4px;">✉</span>
                            <span style="font-weight: 600; color: #334155;">${clinicEmail}</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Right Card: Invoice Details -->
                  <td width="45%" valign="top" style="padding-left: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; box-sizing: border-box;">
                      <tr>
                        <td>
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 11px; line-height: 1.7;">
                            <tr>
                              <td style="color: #64748b;" width="42%">Invoice No.</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;" width="58%">${invoiceNo}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Date</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;">${dateStr}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Time</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;">${timeStr}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Receipt No.</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0;">${receiptNo}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Payment Mode</td>
                              <td style="font-weight: 700; color: #0f172a; padding-left: 10px; border-left: 1px solid #e2e8f0; text-transform: uppercase;">${paymentMethod}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Status</td>
                              <td style="padding-left: 10px; border-left: 1px solid #e2e8f0;">
                                <span style="background-color: #dcfce7; color: #166534; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase;">${paymentStatus}</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Middle Card: Patient & Doctor Information -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; border-collapse: separate; border-spacing: 0;">
                <tr>
                  <td style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="left" style="font-size: 11px; font-weight: 700; color: #0f172a;">
                          👤 Patient & Doctor Information
                        </td>
                        <td align="right" style="font-size: 10px; color: #64748b; font-family: monospace;">
                          UHID: <strong style="color: #0f172a;">${uhid}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 11px;">
                      <tr>
                        <td width="48%" valign="top">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="line-height: 1.8;">
                            <tr>
                              <td width="105" style="color: #64748b;">Patient Name</td>
                              <td width="10" style="color: #94a3b8;">:</td>
                              <td style="font-weight: 700; color: #0f172a;">${patientName}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Age / Gender</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 600; color: #0f172a;">${patientAge} / ${patientGender}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Contact Phone</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 600; color: #0f172a;">+91 98765 43210</td>
                            </tr>
                          </table>
                        </td>
                        <td width="4%" align="center" valign="middle">
                          <div style="width: 1px; height: 50px; background-color: #e2e8f0;"></div>
                        </td>
                        <td width="48%" valign="top">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="line-height: 1.8;">
                            <tr>
                              <td width="105" style="color: #64748b;">Attending Doctor</td>
                              <td width="10" style="color: #94a3b8;">:</td>
                              <td style="font-weight: 700; color: #0f172a;">${doctorName}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Specialization</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 600; color: #0f172a;">${doctorSpecialization}</td>
                            </tr>
                            <tr>
                              <td style="color: #64748b;">Visit Category</td>
                              <td style="color: #94a3b8;">:</td>
                              <td style="font-weight: 600; color: #059669;">First Visit (OPD)</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Charges Table: Solid Medical Emerald Header -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 16px; overflow: hidden; border-collapse: separate; border-spacing: 0;">
                <tr>
                  <td colspan="6" style="background-color: #059669; padding: 10px 14px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="left" style="font-size: 11px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">
                          SERVICE & TREATMENT CHARGES
                        </td>
                        <td align="right" style="font-size: 10px; font-weight: 600; color: #ecfdf5;">
                          Cur: INR (₹)
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr style="background-color: #f8fafc; font-size: 11px; font-weight: 700; color: #1e293b;">
                  <td style="padding: 9px 8px; text-align: center; border-bottom: 1px solid #e2e8f0;" width="6%">#</td>
                  <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0;" width="22%">Category</td>
                  <td style="padding: 9px 12px; border-bottom: 1px solid #e2e8f0;" width="38%">Item Description</td>
                  <td style="padding: 9px 8px; text-align: center; border-bottom: 1px solid #e2e8f0;" width="8%">Qty</td>
                  <td style="padding: 9px 12px; text-align: right; border-bottom: 1px solid #e2e8f0;" width="13%">Unit Price</td>
                  <td style="padding: 9px 12px; text-align: right; border-bottom: 1px solid #e2e8f0;" width="13%">Total Amount</td>
                </tr>
                ${items.map((item, index) => `
                <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px;">
                  <td style="padding: 10px 8px; text-align: center; color: #94a3b8; font-family: monospace; border-bottom: 1px solid #f1f5f9;">${index + 1}</td>
                  <td style="padding: 10px 12px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #f1f5f9;">
                    <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background-color: #059669; margin-right: 6px; vertical-align: middle;"></span>
                    ${item.category}
                  </td>
                  <td style="padding: 10px 12px; color: #334155; line-height: 1.4; border-bottom: 1px solid #f1f5f9;">${item.description}</td>
                  <td style="padding: 10px 8px; text-align: center; color: #475569; font-family: monospace; border-bottom: 1px solid #f1f5f9;">${item.quantity}</td>
                  <td style="padding: 10px 12px; text-align: right; color: #475569; font-family: monospace; border-bottom: 1px solid #f1f5f9;">${typeof item.unitPrice === 'number' ? `₹${formatInvoiceAmount(item.unitPrice)}` : item.unitPrice}</td>
                  <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #0f172a; font-family: monospace; border-bottom: 1px solid #f1f5f9;">${typeof item.amount === 'number' ? `₹${formatInvoiceAmount(item.amount)}` : item.amount}</td>
                </tr>
                `).join('')}
              </table>

              <!-- Totals & Notes Section -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
                <tr>
                  <!-- Left: Notes -->
                  <td width="52%" valign="top" style="padding-right: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background-color: #ffffff;">
                      <tr>
                        <td style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px 12px; font-size: 11px; font-weight: 700; color: #0f172a;">
                          📄 Clinical & Billing Notes
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 12px; font-size: 11px; color: #64748b; line-height: 1.5;">
                          <div style="font-family: monospace; color: #94a3b8; font-size: 10px; margin-bottom: 4px;">REF: ${invoiceNo}</div>
                          <div style="color: #334155; font-style: italic; margin-bottom: 8px;">
                            ${d.notes || 'Routine consultation and outpatient services rendered.'}
                          </div>
                          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; font-size: 10px; color: #64748b;">
                            Thank you for your visit. Computer-generated tax invoice. No signature required.
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>

                  <!-- Right: Financial Breakdown -->
                  <td width="48%" valign="top" style="padding-left: 8px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; font-size: 11px; background-color: #ffffff;">
                      <tr>
                        <td style="padding: 12px 14px; line-height: 1.8;">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td style="color: #64748b;">Subtotal</td>
                              <td align="right" style="font-family: monospace; font-weight: 600; color: #0f172a;">₹${subtotalStr}</td>
                            </tr>
                            ${discountStr ? `
                            <tr>
                              <td style="color: #059669;">Discount</td>
                              <td align="right" style="font-family: monospace; font-weight: 600; color: #059669;">- ₹${discountStr}</td>
                            </tr>` : ''}
                            <tr>
                              <td style="color: #64748b;">${taxVal > 0 ? 'GST / Taxes' : 'GST (0% Healthcare Exemption)'}</td>
                              <td align="right" style="font-family: monospace; color: #64748b;">₹${taxStr}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="background-color: #059669; padding: 10px 14px;">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td style="color: #ffffff; font-size: 12px; font-weight: 800; text-transform: uppercase;">Grand Total</td>
                              <td align="right" style="color: #ffffff; font-family: monospace; font-size: 16px; font-weight: 900;">₹${grandTotalStr}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="background-color: #f8fafc; padding: 10px 14px; line-height: 1.8;">
                          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td style="color: #334155;">Amount Paid</td>
                              <td align="right" style="font-family: monospace; font-weight: 700; color: #0f172a;">₹${grandTotalStr}</td>
                            </tr>
                            <tr>
                              <td style="color: #059669; font-weight: 700; border-top: 1px solid #e2e8f0; padding-top: 4px;">Balance Due</td>
                              <td align="right" style="font-family: monospace; font-weight: 800; color: #059669; border-top: 1px solid #e2e8f0; padding-top: 4px;">₹0.00</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Authorised Signatory -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 16px; padding-top: 14px; border-top: 1px solid #f1f5f9; font-size: 10px; color: #64748b;">
                <tr>
                  <td valign="bottom" align="left">
                    <div style="font-weight: 700; color: #334155;">${clinicName}</div>
                    <div style="font-size: 9px; color: #94a3b8;">Authorised Medical Facility</div>
                  </td>
                  <td valign="bottom" align="right">
                    <div style="width: 140px; border-bottom: 1px solid #94a3b8; margin-bottom: 4px; margin-left: auto;"></div>
                    <div style="font-weight: 700; color: #334155;">Authorised Signatory</div>
                    <div style="font-size: 9px; color: #94a3b8;">Doctor / Billing Executive</div>
                  </td>
                </tr>
              </table>

              <!-- Platform Footer Badges -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                <tr>
                  <td width="35%" valign="middle" align="left">
                    <div style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Connected Clinic</div>
                    <div style="font-size: 20px; font-weight: 900; color: #059669; line-height: 1.1;">VIITSA</div>
                    <div style="font-size: 8px; font-weight: 800; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase;">Better Care Together</div>
                  </td>
                  <td width="65%" valign="middle" align="right">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="right">
                      <tr>
                        <td align="center" style="padding: 0 10px; border-right: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">🛡️</div>
                          Secure Patient<br/>Records
                        </td>
                        <td align="center" style="padding: 0 10px; border-right: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">👥</div>
                          Seamless Clinic<br/>Experience
                        </td>
                        <td align="center" style="padding: 0 10px; font-size: 8px; font-weight: 700; color: #334155; line-height: 1.3;">
                          <div style="font-size: 13px; color: #059669; margin-bottom: 2px;">📈</div>
                          Better Health<br/>Outcomes
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Button & Links -->
              <div style="text-align: center; margin-top: 22px; padding-top: 16px; border-top: 1px solid #f1f5f9;">
                <a href="https://viitsa.com/login" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff; padding: 12px 32px; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);">
                  View Invoices in Patient Portal
                </a>
                ${d.pdfUrl ? `<div style="margin-top: 10px;"><a href="${d.pdfUrl}" target="_blank" style="color: #059669; text-decoration: underline; font-size: 12px; font-weight: 600;">Download Official PDF</a></div>` : ''}
              </div>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export function buildGenericHtml(data?: { body?: string; title?: string; buttonText?: string; buttonUrl?: string }): string {
  const content = `
    <div style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
      ${data?.body || ''}
    </div>
    ${data?.buttonUrl ? `
      <div style="text-align: center; margin-top: 24px;">
        <a href="${data.buttonUrl}" target="_blank" style="display: inline-block; background-color: #059669; color: #ffffff; padding: 12px 32px; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);">
          ${data.buttonText || 'Open Viitsa Portal'}
        </a>
      </div>
    ` : ''}
  `;
  return wrapEmailShell(content, { subtitle: data?.title || 'Notification' });
}

export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    let subject = params.subject || 'Notification from Viitsa';
    let htmlContent = '';

    if (params.template === 'clinic_pending') {
      subject = `Verification Under Process - ${params.data?.clinicName || 'Clinic'}`;
      htmlContent = buildClinicPendingHtml(params.data);
    } else if (params.template === 'clinic_approved') {
      subject = `Clinic Approved - Welcome to Viitsa, ${params.data?.clinicName || 'Clinic'}!`;
      htmlContent = buildClinicApprovedHtml(params.data);
    } else if (params.template === 'clinic_rejected') {
      subject = `Verification Rejected - Action Required for ${params.data?.clinicName || 'Clinic'}`;
      htmlContent = buildClinicRejectedHtml(params.data);
    } else if (params.template.startsWith('appointment_')) {
      const type = params.template === 'appointment_cancelled' 
        ? 'cancelled' 
        : (params.template === 'appointment_rescheduled' ? 'rescheduled' : 'confirmed');
      const title = type === 'cancelled' ? 'Appointment Cancelled' : (type === 'rescheduled' ? 'Appointment Rescheduled' : 'Appointment Confirmed');
      subject = `${title} - ${params.data?.clinicName || 'Viitsa'}`;
      htmlContent = buildAppointmentHtml({ ...params.data, type });
    } else if (params.template === 'prescription') {
      const { prescriptionNo, clinicName } = params.data || {};
      subject = params.subject || `Doctor Prescription - ${prescriptionNo || 'Rx'} | ${clinicName || 'Viitsa'}`;
      htmlContent = buildPrescriptionHtml(params.data);
    } else if (params.template === 'invoice') {
      const { invoiceNo, clinicName } = params.data || {};
      subject = params.subject || `Invoice ${invoiceNo || ''} from ${clinicName || 'Viitsa'}`;
      htmlContent = buildInvoiceHtml(params.data);
    } else if (params.template === 'sub_change') {
      const { newPlan, clinicName } = params.data || {};
      subject = params.subject || `Plan Change Scheduled - ${newPlan || 'Plan'} | ${clinicName || 'Viitsa'}`;
      htmlContent = buildSubscriptionPlanChangeScheduledHtml(params.data);
    } else if (params.template === 'sub_cancelled') {
      const { planName, clinicName } = params.data || {};
      subject = params.subject || `Subscription Cancellation Scheduled - ${planName || 'Plan'} | ${clinicName || 'Viitsa'}`;
      htmlContent = buildSubscriptionCancelledHtml(params.data);
    } else {
      htmlContent = buildGenericHtml(params.data);
    }

    const sendInstantEmail = httpsCallable(functions, 'sendInstantEmail');
    await sendInstantEmail({
      to: params.to,
      subject,
      htmlContent,
      attachments: params.attachments
    });

    return { success: true };
  } catch (error: any) {
    console.error('sendEmail Error:', error);
    return { success: false, error: error.message };
  }
}

export async function sendInstantAppointmentEmail(
  apptId: string, 
  template: "appointment_confirmed" | "appointment_cancelled" | "appointment_rescheduled"
) {
  try {
    const apptSnap = await getDoc(doc(db, 'appointments', apptId));
    if (!apptSnap.exists()) return;
    const appt = apptSnap.data();

    let patientEmail = null;
    let patientName = "Patient";

    if (appt.patient_id) {
      const pSnap = await getDoc(doc(db, 'patient_accounts', appt.patient_id));
      if (pSnap.exists()) {
        patientEmail = pSnap.data().email;
        patientName = pSnap.data().name || pSnap.data().full_name || "Patient";
      } else {
        const p2Snap = await getDoc(doc(db, 'patients', appt.patient_id));
        if (p2Snap.exists()) {
          patientEmail = p2Snap.data().email;
          patientName = p2Snap.data().name || p2Snap.data().full_name || "Patient";
        }
      }
    }

    if (!patientEmail) return;

    let doctorName = "Your Doctor";
    if (appt.doctor_id) {
      const dSnap = await getDoc(doc(db, 'users', appt.doctor_id));
      if (dSnap.exists()) doctorName = dSnap.data().name || "Your Doctor";
    }

    let clinicName = "Viitsa Clinic";
    if (appt.clinic_id) {
      const cSnap = await getDoc(doc(db, 'clinics', appt.clinic_id));
      if (cSnap.exists()) clinicName = cSnap.data().name || "Viitsa Clinic";
    }

    const dateStr = formatDate(appt.date);
    const rawToken = appt.display_token || (appt.token_number ? `ON-${String(appt.token_number).padStart(3, '0')}` : '—');
    const tokenDisplay = rawToken.replace(/^EM-/, 'QR-');

    await sendEmail({
      to: patientEmail,
      template,
      data: {
        patientName,
        doctorName,
        clinicName,
        date: dateStr,
        time: appt.time_slot || '—',
        token: tokenDisplay
      }
    });

  } catch (err) {
    console.error('Error sending instant appointment email:', err);
  }
}

export async function sendVerificationNotificationEmail(
  email: string,
  displayName?: string,
  continueUrl?: string,
  portal?: 'clinic' | 'patient'
): Promise<{ success: boolean; error?: string }> {
  const isClinic = portal === 'clinic' || Boolean(continueUrl && continueUrl.includes('/clinic')) || (typeof window !== 'undefined' && window.location.pathname.startsWith('/clinic'));
  const origin = (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
    ? window.location.origin
    : 'https://viitsa.com';
  const url = continueUrl || (isClinic 
    ? `${origin}/clinic/login?verified=true`
    : `${origin}/login?verified=true`);

  // 1. Primary: Cloud Function in asia-south1 using Titan SMTP (support@viitsa.com) and branded HTML
  try {
    const sendVerifAsia = httpsCallable(functions, 'sendVerificationEmail');
    const roleName = displayName || (isClinic ? 'Doctor / Clinic Administrator' : 'Patient');
    const res: any = await sendVerifAsia({ email: email.trim().toLowerCase(), displayName: roleName, continueUrl: url, portal: isClinic ? 'clinic' : 'patient' });
    if (res?.data?.success) {
      return { success: true };
    }
  } catch (err: any) {
    console.warn('Cloud Function sendVerificationEmail error:', err);
    if (err.code === 'functions/not-found' || err.message?.includes('not-found') || err.message?.includes('No account found')) {
      return {
        success: false,
        error: 'No account found with this email address. Please check your spelling or register a new account.'
      };
    }
  }

  // 2. Secondary fallback: Firebase Authentication Client SDK
  try {
    if (auth.currentUser && auth.currentUser.email?.toLowerCase() === email.trim().toLowerCase()) {
      const { sendEmailVerification: fbSendVerif } = await import('firebase/auth');
      try {
        await fbSendVerif(auth.currentUser, { url, handleCodeInApp: true });
        return { success: true };
      } catch (urlErr: any) {
        if (urlErr.code === 'auth/unauthorized-continue-uri') {
          console.warn('sendEmailVerification with continueUrl unauthorized, sending standard verification:', urlErr);
          await fbSendVerif(auth.currentUser);
          return { success: true };
        }
        throw urlErr;
      }
    }
  } catch (clientErr: any) {
    console.warn('Firebase Auth sendEmailVerification client note:', clientErr);
  }

  return { 
    success: false, 
    error: 'Verification service is temporarily busy. Please wait a moment and try resending your verification link.' 
  };
}

export async function sendPasswordResetNotificationEmail(
  email: string,
  returnUrl?: string,
  portal?: 'clinic' | 'patient' | 'admin'
): Promise<{ success: boolean; error?: string; code?: string }> {
  const origin = (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
    ? window.location.origin
    : 'https://viitsa.com';
  const cleanEmail = email.trim().toLowerCase();
  const isClinic = portal === 'clinic' || Boolean(returnUrl && returnUrl.includes('/clinic'));
  const isAdmin = portal === 'admin' || Boolean(returnUrl && returnUrl.includes('/admin'));
  const defaultReturn = isAdmin ? '/admin/login' : (isClinic ? '/clinic/login' : '/login');
  const actualReturn = returnUrl || defaultReturn;
  const continueUrl = `${origin}/reset-password?return=${encodeURIComponent(actualReturn)}&completed=true`;

  try {
    const sendResetAsia = httpsCallable(functions, 'sendPasswordResetEmail');
    const res: any = await sendResetAsia({
      email: cleanEmail,
      returnUrl: actualReturn,
      continueUrl,
      portal: portal || (isAdmin ? 'admin' : (isClinic ? 'clinic' : 'patient')),
    });
    if (res?.data?.success) {
      return { success: true };
    }
  } catch (fnErr: any) {
    console.warn('Cloud Function sendPasswordResetEmail note:', fnErr);
    const code = fnErr.code || '';
    const msg = fnErr.message || '';
    if (code === 'functions/not-found' || msg.includes('No account found') || msg.includes('not-found')) {
      return {
        success: false,
        error: 'No account found with this email address. Please check your spelling or register a new account.',
        code: 'auth/user-not-found'
      };
    }
    if (code === 'functions/invalid-argument' || msg.includes('invalid-argument') || msg.includes('Missing required')) {
      return {
        success: false,
        error: 'Please enter a valid email address.',
        code: 'auth/invalid-email'
      };
    }
    return {
      success: false,
      error: msg || 'Failed to send password reset email. Please try again.',
      code: code
    };
  }

  return {
    success: false,
    error: 'Failed to send password reset email. Please try again.'
  };
}

/**
 * Send 6-digit OTP code to email address via Titan SMTP
 */
export async function sendEmailAuthOtpCode(
  email: string,
  name?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const fn = httpsCallable(functions, 'sendEmailAuthOtp');
    const res: any = await fn({ email: email.trim().toLowerCase(), name });
    if (res?.data?.success) {
      return { success: true };
    }
    return { success: false, error: res?.data?.message || 'Failed to send email verification code.' };
  } catch (err: any) {
    console.error('sendEmailAuthOtp error:', err);
    return { success: false, error: err.message || 'Failed to dispatch email verification code.' };
  }
}

/**
 * Verify 6-digit OTP code sent to email
 */
export async function verifyEmailAuthOtpCode(
  email: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const fn = httpsCallable(functions, 'verifyEmailAuthOtp');
    const res: any = await fn({ email: email.trim().toLowerCase(), otp: otp.trim() });
    if (res?.data?.success) {
      return { success: true };
    }
    return { success: false, error: res?.data?.message || 'Invalid email verification code.' };
  } catch (err: any) {
    console.error('verifyEmailAuthOtp error:', err);
    return { success: false, error: err.message || 'Failed to verify email code.' };
  }
}

/**
 * Check if a mobile phone number or email address is already registered as a different role,
 * or verify upfront whether it is permitted to login to a specific portal.
 */
export async function checkRegistrationConflict(
  phone?: string,
  email?: string,
  targetRole?: string,
  action: 'login' | 'register' = 'register',
  portal: 'clinic' | 'patient' | 'admin' = 'clinic'
): Promise<{
  allowed: boolean;
  hasConflict: boolean;
  conflictMessage?: string;
  phoneConflict?: { exists: boolean; role?: string; roleLabel?: string };
  emailConflict?: { exists: boolean; role?: string; roleLabel?: string };
}> {
  try {
    const fn = httpsCallable(functions, 'checkRegistrationConflict');
    const res: any = await fn({
      phone: phone ? phone.replace(/\D/g, '').slice(-10) : undefined,
      email: email ? email.trim().toLowerCase() : undefined,
      targetRole: targetRole || 'clinic_admin',
      action,
      portal,
    });
    const d = res?.data || {};
    return {
      allowed: d.allowed !== false,
      hasConflict: Boolean(d.hasConflict),
      conflictMessage: d.conflictMessage,
      phoneConflict: d.phoneConflict,
      emailConflict: d.emailConflict,
    };
  } catch (err: any) {
    console.warn('checkRegistrationConflict note:', err);
    return { allowed: true, hasConflict: false };
  }
}




