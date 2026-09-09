function parseDateArg(d: string | Date): Date {
  if (typeof d !== 'string') return d;
  // Date-only strings (YYYY-MM-DD) must be parsed as local time, not UTC.
  // Appending T00:00:00 makes JS treat it as local rather than UTC midnight.
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T00:00:00') : new Date(d);
}

export function formatDate(d: string | Date): string {
  const date = parseDateArg(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatLongDate(d: string | Date): string {
  const date = parseDateArg(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatTime(t: string): string {
  if (!t) return '—';
  // Accept "HH:mm" or "HH:mm:ss"
  const [hh, mm] = t.split(':');
  const h = parseInt(hh, 10);
  const m = mm ?? '00';
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
