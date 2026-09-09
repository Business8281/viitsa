import { useEffect, useMemo, useState } from 'react';
import { Plus, Download, Wallet, TrendingUp, FileText, Search, Check, MessageCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useClinicData } from '../lib/useClinicData';
import { useToast } from '../lib/toast';
import { Modal } from '../components/Modal';
import { EmptyState, Loading } from '../components/ui';
import { BillingForm, calcTotal, type BillingFormData } from '../components/BillingForm';
import { InvoiceView } from '../components/InvoiceView';
import { processPayment } from '../lib/paymentService';
import { formatRs, formatDate, statusBadgeClass, toCSV, downloadCSV, todayISO, whatsappReminderLink } from '../lib/format';
import type { Bill, Invoice, Patient, User as StaffUser } from '../lib/types';

const DEFAULT_FORM: BillingFormData = {
  consultationFee: 500,
  lineItems: [],
  discountAmount: 0,
  discountPercent: 0,
  paymentMethod: 'cash',
  upiRef: '',
  expectedPaymentDate: '',
  notes: '',
};

type FilterKey = 'all' | 'paid' | 'pending' | 'today' | 'week';

export function BillingScreen() {
  const { clinic } = useAuth();
  const { bills, patients, loading, refresh } = useClinicData();
  const { toast } = useToast();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [invoicesMap, setInvoicesMap] = useState<Record<string, Invoice>>({});

  // Load invoices for all bills
  useEffect(() => {
    if (!clinic) return;
    supabase.from('invoices').select('*, patient:patients(*), doctor:users(*), clinic:clinics(*)')
      .eq('clinic_id', clinic.clinic_id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const m: Record<string, Invoice> = {};
        (data as Invoice[] | null)?.forEach(inv => { m[inv.bill_id] = inv; });
        setInvoicesMap(m);
      });
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
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(b => b.patient?.name?.toLowerCase().includes(q));
    }
    return list;
  }, [bills, filter, query, todayStr, weekAgo]);

  const markPaid = async (bill: Bill) => {
    const { error } = await supabase.from('billing').update({ payment_status: 'paid' }).eq('bill_id', bill.bill_id);
    if (error) return toast('Unable to update payment status. Please try again.', 'error');
    await supabase.from('invoices').update({ payment_status: 'paid', payment_date: todayISO() }).eq('bill_id', bill.bill_id);
    toast('Bill marked paid.', 'success');
    void refresh();
  };

  const sendReminder = (bill: Bill) => {
    const p = bill.patient;
    if (!p?.phone || !clinic) return toast('No phone on file.', 'warning');
    const msg = `Dear ${p.name},\n\nThis is a gentle reminder from ${clinic.name}.\nYour outstanding balance for your visit on ${formatDate(bill.created_at)} is ${formatRs(Number(bill.amount))}.\n\nYou can pay via UPI to: ${(clinic as { upi_id?: string }).upi_id ?? 'our clinic'}\nPlease mention your name as reference.\n\nFor queries call: ${clinic.phone}\n\nThank you,\n${clinic.name} — Powered by VIITSA`;
    const clean = p.phone.replace(/\D/g,'');
    const intl = clean.length === 10 ? '91' + clean : clean;
    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };

  const exportCSV = () => {
    const csv = toCSV(filtered.map(b => ({
      patient: b.patient?.name ?? 'Unknown',
      amount: Number(b.amount),
      status: b.payment_status,
      method: b.payment_method,
      invoice: b.invoice_number ?? '',
      date: formatDate(b.created_at),
    })), [
      { key: 'patient', label: 'Patient' },
      { key: 'amount', label: 'Amount (₹)' },
      { key: 'status', label: 'Status' },
      { key: 'method', label: 'Method' },
      { key: 'invoice', label: 'Invoice No.' },
      { key: 'date', label: 'Date' },
    ]);
    downloadCSV(`billing-${todayISO()}.csv`, csv);
    toast('CSV exported.', 'success');
  };

  if (loading) return <Loading label="Loading billing…" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink">Billing & Payments</h1>
          <p className="text-sm text-ink-muted">Manage bills, invoices, and revenue</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-outline"><Download size={14} /> Export CSV</button>
          <button onClick={() => setOpen(true)} className="btn-primary"><Plus size={14} /> New bill</button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard icon={<TrendingUp size={18} />} label="Collected today" value={formatRs(summary.collected)} tone="success" />
        <SummaryCard icon={<Wallet size={18} />} label="Pending today" value={formatRs(summary.pending)} tone="warning" />
        <SummaryCard icon={<FileText size={18} />} label="Transactions" value={String(summary.transactions)} tone="primary" />
      </div>

      {/* Global pending alert */}
      {allPendingAmt >= 5000 && (
        <div className="flex items-center gap-3 rounded-xl bg-warning-bg border border-warning/20 px-4 py-3">
          <AlertTriangle size={16} className="text-warning shrink-0" />
          <p className="text-sm text-warning font-medium">
            Total outstanding: <strong>{formatRs(allPendingAmt)}</strong> across {bills.filter(b => b.payment_status !== 'paid').length} bills.
          </p>
        </div>
      )}

      {/* List */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1 rounded-lg bg-primary-50/60 p-0.5 overflow-x-auto">
            {(['all','paid','pending','today','week'] as FilterKey[]).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition capitalize whitespace-nowrap ${filter === f ? 'bg-white text-primary shadow-sm' : 'text-ink-muted'}`}>
                {f}
              </button>
            ))}
          </div>
          <div className="relative sm:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <input value={query} onChange={e => setQuery(e.target.value)} className="input pl-9 text-sm" placeholder="Search patient…" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<Wallet size={18} />} title="No bills found" description="Create a new bill or change filter." />
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-ink-subtle border-b border-black/5">
                  <th className="pb-2 pr-3 font-semibold">Patient</th>
                  <th className="pb-2 pr-3 font-semibold hidden sm:table-cell">Invoice</th>
                  <th className="pb-2 pr-3 font-semibold">Amount</th>
                  <th className="pb-2 pr-3 font-semibold hidden sm:table-cell">Method</th>
                  <th className="pb-2 pr-3 font-semibold">Status</th>
                  <th className="pb-2 pr-3 font-semibold hidden md:table-cell">Date</th>
                  <th className="pb-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filtered.slice(0, 60).map(b => {
                  const isOverdue = b.payment_status !== 'paid' && b.expected_payment_date && new Date(b.expected_payment_date) < new Date();
                  return (
                    <tr key={b.bill_id} className={`hover:bg-primary-50/30 relative ${
                      isOverdue ? 'border-l-2 border-danger' : b.payment_status !== 'paid' ? 'border-l-2 border-warning' : ''
                    }`}>
                      <td className="py-3 pr-3"><p className="font-medium text-ink">{b.patient?.name ?? 'Unknown'}</p></td>
                      <td className="py-3 pr-3 text-xs text-ink-muted hidden sm:table-cell">
                        {b.invoice_number ? (
                          <button onClick={() => {
                            const inv = invoicesMap[b.bill_id];
                            if (inv) setViewInvoice(inv);
                          }} className="text-primary hover:underline">{b.invoice_number}</button>
                        ) : '—'}
                      </td>
                      <td className="py-3 pr-3 font-semibold text-ink">{formatRs(Number(b.amount))}</td>
                      <td className="py-3 pr-3 text-ink-muted capitalize hidden sm:table-cell">{b.payment_method}</td>
                      <td className="py-3 pr-3">
                        <span className={`badge ${statusBadgeClass(b.payment_status)} capitalize`}>{b.payment_status}</span>
                      </td>
                      <td className="py-3 pr-3 text-xs text-ink-muted hidden md:table-cell">{formatDate(b.created_at)}</td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {b.payment_status !== 'paid' && (
                            <>
                              <button onClick={() => markPaid(b)} className="btn-ghost p-1.5 text-success" title="Mark paid"><Check size={14} /></button>
                              <button onClick={() => sendReminder(b)} className="btn-ghost p-1.5 text-ink-muted" title="WhatsApp reminder"><MessageCircle size={14} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice modal */}
      {viewInvoice && (
        <Modal open title={viewInvoice.invoice_number} onClose={() => setViewInvoice(null)} size="lg">
          <InvoiceView invoice={viewInvoice} />
        </Modal>
      )}

      {/* New bill modal */}
      <NewBillModal
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => { void refresh(); setOpen(false); }}
        patients={patients}
        clinicId={clinic?.clinic_id ?? ''}
        upiId={(clinic as { upi_id?: string } | null)?.upi_id}
      />
    </div>
  );
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  const tones: Record<string, string> = {
    success: 'bg-success-bg text-success',
    warning: 'bg-warning-bg text-warning',
    primary: 'bg-primary-50 text-primary',
  };
  return (
    <div className="card flex items-center gap-4">
      <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone] ?? ''}`}>{icon}</div>
      <div>
        <p className="text-xs text-ink-muted uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-ink">{value}</p>
      </div>
    </div>
  );
}

interface NewBillModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  patients: Patient[];
  clinicId: string;
  upiId?: string | null;
}

function NewBillModal({ open, onClose, onSaved, patients, clinicId, upiId }: NewBillModalProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [doctors, setDoctors] = useState<StaffUser[]>([]);
  const [form, setForm] = useState<BillingFormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('users').select('*').eq('clinic_id', clinicId).eq('role', 'doctor').eq('active', true)
      .then(({ data }) => {
        const list = (data as StaffUser[] | null) ?? [];
        setDoctors(list);
        if (list.length > 0) setDoctorId(list[0].user_id);
      });
  }, [clinicId]);

  const filteredPats = query
    ? patients.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.phone?.includes(query)).slice(0, 5)
    : [];

  const selectedPatient = patients.find(p => p.patient_id === patientId);
  const selectedDoctor = doctors.find(d => d.user_id === doctorId);

  const submit = async () => {
    if (!patientId) return toast('Select a patient.', 'error');
    if (!form.consultationFee && form.lineItems.length === 0) return toast('Enter at least a consultation fee.', 'error');
    setSaving(true);
    const { discount } = calcTotal(form);
    const result = await processPayment({
      clinicId,
      patientId,
      apptId: null,
      doctorId: doctorId || null,
      consultationFee: form.consultationFee,
      lineItems: form.lineItems,
      discountAmount: discount,
      discountPercent: form.discountPercent,
      paymentMethod: form.paymentMethod,
      upiRef: form.upiRef || undefined,
      expectedPaymentDate: form.expectedPaymentDate || undefined,
      notes: form.notes || undefined,
    });
    setSaving(false);
    if (!result.ok) return toast('Unable to process payment. Please try again.', 'error');
    toast(`Bill created — ${result.invoiceNumber}`, 'success');
    setPatientId(''); setQuery(''); setForm(DEFAULT_FORM);
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title="Create new bill" subtitle="Patient details + payment" size="lg"
      footer={<>
        <button onClick={onClose} className="btn-ghost">Cancel</button>
        <button onClick={submit} disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Create bill & invoice'}
        </button>
      </>}
    >
      <div className="space-y-4">
        <div>
          <label className="label">Patient *</label>
          {patientId ? (
            <div className="flex items-center justify-between input">
              <span className="text-sm">{selectedPatient?.name}</span>
              <button onClick={() => setPatientId('')} className="text-ink-subtle hover:text-danger text-xs">Change</button>
            </div>
          ) : (
            <>
              <input value={query} onChange={e => setQuery(e.target.value)} className="input" placeholder="Search patient…" />
              {filteredPats.length > 0 && (
                <div className="mt-1 border border-black/5 rounded-lg divide-y divide-black/5">
                  {filteredPats.map(p => (
                    <button key={p.patient_id} onClick={() => { setPatientId(p.patient_id); setQuery(''); }}
                      className="w-full text-left px-3 py-2 hover:bg-primary-50 text-sm">
                      <span className="font-medium text-ink">{p.name}</span>
                      <span className="text-xs text-ink-muted ml-2">{p.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div>
          <label className="label">Doctor</label>
          <select className="select" value={doctorId} onChange={e => setDoctorId(e.target.value)}>
            {doctors.map(d => <option key={d.user_id} value={d.user_id}>{d.name}</option>)}
          </select>
        </div>

        <BillingForm
          patientName={selectedPatient?.name ?? '—'}
          doctorName={selectedDoctor?.name ?? '—'}
          value={form}
          onChange={setForm}
          upiId={upiId}
        />
      </div>
    </Modal>
  );
}
