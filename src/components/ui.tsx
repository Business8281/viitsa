import { AlertTriangle } from 'lucide-react';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary">
        {icon ?? <AlertTriangle size={20} />}
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description ? <p className="mt-1 text-xs text-ink-muted max-w-xs">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="inline-flex items-center gap-2 text-ink-muted text-sm">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        {label}
      </div>
    </div>
  );
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {subtitle ? <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Avatar({ name, color = '#0F6E56', size = 40 }: { name: string; color?: string; size?: number }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div
      className="inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0"
      style={{ backgroundColor: color, width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials || '?'}
    </div>
  );
}

export function StatusBadge({ text }: { text: string }) {
  const lower = (text || '').toLowerCase();
  let cls = 'badge';
  if (lower === 'active' || lower === 'completed' || lower === 'done' || lower === 'paid') cls += ' badge-done';
  else if (lower === 'pending' || lower === 'waiting') cls += ' badge-waiting';
  else if (lower === 'urgent') cls += ' badge-urgent';
  else if (lower === 'cancelled' || lower === 'canceled') cls += ' badge-cancelled';
  else if (lower === 'in-progress' || lower === 'in progress') cls += ' badge-progress';
  else cls += ' bg-primary-50 text-primary';
  return <span className={cls}>{text}</span>;
}

export function RoleBadge({ role }: { role?: string }) {
  if (!role) return <span className="badge badge-cancelled">unknown</span>;
  if (role === 'company_admin') return <span className="badge bg-purple-50 text-purple-700">{role}</span>;
  if (role === 'company_manager') return <span className="badge bg-purple-50 text-purple-600">{role}</span>;
  if (role === 'company_staff') return <span className="badge bg-purple-50 text-purple-500">{role}</span>;
  if (role === 'clinic_admin')  return <span className="badge badge-done">{role}</span>;
  if (role === 'clinic_doctor') return <span className="badge badge-progress">{role}</span>;
  if (role === 'clinic_staff')  return <span className="badge badge-waiting">{role}</span>;
  if (role === 'patient')       return <span className="badge bg-blue-50 text-blue-700">{role}</span>;
  if (role === 'patient_attendant') return <span className="badge bg-blue-50 text-blue-600">{role}</span>;
  return <span className="badge badge-cancelled">{role}</span>;
}

export function DataTable({ headers, hiddenFrom, children, empty, emptyLabel }: {
  headers: string[];
  hiddenFrom?: (string | null)[];
  children: React.ReactNode;
  empty: boolean;
  emptyLabel: string;
}) {
  return (
    <div className="card p-0 overflow-hidden">
      {empty ? (
        <div className="px-4 py-10 text-center text-sm text-ink-muted">
          {emptyLabel}
        </div>
      ) : (
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-sm">
            <thead className="border-b border-black/5 bg-surface">
              <tr>
                {headers.map((h, i) => (
                  <th
                    key={h}
                    className={`text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide ${
                      hiddenFrom?.[i] ? `hidden ${hiddenFrom[i]}:table-cell` : ''
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {children}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
