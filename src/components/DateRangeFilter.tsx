import React, { useState } from 'react';
import { Calendar, X, Filter } from 'lucide-react';
import { type DateRangePreset, formatDobForInput } from '../lib/format';

export interface DateRangeFilterProps {
  preset: DateRangePreset;
  onPresetChange: (preset: DateRangePreset) => void;
  customStart?: string;
  onCustomStartChange?: (date: string) => void;
  customEnd?: string;
  onCustomEndChange?: (date: string) => void;
  className?: string;
  label?: string;
}

export function DateRangeFilter({
  preset,
  onPresetChange,
  customStart = '',
  onCustomStartChange,
  customEnd = '',
  onCustomEndChange,
  className = '',
  label,
}: DateRangeFilterProps) {
  const [showCustomInputs, setShowCustomInputs] = useState(preset === 'custom');

  const presets: { id: DateRangePreset; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: '3months', label: '3 Months' },
    { id: 'all', label: 'All Time' },
    { id: 'custom', label: 'Custom' },
  ];

  const handleSelect = (id: DateRangePreset) => {
    onPresetChange(id);
    if (id === 'custom') {
      setShowCustomInputs(true);
    } else {
      setShowCustomInputs(false);
    }
  };

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap ${className}`}>
      {label && (
        <span className="text-xs font-semibold text-ink-muted flex items-center gap-1 shrink-0">
          <Calendar size={13} className="text-primary" />
          {label}:
        </span>
      )}

      {/* Preset Pill Buttons */}
      <div className="inline-flex items-center p-1 bg-surface-elevated border border-divider/60 rounded-xl gap-1 shrink-0 shadow-xs">
        {presets.map((p) => {
          const active = preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelect(p.id)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                active
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-ink-muted hover:text-ink hover:bg-black/5'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Custom Date Pickers */}
      {(preset === 'custom' || showCustomInputs) && (
        <div className="flex items-center gap-1.5 bg-surface-elevated border border-divider/60 p-1 rounded-xl text-xs shadow-xs animate-in fade-in duration-200">
          <span className="text-ink-subtle pl-1 text-[11px] font-medium">From:</span>
          <input
            type="date"
            value={formatDobForInput(customStart)}
            onChange={(e) => {
              onCustomStartChange?.(e.target.value);
              onPresetChange('custom');
            }}
            className="px-2 py-0.5 bg-white border border-divider/50 rounded-md text-ink text-xs focus:ring-1 focus:ring-primary focus:outline-none"
          />
          <span className="text-ink-subtle text-[11px] font-medium">To:</span>
          <input
            type="date"
            value={formatDobForInput(customEnd)}
            onChange={(e) => {
              onCustomEndChange?.(e.target.value);
              onPresetChange('custom');
            }}
            className="px-2 py-0.5 bg-white border border-divider/50 rounded-md text-ink text-xs focus:ring-1 focus:ring-primary focus:outline-none"
          />
          {(customStart || customEnd) && (
            <button
              type="button"
              onClick={() => {
                onCustomStartChange?.('');
                onCustomEndChange?.('');
              }}
              title="Clear custom range"
              className="p-1 text-ink-subtle hover:text-ink rounded"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
