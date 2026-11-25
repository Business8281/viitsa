import { useState } from 'react';
import { Printer, Download, Phone, Mail, ShieldCheck, CheckCircle2, Loader2, ArrowLeft, Share2 } from 'lucide-react';
import { formatDate, parseDateArg } from '../lib/format';
import type { Clinic } from '../lib/types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Props {
  subscription: any;
  clinic: Clinic;
  onClose: () => void;
}

export function SubscriptionInvoiceView({ subscription, clinic, onClose }: Props) {
  const [isDownloading, setIsDownloading] = useState<'download' | 'whatsapp' | 'email' | null>(null);
  const rawDate = subscription?.created_at || subscription?.date;
  const parsedDate = parseDateArg(rawDate);
  const invoiceDate = !isNaN(parsedDate.getTime()) ? parsedDate : new Date();
  const invoiceDateDisplay = formatDate(rawDate || invoiceDate);
  const idStr = subscription?.id || subscription?.invoice_number || 'SUB-INV-001';

  // Dynamic plan details based on what the clinic actually chose
  const planCode = (subscription?.plan_code || subscription?.plan || subscription?.plan_id || clinic?.subscription_plan || 'clinic').toLowerCase();
  const planName = subscription?.plan_name || (
    planCode === 'solo' ? 'Solo Doctor Plan' :
    planCode === 'multispecialty' || planCode === 'multi_speciality' ? 'Multi-Speciality Clinic Plan' :
    planCode === 'hospital' ? 'Hospital Enterprise Plan' :
    'Small Clinic Plan'
  );
  const cycle = subscription?.billing_cycle || subscription?.cycle || clinic?.subscription_billing_cycle || 'monthly';
  const rawAmount = subscription?.amount != null ? Number(subscription.amount) : (
    subscription?.total != null ? Number(subscription.total) : (
      planCode === 'solo' ? (cycle === 'annual' ? 9999 : 999) :
      planCode === 'multispecialty' ? (cycle === 'annual' ? 39999 : 3999) :
      (cycle === 'annual' ? 19999 : 1999)
    )
  );
  const amountStr = rawAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const generateBlob = async (): Promise<Blob> => {
    const element = document.getElementById('sub-print-area');
    if (!element) throw new Error('Element not found');
    const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfWidth = doc.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    return doc.output('blob');
  };

  const downloadPDF = async () => {
    try {
      setIsDownloading('download');
      const blob = await generateBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Viitsa_Invoice_${idStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Failed to download PDF.');
    } finally {
      setIsDownloading(null);
    }
  };

  const shareViaWhatsApp = async () => {
    try {
      setIsDownloading('whatsapp');
      const blob = await generateBlob();
      const file = new File([blob], `Invoice_${idStr}.pdf`, { type: 'application/pdf' });
      const loginUrl = 'https://viitsa.com/clinic/login';
      const msg = `*Viitsa Pro Subscription Invoice*\nInvoice No: ${idStr}\n\n🔐 Login to your Clinic Account:\n${loginUrl}\n\n— VIITSA`;

      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Viitsa Pro Invoice`,
          text: msg,
          files: [file]
        });
      } else {
        downloadPDF();
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDownloading(null);
    }
  };

  const shareViaEmail = async () => {
    try {
      setIsDownloading('email');
      const blob = await generateBlob();
      const file = new File([blob], `Invoice_${idStr}.pdf`, { type: 'application/pdf' });
      const loginUrl = 'https://viitsa.com/clinic/login';
      const subject = `Viitsa Pro Subscription Invoice - ${idStr}`;
      const body = `Hello,\n\nPlease find your Viitsa Pro subscription invoice: ${idStr}.\n\n🔐 Login to your Clinic Account:\n${loginUrl}\n\n(The PDF file has been downloaded to your computer)\n\nThank you,\nVIITSA Team`;

      downloadPDF();
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: subject,
          text: body,
          files: [file]
        });
      } else {
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDownloading(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col items-start sm:items-center overflow-x-auto w-full relative h-full">
      
      {/* Top sticky bar with close/actions */}
      <div className="sticky top-0 left-0 w-full bg-white/95 backdrop-blur-sm border-b border-gray-200 p-3 sm:p-4 flex items-center justify-between gap-2 overflow-x-auto z-50 print:hidden">
        <button onClick={onClose} className="btn-secondary px-3 sm:px-4 py-2 flex items-center gap-1.5 sm:gap-2 shrink-0 text-xs sm:text-sm">
          <ArrowLeft size={16} /> Back to Settings
        </button>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button onClick={handlePrint} className="btn-secondary px-6">
            <Printer size={16} /> Print
          </button>
          <button onClick={shareViaWhatsApp} disabled={isDownloading !== null} className="btn-secondary text-[#25D366] hover:bg-[#25D366]/10 px-4 flex items-center gap-2">
            {isDownloading === 'whatsapp' ? <Loader2 size={16} className="animate-spin" /> : <Phone size={16} />}
            WhatsApp
          </button>
          <button onClick={shareViaEmail} disabled={isDownloading !== null} className="btn-secondary text-primary hover:bg-primary/10 px-4 flex items-center gap-2">
            {isDownloading === 'email' ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
            Email
          </button>
          <button onClick={downloadPDF} disabled={isDownloading !== null} className="btn-primary px-6 bg-[#059669] hover:bg-[#047857] text-white border-transparent disabled:opacity-50 flex items-center gap-2 shadow-sm">
            {isDownloading === 'download' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} 
            Download
          </button>
        </div>
      </div>

      <div 
        id="sub-print-area" 
        className="invoice-page bg-white text-ink font-sans relative mt-8 print:mt-0 shadow-xl print:shadow-none rounded-2xl border border-slate-100 overflow-hidden"
        style={{ width: '210mm', minHeight: '297mm', padding: '0' }}
      >
        <div className="relative z-10 p-0 m-0 w-full h-full">

          {/* Top Header Section */}
          <div className="px-10 pt-10 pb-6 flex justify-between items-start">
            <div className="flex flex-col">
              <h1 className="text-3xl font-black tracking-tight" style={{ color: '#059669' }}>VIITSA</h1>
              <p className="text-xs font-bold tracking-tight text-[#059669] mt-0.5">Clinic-paid Healthcare SaaS</p>
              <p className="text-[11px] italic text-slate-400 font-medium">Simplifying Care. Stronger Patients.</p>
            </div>
            
            <div className="text-right flex flex-col items-end">
              <div className="text-[9.5px] font-bold tracking-widest text-slate-500 uppercase leading-snug">
                <div>CONNECTED CLINICS</div>
                <div>HEALTHIER PATIENTS</div>
                <div>BRIGHTER TOMORROW</div>
              </div>
              <div className="h-0.5 w-12 bg-[#059669] mt-1.5 rounded-full"></div>
            </div>
          </div>

          {/* Title */}
          <div className="px-10 pb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Subscription Tax Invoice</h2>
            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase mt-0.5">OFFICIAL SAAS BILLING STATEMENT</p>
          </div>

          {/* Two Side-by-Side Profile & Metadata Cards */}
          <div className="px-10 pb-6 grid grid-cols-12 gap-5">
            {/* Left Card: Clinic Profile */}
            <div className="col-span-7 bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-[#059669] text-white flex items-center justify-center font-black text-xl shrink-0 shadow-md shadow-[#059669]/20">
                  {(clinic?.name || 'V').trim().charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 truncate">{clinic?.name || 'Clinic Partner'}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{clinic?.address || 'Registered Medical Practice Partner'}</p>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-3.5 mt-3 flex items-center gap-4 text-xs text-slate-600">
                <div className="flex items-center gap-1.5 truncate">
                  <Phone size={13} className="text-[#059669] shrink-0" />
                  <span className="truncate">{clinic?.phone || '—'}</span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                  <Mail size={13} className="text-[#059669] shrink-0" />
                  <span className="truncate">{clinic?.email || '—'}</span>
                </div>
              </div>
            </div>

            {/* Right Card: Metadata */}
            <div className="col-span-5 bg-slate-50/70 rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between">
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Invoice No.</span>
                  <span className="font-bold text-slate-900">#{idStr.substring(0, 14).toUpperCase()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Date</span>
                  <span className="font-bold text-slate-900">{invoiceDateDisplay}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Time</span>
                  <span className="text-slate-700 font-medium">{invoiceDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Receipt No.</span>
                  <span className="font-bold text-slate-900">RCP-{idStr.replace(/\D/g, '').slice(-4) || '8921'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Payment Mode</span>
                  <span className="font-bold text-slate-900">UPI / ONLINE</span>
                </div>
                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-slate-500 font-medium">Status</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[11px] flex items-center gap-1">
                    <CheckCircle2 size={11} /> PAID
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Subscription & Account Information Block */}
          <div className="px-10 pb-6">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <span className="text-[#059669]">👤</span> Subscription & Account Information
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  UHID: <span className="font-bold text-slate-700">UHID-{idStr.replace(/\D/g, '').slice(-6) || '2026-918'}</span>
                </div>
              </div>
              <div className="p-5 grid grid-cols-2 gap-x-8 gap-y-2.5 text-xs">
                <div className="flex items-center">
                  <span className="w-32 text-slate-500 font-medium">Clinic Name</span>
                  <span className="text-slate-900 font-bold">: {clinic?.name || 'Clinic Partner'}</span>
                </div>
                <div className="flex items-center">
                  <span className="w-32 text-slate-500 font-medium">Attending Doctor</span>
                  <span className="text-slate-900 font-bold">: Dr. {(clinic?.name || 'Admin').replace(/^(Dr\.?|Doctor)\s+/i, '')}</span>
                </div>
                <div className="flex items-center">
                  <span className="w-32 text-slate-500 font-medium">Attending Doctor</span>
                  <span className="text-slate-900 font-bold">: Dr. {(clinic?.name || 'Admin').replace(/^(Dr\.?|Doctor)\s+/i, '')}</span>
                </div>
                <div className="flex items-center">
                  <span className="w-32 text-slate-500 font-medium">Specialization</span>
                  <span className="text-slate-700 font-medium">: Internal Medicine & Healthcare</span>
                </div>
                <div className="flex items-center">
                  <span className="w-32 text-slate-500 font-medium">Contact Phone</span>
                  <span className="text-slate-700 font-medium">: {clinic?.phone || '—'}</span>
                </div>
                <div className="flex items-center">
                  <span className="w-32 text-slate-500 font-medium">Visit Category</span>
                  <span className="text-[#059669] font-bold">: {planName} ({cycle.toUpperCase()} Tier)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Table with Medical Emerald Header Banner */}
          <div className="px-10 pb-6">
            <div className="border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm">
              {/* Solid Medical Emerald Header */}
              <div className="bg-[#059669] px-6 py-3 flex justify-between items-center text-white">
                <span className="text-xs font-black tracking-wider uppercase">SERVICE & SUBSCRIPTION CHARGES</span>
                <span className="text-xs font-bold tracking-wide">Cur: INR (₹)</span>
              </div>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-6 w-12 text-center">#</th>
                    <th className="py-3 px-6 w-36">Category</th>
                    <th className="py-3 px-6">Item Description</th>
                    <th className="py-3 px-4 w-16 text-center">Qty</th>
                    <th className="py-3 px-6 w-28 text-right">Unit Price</th>
                    <th className="py-3 px-6 w-32 text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-xs">
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-4 px-6 text-center font-bold text-slate-400">1</td>
                    <td className="py-4 px-6 font-bold text-[#059669]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#059669]"></span>
                        Subscription
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-900">
                      <div className="font-bold text-sm text-slate-900">Viitsa Clinic — {planName}</div>
                      <div className="text-slate-500 text-[11px] mt-0.5 capitalize">{cycle} recurring clinic software access, AI patient triage, and unlimited doctor seats.</div>
                    </td>
                    <td className="py-4 px-4 text-center font-bold text-slate-700">1</td>
                    <td className="py-4 px-6 text-right font-medium text-slate-700">₹{amountStr}</td>
                    <td className="py-4 px-6 text-right font-black text-slate-900">₹{amountStr}</td>
                  </tr>
                </tbody>
              </table>
              
              {/* Summary Bottom Bar */}
              <div className="bg-slate-50/60 p-6 flex justify-between items-center border-t border-slate-200/90">
                <div className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                  <ShieldCheck size={16} className="text-[#059669]" />
                  Secure Payment Processed via Razorpay Subscriptions
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-[11px] text-slate-400 uppercase font-bold tracking-wider">Total Paid</div>
                    <div className="text-2xl font-black tracking-tight" style={{ color: '#059669' }}>₹{amountStr}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Terms & Notes */}
          <div className="px-10 pb-16">
            <div className="bg-slate-50/60 rounded-xl p-4 border border-slate-200/80 text-[11px] text-slate-500 leading-relaxed">
              <strong className="text-slate-700 block mb-1">TERMS & MANDATE INSTRUCTIONS:</strong>
              Payment received successfully. Your clinic operational quotas, AI triage, and doctor seats are live across all connected devices in real time. Auto-renews per {cycle} cycle.
            </div>
          </div>

          {/* Footer */}
          <div className="absolute bottom-8 left-10 right-10 text-center border-t border-slate-200 pt-6">
            <p className="text-xs font-semibold text-slate-700 mb-1">Thank you for choosing Viitsa to manage your practice.</p>
            <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
              <ShieldCheck size={12} className="text-[#059669]" /> Computer-generated official SaaS tax invoice • Does not require physical signature
            </p>
          </div>
        
        </div>
      </div>
    </div>
  );
}
