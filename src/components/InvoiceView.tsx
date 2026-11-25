import { useState } from 'react';
import { 
  Printer, Share2, Download, Building, User, FileText, Phone, Mail, 
  ShieldCheck, Users, TrendingUp, Pill, FlaskConical, Activity, 
  ClipboardList, Loader2, X, Send, Check, Bell, QrCode, CheckCircle2 
} from 'lucide-react';
import { formatDate, formatRs, parseDateArg } from '../lib/format';
import type { Invoice, Clinic, Patient, User as Doctor } from '../lib/types';
import { 
  downloadInvoicePDF, 
  shareInvoicePDF, 
  uploadAndGetInvoiceUrl,
  generateInvoiceBlob,
  blobToBase64,
  downloadBlobFile,
  sharePdfFileNative
} from '../lib/pdf';
import { sendEmail } from '../lib/emailService';
import { useToast } from '../lib/toast';
import { sendWhatsAppPatientInvoiceViaAPI, sendWhatsAppPaymentReminderViaAPI } from '../lib/whatsappClientService';
import { useAuth } from '../lib/auth';

export type InvoiceTemplateStyle = 'modern' | 'minimal' | 'classic' | 'executive';

export interface InvoiceCustomizationOptions {
  templateStyle?: InvoiceTemplateStyle;
  accentColor?: string;
  showPlatformBranding?: boolean;
  showSignatureBox?: boolean;
  showUpiQr?: boolean;
  customTerms?: string;
}

export interface InvoiceViewProps {
  invoice: Invoice;
  clinic?: Clinic | null;
  patient?: Patient | null;
  doctor?: Doctor | null;
  onClose?: () => void;
  customizationOptions?: InvoiceCustomizationOptions;
}

const getCategoryIcon = (category: string, accentColor?: string) => {
  const cat = category.toLowerCase();
  const style = accentColor ? { color: accentColor } : undefined;
  const cls = accentColor ? '' : 'text-primary';
  if (cat.includes('consultation')) return <User size={14} className={cls} style={style} />;
  if (cat.includes('medicine') || cat.includes('pharmacy')) return <Pill size={14} className={cls} style={style} />;
  if (cat.includes('lab') || cat.includes('test') || cat.includes('diagnostic')) return <FlaskConical size={14} className={cls} style={style} />;
  if (cat.includes('procedure') || cat.includes('nursing') || cat.includes('vaccination')) return <Activity size={14} className={cls} style={style} />;
  return <ClipboardList size={14} className={cls} style={style} />;
};

export function InvoiceView({ 
  invoice, 
  clinic, 
  patient, 
  doctor, 
  onClose,
  customizationOptions 
}: InvoiceViewProps) {
  const { clinic: authClinic } = useAuth();
  const c = clinic ?? authClinic ?? (invoice.clinic as Clinic | null);
  const p = patient ?? (invoice.patient as Patient | null);
  const d = doctor ?? (invoice.doctor as Doctor | null);

  // Read saved settings or prop customization
  const clinicSavedOpts = (c as any)?.invoice_settings || (c as any)?.invoice_customization;
  const optStyle: InvoiceTemplateStyle = customizationOptions?.templateStyle || clinicSavedOpts?.template_style || 'modern';
  const optColor: string = customizationOptions?.accentColor || clinicSavedOpts?.accent_color || '#059669';
  const optPlatformBranding: boolean = customizationOptions?.showPlatformBranding ?? clinicSavedOpts?.show_platform_branding ?? true;
  const optSignature: boolean = customizationOptions?.showSignatureBox ?? clinicSavedOpts?.show_signature_box ?? true;
  const optUpiQr: boolean = customizationOptions?.showUpiQr ?? clinicSavedOpts?.show_upi_qr ?? true;
  const optTerms: string = customizationOptions?.customTerms ?? clinicSavedOpts?.custom_terms ?? '';

  const clinicName = c?.name || (invoice as any)?.clinic_name || (invoice as any)?.clinic || '—';
  const clinicAddress = c?.address || (invoice as any)?.clinic_address || '—';
  const clinicPhone = c?.phone || (invoice as any)?.clinic_phone || '—';
  const clinicEmail = c?.email || (invoice as any)?.clinic_email || '—';

  const patientName = p?.name || (p as any)?.full_name || (invoice as any)?.patient_name || (invoice as any)?.patient || '—';
  const patientPhone = p?.phone || (invoice as any)?.patient_phone || (invoice as any)?.phone || '—';
  const patientIdDisplay = (p as any)?.display_id || (p as any)?.patient_code || (p as any)?.id_number || (invoice as any)?.patient_code || (invoice as any)?.id_number || p?.patient_id || (invoice as any)?.patient_id || '—';
  const patientAge = p?.age || (invoice as any)?.patient_age || (invoice as any)?.age || null;
  const patientGender = p?.gender || (invoice as any)?.patient_gender || (invoice as any)?.gender || '—';

  const doctorName = d?.name || (invoice as any)?.doctor_name || (invoice as any)?.doctor || '—';
  const doctorSpec = d?.specialisation || (invoice as any)?.doctor_specialisation || (invoice as any)?.specialization || '—';

  const rawDate = invoice.visit_date || invoice.created_at || (invoice as any)?.date;
  const parsedDate = parseDateArg(rawDate);
  const invoiceDate = !isNaN(parsedDate.getTime()) ? parsedDate : new Date();
  const invoiceDateDisplay = formatDate(rawDate || invoiceDate);
  const invoiceTimeDisplay = !isNaN(parsedDate.getTime())
    ? parsedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';
  const idStr = invoice.invoice_number || invoice.id || invoice.invoice_id || 'UNKNOWN';

  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState<'wa' | 'email' | 'reminder' | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [targetEmail, setTargetEmail] = useState(p?.email || '');

  const shareWhatsApp = async () => {
    await shareInvoicePDF(invoice, c, p?.name ?? 'Patient');
  };

  const shareViaWhatsAppText = async () => {
    try {
      setIsUploading('wa');
      const blob = await generateInvoiceBlob(invoice, c, p?.name ?? 'Patient');
      const fileName = `Invoice_${idStr}.pdf`;

      let pdfUrl = '';
      try {
        pdfUrl = await uploadAndGetInvoiceUrl(invoice, c, p?.name ?? 'Patient');
      } catch (uErr) {
        console.warn('PDF upload error:', uErr);
      }

      // 1. Direct delivery via official Meta WhatsApp Cloud API with PDF document attachment!
      const cleanPhone = (p?.phone || '').replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        try {
          toast('Sending official WhatsApp invoice with PDF...', 'info');
          const res = await sendWhatsAppPatientInvoiceViaAPI({
            to: cleanPhone,
            clinicId: c?.clinic_id || '',
            patientName: p?.name || 'Patient',
            clinicName: c?.name || 'Clinic',
            invoiceNumber: idStr,
            totalAmount: Number(invoice.total || invoice.amount || 0),
            paymentStatus: String(invoice.payment_status || 'PAID').toUpperCase(),
            billingDate: invoiceDateDisplay,
            clinicPhone: c?.phone || '+91 73961 11081',
            pdfUrl: pdfUrl || undefined,
          });

          if (res.success) {
            toast(`Official WhatsApp invoice delivered to ${p?.name || 'patient'}!`, 'success');
            return;
          } else {
            console.warn('[shareViaWhatsAppText] API error, falling back to manual share:', res.error);
          }
        } catch (apiErr) {
          console.warn('[shareViaWhatsAppText] API error, falling back to manual share:', apiErr);
        }
      }

      // 2. Fallback to native Web Share / WhatsApp Web link
      const loginUrl = 'https://viitsa.com/login';
      const text = `*Payment Invoice — ${c?.name ?? 'Clinic'}*\n\n` +
        `👤 Patient: ${p?.name ?? 'Patient'}\n` +
        `🧾 Invoice No: ${idStr}\n` +
        `📅 Date: ${invoiceDateDisplay}\n` +
        `💰 Total Amount: ${formatRs(Number(invoice.total || invoice.amount))}\n` +
        `📌 Status: ${(invoice.payment_status || 'Paid').toUpperCase()}\n\n` +
        `🔐 *Login to your Patient Portal Account:*\n${loginUrl}\n\n` +
        (pdfUrl ? `📄 *View & Download Official PDF Invoice:*\n${pdfUrl}\n\n` : '') +
        `📎 _Note: Official invoice PDF has also been downloaded to your device for quick reference & direct attachment._\n\n` +
        `— VIITSA Healthcare Platform`;

      const sharedNatively = await sharePdfFileNative(blob, fileName, `Invoice - ${idStr}`, text);

      if (!sharedNatively) {
        downloadBlobFile(blob, fileName);
        const phone = (p?.phone || '').replace(/\D/g, '');
        const waUrl = phone 
          ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` 
          : `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(waUrl, '_blank');
        toast('Invoice PDF downloaded! WhatsApp opened with your login and PDF link.', 'success');
      } else {
        toast('Shared invoice PDF successfully!', 'success');
      }
    } catch (e) {
      console.error(e);
      toast('Failed to generate PDF for WhatsApp. Please try Download.', 'error');
    } finally {
      setIsUploading(null);
    }
  };

  const sendPaymentReminderViaWhatsApp = async () => {
    const cleanPhone = (p?.phone || '').replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      toast('Patient phone number is missing or invalid.', 'error');
      return;
    }
    try {
      setIsUploading('reminder');
      toast('Sending official WhatsApp payment reminder...', 'info');
      const res = await sendWhatsAppPaymentReminderViaAPI({
        to: cleanPhone,
        clinicId: c?.clinic_id || '',
        patientName: p?.name || 'Patient',
        clinicName: c?.name || 'Clinic',
        pendingAmount: balanceDue || grandTotal,
        visitDate: invoiceDateDisplay,
        upiId: (c as any)?.upi_id || (c as any)?.upiId || 'clinic@upi',
        clinicPhone: c?.phone || '+91 73961 11081',
      });
      if (res.success) {
        toast(`WhatsApp payment reminder delivered to ${p?.name || 'patient'}!`, 'success');
      } else {
        toast(`Failed: ${res.error || 'Could not send reminder'}`, 'error');
      }
    } catch (err: any) {
      toast(`Error sending reminder: ${err?.message || err}`, 'error');
    } finally {
      setIsUploading(null);
    }
  };

  const handleOpenEmailDialog = () => {
    setTargetEmail(p?.email || '');
    setEmailModalOpen(true);
  };

  const handleSendInvoiceEmail = async () => {
    if (!targetEmail.trim() || !targetEmail.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }
    try {
      setIsUploading('email');
      const blob = await generateInvoiceBlob(invoice, c, p?.name ?? 'Patient');
      const base64 = await blobToBase64(blob);
      const fileName = `Invoice_${idStr}.pdf`;

      let pdfUrl = '';
      try {
        pdfUrl = await uploadAndGetInvoiceUrl(invoice, c, p?.name ?? 'Patient');
      } catch (uErr) {
        console.warn('PDF upload:', uErr);
      }

      const loginUrl = 'https://viitsa.com/login';

      const res = await sendEmail({
        to: targetEmail.trim(),
        template: 'invoice',
        subject: `Payment Invoice ${idStr} | ${c?.name ?? 'Viitsa'}`,
        data: {
          patientName: p?.name ?? 'Patient',
          clinicName: c?.name ?? 'Clinic',
          invoiceNo: idStr,
          amount: formatRs(Number(invoice.total || invoice.amount)),
          date: invoiceDateDisplay,
          pdfUrl,
          loginUrl
        },
        attachments: [
          {
            filename: fileName,
            content: base64,
            contentType: 'application/pdf'
          }
        ]
      });

      downloadBlobFile(blob, fileName);

      if (res.success) {
        setEmailModalOpen(false);
        toast(`Invoice email sent to ${targetEmail} with PDF attached and account login link!`, 'success');
      } else {
        const subject = `Invoice ${idStr} from ${c?.name ?? 'Clinic'}`;
        const body = `Hello ${p?.name ?? 'Patient'},\n\nHere is your invoice from ${c?.name ?? 'our clinic'}:\n\nInvoice No: ${idStr}\nTotal: ${formatRs(Number(invoice.total || invoice.amount))}\n\n🔐 Login to your account: ${loginUrl}\n📄 View PDF: ${pdfUrl}\n\n(The PDF file has been downloaded to your computer)\n\nThank you,\n${c?.name ?? 'Clinic'}`;
        window.location.href = `mailto:${targetEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        setEmailModalOpen(false);
        toast('Invoice PDF downloaded! Email client opened with login and PDF links.', 'info');
      }
    } catch (e) {
      console.error(e);
      toast('Failed to send invoice email.', 'error');
    } finally {
      setIsUploading(null);
    }
  };

  const downloadPDF = () => {
    downloadInvoicePDF(invoice, c, p?.name ?? 'Patient');
  };

  // Group line items by category
  const items = Array.isArray(invoice.line_items) ? [...invoice.line_items] : [];
  const effectiveAmt = Number(invoice.amount ?? invoice.total_amount ?? invoice.total ?? 0);
  if (items.length === 0 && effectiveAmt > 0) {
    items.push({
      category: invoice.category || (invoice.description ? 'Service' : 'Consultation Fee'),
      description: invoice.description || invoice.notes || 'Consultation / Medical Service',
      amount: effectiveAmt,
      quantity: 1
    });
  }

  const groupedItems = items.reduce((acc: any, item: any) => {
    const cat = item.category || (item.description?.toLowerCase().includes('consultation') ? 'Consultation Fee' : 'Other Charges');
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const subtotal = Number(invoice.subtotal ?? invoice.amount ?? invoice.total_amount ?? invoice.total ?? 0);
  const discount = Number(invoice.discount_amount || invoice.discount || 0);
  const tax = Number(invoice.tax || invoice.tax_amount || 0);
  const grandTotal = Number(invoice.total ?? invoice.amount ?? invoice.total_amount ?? subtotal);
  const isPaidStatus = (invoice.payment_status || invoice.status || '').toLowerCase() === 'paid';
  const amountPaid = invoice.amount_paid !== undefined ? Number(invoice.amount_paid) : (isPaidStatus ? grandTotal : 0);
  const balanceDue = invoice.balance_due !== undefined ? Number(invoice.balance_due) : Math.max(0, grandTotal - amountPaid);

  const fmt = (num: number) => num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col items-start sm:items-center overflow-x-auto w-full max-w-full px-1 sm:px-2 py-4">
      <div 
        id="print-area" 
        className="invoice-page bg-white text-ink font-sans relative"
        style={{ 
          width: '210mm', 
          minHeight: '297mm', 
          margin: '0 auto', 
          padding: '10mm 12mm', 
          boxSizing: 'border-box' 
        }}
      >
        
        {/* ======================= TEMPLATE 1: MODERN MEDICAL (DEFAULT) ======================= */}
        {optStyle === 'modern' && (
          <>
            {/* Header */}
            <div className="flex justify-between items-start mb-5">
              <div>
                <h1 className="text-3xl font-black tracking-tight leading-none" style={{ color: optColor }}>VIITSA</h1>
                <p className="text-[11px] font-semibold tracking-wide mt-1" style={{ color: optColor }}>Clinic-paid Healthcare SaaS</p>
                <p className="text-[10px] text-ink-subtle mt-0.5 italic">Simplifying Care. Stronger Patients.</p>
              </div>
              <div className="text-right flex flex-col items-end">
                <p className="text-[9px] font-bold tracking-widest text-ink-muted uppercase leading-relaxed text-right">
                  Connected Clinics<br/>Healthier Patients<br/>Brighter Tomorrow
                </p>
                <div className="w-10 h-[2px] mt-2" style={{ backgroundColor: optColor }}></div>
              </div>
            </div>

            {/* Title */}
            <div className="mb-4">
              <h2 className="text-[26px] font-bold text-ink tracking-tight leading-none">Patient Invoice</h2>
              <p className="text-[10px] font-bold tracking-[0.2em] text-ink-subtle uppercase mt-1">Medical Billing Statement</p>
            </div>

            {/* Two Cards: Clinic + Invoice Details */}
            <div className="grid grid-cols-[56%_42%] justify-between gap-4 mb-4">
              <div className="bg-slate-50 border border-slate-200/80 rounded-[10px] p-4 flex flex-col justify-between shadow-2xs">
                <div className="flex gap-3">
                  {c?.logo_url ? (
                    <div className="shrink-0 h-[60px] w-[60px] sm:h-[70px] sm:w-[70px] flex items-center justify-center">
                      <img src={c.logo_url} alt="Clinic Logo" className="max-w-full max-h-full object-contain" />
                    </div>
                  ) : (
                    <div 
                      className="w-12 h-12 rounded-lg text-white shrink-0 flex items-center justify-center font-bold text-lg tracking-wider"
                      style={{ backgroundColor: optColor }}
                    >
                      {c?.name ? c.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : 'CL'}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-[15px] font-bold text-ink leading-tight">{clinicName}</h3>
                    <p className="text-[11px] text-ink-muted mt-1 leading-relaxed pr-2">
                      {clinicAddress}
                    </p>
                  </div>
                </div>
                
                <div className="mt-3 pt-2.5 border-t border-slate-200 flex flex-col gap-1 text-[10px] text-ink-muted">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5"><Phone size={11} style={{ color: optColor }}/> {clinicPhone}</span>
                    <span className="w-px h-3 bg-slate-300"></span>
                    <span className="flex items-center gap-1.5"><Mail size={11} style={{ color: optColor }}/> {clinicEmail}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {c?.gstin && <span>GSTIN: <strong className="text-slate-800">{c.gstin}</strong></span>}
                    {c?.gstin && c?.registration_number && <span className="w-px h-3 bg-slate-300"></span>}
                    {c?.registration_number && <span>Reg: <strong className="text-slate-800">{c.registration_number}</strong></span>}
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-[10px] p-4 shadow-2xs">
                <div className="grid grid-cols-[80px_1fr] gap-y-2 text-[11px]">
                  <span className="text-ink-muted">Invoice No.</span>
                  <span className="font-bold text-ink border-l border-slate-200 pl-3">{idStr}</span>
                  
                  <span className="text-ink-muted">Date</span>
                  <span className="font-bold text-ink border-l border-slate-200 pl-3">{invoiceDateDisplay}</span>
                  
                  <span className="text-ink-muted">Time</span>
                  <span className="font-bold text-ink border-l border-slate-200 pl-3">{invoiceTimeDisplay}</span>
                  
                  <span className="text-ink-muted">Receipt No.</span>
                  <span className="font-bold text-ink border-l border-slate-200 pl-3">{invoice.receipt_number || invoice.id?.slice(0, 8) || '—'}</span>
                  
                  <span className="text-ink-muted">Payment Mode</span>
                  <span className="font-bold text-ink uppercase border-l border-slate-200 pl-3">{invoice.payment_method || 'CASH'}</span>

                  <span className="text-ink-muted">Status</span>
                  <span className="border-l border-slate-200 pl-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      isPaidStatus ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                    }`}>
                      {isPaidStatus ? 'PAID' : 'PENDING'}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ======================= TEMPLATE 2: CLEAN MINIMALIST ======================= */}
        {optStyle === 'minimal' && (
          <div className="border-b-2 pb-4 mb-4" style={{ borderColor: optColor }}>
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{clinicName}</h1>
                <p className="text-[11px] text-slate-600 max-w-md">{clinicAddress}</p>
                <p className="text-[10px] text-slate-500">
                  Tel: {clinicPhone} · Email: {clinicEmail}
                  {c?.gstin ? ` · GSTIN: ${c.gstin}` : ''}
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 block">TAX INVOICE</span>
                <span className="text-xl font-bold font-mono text-slate-900">{idStr}</span>
                <div className="text-xs text-slate-500 mt-1">
                  <span>{invoiceDateDisplay}</span> · <span>{invoiceTimeDisplay}</span>
                </div>
                <div className="mt-1">
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    isPaidStatus ? 'bg-slate-900 text-white' : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}>
                    {isPaidStatus ? 'PAID' : 'PAYMENT DUE'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================= TEMPLATE 3: CLASSIC HOSPITAL ======================= */}
        {optStyle === 'classic' && (
          <div className="border-b border-slate-300 pb-4 mb-4">
            <div className="text-center pb-3 border-b border-slate-200 mb-3">
              <h1 className="text-2xl font-bold uppercase tracking-wide text-slate-900">{clinicName}</h1>
              <p className="text-xs text-slate-600 mt-0.5">{clinicAddress}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Contact: {clinicPhone} | E-mail: {clinicEmail}
                {c?.registration_number ? ` | Reg. No: ${c.registration_number}` : ''}
                {c?.gstin ? ` | GSTIN: ${c.gstin}` : ''}
              </p>
            </div>
            
            <div className="flex justify-between items-center px-1">
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">OFFICIAL OUTPATIENT BILL OF SUPPLY</span>
              </div>
              <div className="text-xs font-mono">
                <span className="text-slate-500">Invoice No: </span>
                <strong className="text-slate-900">{idStr}</strong>
                <span className="text-slate-400 mx-2">|</span>
                <span className="text-slate-500">Date: </span>
                <strong className="text-slate-900">{invoiceDateDisplay}</strong>
              </div>
            </div>
          </div>
        )}

        {/* ======================= TEMPLATE 4: EXECUTIVE NAVY ======================= */}
        {optStyle === 'executive' && (
          <div className="rounded-xl overflow-hidden mb-4 border border-slate-200 shadow-sm">
            <div className="p-4 text-white flex justify-between items-center" style={{ backgroundColor: optColor }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center font-bold text-white text-base">
                  {c?.name ? c.name.substring(0, 2).toUpperCase() : 'VI'}
                </div>
                <div>
                  <h1 className="text-lg font-bold leading-tight">{clinicName}</h1>
                  <p className="text-xs text-white/80">{clinicAddress}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold tracking-widest text-white/70 block">INVOICE STATEMENT</span>
                <span className="text-lg font-mono font-bold tracking-tight">{idStr}</span>
                <p className="text-[10px] text-white/80 mt-0.5">{invoiceDateDisplay}</p>
              </div>
            </div>
          </div>
        )}

        {/* ======================= PATIENT DETAILS BLOCK ======================= */}
        <div className="border border-slate-200 rounded-[10px] mb-4 overflow-hidden shadow-2xs">
          <div className="bg-slate-50 px-4 py-2 flex items-center justify-between border-b border-slate-200">
            <div className="flex items-center gap-2">
              <User size={13} style={{ color: optColor }} />
              <h3 className="text-xs font-bold text-ink">Patient & Doctor Information</h3>
            </div>
            <span className="text-[10px] font-mono text-slate-500">UHID: <strong className="text-slate-800">{patientIdDisplay}</strong></span>
          </div>

          <div className="p-3 bg-white text-[11px]">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-x-6">
              <div className="grid grid-cols-[100px_10px_1fr] gap-y-1.5">
                <span className="text-ink-muted">Patient Name</span><span>:</span><span className="font-bold text-ink">{patientName}</span>
                <span className="text-ink-muted">Age / Gender</span><span>:</span><span className="font-medium text-ink">{patientAge ? `${patientAge} Y` : '—'} / {patientGender}</span>
                <span className="text-ink-muted">Contact Phone</span><span>:</span><span className="font-medium text-ink">{patientPhone}</span>
              </div>
              
              <div className="w-px bg-slate-200"></div>
              
              <div className="grid grid-cols-[100px_10px_1fr] gap-y-1.5">
                <span className="text-ink-muted">Attending Doctor</span><span>:</span><span className="font-bold text-ink">{doctorName}</span>
                <span className="text-ink-muted">Specialization</span><span>:</span><span className="font-medium text-ink">{doctorSpec}</span>
                <span className="text-ink-muted">Visit Category</span><span>:</span><span className="font-medium text-ink">{invoice.visit_type === 'new-visit' ? 'First Visit (OPD)' : 'Follow-up (OPD)'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ======================= BILLING TABLE ======================= */}
        <div className="border border-slate-200 rounded-[10px] mb-4 overflow-hidden shadow-2xs">
          <div className="px-4 py-2 text-white flex justify-between items-center" style={{ backgroundColor: optColor }}>
            <h3 className="text-xs font-bold uppercase tracking-wider">Service & Treatment Charges</h3>
            <span className="text-[10px] font-semibold text-white/90">Cur: INR (₹)</span>
          </div>

          <table className="w-full text-[11px] text-left">
            <thead className="bg-slate-50 text-slate-800 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 w-[6%] text-center">#</th>
                <th className="py-2.5 px-3 w-[22%]">Category</th>
                <th className="py-2.5 px-3 w-[36%]">Item Description</th>
                <th className="py-2.5 px-3 w-[8%] text-center">Qty</th>
                <th className="py-2.5 px-3 w-[14%] text-right">Unit Price</th>
                <th className="py-2.5 px-3 w-[14%] text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.keys(groupedItems).map((category, catIndex) => {
                const catItems = groupedItems[category];
                return (
                  <tr key={category} className="align-top hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[10px]">{catIndex + 1}</td>
                    
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      <div className="flex items-center gap-1.5">
                        {getCategoryIcon(category, optColor)}
                        <span>{category}</span>
                      </div>
                    </td>
                    
                    <td className="py-2.5 px-3 text-slate-700">
                      {catItems.map((item: any, i: number) => (
                        <div key={i} className={`font-medium ${i > 0 ? 'mt-1' : ''}`}>{item.description || item.name || 'Service item'}</div>
                      ))}
                    </td>
                    
                    <td className="py-2.5 px-3 text-center text-slate-600 font-mono">
                      {catItems.map((item: any, i: number) => (
                        <div key={i} className={i > 0 ? 'mt-1' : ''}>{item.quantity || 1}</div>
                      ))}
                    </td>
                    
                    <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                      {catItems.map((item: any, i: number) => (
                        <div key={i} className={i > 0 ? 'mt-1' : ''}>₹{fmt(item.amount / (item.quantity || 1))}</div>
                      ))}
                    </td>
                    
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                      {catItems.map((item: any, i: number) => (
                        <div key={i} className={i > 0 ? 'mt-1' : ''}>₹{fmt(item.amount)}</div>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ======================= TOTALS & SUMMARY ======================= */}
        <div className="grid grid-cols-[52%_45%] justify-between gap-4 mb-4">
          
          {/* Left Column: Notes & Custom Terms & UPI */}
          <div className="space-y-3">
            <div className="border border-slate-200 rounded-[10px] overflow-hidden bg-white shadow-2xs">
              <div className="bg-slate-50 px-3.5 py-1.5 flex items-center gap-1.5 border-b border-slate-200">
                <FileText size={12} style={{ color: optColor }} />
                <h4 className="text-[11px] font-bold text-slate-800">Clinical & Billing Notes</h4>
              </div>
              <div className="p-3 text-[10px] text-slate-600 space-y-1">
                <p className="font-mono text-slate-400">REF: {idStr}</p>
                <p className="italic text-slate-700">{invoice.notes || 'Routine consultation and outpatient services rendered.'}</p>
              </div>
            </div>

            {/* Custom Terms if set */}
            {optTerms && (
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[10px] text-slate-500 leading-relaxed">
                {optTerms}
              </div>
            )}

            {/* UPI QR Code block for pending or instant settlement */}
            {optUpiQr && (c as any)?.upi_id && (
              <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Instant UPI Payment</span>
                  <span className="font-mono font-bold text-slate-800 text-[11px]">{(c as any).upi_id}</span>
                </div>
                <div className="h-7 w-7 rounded bg-white border border-slate-200 flex items-center justify-center text-teal-800">
                  <QrCode size={18} />
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Financial Breakdown */}
          <div className="border border-slate-200 rounded-[10px] overflow-hidden text-[11px] bg-white shadow-2xs flex flex-col">
            <div className="p-3.5 space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono font-semibold text-slate-800">₹{fmt(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount</span>
                  <span className="font-mono font-semibold">- ₹{fmt(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>GST (0% Healthcare Exemption)</span>
                <span className="font-mono text-slate-700">₹{fmt(tax)}</span>
              </div>
            </div>

            <div className="px-3.5 py-2 flex justify-between items-center text-white" style={{ backgroundColor: optColor }}>
              <span className="font-bold text-xs uppercase tracking-wide">Grand Total</span>
              <span className="font-mono font-black text-base">₹{fmt(grandTotal)}</span>
            </div>

            <div className="p-3.5 space-y-1.5 bg-slate-50/50">
              <div className="flex justify-between text-slate-700">
                <span>Amount Paid</span>
                <span className="font-mono font-bold text-slate-900">₹{fmt(amountPaid)}</span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t border-slate-200">
                <span>Balance Due</span>
                <span className={`font-mono ${balanceDue > 0 ? 'text-rose-600 font-extrabold' : 'text-emerald-700'}`}>
                  ₹{fmt(balanceDue)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ======================= SIGNATURE / STAMP SECTION ======================= */}
        {optSignature && (
          <div className="flex justify-between items-end mt-4 pt-4 border-t border-slate-100 text-[10px] text-slate-500">
            <div>
              <p className="font-semibold text-slate-700">{clinicName}</p>
              <p className="text-[9px]">Authorised Medical Facility</p>
            </div>
            <div className="text-right">
              <div className="w-40 border-b border-slate-400 mb-1"></div>
              <span className="font-semibold text-slate-700 block">Authorised Signatory</span>
              <span className="text-[9px] text-slate-400">Doctor / Billing Executive</span>
            </div>
          </div>
        )}

        {/* ======================= PLATFORM FOOTER BADGES ======================= */}
        {optPlatformBranding && (
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between mt-auto">
            <div>
              <p className="text-[9px] font-semibold text-slate-400 mb-0.5">Connected Clinic</p>
              <h2 className="text-[20px] font-black leading-none" style={{ color: optColor }}>VIITSA</h2>
              <p className="text-[7.5px] font-bold tracking-widest text-slate-400 mt-1 uppercase">Better Care Together</p>
            </div>
            
            <div className="flex items-center gap-4 text-slate-700">
              <div className="flex flex-col items-center pr-4 border-r border-slate-200">
                <ShieldCheck size={14} style={{ color: optColor }} className="mb-0.5" />
                <span className="text-[8px] font-bold text-center leading-tight">Secure<br/>Patient Records</span>
              </div>
              <div className="flex flex-col items-center pr-4 border-r border-slate-200">
                <Users size={14} style={{ color: optColor }} className="mb-0.5" />
                <span className="text-[8px] font-bold text-center leading-tight">Seamless<br/>Clinic Experience</span>
              </div>
              <div className="flex flex-col items-center">
                <TrendingUp size={14} style={{ color: optColor }} className="mb-0.5" />
                <span className="text-[8px] font-bold text-center leading-tight">Better<br/>Health Outcomes</span>
              </div>
            </div>

            <div className="text-right">
              <p className="text-[9px] text-slate-500 mb-0.5">Official Invoice via <span className="font-bold text-slate-800">VIITSA</span></p>
              <a href="https://www.viitsa.com" className="text-[8px] font-medium hover:underline" style={{ color: optColor }}>www.viitsa.com</a>
            </div>
          </div>
        )}

      </div>

      {/* ======================= ACTION BUTTONS ======================= */}
      <div id="invoice-actions" className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap print:hidden max-w-[210mm] w-full mx-auto mt-4 pb-10 px-2">
        <button 
          onClick={shareViaWhatsAppText} 
          disabled={isUploading !== null} 
          className="btn-secondary px-6 bg-green-50 text-green-700 hover:bg-green-100 border-green-200 disabled:opacity-50 flex items-center gap-2"
          title="Share invoice PDF file & portal login link via WhatsApp"
        >
          {isUploading === 'wa' ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />} WhatsApp
        </button>

        {!isPaidStatus && balanceDue > 0 && (
          <button 
            onClick={sendPaymentReminderViaWhatsApp} 
            disabled={isUploading !== null} 
            className="btn-secondary px-6 bg-amber-50 text-amber-800 hover:bg-amber-100 border-amber-200 disabled:opacity-50 flex items-center gap-2"
            title="Send official WhatsApp payment reminder to patient"
          >
            {isUploading === 'reminder' ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />} Send Payment Reminder
          </button>
        )}

        <button 
          onClick={handleOpenEmailDialog} 
          disabled={isUploading !== null} 
          className="btn-secondary px-6 disabled:opacity-50 flex items-center gap-2"
          title="Email invoice with attached PDF file & portal login link"
        >
          {isUploading === 'email' ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />} Email
        </button>

        <button onClick={downloadPDF} className="btn-outline px-6 flex items-center gap-2">
          <Download size={16} /> Download PDF
        </button>

        <button onClick={() => window.print()} className="btn-primary px-8 flex items-center gap-2">
          <Printer size={16} /> Print Document
        </button>
      </div>

      {/* Email Sharing Modal */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-primary">
                  <Mail size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Send Invoice via Email</h3>
                  <p className="text-[11px] text-slate-500">Official PDF attached + Account login link</p>
                </div>
              </div>
              <button 
                onClick={() => setEmailModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Recipient Email Address *
                </label>
                <input
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="e.g. patient@example.com"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium"
                />
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-1.5 text-[11px] text-slate-600">
                <div className="flex items-center gap-2 text-slate-800 font-semibold">
                  <Check size={13} className="text-emerald-600" />
                  <span>What will be sent:</span>
                </div>
                <div className="pl-5 space-y-1">
                  <p>📎 <strong>Official PDF Invoice:</strong> Attached directly to email</p>
                  <p>🔐 <strong>Patient Portal Login:</strong> https://viitsa.com/login</p>
                  <p>📄 <strong>Online View Link:</strong> High-resolution cloud invoice link</p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEmailModalOpen(false)}
                disabled={isUploading === 'email'}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendInvoiceEmail}
                disabled={isUploading === 'email' || !targetEmail.trim()}
                className="btn-primary px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition"
              >
                {isUploading === 'email' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {isUploading === 'email' ? 'Sending Email with PDF...' : 'Send Email with PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
