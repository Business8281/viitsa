import { useEffect, useState } from 'react';
import { ChevronLeft, Download, Share2, CheckCircle, Clock } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore';
import { formatDate, formatRs } from '../lib/format';
import type { Invoice, Clinic } from '../lib/types';
import type { PatientTab } from './PatientBottomNav';

interface Props { patientId: string | null; onTab: (t: PatientTab) => void; }

export function PatientPayments({ patientId, onTab }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selected, setSelected] = useState<Invoice | null>(null);

  const fetchInvoices = async () => {
    if (!patientId) return;
    const q = query(collection(db, 'invoices'), where('patient_id', '==', patientId), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    const invs = snap.docs.map(d => d.data() as Invoice);
    // Fetch clinic details for each invoice
    for (const inv of invs) {
      if (inv.clinic_id) {
        const cSnap = await getDoc(doc(db, 'clinics', inv.clinic_id));
        if (cSnap.exists()) {
          inv.clinic = cSnap.data() as Clinic;
        }
      }
    }
    setInvoices(invs);
  };

  useEffect(() => {
    fetchInvoices();
  }, [patientId]);

  if (selected) {
    return <InvoiceDetail invoice={selected} onBack={() => setSelected(null)} onRefresh={() => {
      fetchInvoices().then(() => setSelected(null));
    }} />;
  }

  return (
    <div className="min-h-screen bg-[#F5FAFA] pb-24">
      <div className="bg-primary px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={() => onTab('home')} className="p-2 rounded-xl bg-white/10 text-white"><ChevronLeft size={18} /></button>
        <p className="text-sm font-bold text-white">Payments & Invoices</p>
      </div>

      <div className="px-4 py-4 space-y-3">
        {invoices.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center mt-6">
            <Download size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No invoices yet.</p>
          </div>
        ) : invoices.map(inv => (
          <button key={inv.invoice_id} onClick={() => setSelected(inv)}
            className={`w-full bg-white rounded-2xl border p-4 flex items-center gap-3 text-left shadow-sm ${
              inv.payment_status === 'pending' ? 'border-l-4 border-l-yellow-400 border-t-gray-100 border-r-gray-100 border-b-gray-100' : 'border-gray-100'
            }`}>
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
              inv.payment_status === 'paid' ? 'bg-[#E1F5EE]' : 'bg-yellow-50'
            }`}>
              {inv.payment_status === 'paid'
                ? <CheckCircle size={18} className="text-primary" />
                : <Clock size={18} className="text-yellow-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{(inv.clinic as Clinic | null)?.name ?? 'Clinic'}</p>
              <p className="text-xs text-gray-500">{formatDate(inv.created_at)} · {inv.invoice_number}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-gray-900">{formatRs(Number(inv.total))}</p>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                inv.payment_status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
              }`}>{inv.payment_status}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function InvoiceDetail({ invoice, onBack, onRefresh }: { invoice: Invoice; onBack: () => void; onRefresh: () => void }) {
  const clinic = invoice.clinic as Clinic | null;
  const [upiRef, setUpiRef] = useState('');
  const [marking, setMarking] = useState(false);

  const markPaid = async () => {
    if (!upiRef.trim()) return;
    setMarking(true);
    // Update invoice status to 'partial' (pending verification)
    await updateDoc(doc(db, 'invoices', invoice.invoice_id), { payment_status: 'partial', upi_ref: upiRef, notes: 'Patient marked as paid via UPI - pending clinic verification' });
    await updateDoc(doc(db, 'billing', invoice.bill_id), { payment_status: 'partial', upi_ref: upiRef, notes: 'Patient marked as paid via UPI - pending clinic verification' });
    setMarking(false);
    onRefresh();
  };

  const shareWhatsApp = () => {
    const msg = `Dear patient, your invoice ${invoice.invoice_number} of ${formatRs(Number(invoice.total))} from ${clinic?.name ?? 'clinic'} on ${formatDate(invoice.created_at ?? '')}. Status: ${invoice.payment_status.toUpperCase()} — VIITSA`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };

  return (
    <div className="min-h-screen bg-[#F5FAFA] pb-24">
      <div className="bg-primary px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl bg-white/10 text-white"><ChevronLeft size={18} /></button>
        <p className="text-sm font-bold text-white">{invoice.invoice_number}</p>
      </div>

      {/* Invoice card */}
      <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm" id="print-area">
        {/* Header */}
        <div className="bg-primary px-5 py-4">
          <p className="text-lg font-bold text-white">{clinic?.name ?? 'Clinic'}</p>
          <p className="text-xs text-white/70 mt-0.5">{clinic?.address}</p>
          <p className="text-xs text-white/70">{clinic?.phone} · {clinic?.email}</p>
        </div>
        {/* Meta */}
        <div className="grid grid-cols-2 gap-3 px-5 py-4 border-b border-gray-50 text-xs">
          <div><p className="text-gray-400">Invoice no.</p><p className="font-semibold text-gray-800">{invoice.invoice_number}</p></div>
          <div><p className="text-gray-400">Visit date</p><p className="font-semibold text-gray-800">{invoice.visit_date ? formatDate(invoice.visit_date) : '—'}</p></div>
          <div><p className="text-gray-400">Payment method</p><p className="font-semibold text-gray-800 capitalize">{invoice.payment_method}</p></div>
          <div><p className="text-gray-400">Status</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${invoice.payment_status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
              {invoice.payment_status}
            </span>
          </div>
        </div>
        {/* Line items */}
        <div className="px-5 py-4 border-b border-gray-50">
          <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Bill details</p>
          <div className="space-y-2">
            {(invoice.line_items ?? []).map((li, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{li.description}</span>
                <span className="font-semibold text-gray-900">{formatRs(Number(li.amount))}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 mt-3 pt-3 space-y-1">
            {Number(invoice.discount_amount) > 0 && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>Discount</span><span>-{formatRs(Number(invoice.discount_amount))}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base text-gray-900">
              <span>Total</span><span>{formatRs(Number(invoice.total))}</span>
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="px-5 py-3 text-center">
          <p className="text-xs text-gray-400">Thank you for visiting {clinic?.name}.</p>
          <p className="text-[10px] text-gray-300 mt-1">Powered by VIITSA</p>
        </div>
      </div>

      {/* Pay now (pending) */}
      {invoice.payment_status === 'pending' && (
        <div className="mx-4 mt-4 bg-yellow-50 rounded-2xl border border-yellow-100 p-4 space-y-3">
          <p className="text-sm font-bold text-yellow-800">Pay now</p>
          {clinic && (
            <p className="text-xs text-yellow-700">UPI: <strong>{(clinic as Clinic & { upi_id?: string }).upi_id ?? 'Ask clinic'}</strong></p>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">UPI transaction reference</label>
            <input value={upiRef} onChange={e => setUpiRef(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-primary"
              placeholder="e.g. 12345678901" />
          </div>
          <button onClick={markPaid} disabled={marking || !upiRef.trim()}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: '#0F6E56' }}>
            {marking ? 'Submitting…' : 'Mark as paid — notify clinic'}
          </button>
          <p className="text-xs text-yellow-600 text-center">
            Clinic staff will verify your payment shortly.
          </p>
        </div>
      )}

      {/* Pending verification */}
      {invoice.payment_status === 'partial' && (
        <div className="mx-4 mt-4 bg-blue-50 rounded-2xl border border-blue-100 p-4 space-y-2">
          <p className="text-sm font-bold text-blue-800">Payment verification pending</p>
          <p className="text-xs text-blue-700">
            Your payment with UPI ref <strong>{invoice.upi_ref || upiRef}</strong> is being verified by the clinic.
          </p>
          <p className="text-xs text-blue-600">
            You will be notified once the clinic confirms your payment.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="mx-4 mt-3 space-y-2">
        <button onClick={shareWhatsApp}
          className="w-full rounded-xl py-3 text-sm font-semibold bg-green-500 text-white flex items-center justify-center gap-2">
          <Share2 size={14} /> Share on WhatsApp
        </button>
        <button onClick={() => window.print()}
          className="w-full rounded-xl py-3 text-sm font-semibold border border-gray-200 text-gray-700 flex items-center justify-center gap-2">
          <Download size={14} /> Download / Print
        </button>
      </div>
    </div>
  );
}
