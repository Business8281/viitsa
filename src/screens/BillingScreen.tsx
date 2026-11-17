import { useEffect, useMemo, useState } from 'react';
import { DollarSign, Search, FileText, CheckCircle, Download, FileSpreadsheet, Plus, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../lib/auth';
import { useClinicData } from '../lib/useClinicData';
import { useToast } from '../lib/toast';
import { Modal } from '../components/Modal';
import { InvoiceView } from '../components/InvoiceView';
import { EmptyState, Loading } from '../components/ui';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { formatDate, formatTime, statusBadgeClass, todayISO, isSameDay, isWithinDays, parseDateArg, matchesDateRange, type DateRangePreset } from '../lib/format';
import type { Bill, Invoice, Patient, User as U } from '../lib/types';
import { processPayment } from '../lib/paymentService';

const formatRs = (amt: number) => `₹${amt.toFixed(2)}`;

type StatusFilterKey = 'all' | 'paid' | 'pending';

export function BillingScreen() {
  const { clinic, user } = useAuth();
  const { bills, patients, inventory, loading, refresh } = useClinicData();
  const { toast } = useToast();
  
  // Live Date Range Calendar Filter
  const [datePreset, setDatePreset] = useState<DateRangePreset>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  // Status & Search filters
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>('all');
  const [queryInput, setQueryInput] = useState('');
  const [open, setOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [invoicesMap, setInvoicesMap] = useState<Record<string, Invoice>>({});

  // Load invoices for all bills
  useEffect(() => {
    if (!clinic) return;
    const q = query(
      collection(db, 'invoices'),
      where('clinic_id', '==', clinic.clinic_id)
    );
    const unsub = onSnapshot(q, (snap) => {
      const m: Record<string, Invoice> = {};
      snap.docs.forEach(d => {
        const inv = { ...d.data(), invoice_id: d.id } as Invoice;
        if (inv.bill_id) {
          m[inv.bill_id] = inv;
        } else if (inv.appointment_id) {
          m[inv.appointment_id] = inv;
        } else if (inv.created_at) {
          m[inv.created_at] = inv;
        }
      });
      setInvoicesMap(m);
    }, (e) => console.error("Error fetching invoices", e));
    return () => unsub();
  }, [clinic]);

  const getBillAmount = (b: any): number => {
    const raw = b.amount !== undefined && b.amount !== null && b.amount !== '' ? b.amount : (b.total !== undefined && b.total !== null && b.total !== '' ? b.total : (b.subtotal ?? 0));
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw || 0).replace(/[^0-9.-]+/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const getBillDate = (b: any) => {
    return b.created_at || (b as any).createdAt || (b as any).date || (b as any).payment_date || (b as any).timestamp || (b as any).visit_date;
  };

  const isBillPaid = (b: any): boolean => {
    const st = String(b.payment_status || b.status || '').toLowerCase().trim();
    return st === 'paid' || st === 'completed' || st === 'success' || st === 'cleared';
  };

  const isBillCancelled = (b: any): boolean => {
    const st = String(b.payment_status || b.status || '').toLowerCase().trim();
    return st === 'cancelled' || st === 'void';
  };

  const rangeLabel = useMemo(() => {
    switch (datePreset) {
      case 'today': return "Today's";
      case 'week': return "This Week's";
      case 'month': return "This Month's";
      case '3months': return "3 Months'";
      case 'custom': return "Selected Period";
      default: return "All-Time";
    }
  }, [datePreset]);

  const summary = useMemo(() => {
    let allTimeCollected = 0;
    let allTimePaidCount = 0;
    let allTimePending = 0;
    let allTimePendingCount = 0;

    let rangeCollected = 0;
    let rangePaidCount = 0;
    let rangePending = 0;
    let rangePendingCount = 0;

    bills.forEach(b => {
      const amt = getBillAmount(b);
      const isPaid = isBillPaid(b);
      const isCancelled = isBillCancelled(b);
      const inRange = matchesDateRange(getBillDate(b), datePreset, customStart, customEnd);

      if (isPaid) {
        allTimeCollected += amt;
        allTimePaidCount += 1;
        if (inRange) {
          rangeCollected += amt;
          rangePaidCount += 1;
        }
      } else if (!isCancelled) {
        allTimePending += amt;
        allTimePendingCount += 1;
        if (inRange) {
          rangePending += amt;
          rangePendingCount += 1;
        }
      }
    });

    return {
      allTimeCollected,
      allTimePaidCount,
      allTimePending,
      allTimePendingCount,
      rangeCollected,
      rangePaidCount,
      rangePending,
      rangePendingCount,
    };
  }, [bills, datePreset, customStart, customEnd]);

  const filtered = useMemo(() => {
    let list = bills;

    // Filter by live calendar date preset / custom range
    list = list.filter(b => matchesDateRange(getBillDate(b), datePreset, customStart, customEnd));

    // Status filter
    if (statusFilter === 'paid') list = list.filter(b => isBillPaid(b));
    else if (statusFilter === 'pending') list = list.filter(b => !isBillPaid(b) && !isBillCancelled(b));

    // Search query
    if (queryInput) {
      const q = queryInput.toLowerCase().trim();
      list = list.filter(b => {
        const p = patients.find(pat => pat.patient_id === b.patient_id);
        const name = p?.name || (b as any).patient?.name || (b as any).patient_name || '';
        const id = p?.id_number || p?.display_id || '';
        const method = (b.payment_method || '').toLowerCase();
        const invNo = (b.invoice_number || '').toLowerCase();
        return name.toLowerCase().includes(q) || id.toLowerCase().includes(q) || method.includes(q) || invNo.includes(q);
      });
    }
    return list;
  }, [bills, datePreset, customStart, customEnd, statusFilter, queryInput, patients]);

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
    const csv = toCSV(filtered.map(b => {
      const d = parseDateArg(b.created_at || (b as any).date);
      const dateStr = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '—';
      return {
        patient: patients.find(p => p.patient_id === b.patient_id)?.name ?? (b as any).patient?.name ?? 'Unknown',
        amount: getBillAmount(b),
        status: b.payment_status || 'pending',
        method: b.payment_method || 'cash',
        date: dateStr,
      };
    }));
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };



  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink">Billing & Payments</h1>
          <p className="text-sm text-ink-muted">Manage invoices, collections, and track live revenue</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-outline"><FileSpreadsheet size={16} /> Export</button>
          <button onClick={() => setOpen(true)} className="btn-primary"><Plus size={16} /> New bill</button>
        </div>
      </div>

      {/* Live Calendar Filter Bar */}
      <div className="bg-surface p-3 rounded-2xl border border-divider/60 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3 min-w-0 max-w-full">
        <DateRangeFilter
          preset={datePreset}
          onPresetChange={setDatePreset}
          customStart={customStart}
          onCustomStartChange={setCustomStart}
          customEnd={customEnd}
          onCustomEndChange={setCustomEnd}
          label="Filter Period"
          className="min-w-0 max-w-full"
        />
        <span className="text-xs font-medium text-ink-muted shrink-0">
          Showing <span className="font-bold text-ink">{filtered.length}</span> record{filtered.length !== 1 ? 's' : ''} ({datePreset})
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card bg-primary text-white border-none shadow-sm">
          <p className="text-white/80 text-sm mb-1 font-medium">Total Collections (All Time)</p>
          <p className="text-2xl font-bold">{formatRs(summary.allTimeCollected)}</p>
          <p className="text-xs text-white/70 mt-2">{summary.allTimePaidCount} paid transaction{summary.allTimePaidCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="card bg-emerald-700 text-white border-none shadow-sm">
          <p className="text-white/80 text-sm mb-1 font-medium">{rangeLabel} Collections</p>
          <p className="text-2xl font-bold">{formatRs(summary.rangeCollected)}</p>
          <p className="text-xs text-white/70 mt-2">{summary.rangePaidCount} transaction{summary.rangePaidCount !== 1 ? 's' : ''} in period</p>
        </div>
        <div className="card bg-accent text-white border-none shadow-sm">
          <p className="text-white/80 text-sm mb-1 font-medium">Total Pending (All Time)</p>
          <p className="text-2xl font-bold">{formatRs(summary.allTimePending)}</p>
          <p className="text-xs text-white/70 mt-2 text-warning-100">{summary.allTimePendingCount > 0 ? `${summary.allTimePendingCount} pending bills` : 'Requires follow-up'}</p>
        </div>
        <div className="card border border-divider/60 shadow-sm">
          <p className="text-ink-muted text-sm mb-1 font-medium">{rangeLabel} Pending</p>
          <p className="text-2xl font-bold text-ink">{formatRs(summary.rangePending)}</p>
          <p className="text-xs text-ink-subtle mt-2">{summary.rangePendingCount > 0 ? `${summary.rangePendingCount} unpaid in period` : "No unpaid dues in period"}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-1 bg-black/5 p-1 rounded-lg max-w-full">
            {(['all', 'paid', 'pending'] as StatusFilterKey[]).map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition ${statusFilter === f ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}
              >
                {f === 'all' ? `All Status (${filtered.length})` : f}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <input value={queryInput} onChange={(e) => setQueryInput(e.target.value)} className="input pl-8 text-sm" placeholder="Search patient, ID, or invoice…" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 text-center text-ink-muted text-sm">
            No bills found.
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar w-full max-w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/5 text-xs text-ink-subtle uppercase tracking-wider">
                  <th className="p-3 font-medium">Patient</th>
                  <th className="p-3 font-medium hidden sm:table-cell">Date</th>
                  <th className="p-3 font-medium">Amount</th>
                  <th className="p-3 font-medium hidden md:table-cell">Method</th>
                  <th className="p-3 font-medium">Status</th>
                  <th className="p-3 font-medium text-right sm:text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filtered.map(b => {
                  const patient = patients.find(p => p.patient_id === b.patient_id);
                  const inv = invoicesMap[b.appointment_id ?? b.bill_id!] || invoicesMap[b.created_at];
                  return (
                    <tr key={b.bill_id} className="hover:bg-black/[0.02] transition">
                      <td className="p-3">
                        <p className="text-sm font-medium text-ink">{patient?.name ?? (b as any).patient?.name ?? (b as any).patient_name ?? 'Unknown'}</p>
                        <p className="text-xs text-ink-muted sm:hidden mt-0.5">{formatDate(b.created_at || (b as any).date)}</p>
                      </td>
                      <td className="p-3 text-sm text-ink-muted hidden sm:table-cell">{formatDate(b.created_at || (b as any).date)}</td>
                      <td className="p-3 text-sm font-semibold text-ink whitespace-nowrap">{formatRs(getBillAmount(b))}</td>
                      <td className="p-3 text-sm text-ink-muted capitalize hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <DollarSign size={14} className="text-ink-subtle shrink-0" />
                          <span>{b.payment_method || 'cash'}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`badge ${statusBadgeClass(b.payment_status)} text-[10px] capitalize whitespace-nowrap`}>{b.payment_status}</span>
                      </td>
                      <td className="p-3 text-right sm:text-left">
                        <div className="flex items-center justify-end sm:justify-start gap-1.5">
                          {b.payment_status !== 'paid' && (
                            <>
                              <button onClick={() => markPaid(b)} className="btn-ghost text-xs text-primary py-1 px-2" title="Mark as Paid"><CheckCircle size={14} /></button>
                              <button onClick={() => sendReminder(b)} className="btn-ghost text-xs text-ink-muted py-1 px-2" title="Send Reminder"><DollarSign size={14} /></button>
                            </>
                          )}
                          {inv && (
                            <button onClick={() => setViewInvoice({ ...b, ...inv, payment_status: b.payment_status, payment_method: b.payment_method, patient, clinic } as any)} className="btn-ghost text-xs text-ink-muted py-1 px-2" title="View Invoice">
                              <FileText size={14} />
                            </button>
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

      <CreateBillModal open={open} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); void refresh(); }} clinicId={clinic?.clinic_id ?? ''} patients={patients} inventory={inventory} />

      {viewInvoice && (
        <Modal open onClose={() => setViewInvoice(null)} title="Invoice" size="xl">
          <InvoiceView invoice={viewInvoice} onClose={() => setViewInvoice(null)} />
        </Modal>
      )}
    </div>
  );
}

function CreateBillModal({ open, onClose, onSaved, clinicId, patients, inventory }: { open: boolean; onClose: () => void; onSaved: () => void; clinicId: string; patients: Patient[]; inventory: any[] }) {
  const { toast } = useToast();
  const [patientId, setPatientId] = useState('');
  const [consultationFee, setConsultationFee] = useState('');
  const [lineItems, setLineItems] = useState<{description: string, amount: string}[]>([{ description: '', amount: '' }]);
  const [method, setMethod] = useState<'cash'|'card'|'upi'>('upi');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [doctors, setDoctors] = useState<U[]>([]);

  useEffect(() => {
    if (!open) return;
    const q = query(collection(db, 'users'), where('clinic_id', '==', clinicId), where('role', '==', 'clinic_doctor'), where('active', '==', true));
    const unsub = onSnapshot(q, (snap) => {
      setDoctors(snap.docs.map(d => ({ ...d.data(), id: d.id, user_id: d.id } as U)));
    }, console.error);
    return () => unsub();
  }, [open, clinicId]);

  const addLineItem = () => setLineItems([...lineItems, { description: '', amount: '' }]);
  const removeLineItem = (i: number) => setLineItems(lineItems.filter((_, idx) => idx !== i));
  const updateLineItem = (i: number, field: 'description'|'amount', val: string) => {
    const list = [...lineItems];
    list[i][field] = val;

    // Auto-fill amount if selecting from inventory
    if (field === 'description') {
      const matchedItem = inventory.find(inv => inv.name === val);
      if (matchedItem && matchedItem.cost_per_unit) {
        list[i].amount = matchedItem.cost_per_unit.toString();
      }
    }

    setLineItems(list);
  };

  const total = Number(consultationFee || 0) + lineItems.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  const submit = async () => {
    if (!patientId) return toast('Select a patient.', 'error');
    if (total <= 0) return toast('Total amount must be greater than zero.', 'error');
    
    const validItems = lineItems.filter(item => item.description.trim() !== '' && Number(item.amount) > 0).map(item => ({
      description: item.description,
      amount: Number(item.amount)
    }));

    setSaving(true);
    const res = await processPayment({
      clinicId,
      patientId,
      apptId: null, // manual bill
      doctorId: doctors[0]?.user_id || doctors[0]?.id || null,
      consultationFee: Number(consultationFee || 0),
      lineItems: validItems,
      discountAmount: 0,
      discountPercent: 0,
      paymentMethod: method,
      notes: notes || undefined,
    });
    setSaving(false);
    if (!res.ok) return toast(res.error ?? 'Error', 'error');
    toast('Bill created.', 'success');
    setPatientId(''); setConsultationFee(''); setLineItems([{ description: '', amount: '' }]); setNotes('');
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Manual Bill" size="md" footer={<><button onClick={onClose} className="btn-ghost">Cancel</button><button onClick={submit} disabled={saving} className="btn-primary">{saving ? 'Saving…' : `Create (₹${total})`}</button></>}>
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        <div>
          <label className="label">Patient *</label>
          <select className="select" value={patientId} onChange={e => setPatientId(e.target.value)}>
            <option value="">Select patient…</option>
            {patients.map(p => <option key={p.patient_id} value={p.patient_id}>{p.name} ({p.phone})</option>)}
          </select>
        </div>

        <div className="card space-y-3 bg-gray-50/50 p-4 border border-black/5">
          <h4 className="font-semibold text-sm text-ink mb-2">Bill Items</h4>
          
          <div className="grid grid-cols-3 gap-2 items-center">
            <div className="col-span-2 text-sm text-ink-muted">Consultation Fee</div>
            <input type="number" min="0" className="input" placeholder="₹ 0" value={consultationFee} onChange={e => setConsultationFee(e.target.value)} />
          </div>

          <div className="border-t border-black/5 pt-3 space-y-2">
            <datalist id="inventory-items">
              {inventory.map(inv => (
                <option key={inv.item_id || inv.id} value={inv.name}>
                  {inv.category} - ₹{inv.cost_per_unit}
                </option>
              ))}
            </datalist>
            
            {lineItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className="input flex-1" list="inventory-items" placeholder="Item (e.g. Medicines, X-Ray)" value={item.description} onChange={e => updateLineItem(i, 'description', e.target.value)} />
                <input type="number" min="0" className="input w-24" placeholder="₹ 0" value={item.amount} onChange={e => updateLineItem(i, 'amount', e.target.value)} />
                <button onClick={() => removeLineItem(i)} className="text-danger hover:bg-danger-bg p-2 rounded-lg transition"><X size={16} /></button>
              </div>
            ))}
            <button onClick={addLineItem} className="text-primary text-xs font-semibold flex items-center gap-1 hover:underline mt-2">
              <Plus size={14} /> Add Line Item
            </button>
          </div>

          <div className="flex justify-between items-center border-t border-black/5 pt-3 mt-3">
            <span className="font-semibold text-sm">Total Amount</span>
            <span className="font-bold text-lg text-primary">₹{total.toFixed(2)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
      </div>
    </Modal>
  );
}
