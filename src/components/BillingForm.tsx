import { useState } from 'react';
import { X, Plus, Minus, CreditCard, Banknote, Smartphone, Clock, Check, QrCode } from 'lucide-react';
import type { PaymentMethod, BillLineItem } from '../lib/types';
import { formatRs } from '../lib/format';

export interface BillingFormData {
  consultationFee: number;
  lineItems: BillLineItem[];
  discountAmount: number;
  discountPercent: number;
  paymentMethod: PaymentMethod;
  upiRef: string;
  expectedPaymentDate: string;
  notes: string;
}

interface Props {
  patientName: string;
  doctorName: string;
  defaultFee?: number;
  onChange: (data: BillingFormData) => void;
  value: BillingFormData;
  upiId?: string | null;
}

const METHOD_CONFIG: { method: PaymentMethod; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { method: 'cash',    label: 'Cash',    Icon: Banknote },
  { method: 'upi',     label: 'UPI',     Icon: Smartphone },
  { method: 'card',    label: 'Card',    Icon: CreditCard },
  { method: 'pending', label: 'Pending', Icon: Clock } as unknown as { method: PaymentMethod; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> },
];

export function BillingForm({ patientName, doctorName, defaultFee = 500, onChange, value, upiId }: Props) {
  const subtotal = value.consultationFee + value.lineItems.reduce((s, l) => s + l.amount, 0);
  const discountAmt = value.discountPercent > 0
    ? Math.round(subtotal * value.discountPercent / 100)
    : value.discountAmount;
  const total = Math.max(0, subtotal - discountAmt);

  const update = (patch: Partial<BillingFormData>) => onChange({ ...value, ...patch });

  const addLine = () => update({ lineItems: [...value.lineItems, { description: '', amount: 0 }] });
  const removeLine = (i: number) => update({ lineItems: value.lineItems.filter((_, j) => j !== i) });
  const updateLine = (i: number, patch: Partial<BillLineItem>) => {
    const next = value.lineItems.map((l, j) => j === i ? { ...l, ...patch } : l);
    update({ lineItems: next });
  };

  return (
    <div className="space-y-4">
      {/* Patient + doctor header */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-primary-50/50 px-3 py-2">
          <p className="text-[10px] text-ink-subtle uppercase">Patient</p>
          <p className="font-semibold text-ink">{patientName}</p>
        </div>
        <div className="rounded-lg bg-primary-50/50 px-3 py-2">
          <p className="text-[10px] text-ink-subtle uppercase">Doctor</p>
          <p className="font-semibold text-ink">{doctorName}</p>
        </div>
      </div>

      {/* Consultation fee */}
      <div>
        <label className="label">Consultation fee (₹)</label>
        <input type="number" min="0" className="input" value={value.consultationFee || ''}
          onChange={e => update({ consultationFee: parseFloat(e.target.value) || 0 })} />
      </div>

      {/* Additional charges */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Additional charges</label>
          <button type="button" onClick={addLine} className="btn-ghost text-xs py-1 px-2">
            <Plus size={12} /> Add item
          </button>
        </div>
        {value.lineItems.map((li, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <input
              className="input flex-1"
              placeholder="e.g. Lab test, Dressing"
              value={li.description}
              onChange={e => updateLine(i, { description: e.target.value })}
            />
            <input
              type="number"
              min="0"
              className="input w-24"
              placeholder="₹0"
              value={li.amount || ''}
              onChange={e => updateLine(i, { amount: parseFloat(e.target.value) || 0 })}
            />
            <button type="button" onClick={() => removeLine(i)} className="text-danger p-1">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Discount */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Discount (₹)</label>
          <input type="number" min="0" className="input" value={value.discountAmount || ''}
            onChange={e => update({ discountAmount: parseFloat(e.target.value) || 0, discountPercent: 0 })} />
        </div>
        <div>
          <label className="label">Discount (%)</label>
          <input type="number" min="0" max="100" className="input" value={value.discountPercent || ''}
            onChange={e => update({ discountPercent: parseFloat(e.target.value) || 0, discountAmount: 0 })} />
        </div>
      </div>

      {/* Totals */}
      <div className="rounded-xl bg-primary-50/40 px-4 py-3 space-y-1.5 text-sm">
        <div className="flex justify-between text-ink-muted"><span>Subtotal</span><span>{formatRs(subtotal)}</span></div>
        {discountAmt > 0 && <div className="flex justify-between text-danger"><span>Discount</span><span>-{formatRs(discountAmt)}</span></div>}
        <div className="flex justify-between font-bold text-base text-ink border-t border-primary-100 pt-1.5">
          <span>Total</span><span>{formatRs(total)}</span>
        </div>
      </div>

      {/* Payment method */}
      <div>
        <label className="label">Payment method</label>
        <div className="grid grid-cols-4 gap-2">
          {METHOD_CONFIG.map(({ method, label, Icon }) => {
            const active = value.paymentMethod === method;
            return (
              <button key={method} type="button" onClick={() => update({ paymentMethod: method })}
                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 transition ${
                  active ? 'border-primary bg-primary-50 text-primary' : 'border-gray-200 text-gray-400'
                }`}>
                {active && <Check size={10} className="text-primary self-end -mb-1" />}
                <Icon size={20} />
                <span className="text-[10px] font-semibold">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* UPI details */}
      {value.paymentMethod === 'upi' && (
        <div className="space-y-2">
          <div>
            <label className="label">UPI reference number</label>
            <input className="input" value={value.upiRef} onChange={e => update({ upiRef: e.target.value })} placeholder="12-digit UPI transaction ID" />
          </div>
          {upiId && (
            <div className="flex items-center gap-2 rounded-lg bg-primary-50/50 px-3 py-2 text-xs text-ink-muted">
              <QrCode size={14} className="text-primary" />
              <span>UPI ID: <strong className="text-ink">{upiId}</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Pending expected date */}
      {(value.paymentMethod as string) === 'pending' && (
        <div className="space-y-2">
          <div>
            <label className="label">Expected payment date</label>
            <input type="date" className="input" value={value.expectedPaymentDate}
              onChange={e => update({ expectedPaymentDate: e.target.value })} />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={value.notes} onChange={e => update({ notes: e.target.value })} placeholder="Any note for this pending bill" />
          </div>
        </div>
      )}
    </div>
  );
}

export function calcTotal(data: BillingFormData): { subtotal: number; discount: number; total: number } {
  const subtotal = data.consultationFee + data.lineItems.reduce((s, l) => s + l.amount, 0);
  const discount = data.discountPercent > 0
    ? Math.round(subtotal * data.discountPercent / 100)
    : data.discountAmount;
  return { subtotal, discount, total: Math.max(0, subtotal - discount) };
}
