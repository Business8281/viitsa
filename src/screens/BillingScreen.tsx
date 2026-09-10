import { useEffect, useMemo, useState } from 'react';
import { DollarSign, Search, FileText, CheckCircle, Download, FileSpreadsheet, Plus, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, orderBy } from 'firebase/firestore';
import { useAuth } from '../lib/auth';
import { useClinicData } from '../lib/useClinicData';
import { useToast } from '../lib/toast';
import { Modal } from '../components/Modal';
import { InvoicePrintView } from '../components/InvoicePrintView';
import { EmptyState, Loading } from '../components/ui';
import { formatDate, formatTime, statusBadgeClass, todayISO } from '../lib/format';
import type { Bill, Invoice, Patient, User as U } from '../lib/types';
import { processPayment } from '../lib/paymentService';

const formatRs = (amt: number) => `₹${amt.toFixed(2)}`;

type FilterKey = 'all' | 'paid' | 'pending' | 'today' | 'week';

export function BillingScreen() {
  const { clinic, user } = useAuth();
  const { bills, patients, loading, refresh } = useClinicData();
  const { toast } = useToast();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [queryInput, setQueryInput] = useState('');
  const [open, setOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [invoicesMap, setInvoicesMap] = useState<Record<string, Invoice>>({});

  // Load invoices for all bills
  useEffect(() => {
    if (!clinic) return;
    const fetchInvoices = async () => {
      const q = query(
        collection(db, 'invoices'),
        where('clinic_id', '==', clinic.clinic_id)
      );
      try {
        const snap = await getDocs(q);
        const m: Record<string, Invoice> = {};
        snap.docs.forEach(d => {
          const inv = { ...d.data(), invoice_id: d.id } as Invoice;
          if (inv.bill_id) { // In original we matched on bill_id or appointment_id
            m[inv.bill_id] = inv;
          } else if (inv.appointment_id) {
            // map by appointment id as fallback if bill_id isn't directly on invoice
             m[inv.appointment_id] = inv;
          }
        });
        setInvoicesMap(m);
      } catch (e) {
        console.error("Error fetching invoices", e);
      }
    };
    fetchInvoices();
  }, [clinic, bills]);

  const todayStr = new Date().toDateString();
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);

  const todayBills = useMemo(() => bills.filter(b => new Date(b.created_at).toDateString() === todayStr), [bills, todayStr]);
  const summary = useMemo(() => {
    const collected = todayBills.filter(b => b.payment_status === 'paid').reduce((s, b) => s + Number(b.amount), 0);
    const pending = todayBills.filter(b => b.payment_status !== 'paid').reduce((s, b) => s + Number(b.amount), 0);
    return { collected, pending, transactions: todayBills.length };
  }, [todayBills]);

  const allPendingAmt = useMemo(() =>
    bills.filter(b => b.payment_status !== 'paid').reduce((s, b) => s + Number(b.amount), 0)
  , [bills]);

  const filtered = useMemo(() => {
    let list = bills;
    if (filter === 'paid') list = list.filter(b => b.payment_status === 'paid');
    else if (filter === 'pending') list = list.filter(b => b.payment_status !== 'paid');
    else if (filter === 'today') list = list.filter(b => new Date(b.created_at).toDateString() === todayStr);
    else if (filter === 'week') list = list.filter(b => new Date(b.created_at) >= weekAgo);
    if (queryInput) {
      const q = queryInput.toLowerCase();
      // map patient name locally
      list = list.filter(b => {
        const p = patients.find(pat => pat.patient_id === b.patient_id);
        return p?.name?.toLowerCase().includes(q);
      });
    }
    return list;
  }, [bills, filter, queryInput, todayStr, weekAgo, patients]);

  const markPaid = async (bill: Bill) => {
    try {
      await updateDoc(doc(db, 'billing', bill.bill_id!), { payment_status: 'paid' });
      toast('Bill marked paid.', 'success');
      void refresh();
    } catch(e) {
      toast('Unable to update payment status. Please try again.', 'error');
    }
  };

  const sendReminder = (bill: Bill) => {
    const p = patients.find(pat => pat.patient_id === bill.patient_id);
    if (!p?.phone || !clinic) return toast('No phone on file.', 'warning');
    const msg = `Dear ${p.name},\n\nThis is a gentle reminder from ${clinic.name}.\nYour outstanding balance for your visit on ${formatDate(bill.created_at)} is ${formatRs(Number(bill.amount))}.\n\nYou can pay via UPI to: ${(clinic as { upi_id?: string }).upi_id ?? 'our clinic'}\nPlease mention your name as reference.\n\nFor queries call: ${clinic.phone}\n\nThank you,\n${clinic.name} — Powered by VIITSA`;
    const clean = p.phone.replace(/\D/g,'');
    const intl = clean.length === 10 ? '91' + clean : clean;
    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };

  const exportCSV = () => {
    const toCSV = (data: any[]) => {
      if (!data.length) return '';
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(obj => Object.values(obj).map(v => `"${v}"`).join(',')).join('\n');
      return `${headers}\n${rows}`;
    };
    const csv = toCSV(filtered.map(b => ({
      patient: patients.find(p => p.patient_id === b.patient_id)?.name ?? 'Unknown',
      amount: Number(b.amount),
      status: b.payment_status,
      method: b.payment_method,
      date: new Date(b.created_at).toISOString().split('T')[0],
    })));
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <Loading label="Loading billing data…" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink">Billing & Payments</h1>
          <p className="text-sm text-ink-muted">Manage invoices and track revenue</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-outline"><FileSpreadsheet size={16} /> Export</button>
          <button onClick={() => setOpen(true)} className="btn-primary"><Plus size={16} /> New bill</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card bg-primary text-white border-none">
          <p className="text-white/80 text-sm mb-1 font-medium">Today's Collections</p>
          <p className="text-2xl font-bold">{formatRs(summary.collected)}</p>
          <p className="text-xs text-white/70 mt-2">{summary.transactions} transactions</p>
        </div>
        <div className="card bg-accent text-white border-none">
          <p className="text-white/80 text-sm mb-1 font-medium">Total Pending (All Time)</p>
          <p className="text-2xl font-bold">{formatRs(allPendingAmt)}</p>
          <p className="text-xs text-white/70 mt-2 text-warning-100">Requires follow-up</p>
        </div>
        <div className="card">
          <p className="text-ink-muted text-sm mb-1 font-medium">Today's Pending</p>
          <p className="text-2xl font-bold text-ink">{formatRs(summary.pending)}</p>
          <p className="text-xs text-ink-subtle mt-2">Unpaid from today's visits</p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-1 bg-black/5 p-1 rounded-lg w-max">
            {(['all', 'today', 'week', 'paid', 'pending'] as FilterKey[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition ${filter === f ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <input value={queryInput} onChange={(e) => setQueryInput(e.target.value)} className="input pl-8 text-sm" placeholder="Search patient…" />
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-black/5 text-xs text-ink-subtle uppercase tracking-wider">
                <th className="p-3 font-medium">Patient</th>
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Amount</th>
                <th className="p-3 font-medium">Method</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-ink-muted text-sm">
                    No bills found.
                  </td>
                </tr>
              ) : (
                filtered.map(b => {
                  const patient = patients.find(p => p.patient_id === b.patient_id);
                  const inv = invoicesMap[b.appointment_id ?? b.bill_id!];
                  return (
                    <tr key={b.bill_id} className="hover:bg-black/[0.02] transition">
                      <td className="p-3">
                        <p className="text-sm font-medium text-ink">{patient?.name ?? 'Unknown'}</p>
                      </td>
                      <td className="p-3 text-sm text-ink-muted">{formatDate(b.created_at)}</td>
                      <td className="p-3 text-sm font-semibold text-ink">{formatRs(Number(b.amount))}</td>
                      <td className="p-3 text-sm text-ink-muted capitalize flex items-center gap-1.5">
                        <DollarSign size={14} className="text-ink-subtle" />
                        {b.payment_method}
                      </td>
                      <td className="p-3">
                        <span className={`badge ${statusBadgeClass(b.payment_status)} text-[10px] capitalize`}>{b.payment_status}</span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {b.payment_status !== 'paid' && (
                            <>
                              <button onClick={() => markPaid(b)} className="btn-ghost text-xs text-primary py-1 px-2" title="Mark as Paid"><CheckCircle size={14} /></button>
                              <button onClick={() => sendReminder(b)} className="btn-ghost text-xs text-ink-muted py-1 px-2" title="Send Reminder"><DollarSign size={14} /></button>
                            </>
                          )}
                          {inv && (
                            <button onClick={() => setViewInvoice({ ...inv, patient, clinic } as Invoice)} className="btn-ghost text-xs text-ink-muted py-1 px-2" title="View Invoice">
                              <FileText size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateBillModal open={open} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); void refresh(); }} clinicId={clinic?.clinic_id ?? ''} patients={patients} />

      {viewInvoice && (
        <Modal open onClose={() => setViewInvoice(null)} title="Invoice" size="md">
          <InvoicePrintView invoice={viewInvoice} />
        </Modal>
      )}
    </div>
  );
}

function CreateBillModal({ open, onClose, onSaved, clinicId, patients }: { open: boolean; onClose: () => void; onSaved: () => void; clinicId: string; patients: Patient[] }) {
  const { toast } = useToast();
  const [patientId, setPatientId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash'|'card'|'upi'>('upi');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [doctors, setDoctors] = useState<U[]>([]);

  useEffect(() => {
    if (!open) return;
    const q = query(collection(db, 'users'), where('clinic_id', '==', clinicId), where('role', '==', 'doctor'), where('active', '==', true));
    getDocs(q).then((snap) => {
      setDoctors(snap.docs.map(d => ({ ...d.data(), id: d.id } as U)));
    }).catch(console.error);
  }, [open, clinicId]);

  const submit = async () => {
    if (!patientId) return toast('Select a patient.', 'error');
    if (!amount || Number(amount) < 0) return toast('Enter a valid amount.', 'error');
    setSaving(true);
    const res = await processPayment({
      clinicId,
      patientId,
      apptId: null, // manual bill
      doctorId: doctors[0]?.id ?? null,
      consultationFee: Number(amount),
      lineItems: [],
      discountAmount: 0,
      discountPercent: 0,
      paymentMethod: method,
      notes: notes || undefined,
    });
    setSaving(false);
    if (!res.ok) return toast(res.error ?? 'Error', 'error');
    toast('Bill created.', 'success');
    setPatientId(''); setAmount(''); setNotes('');
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Manual Bill" size="sm" footer={<><button onClick={onClose} className="btn-ghost">Cancel</button><button onClick={submit} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Create'}</button></>}>
      <div className="space-y-4">
        <div>
          <label className="label">Patient *</label>
          <select className="select" value={patientId} onChange={e => setPatientId(e.target.value)}>
            <option value="">Select patient…</option>
            {patients.map(p => <option key={p.patient_id} value={p.patient_id}>{p.name} ({p.phone})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Amount (₹) *</label>
          <input type="number" min="0" className="input" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label">Payment method</label>
          <select className="select" value={method} onChange={e => setMethod(e.target.value as any)}>
            <option value="upi">UPI</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
          </select>
        </div>
        <div>
          <label className="label">Notes</label>
          <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. follow-up fee" />
        </div>
      </div>
    </Modal>
  );
}
