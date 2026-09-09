import { Printer, Share2, Download } from 'lucide-react';
import { formatDate, formatRs } from '../lib/format';
import type { Invoice, Clinic, Patient, User } from '../lib/types';

interface Props {
  invoice: Invoice;
  clinic?: Clinic | null;
  patient?: Patient | null;
  doctor?: User | null;
  onClose?: () => void;
}

export function InvoiceView({ invoice, clinic, patient, doctor, onClose }: Props) {
  const c = clinic ?? (invoice.clinic as Clinic | null);
  const p = patient ?? (invoice.patient as Patient | null);
  const d = doctor ?? (invoice.doctor as User | null);

  const shareWhatsApp = () => {
    const msg = `Dear ${p?.name ?? 'patient'}, your invoice ${invoice.invoice_number} of ${formatRs(Number(invoice.total))} from ${c?.name ?? 'clinic'} on ${formatDate(invoice.visit_date ?? invoice.created_at)}.\nInvoice No: ${invoice.invoice_number} | Status: ${invoice.payment_status.toUpperCase()}\n- VIITSA`;
    if (p?.phone) {
      const clean = p.phone.replace(/\D/g,'');
      const intl = clean.length === 10 ? '91' + clean : clean;
      window.open(`https://wa.me/${intl}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
    }
  };

  return (
    <div className="space-y-3">
      {/* Invoice card — this part prints */}
      <div id="print-area" className="bg-white rounded-xl border border-black/5 overflow-hidden">
        {/* Teal header */}
        <div className="px-6 py-5" style={{ backgroundColor: '#0F6E56' }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xl font-bold text-white">{c?.name ?? 'Clinic'}</p>
              <p className="text-xs text-white/70 mt-1">{c?.address}</p>
              <p className="text-xs text-white/70">{c?.phone}{c?.email ? ` · ${c.email}` : ''}</p>
            </div>
            <div className="text-right text-white/90">
              <p className="text-[10px] uppercase tracking-wider text-white/60">VIITSA</p>
              <p className="text-sm font-bold">INVOICE</p>
            </div>
          </div>
        </div>

        {/* Metadata row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-4 border-b border-black/5 text-xs">
          <Datum label="Invoice no." value={invoice.invoice_number} />
          <Datum label="Visit date" value={invoice.visit_date ? formatDate(invoice.visit_date) : '—'} />
          <Datum label="Payment date" value={invoice.payment_date ? formatDate(invoice.payment_date) : '—'} />
          <Datum label="Method" value={
            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
              invoice.payment_method === 'cash' ? 'bg-green-50 text-green-700' :
              invoice.payment_method === 'upi' ? 'bg-blue-50 text-blue-700' :
              invoice.payment_method === 'card' ? 'bg-purple-50 text-purple-700' :
              'bg-yellow-50 text-yellow-700'
            }`}>{invoice.payment_method}</span>
          } />
        </div>

        {/* Patient + doctor */}
        <div className="grid grid-cols-2 gap-3 px-5 py-3 border-b border-black/5 text-xs">
          <div>
            <p className="text-[10px] text-ink-subtle uppercase tracking-wide mb-1">Patient</p>
            <p className="font-semibold text-ink">{p?.name ?? '—'}</p>
            <p className="text-ink-muted">{p?.phone} · {p?.age ?? '—'} yrs · {p?.gender ?? '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-ink-subtle uppercase tracking-wide mb-1">Doctor</p>
            <p className="font-semibold text-ink">{d?.name ?? '—'}</p>
            <p className="text-ink-muted">{d?.specialisation ?? 'General Medicine'}</p>
          </div>
        </div>

        {/* Line items table */}
        <div className="px-5 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] text-ink-subtle uppercase tracking-wide border-b border-black/5">
                <th className="text-left pb-2 font-semibold">Description</th>
                <th className="text-right pb-2 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.03]">
              {(invoice.line_items ?? []).map((li, i) => (
                <tr key={i}>
                  <td className="py-2 text-ink">{li.description}</td>
                  <td className="py-2 text-right text-ink">{formatRs(Number(li.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-black/10 mt-3 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-ink-muted">
              <span>Subtotal</span>
              <span>{formatRs(Number(invoice.subtotal))}</span>
            </div>
            {Number(invoice.discount_amount) > 0 && (
              <div className="flex justify-between text-danger">
                <span>Discount</span>
                <span>-{formatRs(Number(invoice.discount_amount))}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base text-ink">
              <span>TOTAL {invoice.payment_status === 'paid' ? 'PAID' : 'DUE'}</span>
              <span>{formatRs(Number(invoice.total))}</span>
            </div>
          </div>
        </div>

        {/* Payment status stamp */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-black/5 bg-primary-50/30">
          <div>
            {invoice.upi_ref && (
              <p className="text-xs text-ink-muted">UPI Ref: <span className="font-medium text-ink">{invoice.upi_ref}</span></p>
            )}
          </div>
          <span className={`text-sm font-bold px-4 py-1.5 rounded-full uppercase tracking-wide ${
            invoice.payment_status === 'paid'
              ? 'bg-success-bg text-success border border-success/20'
              : 'bg-warning-bg text-warning border border-warning/20'
          }`}>
            {invoice.payment_status === 'paid' ? '✓ PAID' : '⏳ PENDING'}
          </span>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-black/5 text-center">
          <p className="text-xs text-ink-muted">Thank you for visiting {c?.name}.</p>
          <p className="text-[10px] text-ink-subtle mt-0.5">Powered by VIITSA</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={shareWhatsApp} className="btn-secondary flex-1">
          <Share2 size={14} /> WhatsApp
        </button>
        <button onClick={() => window.print()} className="btn-outline flex-1">
          <Printer size={14} /> Print
        </button>
        <button onClick={() => window.print()} className="btn-ghost flex-1">
          <Download size={14} /> Download
        </button>
      </div>
    </div>
  );
}

function Datum({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-ink-subtle uppercase tracking-wide">{label}</p>
      <div className="text-xs font-semibold text-ink mt-0.5">{value}</div>
    </div>
  );
}
