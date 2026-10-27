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
  const rawDate = subscription.created_at || subscription.date;
  const parsedDate = parseDateArg(rawDate);
  const invoiceDate = !isNaN(parsedDate.getTime()) ? parsedDate : new Date();
  const invoiceDateDisplay = formatDate(rawDate || invoiceDate);
  const idStr = subscription.id || 'UNKNOWN';
  const amountStr = "2,999.00";

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
    <div className="flex flex-col items-center overflow-auto w-full relative h-full">
      
      {/* Top sticky bar with close/actions */}
      <div className="sticky top-0 left-0 w-full bg-white/90 backdrop-blur-sm border-b border-gray-200 p-4 flex items-center justify-between z-50 print:hidden">
        <button onClick={onClose} className="btn-secondary px-4 py-2 flex items-center gap-2">
          <ArrowLeft size={16} /> Back to Settings
        </button>
        <div className="flex items-center gap-3">
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
          <button onClick={downloadPDF} disabled={isDownloading !== null} className="btn-primary px-6 bg-[#05C994] hover:bg-[#04b081] text-white border-transparent disabled:opacity-50 flex items-center gap-2">
            {isDownloading === 'download' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} 
            Download
          </button>
        </div>
      </div>

      <div 
        id="sub-print-area" 
        className="invoice-page bg-white text-ink font-sans relative mt-8 print:mt-0 shadow-xl print:shadow-none"
        style={{ width: '210mm', minHeight: '297mm', padding: '0' }}
      >
        <div className="bg-[url('https://www.transparenttextures.com/patterns/clean-gray-paper.png')] absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-multiply"></div>
        <div className="relative z-10 p-0 m-0 w-full h-full">

          {/* Top Accent Bar */}
          <div className="h-4 w-full bg-gradient-to-r from-[#05C994] via-[#04b081] to-teal-800"></div>

          {/* Header Section */}
          <div className="px-12 pt-12 pb-8 flex justify-between items-start">
            <div className="flex flex-col">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-14 h-14 bg-gradient-to-br from-[#05C994] to-teal-700 rounded-xl flex items-center justify-center shadow-lg shadow-[#05C994]/20 text-white font-black text-2xl tracking-tighter">
                  V
                </div>
                <div className="flex flex-col">
                  <h1 className="text-3xl font-black text-ink tracking-tight uppercase" style={{ color: '#05C994' }}>VIITSA</h1>
                  <p className="text-sm font-semibold tracking-widest text-ink-muted uppercase -mt-1">Clinic Pro</p>
                </div>
              </div>
            </div>
            
            <div className="text-right flex flex-col items-end">
              <h2 className="text-4xl font-black text-ink/10 tracking-widest uppercase mb-4">Invoice</h2>
              <div className="bg-slate-50 px-5 py-3 rounded-xl border border-slate-100 flex flex-col gap-1 text-right min-w-[200px]">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-ink-muted font-medium">Invoice No</span>
                  <span className="font-bold text-ink">#{idStr.substring(0, 8).toUpperCase()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-ink-muted font-medium">Date</span>
                  <span className="font-bold text-ink">{invoiceDateDisplay}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-ink-muted font-medium">Status</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full text-xs">
                    <CheckCircle2 size={12} /> PAID
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Billed To */}
          <div className="px-12 pb-10 flex gap-12">
            <div className="flex-1">
              <div className="inline-block bg-slate-900 text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-4">Billed To</div>
              <h3 className="text-xl font-bold text-ink mb-1">{clinic?.name || 'Clinic Name'}</h3>
              <p className="text-ink-muted text-sm">{clinic?.address || 'Clinic Address'}</p>
              <div className="mt-3 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-sm text-ink-muted">
                  <Phone size={14} className="text-[#05C994]" /> 
                  <span className="font-medium text-ink">{clinic?.phone || 'Phone'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-ink-muted">
                  <Mail size={14} className="text-[#05C994]" /> 
                  <span className="font-medium text-ink">{clinic?.email || 'Email'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="px-12 pb-12">
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="py-4 px-6 text-xs font-bold text-ink-muted uppercase tracking-wider">Description</th>
                    <th className="py-4 px-6 text-xs font-bold text-ink-muted uppercase tracking-wider text-right w-32">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  <tr className="hover:bg-slate-50/50">
                    <td className="py-4 px-6 text-sm text-ink">
                      <div className="font-bold text-base mb-1">Viitsa Clinic Pro Subscription</div>
                      <div className="text-ink-muted">Monthly access to all premium clinic management tools and AI features.</div>
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-ink whitespace-nowrap">Rs. {amountStr}</td>
                  </tr>
                </tbody>
              </table>
              
              <div className="bg-slate-50/50 p-6 flex justify-between items-center border-t border-slate-200">
                <div className="text-ink-muted text-sm flex items-center gap-1">
                  <ShieldCheck size={16} className="text-[#05C994]" />
                  Secure Payment Processed
                </div>
                <div className="flex items-center gap-8">
                  <span className="text-lg font-medium text-ink-muted">Total Paid</span>
                  <span className="text-3xl font-black text-[#05C994] tracking-tight">Rs. {amountStr}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="absolute bottom-12 left-12 right-12 text-center border-t border-slate-200 pt-8">
            <p className="text-sm font-medium text-ink-muted mb-1">Thank you for choosing Viitsa to manage your practice.</p>
            <p className="text-xs text-ink-muted/70 flex items-center justify-center gap-1">
              <ShieldCheck size={12} /> This is a computer-generated invoice and does not require a physical signature.
            </p>
          </div>
        
        </div>
      </div>
    </div>
  );
}
