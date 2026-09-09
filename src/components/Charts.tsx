interface BarChartProps {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  formatValue?: (n: number) => string;
}

export function BarChart({ data, color = '#0F6E56', height = 160, formatValue }: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-2 sm:gap-3" style={{ height }}>
      {data.map((d, i) => {
        const h = Math.max(2, (d.value / max) * (height - 28));
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5 min-w-0">
            <span className="text-[10px] font-semibold text-ink-muted">
              {formatValue ? formatValue(d.value) : d.value}
            </span>
            <div
              className="w-full rounded-t-md transition-all hover:opacity-80"
              style={{ height: h, backgroundColor: color }}
            />
            <span className="text-[10px] text-ink-subtle truncate w-full text-center">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

interface LineChartProps {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  formatValue?: (n: number) => string;
}

export function LineChart({ data, color = '#0F6E56', height = 180, formatValue }: LineChartProps) {
  if (data.length === 0) return <div className="text-xs text-ink-subtle">No data</div>;
  const max = Math.max(1, ...data.map((d) => d.value));
  const min = Math.min(0, ...data.map((d) => d.value));
  const range = max - min || 1;
  const w = 600;
  const h = height;
  const pad = { t: 20, r: 16, b: 24, l: 32 };
  const chartW = w - pad.l - pad.r;
  const chartH = h - pad.t - pad.b;
  const step = data.length > 1 ? chartW / (data.length - 1) : 0;
  const points = data.map((d, i) => {
    const x = pad.l + i * step;
    const y = pad.t + chartH - ((d.value - min) / range) * chartH;
    return { x, y, v: d.value, label: d.label };
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${path} L${points[points.length - 1].x},${pad.t + chartH} L${points[0].x},${pad.t + chartH} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="line-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = pad.t + t * chartH;
        const val = max - t * range;
        return (
          <g key={t}>
            <line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="#E5EBEF" strokeDasharray="3 3" />
            <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#8A99A8">
              {formatValue ? formatValue(val) : Math.round(val)}
            </text>
          </g>
        );
      })}
      <path d={areaPath} fill="url(#line-grad)" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3" fill="#fff" stroke={color} strokeWidth="2" />
          {data.length <= 8 && (
            <text x={p.x} y={h - 6} textAnchor="middle" fontSize="9" fill="#8A99A8">
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

interface HBarChartProps {
  data: { label: string; value: number }[];
  color?: string;
  formatValue?: (n: number) => string;
}

export function HBarChart({ data, color = '#0F6E56', formatValue }: HBarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-ink-muted w-28 truncate flex-shrink-0">{d.label}</span>
          <div className="flex-1 bg-primary-50/50 rounded-full h-5 overflow-hidden">
            <div
              className="h-5 rounded-full flex items-center justify-end pr-2 transition-all"
              style={{ width: `${Math.max(4, (d.value / max) * 100)}%`, backgroundColor: color }}
            >
              <span className="text-[10px] font-semibold text-white">
                {formatValue ? formatValue(d.value) : d.value}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
}

export function DonutChart({ data, size = 160 }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const segments = total === 0 ? [] : data.map((d) => {
    const pct = d.value / total;
    const len = pct * circumference;
    const seg = { color: d.color, dash: `${len} ${circumference - len}`, offset: -offset, label: d.label, value: d.value, pct };
    offset += len;
    return seg;
  });

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg width={size} height={size} className="shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F0F4F6" strokeWidth="12" />
        {segments.map((s, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="12"
            strokeDasharray={s.dash}
            strokeDashoffset={s.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeLinecap="butt"
          />
        ))}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="18" fontWeight="700" fill="#0F1B2C">
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" fill="#8A99A8">
          TOTAL
        </text>
      </svg>
      <div className="space-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-ink-muted">{d.label}</span>
            <span className="font-semibold text-ink ml-auto">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  label?: string;
  rightText?: string;
}

export function ProgressBar({ value, max = 100, color = '#0F6E56', label, rightText }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div>
      {(label || rightText) && (
        <div className="flex items-center justify-between mb-1">
          {label && <span className="text-xs font-medium text-ink-muted">{label}</span>}
          {rightText && <span className="text-xs font-semibold text-ink">{rightText}</span>}
        </div>
      )}
      <div className="bg-primary-50/60 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

interface ProgressRingProps {
  value: number;
  size?: number;
  color?: string;
  label?: string;
}

export function ProgressRing({ value, size = 96, color = '#0F6E56', label }: ProgressRingProps) {
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const off = circ - (value / 100) * circ;
  const cx = size / 2;
  return (
    <div className="inline-flex flex-col items-center">
      <svg width={size} height={size}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#E5EBEF" strokeWidth="6" />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circ}
          strokeDashoffset={off}
          transform={`rotate(-90 ${cx} ${cx})`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s' }}
        />
        <text x={cx} y={cx + 5} textAnchor="middle" fontSize="16" fontWeight="700" fill={color}>
          {Math.round(value)}%
        </text>
      </svg>
      {label && <span className="text-xs font-medium text-ink-muted mt-1">{label}</span>}
    </div>
  );
}
