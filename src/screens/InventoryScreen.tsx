import { useMemo, useState } from 'react';
import { Search, Plus, AlertTriangle, Package, Pill, Stethoscope, RefreshCw } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../lib/auth';
import { useClinicData } from '../lib/useClinicData';
import { useToast } from '../lib/toast';
import { Modal } from '../components/Modal';
import { EmptyState, Loading } from '../components/ui';
import { formatRs } from '../lib/format';
import type { InventoryItem } from '../lib/types';

export function InventoryScreen() {
  const { clinic } = useAuth();
  const { inventory, loading, refresh, criticalInventory } = useClinicData();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | 'Medicine' | 'Supplies' | 'Equipment'>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [restock, setRestock] = useState<InventoryItem | null>(null);

  const filtered = useMemo(() => {
    let list = inventory;
    if (category !== 'all') list = list.filter((i) => i.category === category);
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q) || i.supplier?.toLowerCase().includes(q));
    }
    return list;
  }, [inventory, query, category]);

  const stats = useMemo(() => {
    const ok = inventory.filter((i) => i.quantity > i.reorder_level).length;
    const low = inventory.filter((i) => i.quantity > 0 && i.quantity <= i.reorder_level).length;
    const critical = inventory.filter((i) => i.quantity <= 0).length;
    const value = inventory.reduce((s, i) => s + Number(i.quantity) * Number(i.cost_per_unit), 0);
    return { ok, low, critical, value };
  }, [inventory]);

  if (loading) return <Loading label="Loading inventory…" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink">Inventory</h1>
          <p className="text-sm text-ink-muted">{inventory.length} items · Stock value {formatRs(stats.value)}</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary">
          <Plus size={14} />
          Add item
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="OK" value={stats.ok} color="bg-success-bg text-success" />
        <Stat label="Low stock" value={stats.low} color="bg-warning-bg text-warning" />
        <Stat label="Critical" value={stats.critical} color="bg-danger-bg text-danger" />
        <Stat label="Categories" value={new Set(inventory.map((i) => i.category)).size} color="bg-primary-50 text-primary" />
      </div>

      {criticalInventory.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-danger-bg border border-danger/20 px-3 py-2 text-sm text-danger">
          <AlertTriangle size={14} />
          {criticalInventory.length} item{criticalInventory.length > 1 ? 's' : ''} critical — restock action required.
        </div>
      )}

      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1 rounded-lg bg-primary-50/60 p-0.5">
            {(['all', 'Medicine', 'Supplies', 'Equipment'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition capitalize ${
                  category === c ? 'bg-white text-primary shadow-sm' : 'text-ink-muted'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="relative sm:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="input pl-9 text-sm" placeholder="Search name, supplier…" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<Package size={18} />} title="No items found" description="Add items with the button above." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((item) => {
              const status = item.quantity <= 0 ? 'critical' : item.quantity <= item.reorder_level ? 'low' : 'ok';
              const tone =
                status === 'critical' ? 'border-danger/20 bg-danger-bg/20' : status === 'low' ? 'border-warning/20 bg-warning-bg/30' : 'border-black/5';
              const Icon = item.category === 'Medicine' ? Pill : item.category === 'Supplies' ? Package : Stethoscope;
              return (
                <div key={item.item_id} className={`rounded-xl border p-3 ${tone}`}>
                  <div className="flex items-start gap-3">
                    <div className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${status === 'critical' ? 'bg-danger-bg text-danger' : status === 'low' ? 'bg-warning-bg text-warning' : 'bg-primary-50 text-primary'}`}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink truncate">{item.name}</p>
                      <p className="text-[10px] text-ink-subtle uppercase tracking-wide">{item.category}</p>
                    </div>
                    {status !== 'ok' && (
                      <span className={`badge ${status === 'critical' ? 'badge-urgent' : 'badge-waiting'} text-[10px] uppercase`}>
                        {status === 'critical' ? 'Critical' : 'Low'}
                      </span>
                    )}
                    {status === 'ok' && <span className="badge badge-done text-[10px] uppercase">OK</span>}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-[10px] text-ink-subtle uppercase">Quantity</p>
                      <p className="font-semibold text-ink">{item.quantity} {item.unit}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-ink-subtle uppercase">Reorder at</p>
                      <p className="font-medium text-ink-muted">{item.reorder_level} {item.unit}</p>
                    </div>
                  </div>
                  {item.supplier && <p className="mt-2 text-[10px] text-ink-subtle truncate">Supplier: {item.supplier}</p>}
                  <button
                    onClick={() => setRestock(item)}
                    className="btn-secondary w-full mt-3 py-1.5 text-xs"
                  >
                    <RefreshCw size={12} />
                    Restock
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AddItemModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={() => { void refresh(); setAddOpen(false); }} clinicId={clinic?.clinic_id ?? ''} />
      <RestockModal item={restock} onClose={() => setRestock(null)} onSaved={() => { void refresh(); setRestock(null); }} />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card flex items-center gap-3">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${color} font-bold`}>{value}</div>
      <p className="text-xs text-ink-muted uppercase tracking-wide">{label}</p>
    </div>
  );
}

function AddItemModal({ open, onClose, onSaved, clinicId }: { open: boolean; onClose: () => void; onSaved: () => void; clinicId: string }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', category: 'Medicine', quantity: '', unit: 'strips', reorder: '', supplier: '', cost: '' });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.name.trim()) return toast('Item name is required.', 'error');
    if (!form.quantity) return toast('Enter quantity.', 'error');
    setSaving(true);
    try {
      await addDoc(collection(db, 'inventory'), {
        clinic_id: clinicId,
        name: form.name.trim(),
        category: form.category,
        quantity: parseFloat(form.quantity) || 0,
        unit: form.unit,
        reorder_level: parseFloat(form.reorder) || 10,
        supplier: form.supplier || null,
        cost_per_unit: parseFloat(form.cost) || 0,
        created_at: new Date().toISOString()
      });
      setSaving(false);
      toast('Item added to inventory.', 'success');
      setForm({ name: '', category: 'Medicine', quantity: '', unit: 'strips', reorder: '', supplier: '', cost: '' });
      onSaved();
    } catch(error) {
      setSaving(false);
      toast('Unable to update inventory. Please try again.', 'error');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add inventory item" size="md"
      footer={<><button onClick={onClose} className="btn-ghost">Cancel</button><button onClick={submit} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Add item'}</button></>}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Name *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Category</label><select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option>Medicine</option><option>Supplies</option><option>Equipment</option></select></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">Quantity *</label><input type="number" className="input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
          <div><label className="label">Unit</label><input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
          <div><label className="label">Reorder at</label><input type="number" className="input" value={form.reorder} onChange={(e) => setForm({ ...form, reorder: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Supplier</label><input className="input" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
          <div><label className="label">Cost / unit (₹)</label><input type="number" className="input" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></div>
        </div>
      </div>
    </Modal>
  );
}

function RestockModal({ item, onClose, onSaved }: { item: InventoryItem | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [qty, setQty] = useState('0');
  const [saving, setSaving] = useState(false);
  if (!item) return null;
  const newQty = (Number(item.quantity) + (parseFloat(qty) || 0)).toFixed(0);
  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title={`Restock ${item.name}`}
      subtitle={`Current: ${item.quantity} ${item.unit} · Reorder at ${item.reorder_level}`}
      size="sm"
      footer={<>
        <button onClick={onClose} className="btn-ghost">Cancel</button>
        <button
          onClick={async () => {
            try {
              await updateDoc(doc(db, 'inventory', item.item_id!), { quantity: parseFloat(newQty) });
              setSaving(false);
              toast(`Restocked. New quantity: ${newQty} ${item.unit}.`, 'success');
              setQty('0');
              onSaved();
            } catch(error) {
              setSaving(false);
              toast('Failed.', 'error');
            }
          }}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </>}
    >
      <div className="space-y-3">
        <div>
          <label className="label">Add quantity</label>
          <input type="number" min="0" className="input" value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div className="rounded-lg bg-primary-50/60 px-3 py-2 text-sm">
          <p className="text-ink-muted text-xs">New total</p>
          <p className="font-bold text-primary text-lg">{newQty} {item.unit}</p>
        </div>
      </div>
    </Modal>
  );
}
