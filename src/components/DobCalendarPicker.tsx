import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';
import { formatDate, parseDateArg, formatDobForInput, localDateISO } from '../lib/format';

interface DobCalendarPickerProps {
  value: string; // YYYY-MM-DD
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function DobCalendarPicker({
  value,
  onChange,
  placeholder = 'Select Date of Birth',
  className = '',
  disabled = false,
}: DobCalendarPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial selected date or default to a reasonable adult year (e.g., 2000)
  const initialDate = value ? parseDateArg(value) : null;
  const validInitial = initialDate && !isNaN(initialDate.getTime()) ? initialDate : null;

  const today = new Date();
  const currentYear = today.getFullYear();
  const todayISO = localDateISO(today);

  const [viewYear, setViewYear] = useState<number>(
    validInitial ? validInitial.getFullYear() : 2000
  );
  const [viewMonth, setViewMonth] = useState<number>(
    validInitial ? validInitial.getMonth() : 0
  );

  // Sync internal view when value changes externally
  useEffect(() => {
    if (value) {
      const parsed = parseDateArg(value);
      if (!isNaN(parsed.getTime())) {
        setViewYear(parsed.getFullYear());
        setViewMonth(parsed.getMonth());
      }
    }
  }, [value]);

  // Close calendar popup when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Generate Year options from current year down to 1910
  const years: number[] = [];
  for (let y = currentYear; y >= 1910; y--) {
    years.push(y);
  }

  // Days in selected view month
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  // Navigation handlers
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(prev => prev - 1);
      setViewMonth(11);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const nextMonth = () => {
    if (viewYear === currentYear && viewMonth >= today.getMonth()) return;
    if (viewMonth === 11) {
      setViewYear(prev => prev + 1);
      setViewMonth(0);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const iso = `${viewYear}-${mm}-${dd}`;
    onChange(iso);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const formattedDisplay = (() => {
    if (!value) return '';
    try {
      const parsed = parseDateArg(value);
      if (isNaN(parsed.getTime())) return '';
      const day = String(parsed.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[parsed.getMonth()];
      const year = parsed.getFullYear();
      return `${day} ${month} ${year}`;
    } catch {
      return '';
    }
  })();

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Input Display Button */}
      <div
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        className={`flex items-center justify-between w-full h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-sm cursor-pointer transition shadow-xs hover:border-[#106EBE] focus-within:border-[#106EBE] ${
          disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <CalendarIcon size={16} className="text-[#106EBE] shrink-0" />
          <span className={`text-sm ${formattedDisplay ? 'font-semibold text-black font-mono tracking-wide' : 'text-slate-400'}`}>
            {formattedDisplay || 'DD / MM / YYYY'}
          </span>
        </div>

        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition shrink-0 ml-1"
            title="Clear date"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Calendar Popup Dropdown */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 sm:right-auto sm:w-80 mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-150">
          {/* Header Controls: Month & Year Selectors */}
          <div className="flex items-center justify-between gap-1 mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition"
              title="Previous month"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-1.5 flex-1 justify-center">
              {/* Month Dropdown */}
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 rounded-lg px-2 py-1 focus:outline-none focus:border-[#106EBE]"
              >
                {MONTH_NAMES.map((name, idx) => {
                  const isFuture = viewYear === currentYear && idx > today.getMonth();
                  return (
                    <option key={name} value={idx} disabled={isFuture}>
                      {name}
                    </option>
                  );
                })}
              </select>

              {/* Year Dropdown */}
              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 rounded-lg px-2 py-1 focus:outline-none focus:border-[#106EBE]"
              >
                {years.map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={nextMonth}
              disabled={viewYear === currentYear && viewMonth >= today.getMonth()}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400 mb-1">
            {DAYS_OF_WEEK.map(d => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Blank offset cells for first day of month */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8" />
            ))}

            {/* Days of current month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const mm = String(viewMonth + 1).padStart(2, '0');
              const dd = String(day).padStart(2, '0');
              const cellISO = `${viewYear}-${mm}-${dd}`;
              const isSelected = formatDobForInput(value) === cellISO;
              const isFuture = cellISO > todayISO;

              return (
                <button
                  key={day}
                  type="button"
                  disabled={isFuture}
                  onClick={() => handleSelectDay(day)}
                  className={`h-8 w-8 mx-auto rounded-xl text-xs font-semibold flex items-center justify-center transition ${
                    isSelected
                      ? 'bg-[#106EBE] text-white shadow-sm font-bold'
                      : isFuture
                      ? 'text-slate-200 cursor-not-allowed'
                      : 'text-slate-700 hover:bg-[#0FFCBE]/20 hover:text-black'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer Quick Actions */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className="text-slate-400 hover:text-rose-500 font-medium"
            >
              Clear
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 bg-[#106EBE] text-white rounded-lg font-semibold hover:bg-[#0D5A9C] transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
