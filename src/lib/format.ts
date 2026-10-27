export function parseDateArg(d: any): Date {
  if (!d) return new Date(NaN);
  if (d instanceof Date) return isNaN(d.getTime()) ? new Date(NaN) : d;
  if (typeof d?.toDate === 'function') {
    try {
      const dt = d.toDate();
      if (dt instanceof Date && !isNaN(dt.getTime())) return dt;
    } catch {}
  }
  if (typeof d?.toMillis === 'function') {
    try {
      const ms = d.toMillis();
      if (typeof ms === 'number' && !isNaN(ms)) return new Date(ms);
    } catch {}
  }
  if (typeof d === 'number') return isNaN(d) ? new Date(NaN) : new Date(d);
  if (typeof d === 'object' && d !== null) {
    if (typeof d.seconds === 'number') return new Date(d.seconds * 1000 + Math.floor((d.nanoseconds || 0) / 1e6));
    if (typeof d._seconds === 'number') return new Date(d._seconds * 1000 + Math.floor((d._nanoseconds || 0) / 1e6));
  }
  if (typeof d !== 'string') return new Date(NaN);
  const trimmed = d.trim();
  if (!trimmed || trimmed === '—' || trimmed === 'undefined' || trimmed === 'null') return new Date(NaN);

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parts = trimmed.split('-');
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }

  // 1. Support YYYY-MM-DD or YYYY/MM/DD (Universal Safari & Chromium fix: avoids UTC shift)
  const ymd = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymd) {
    const year = parseInt(ymd[1], 10);
    const month = parseInt(ymd[2], 10) - 1;
    const day = parseInt(ymd[3], 10);
    const parsed = new Date(year, month, day);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  // 2. Support DD-MM-YYYY or DD/MM/YYYY formats
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10) - 1;
    const year = parseInt(ddmmyyyy[3], 10);
    const parsed = new Date(year, month, day);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  // 3. Match ISO strings with optional time: YYYY-MM-DDTHH:mm:ss or YYYY-MM-DD HH:mm:ss
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (isoMatch) {
    const parsed = new Date(
      parseInt(isoMatch[1], 10),
      parseInt(isoMatch[2], 10) - 1,
      parseInt(isoMatch[3], 10),
      parseInt(isoMatch[4], 10),
      parseInt(isoMatch[5], 10),
      isoMatch[6] ? parseInt(isoMatch[6], 10) : 0
    );
    if (!isNaN(parsed.getTime())) return parsed;
  }

  const dt = new Date(trimmed);
  if (!isNaN(dt.getTime())) return dt;

  // 4. Safari fallback: replace dashes with slashes
  const safariSafe = trimmed.replace(/-/g, '/').replace(/T/g, ' ');
  const dtSafari = new Date(safariSafe);
  return isNaN(dtSafari.getTime()) ? new Date(NaN) : dtSafari;
}

/**
 * Calculates current age in full years from any DOB representation.
 * 100% resilient across Safari, iOS WebKit, Chrome, Firefox, and Edge.
 */
export function calculateAge(dobInput: any): number | null {
  if (!dobInput) return null;
  const birthDate = parseDateArg(dobInput);
  if (isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 && age <= 130 ? age : null;
}

/**
 * Normalizes any DOB string or Date into strictly 'YYYY-MM-DD'
 * Required by Safari to render HTML5 date inputs correctly without blanking out.
 */
export function formatDobForInput(dobInput: any): string {
  if (!dobInput) return '';
  const dt = parseDateArg(dobInput);
  if (isNaN(dt.getTime())) return '';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isSameDay(d1: any, d2: any = new Date()): boolean {
  if (!d1) return false;
  if (typeof d1 === 'string' && typeof d2 === 'string' && d1.trim() === d2.trim()) return true;
  const a = parseDateArg(d1);
  const b = parseDateArg(d2);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return false;
  return (
    (a.getFullYear() === b.getFullYear() &&
     a.getMonth() === b.getMonth() &&
     a.getDate() === b.getDate()) ||
    a.toDateString() === b.toDateString()
  );
}

export function isWithinDays(d: any, days: number = 7): boolean {
  const dt = parseDateArg(d);
  if (isNaN(dt.getTime())) return false;
  const now = new Date();
  const diffMs = now.getTime() - dt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= -0.5 && diffDays <= days;
}

export function formatDate(d: any): string {
  try {
    const date = parseDateArg(d);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function formatLongDate(d: any): string {
  try {
    const date = parseDateArg(d);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function formatTime(t: any): string {
  if (!t || typeof t !== 'string') return '—';
  const parts = t.split(':');
  if (!parts.length) return '—';
  const h = parseInt(parts[0], 10);
  if (isNaN(h)) return '—';
  const m = parts[1] ?? '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12.toString().padStart(2, '0')}:${m} ${ampm}`;
}

export function formatRs(n: number): string {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function localDateISO(date: Date = new Date()): string {
  return (
    date.getFullYear() +
    '-' +
    String(date.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(date.getDate()).padStart(2, '0')
  );
}

export function todayISO(): string {
  return localDateISO();
}

export function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'waiting':
      return 'badge-waiting';
    case 'in-progress':
      return 'badge-progress';
    case 'done':
      return 'badge-done';
    case 'urgent':
      return 'badge-urgent';
    case 'cancelled':
      return 'badge-cancelled';
    case 'paid':
      return 'badge-done';
    case 'pending':
      return 'badge-waiting';
    case 'partial':
      return 'badge-progress';
    default:
      return 'badge bg-gray-100 text-gray-600';
  }
}

export function minsBetween(start: string, end: Date = new Date()): number {
  const [h, m] = start.split(':').map(Number);
  const s = new Date();
  s.setHours(h, m, 0, 0);
  return Math.max(0, Math.round((end.getTime() - s.getTime()) / 60000));
}

export function ageGroup(age: number | null): string {
  if (age == null) return 'Unknown';
  if (age < 18) return '0-17';
  if (age < 35) return '18-34';
  if (age < 50) return '35-49';
  if (age < 65) return '50-64';
  return '65+';
}

export function toCSV(rows: Record<string, string | number>[], columns: { key: string; label: string }[]): string {
  const header = columns.map((c) => `"${c.label}"`).join(',');
  const body = rows
    .map((r) =>
      columns
        .map((c) => {
          const v = r[c.key] ?? '';
          return `"${String(v).replace(/"/g, '""')}"`;
        })
        .join(','),
    )
    .join('\n');
  return header + '\n' + body;
}

export function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function whatsappReminderLink(phone: string, patientName: string, date: string, time: string, clinicName: string, clinicPhone: string): string {
  const cleanPhone = phone.replace(/[^\d]/g, '');
  const intl = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
  const msg =
    `Dear ${patientName}, this is a reminder from ${clinicName}.\n` +
    `Your appointment is scheduled for ${date} at ${time}.\n` +
    `Please arrive 10 minutes early. For queries call ${clinicPhone}.\n` +
    `- VIITSA, ${clinicName}`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`;
}

// WhatsApp message templates for all VIITSA notifications

export function whatsappAppointmentConfirmation(patientName: string, clinicName: string, date: string, time: string, doctorName: string): string {
  const msg = `Dear ${patientName}, your appointment at ${clinicName} is confirmed for ${date} at ${time} with ${doctorName}. Please arrive 10 min early. - VIITSA`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

export function whatsappInvoiceMessage(patientName: string, amount: string, clinicName: string, date: string, invoiceNumber: string, status: string): string {
  const msg = `Dear ${patientName}, your invoice of Rs.${amount} from ${clinicName} on ${date} is attached.\nInvoice No: ${invoiceNumber} | Status: ${status.toUpperCase()}\n- VIITSA`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

export function whatsappPaymentReminder(patientName: string, clinicName: string, amount: string, date: string, upiId: string, clinicPhone: string): string {
  const msg = `Dear ${patientName},\n\nThis is a gentle reminder from ${clinicName}.\nYour outstanding balance for your visit on ${date} is Rs. ${amount}.\n\nYou can pay via UPI to: ${upiId}\nPlease mention your name as reference.\n\nFor queries call: ${clinicPhone}\n\nThank you,\n${clinicName} — Powered by VIITSA`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

export function whatsappFollowUpReminder(patientName: string, doctorName: string, clinicName: string, date: string, patientLink: string): string {
  const msg = `Hi ${patientName}, your follow-up with Dr. ${doctorName} at ${clinicName} is due on ${date}.\nBook here: ${patientLink}\n\n- VIITSA`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

export function whatsappMedicineReminder(medicineName: string, dosage: string): string {
  const msg = `Time to take ${medicineName} - ${dosage}.\n\n- VIITSA`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

export function whatsappClinicShareLink(clinicName: string, patientLink: string): string {
  const msg = `Book your appointment at ${clinicName} using this link: ${patientLink}\n\nPowered by VIITSA`;
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
}

export type DateRangePreset = 'all' | 'today' | 'week' | 'month' | '3months' | 'custom';

export function matchesDateRange(
  dateValue: any,
  preset: DateRangePreset,
  customStart?: string,
  customEnd?: string
): boolean {
  if (preset === 'all') return true;
  if (!dateValue) return false;
  const d = parseDateArg(dateValue);
  if (isNaN(d.getTime())) return false;

  const now = new Date();

  if (preset === 'today') {
    return isSameDay(d, now);
  }

  if (preset === 'week') {
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday, 0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 6, 23, 59, 59, 999);
    return d.getTime() >= startOfWeek.getTime() && d.getTime() <= endOfWeek.getTime();
  }

  if (preset === 'month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return d.getTime() >= startOfMonth.getTime() && d.getTime() <= endOfMonth.getTime();
  }

  if (preset === '3months') {
    const start3M = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
    const end3M = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return d.getTime() >= start3M.getTime() && d.getTime() <= end3M.getTime();
  }

  if (preset === 'custom') {
    if (!customStart && !customEnd) return true;
    let valid = true;
    if (customStart) {
      const s = parseDateArg(customStart);
      s.setHours(0, 0, 0, 0);
      if (d.getTime() < s.getTime()) valid = false;
    }
    if (customEnd) {
      const e = parseDateArg(customEnd);
      e.setHours(23, 59, 59, 999);
      if (d.getTime() > e.getTime()) valid = false;
    }
    return valid;
  }

  return true;
}

