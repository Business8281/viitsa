import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import autoTable from 'jspdf-autotable';
import { formatRs, formatDate } from './format';
import type { Invoice } from './types';
import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export function generateProgrammaticInvoiceBlob(invoice: any, clinic: any, patientName: string): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const idStr = invoice.invoice_number || invoice.id || invoice.invoice_id || 'INV-' + Date.now();
  const dateStr = formatDate(invoice.visit_date || invoice.created_at || new Date());
  const statusStr = String(invoice.payment_status || 'PAID').toUpperCase();
  const amountStr = formatRs(Number(invoice.total || invoice.amount || 0));

  // Brand / Clinic Header
  doc.setFillColor(15, 110, 86); // #0F6E56 Brand Green
  doc.rect(0, 0, 210, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(clinic?.name || 'VIITSA HEALTHCARE', 14, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(220, 245, 235);
  const clinicContact = [clinic?.address, clinic?.phone, clinic?.email].filter(Boolean).join(' | ');
  if (clinicContact) {
    doc.text(clinicContact, 14, 21);
  } else {
    doc.text('Smart Healthcare Management & Patient Billing', 14, 21);
  }

  // Invoice Title & Info Bar
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text('MEDICAL INVOICE & RECEIPT', 14, 38);

  // Metadata Card
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 43, 182, 28, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 43, 182, 28, 2, 2, 'S');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('INVOICE NO:', 18, 51);
  doc.text('DATE:', 18, 59);
  doc.text('PATIENT:', 18, 67);

  doc.setTextColor(15, 23, 42);
  doc.text(String(idStr), 45, 51);
  doc.text(dateStr, 45, 59);
  doc.text(patientName || 'Patient', 45, 67);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('STATUS:', 115, 51);
  doc.text('PAYMENT MODE:', 115, 59);
  if (invoice.receipt_number) {
    doc.text('RECEIPT NO:', 115, 67);
  }

  // Status color
  if (statusStr === 'PAID') {
    doc.setTextColor(16, 149, 102);
  } else if (statusStr === 'PENDING') {
    doc.setTextColor(217, 119, 6);
  } else {
    doc.setTextColor(37, 99, 235);
  }
  doc.text(statusStr, 155, 51);

  doc.setTextColor(15, 23, 42);
  doc.text(String(invoice.payment_method || 'CASH').toUpperCase(), 155, 59);
  if (invoice.receipt_number) {
    doc.text(String(invoice.receipt_number), 155, 67);
  }

  // Table of line items
  const items: any[] = Array.isArray(invoice.line_items) && invoice.line_items.length > 0
    ? invoice.line_items
    : [
        {
          description: invoice.consultation_fee ? 'Doctor Consultation Fee' : 'Medical Services / Consultation',
          amount: Number(invoice.total || invoice.amount || 0)
        }
      ];

  const tableBody = items.map((it: any, idx: number) => [
    idx + 1,
    it.description || 'Medical Service / Consultation',
    it.quantity ? String(it.quantity) : '1',
    formatRs(Number(it.amount || 0))
  ]);

  autoTable(doc, {
    startY: 78,
    margin: { left: 14, right: 14 },
    head: [['#', 'Item / Service Description', 'Qty', 'Amount']],
    body: tableBody,
    headStyles: {
      fillColor: [15, 110, 86],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 100 },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 50, halign: 'right' }
    },
    theme: 'striped'
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 120;

  // Summary box
  const summaryX = 110;
  const summaryY = finalY + 8;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(summaryX, summaryY, 86, 32, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(summaryX, summaryY, 86, 32, 2, 2, 'S');

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('Subtotal:', summaryX + 6, summaryY + 8);
  doc.setTextColor(15, 23, 42);
  doc.text(formatRs(Number(invoice.subtotal || invoice.amount || invoice.total || 0)), summaryX + 78, summaryY + 8, { align: 'right' });

  if (Number(invoice.discount_amount || 0) > 0) {
    doc.setTextColor(100, 116, 139);
    doc.text('Discount:', summaryX + 6, summaryY + 15);
    doc.setTextColor(220, 38, 38);
    doc.text(`-${formatRs(Number(invoice.discount_amount))}`, summaryX + 78, summaryY + 15, { align: 'right' });
  }

  doc.setDrawColor(226, 232, 240);
  doc.line(summaryX + 6, summaryY + 19, summaryX + 80, summaryY + 19);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 110, 86);
  doc.text('Grand Total:', summaryX + 6, summaryY + 27);
  doc.text(amountStr, summaryX + 78, summaryY + 27, { align: 'right' });

  // Notes & Footer
  if (invoice.notes) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Notes: ${invoice.notes}`, 14, summaryY + 12);
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated securely by VIITSA Healthcare Platform • Official Document`, 14, pageHeight - 10);

  return doc.output('blob');
}

export async function generateInvoiceBlob(invoice: any, clinic: any, patientName: string): Promise<Blob> {
  const element = document.getElementById('print-area');
  if (!element) {
    return generateProgrammaticInvoiceBlob(invoice, clinic, patientName);
  }

  // Hide the action buttons temporarily while capturing
  const actionsEl = document.getElementById('invoice-actions');
  if (actionsEl) actionsEl.style.display = 'none';

  const canvas = await html2canvas(element, {
    scale: 2, // High resolution
    useCORS: true,
    backgroundColor: '#ffffff'
  });

  if (actionsEl) actionsEl.style.display = '';

  const imgData = canvas.toDataURL('image/png');
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pdfWidth = doc.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  return doc.output('blob');
}

export async function downloadInvoicePDF(invoice: any, clinic: any, patientName: string) {
  const blob = await generateInvoiceBlob(invoice, clinic, patientName);
  const idStr = invoice.invoice_number || invoice.id || invoice.invoice_id || 'UNKNOWN';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Invoice_${idStr}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function uploadAndGetInvoiceUrl(invoice: any, clinic: any, patientName: string): Promise<string> {
  const blob = await generateInvoiceBlob(invoice, clinic, patientName);
  const idStr = invoice.invoice_number || invoice.id || invoice.invoice_id || 'UNKNOWN';
  const fileRef = ref(storage, `invoices/${clinic?.clinic_id || 'general'}/Invoice_${idStr}_${Date.now()}.pdf`);
  await uploadBytes(fileRef, blob, { contentType: 'application/pdf' });
  return await getDownloadURL(fileRef);
}

export async function shareInvoicePDF(invoice: any, clinic: any, patientName: string) {
  if (!navigator.share) {
    alert("Sharing is not supported on this device/browser.");
    return;
  }

  const pdfBlob = await generateInvoiceBlob(invoice, clinic, patientName);
  const idStr = invoice.invoice_number || invoice.id || invoice.invoice_id || 'UNKNOWN';
  const file = new File([pdfBlob], `Invoice_${idStr}.pdf`, { type: 'application/pdf' });
  
  try {
    await navigator.share({
      title: `Invoice from ${clinic?.name || 'Clinic'}`,
      text: `Here is your invoice for ${formatRs(invoice.amount)}.`,
      files: [file]
    });
  } catch (error) {
    console.error("Error sharing PDF", error);
  }
}

export async function generatePrescriptionBlob(prescriptionNo: string, patientName: string): Promise<Blob> {
  const element = document.getElementById('prescription-print-area');
  if (!element) {
    throw new Error('Prescription print area not found in DOM');
  }

  const canvas = await html2canvas(element, {
    scale: 2, // High resolution for A4 print
    useCORS: true,
    backgroundColor: '#ffffff'
  });

  const imgData = canvas.toDataURL('image/png');
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pdfWidth = doc.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  return doc.output('blob');
}

export async function downloadPrescriptionPDF(prescriptionNo: string, patientName: string) {
  const blob = await generatePrescriptionBlob(prescriptionNo, patientName);
  const cleanNo = (prescriptionNo || 'Prescription').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanName = (patientName || 'Patient').replace(/[^a-zA-Z0-9_-]/g, '_');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Prescription_${cleanNo}_${cleanName}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function downloadBlobFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function sharePdfFileNative(blob: Blob, filename: string, title: string, text: string): Promise<boolean> {
  try {
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title,
        text,
        files: [file]
      });
      return true;
    }
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      console.warn('Native share failed:', err);
    } else {
      return true; // User intentionally cancelled modal
    }
  }
  return false;
}

export async function uploadAndGetPrescriptionUrl(prescriptionNo: string, patientName: string, clinicId?: string): Promise<{ url: string; blob: Blob }> {
  const blob = await generatePrescriptionBlob(prescriptionNo, patientName);
  const cleanNo = (prescriptionNo || 'RX').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileRef = ref(storage, `prescriptions/${clinicId || 'general'}/Prescription_${cleanNo}_${Date.now()}.pdf`);
  await uploadBytes(fileRef, blob, { contentType: 'application/pdf' });
  const url = await getDownloadURL(fileRef);
  return { url, blob };
}

