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
