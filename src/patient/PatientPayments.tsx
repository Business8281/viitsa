import { useEffect, useState, useMemo } from 'react';
import { 
  ChevronLeft, Download, Share2, CheckCircle2, Clock, AlertCircle, 
  Building2, Receipt, CreditCard, ExternalLink, Eye, RefreshCw, 
  FileText, Check, Copy, Sparkles, ShieldCheck, ArrowRight, QrCode
} from 'lucide-react';
import { db } from '../lib/firebase';
import { 
  collection, onSnapshot, updateDoc, doc, getDoc, getDocs, query, where 
} from 'firebase/firestore';
import { formatDate, formatRs, parseDateArg } from '../lib/format';
import type { Invoice, Clinic } from '../lib/types';
import type { PatientTab } from './PatientBottomNav';
import { usePatientAuth } from '../lib/patientAuth';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { downloadInvoicePDF, sharePdfFileNative, generateInvoiceBlob } from '../lib/pdf';
import { Modal } from '../components/Modal';
import { InvoiceView } from '../components/InvoiceView';

interface Props { 
  patientId: string | null; 
  onTab: (t: PatientTab) => void; 
}

export function PatientPayments({ patientId, onTab }: Props) {
  const { account } = usePatientAuth();
  const { user } = useAuth();
  const { toast } = useToast();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending' | 'partial'>('all');
  
  // Pay Now modal state
  const [payingBill, setPayingBill] = useState<Invoice | null>(null);
  const [upiRef, setUpiRef] = useState('');
  const [markingPaid, setMarkingPaid] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // 1. Resolve all linked patient IDs
  const [linkedPatientIds, setLinkedPatientIds] = useState<string[]>([]);

  useEffect(() => {
    const rawPhone = account?.phone || user?.phone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);
    const ids = new Set<string>();
    if (patientId) ids.add(patientId);
    if (account?.account_id) ids.add(account.account_id);
    if (account?.id) ids.add(account.id);
    if (user?.uid) ids.add(user.uid);
    if (user?.user_id) ids.add(user.user_id);
    if (user?.patient_account_id) ids.add(user.patient_account_id);

    if (cleanPhone) {
      const qPat = query(collection(db, 'patients'), where('phone', '==', cleanPhone));
      getDocs(qPat)
        .then((snap) => {
          snap.forEach((d) => ids.add(d.id));
          setLinkedPatientIds(Array.from(ids));
        })
        .catch(() => {
          setLinkedPatientIds(Array.from(ids));
        });
    } else {
      setLinkedPatientIds(Array.from(ids));
    }
  }, [patientId, account, user]);

  // 2. Real-time live synchronization for invoices & billing
  useEffect(() => {
    if (linkedPatientIds.length === 0) {
      setLoading(false);
      return;
    }

    const cleanPhone = (account?.phone || user?.phone || '').replace(/\D/g, '').slice(-10);
    const rawInvoices = new Map<string, any>();
    const rawBilling = new Map<string, any>();
    const clinicCache = new Map<string, Clinic>();

    const matchesThisPatient = (data: any, docId: string) => {
      if (!data) return false;
      if (linkedPatientIds.includes(data.patient_id) || linkedPatientIds.includes(data.account_id)) return true;
      if (docId && linkedPatientIds.includes(docId)) return true;
      if (cleanPhone) {
        const pPhone = String(data.patient_phone || data.phone || '').replace(/\D/g, '').slice(-10);
        if (pPhone && pPhone === cleanPhone) return true;
      }
      return false;
    };

    const recompute = async () => {
      const processedKeys = new Set<string>();
      const combined: Invoice[] = [];

      // Process invoices
      for (const [id, inv] of rawInvoices.entries()) {
        const billId = inv.bill_id || id;
        processedKeys.add(id);
        if (inv.bill_id) processedKeys.add(inv.bill_id);

        const bill = rawBilling.get(billId) || rawBilling.get(id);

        let clinic = inv.clinic || bill?.clinic || null;
        const clinicId = inv.clinic_id || bill?.clinic_id;
        if (!clinic && clinicId) {
          if (!clinicCache.has(clinicId)) {
            try {
              const cSnap = await getDoc(doc(db, 'clinics', clinicId));
              if (cSnap.exists()) clinicCache.set(clinicId, { clinic_id: cSnap.id, ...cSnap.data() } as Clinic);
            } catch {}
          }
          clinic = clinicCache.get(clinicId) || null;
        }

        const totalAmount = Number(inv.total || inv.amount || bill?.amount || 0);
        const lineItems = (Array.isArray(inv.line_items) && inv.line_items.length > 0)
          ? inv.line_items
          : (Array.isArray(bill?.line_items) && bill.line_items.length > 0)
          ? bill.line_items
          : (inv.consultation_fee ? [{ description: 'Consultation Fee', amount: inv.consultation_fee }] : []);

        combined.push({
          id,
          invoice_id: inv.invoice_id || id,
          invoice_number: inv.invoice_number || bill?.invoice_number || `INV-${id.slice(0, 8).toUpperCase()}`,
          receipt_number: inv.receipt_number || bill?.receipt_number,
          bill_id: billId,
          clinic_id: clinicId,
          patient_id: inv.patient_id || bill?.patient_id,
          doctor_id: inv.doctor_id || bill?.doctor_id,
          subtotal: Number(inv.subtotal || totalAmount),
          discount_amount: Number(inv.discount_amount || bill?.discount_amount || 0),
          total: totalAmount,
          amount: totalAmount,
          payment_status: (inv.payment_status || bill?.payment_status || 'paid').toLowerCase(),
          payment_method: inv.payment_method || bill?.payment_method || 'cash',
          upi_ref: inv.upi_ref || bill?.upi_ref || null,
          line_items: lineItems,
          visit_date: inv.visit_date || bill?.visit_date || inv.created_at || bill?.created_at,
          payment_date: inv.payment_date || bill?.payment_date,
          notes: inv.notes || bill?.notes || null,
          created_at: inv.created_at || bill?.created_at || new Date().toISOString(),
          clinic,
        } as Invoice);
      }

      // Process standalone billing entries without an invoice
      for (const [id, bill] of rawBilling.entries()) {
        if (!processedKeys.has(id) && (!bill.invoice_id || !processedKeys.has(bill.invoice_id))) {
          processedKeys.add(id);

          let clinic = bill.clinic || null;
          const clinicId = bill.clinic_id;
          if (!clinic && clinicId) {
            if (!clinicCache.has(clinicId)) {
              try {
                const cSnap = await getDoc(doc(db, 'clinics', clinicId));
                if (cSnap.exists()) clinicCache.set(clinicId, { clinic_id: cSnap.id, ...cSnap.data() } as Clinic);
              } catch {}
            }
            clinic = clinicCache.get(clinicId) || null;
          }

          const totalAmount = Number(bill.amount || bill.total || 0);
          const lineItems = (Array.isArray(bill.line_items) && bill.line_items.length > 0)
            ? bill.line_items
            : (bill.consultation_fee ? [{ description: 'Consultation Fee', amount: bill.consultation_fee }] : []);

          combined.push({
            id,
            invoice_id: id,
            invoice_number: bill.invoice_number || `BILL-${id.slice(0, 8).toUpperCase()}`,
            bill_id: id,
            clinic_id: clinicId,
            patient_id: bill.patient_id,
            doctor_id: bill.doctor_id,
            subtotal: totalAmount,
            discount_amount: Number(bill.discount_amount || 0),
            total: totalAmount,
            amount: totalAmount,
            payment_status: (bill.payment_status || 'paid').toLowerCase(),
            payment_method: bill.payment_method || 'cash',
            upi_ref: bill.upi_ref || null,
            line_items: lineItems,
            visit_date: bill.created_at,
            payment_date: bill.payment_date,
            notes: bill.notes || null,
            created_at: bill.created_at || new Date().toISOString(),
            clinic,
          } as Invoice);
        }
      }

      // Sort newest first
      combined.sort((a, b) => {
        const ta = new Date(a.visit_date || a.created_at || 0).getTime();
        const tb = new Date(b.visit_date || b.created_at || 0).getTime();
        return tb - ta;
      });

      setInvoices(combined);
      setLoading(false);
    };

    const unsubInvoices = onSnapshot(collection(db, 'invoices'), (snap) => {
      snap.docs.forEach((d) => {
        const data = d.data();
        if (matchesThisPatient(data, d.id)) {
          rawInvoices.set(d.id, { ...data, id: d.id, invoice_id: d.id });
        }
      });
      void recompute();
    }, (err) => console.warn('Invoices onSnapshot warning:', err));

    const unsubBilling = onSnapshot(collection(db, 'billing'), (snap) => {
      snap.docs.forEach((d) => {
        const data = d.data();
        if (matchesThisPatient(data, d.id)) {
          rawBilling.set(d.id, { ...data, id: d.id, bill_id: d.id });
        }
      });
      void recompute();
    }, (err) => console.warn('Billing onSnapshot warning:', err));

    return () => {
      unsubInvoices();
      unsubBilling();
    };
  }, [linkedPatientIds, account, user]);

  // Direct PDF Download Handler
  const handleDownloadPDF = async (inv: Invoice, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const idKey = inv.invoice_id || inv.id || 'bill';
    try {
      setDownloadingId(idKey);
      toast('Preparing official invoice PDF...', 'info');
      await downloadInvoicePDF(inv, inv.clinic, account?.name || 'Patient');
      toast('Invoice PDF downloaded!', 'success');
    } catch (err) {
      console.error('PDF download error:', err);
      toast('Could not download PDF. Please try again.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  // WhatsApp Share Handler
  const handleShareWhatsApp = async (inv: Invoice, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const idStr = inv.invoice_number || inv.id || 'INV';
      const clinicName = (inv.clinic as Clinic | null)?.name || 'Clinic';
      const loginUrl = `${window.location.origin}/login`;
      const text = `*Payment Invoice — ${clinicName}*\n\n` +
        `👤 Patient: ${account?.name ?? 'Patient'}\n` +
        `🧾 Invoice No: ${idStr}\n` +
        `📅 Date: ${formatDate(inv.visit_date || inv.created_at)}\n` +
        `💰 Total Amount: ${formatRs(Number(inv.total || inv.amount))}\n` +
        `📌 Status: ${(inv.payment_status || 'Paid').toUpperCase()}\n\n` +
        `🔐 *Login to your Patient Portal Account:*\n${loginUrl}\n\n` +
        `— VIITSA Healthcare Platform`;

      try {
        const blob = await generateInvoiceBlob(inv, inv.clinic, account?.name || 'Patient');
        const shared = await sharePdfFileNative(blob, `Invoice_${idStr}.pdf`, `Invoice - ${idStr}`, text);
        if (shared) {
          toast('Invoice shared successfully!', 'success');
          return;
        }
      } catch {}

      const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank', 'noopener');
    } catch (err) {
      console.error('WhatsApp share error:', err);
    }
  };

  // Submit UPI Payment reference to notify clinic
  const handleMarkPaid = async () => {
    if (!payingBill || !upiRef.trim()) {
      toast('Please enter your 12-digit UPI reference ID / UTR.', 'error');
      return;
    }
    setMarkingPaid(true);
    try {
      const billId = payingBill.bill_id || payingBill.id;
      const invId = payingBill.invoice_id || payingBill.id;

      const updateData = {
        payment_status: 'partial',
        upi_ref: upiRef.trim(),
        payment_method: 'upi',
        notes: `Patient marked paid via UPI ref: ${upiRef.trim()} - verification pending from clinic.`,
      };

      if (invId) {
        try {
          await updateDoc(doc(db, 'invoices', invId), updateData);
        } catch {}
      }
      if (billId) {
        try {
          await updateDoc(doc(db, 'billing', billId), updateData);
        } catch {}
      }

      toast('Payment details submitted! Clinic staff will verify shortly.', 'success');
      setPayingBill(null);
      setUpiRef('');
      if (selectedInvoice) {
        setSelectedInvoice((prev) => prev ? { ...prev, payment_status: 'partial', upi_ref: upiRef.trim() } : null);
      }
    } catch (e) {
      console.error('Error submitting UPI reference:', e);
      toast('Failed to submit reference. Please contact clinic.', 'error');
    } finally {
      setMarkingPaid(false);
    }
  };

  // Aggregated Summary Statistics
  const summary = useMemo(() => {
    let totalPaid = 0;
    let totalPending = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let partialCount = 0;

    invoices.forEach((inv) => {
      const amt = Number(inv.total || inv.amount || 0);
      const st = String(inv.payment_status || 'paid').toLowerCase();
      if (st === 'paid') {
        totalPaid += amt;
        paidCount++;
      } else if (st === 'partial') {
        partialCount++;
      } else {
        totalPending += amt;
        pendingCount++;
      }
    });

    return {
      totalPaid,
      totalPending,
      totalCount: invoices.length,
      paidCount,
      pendingCount,
      partialCount,
    };
  }, [invoices]);

  // Filtered Bills List
  const filteredInvoices = useMemo(() => {
    if (filter === 'all') return invoices;
    return invoices.filter((inv) => {
      const st = String(inv.payment_status || '').toLowerCase();
      if (filter === 'paid') return st === 'paid';
      if (filter === 'pending') return st === 'pending';
      if (filter === 'partial') return st === 'partial';
      return true;
    });
  }, [invoices, filter]);

  return (
    <div className="min-h-screen bg-[#F5FAFA] pb-28">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-[#0F6E56] to-[#0A4B3A] text-white px-5 pt-12 pb-6 shadow-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onTab('home')} 
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
              aria-label="Back to home"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
                Payments & Invoices
                <span className="flex items-center gap-1 text-[10px] bg-emerald-400/20 text-emerald-200 border border-emerald-300/30 font-semibold px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                  Live
                </span>
              </h1>
              <p className="text-xs text-white/70">All clinic bills, receipts & official PDF statements</p>
            </div>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-3 gap-2.5 mt-2">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
            <p className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">Total Bills</p>
            <p className="text-lg font-black text-white mt-0.5">{summary.totalCount}</p>
          </div>
          <div className="bg-emerald-500/20 backdrop-blur-md rounded-xl p-3 border border-emerald-400/20">
            <p className="text-[10px] text-emerald-200 font-semibold uppercase tracking-wider">Total Paid</p>
            <p className="text-lg font-black text-emerald-100 mt-0.5">{formatRs(summary.totalPaid)}</p>
          </div>
          <div className={`backdrop-blur-md rounded-xl p-3 border ${summary.totalPending > 0 ? 'bg-amber-500/25 border-amber-300/30' : 'bg-white/10 border-white/10'}`}>
            <p className="text-[10px] text-amber-200 font-semibold uppercase tracking-wider">Pending Due</p>
            <p className={`text-lg font-black mt-0.5 ${summary.totalPending > 0 ? 'text-amber-100' : 'text-white/60'}`}>
              {formatRs(summary.totalPending)}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-4 py-4 max-w-3xl mx-auto space-y-4">
        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs font-semibold">
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl border transition ${
              filter === 'all'
                ? 'bg-[#0F6E56] text-white border-[#0F6E56] shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            All Bills ({summary.totalCount})
          </button>
          <button
            onClick={() => setFilter('paid')}
            className={`px-3.5 py-1.5 rounded-xl border transition ${
              filter === 'paid'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Paid ({summary.paidCount})
          </button>
          {summary.pendingCount > 0 && (
            <button
              onClick={() => setFilter('pending')}
              className={`px-3.5 py-1.5 rounded-xl border transition ${
                filter === 'pending'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                  : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
              }`}
            >
              Pending ({summary.pendingCount})
            </button>
          )}
          {summary.partialCount > 0 && (
            <button
              onClick={() => setFilter('partial')}
              className={`px-3.5 py-1.5 rounded-xl border transition ${
                filter === 'partial'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
              }`}
            >
              Verification ({summary.partialCount})
            </button>
          )}
        </div>

        {/* Live Bills Stream */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
            <RefreshCw size={28} className="text-[#0F6E56] animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-800">Synchronizing your live invoices...</p>
            <p className="text-xs text-gray-500 mt-1">Connecting to clinic database</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
            <div className="w-14 h-14 bg-emerald-50 text-[#0F6E56] rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Receipt size={28} />
            </div>
            <h3 className="text-base font-bold text-gray-900">No {filter !== 'all' ? filter : ''} bills found</h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto mt-1">
              {filter === 'all'
                ? 'Your completed and pending consultation bills from clinics will appear here automatically.'
                : `There are currently no bills matching "${filter}".`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredInvoices.map((inv) => {
              const clinic = inv.clinic as Clinic | null;
              const isPaid = inv.payment_status === 'paid';
              const isPartial = inv.payment_status === 'partial';
              const isPending = !isPaid && !isPartial;
              const totalAmt = Number(inv.total || inv.amount || 0);
              const isDownloadingThis = downloadingId === (inv.invoice_id || inv.id);

              return (
                <div
                  key={inv.invoice_id || inv.id}
                  onClick={() => setSelectedInvoice(inv)}
                  className={`bg-white rounded-2xl border p-4 transition shadow-sm hover:shadow-md cursor-pointer relative overflow-hidden ${
                    isPending
                      ? 'border-l-4 border-l-amber-500 border-t-amber-100/50 border-r-amber-100/50 border-b-amber-100/50 bg-amber-50/10'
                      : isPartial
                      ? 'border-l-4 border-l-blue-500 border-t-blue-100/50 border-r-blue-100/50 border-b-blue-100/50 bg-blue-50/10'
                      : 'border-l-4 border-l-emerald-500 border-gray-100'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isPaid ? 'bg-emerald-50 text-emerald-700' : isPartial ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {isPaid ? <CheckCircle2 size={20} /> : isPartial ? <Clock size={20} /> : <AlertCircle size={20} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-gray-900 truncate">
                            {clinic?.name || 'Medical Clinic'}
                          </p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800'
                              : isPartial
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800 animate-pulse'
                          }`}>
                            {isPartial ? 'Verification Pending' : inv.payment_status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatDate(inv.visit_date || inv.created_at)} · #{inv.invoice_number}
                        </p>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right shrink-0">
                      <p className="text-base font-black text-gray-900">{formatRs(totalAmt)}</p>
                      <span className="text-[10px] uppercase font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                        {inv.payment_method || 'CASH'}
                      </span>
                    </div>
                  </div>

                  {/* Line Items Preview */}
                  {Array.isArray(inv.line_items) && inv.line_items.length > 0 && (
                    <div className="bg-gray-50/70 rounded-xl p-2.5 mb-3 border border-gray-100 text-xs text-gray-700 space-y-1">
                      {inv.line_items.slice(0, 2).map((item, i) => (
                        <div key={i} className="flex justify-between items-center text-[11px]">
                          <span className="truncate pr-2">• {item.description}</span>
                          <span className="font-semibold text-gray-900 shrink-0">{formatRs(Number(item.amount))}</span>
                        </div>
                      ))}
                      {inv.line_items.length > 2 && (
                        <p className="text-[10px] text-gray-500 font-medium">
                          + {inv.line_items.length - 2} more item{inv.line_items.length - 2 > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Verification Pending Notice Banner */}
                  {isPartial && inv.upi_ref && (
                    <div className="mb-3 bg-blue-50 rounded-xl p-2.5 text-xs text-blue-800 flex items-center justify-between border border-blue-100">
                      <div className="flex items-center gap-1.5">
                        <Clock size={13} className="text-blue-600 shrink-0" />
                        <span>UPI Ref: <strong>{inv.upi_ref}</strong> (Awaiting Clinic Confirmation)</span>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons Row */}
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100/80">
                    <button
                      onClick={(e) => handleDownloadPDF(inv, e)}
                      disabled={isDownloadingThis}
                      className="flex-1 py-2 px-3 rounded-xl border border-gray-200 hover:border-[#0F6E56] hover:bg-[#0F6E56]/5 text-gray-700 hover:text-[#0F6E56] text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                    >
                      {isDownloadingThis ? (
                        <RefreshCw size={14} className="animate-spin text-[#0F6E56]" />
                      ) : (
                        <Download size={14} className="text-[#0F6E56]" />
                      )}
                      <span>Download PDF</span>
                    </button>

                    <button
                      onClick={(e) => handleShareWhatsApp(inv, e)}
                      className="py-2 px-3 rounded-xl border border-emerald-200 hover:bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
                      title="Share via WhatsApp"
                    >
                      <Share2 size={14} />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </button>

                    {isPending ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPayingBill(inv);
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition active:scale-95"
                      >
                        <CreditCard size={14} />
                        <span>Pay Now</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="py-2 px-3 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-800 text-xs font-bold flex items-center justify-center gap-1 transition"
                      >
                        <Eye size={14} />
                        <span>Details</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Official Invoice Modal — Exact Same Design as Clinic Billing */}
      {selectedInvoice && (
        <Modal
          open={Boolean(selectedInvoice)}
          onClose={() => setSelectedInvoice(null)}
          title="Invoice"
          size="xl"
        >
          <InvoiceView
            invoice={selectedInvoice}
            clinic={(selectedInvoice.clinic as Clinic | null) || (account?.clinic_id ? { clinic_id: account.clinic_id, name: account.clinic_name || 'Clinic' } as any : null)}
            patient={account as any}
            onClose={() => setSelectedInvoice(null)}
          />
        </Modal>
      )}

      {/* 4. Pay Now UPI Modal */}
      {payingBill && (
        <Modal
          open={Boolean(payingBill)}
          onClose={() => setPayingBill(null)}
          title="Complete UPI Payment"
          subtitle={`Amount: ${formatRs(Number(payingBill.total || payingBill.amount || 0))} to ${(payingBill.clinic as Clinic | null)?.name || 'Clinic'}`}
          size="md"
        >
          <div className="space-y-4">
            {/* Amount Callout */}
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-800 font-bold uppercase">Total Due Amount</p>
                <p className="text-2xl font-black text-[#0F6E56]">
                  {formatRs(Number(payingBill.total || payingBill.amount || 0))}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#0F6E56] text-white flex items-center justify-center">
                <Receipt size={20} />
              </div>
            </div>

            {/* UPI ID Details */}
            {(() => {
              const c = payingBill.clinic as (Clinic & { upi_id?: string }) | null;
              const upiId = c?.upi_id || 'viitsa.healthcare@upi';
              const upiDeepLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(c?.name || 'Clinic')}&am=${Number(payingBill.total || payingBill.amount || 0)}&cu=INR&tn=${encodeURIComponent('Bill ' + payingBill.invoice_number)}`;

              return (
                <div className="space-y-3">
                  <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-[11px] font-bold text-gray-500 uppercase mb-1">Clinic UPI ID</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-sm text-gray-900 select-all">{upiId}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(upiId);
                          setCopiedUpi(true);
                          setTimeout(() => setCopiedUpi(false), 2000);
                          toast('UPI ID copied to clipboard!', 'success');
                        }}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-white text-xs font-semibold flex items-center gap-1 text-gray-700 transition"
                      >
                        {copiedUpi ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <a
                    href={upiDeepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#0F6E56] to-[#0A4B3A] text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm transition active:scale-95"
                  >
                    <ExternalLink size={15} />
                    <span>Open in Google Pay / PhonePe / Paytm</span>
                  </a>
                </div>
              );
            })()}

            {/* UTR / Transaction Reference Input */}
            <div className="pt-2 border-t border-gray-100">
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Enter 12-digit UPI Reference Number / UTR *
              </label>
              <input
                type="text"
                value={upiRef}
                onChange={(e) => setUpiRef(e.target.value)}
                placeholder="e.g. 428198765432"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm focus:outline-none focus:border-[#0F6E56] font-mono tracking-wide"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Found on your UPI payment confirmation screen after payment.
              </p>
            </div>

            <button
              onClick={handleMarkPaid}
              disabled={markingPaid || !upiRef.trim()}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black flex items-center justify-center gap-2 shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              {markingPaid ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Submitting to Clinic...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Confirm Payment & Notify Clinic</span>
                </>
              )}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
