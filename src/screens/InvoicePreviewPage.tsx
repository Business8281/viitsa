import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Palette, Printer, Download, Save, CheckCircle2, 
  RotateCcw, Sliders, Eye, FileText, Sparkles, Building2, 
  ChevronRight, Check, QrCode, Shield, Layers, HelpCircle
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { InvoiceView, type InvoiceTemplateStyle, type InvoiceCustomizationOptions } from '../components/InvoiceView';
import { useToast } from '../lib/toast';
import { downloadInvoicePDF } from '../lib/pdf';
import type { Invoice, Clinic, Patient, User as Doctor } from '../lib/types';

export function InvoicePreviewPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clinic, user } = useAuth();
  const { toast } = useToast();

  const invoiceId = searchParams.get('id') || searchParams.get('invoiceId');

  // Loaded real data (if invoiceId provided)
  const [realInvoice, setRealInvoice] = useState<Invoice | null>(null);
  const [loadingReal, setLoadingReal] = useState(Boolean(invoiceId));

  // Customization state
  const [templateStyle, setTemplateStyle] = useState<InvoiceTemplateStyle>('modern');
  const [accentColor, setAccentColor] = useState<string>('#059669');
  const [showPlatformBranding, setShowPlatformBranding] = useState<boolean>(true);
  const [showSignatureBox, setShowSignatureBox] = useState<boolean>(true);
  const [showUpiQr, setShowUpiQr] = useState<boolean>(true);
  const [customTerms, setCustomTerms] = useState<string>('Thank you for your visit. Computer-generated tax invoice. No signature required.');
  const [useSampleData, setUseSampleData] = useState<boolean>(!invoiceId);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Initialize from clinic's existing invoice_settings if present
  useEffect(() => {
    if (!clinic) return;
    const settings = (clinic as any)?.invoice_settings || (clinic as any)?.invoice_customization;
    if (settings) {
      if (settings.template_style) setTemplateStyle(settings.template_style);
      if (settings.accent_color) setAccentColor(settings.accent_color);
      if (settings.show_platform_branding !== undefined) setShowPlatformBranding(settings.show_platform_branding);
      if (settings.show_signature_box !== undefined) setShowSignatureBox(settings.show_signature_box);
      if (settings.show_upi_qr !== undefined) setShowUpiQr(settings.show_upi_qr);
      if (settings.custom_terms) setCustomTerms(settings.custom_terms);
    }
  }, [clinic]);

  // Load real invoice if query param exists
  useEffect(() => {
    if (!invoiceId) {
      setLoadingReal(false);
      return;
    }
    let isMounted = true;
    async function loadInvoice() {
      try {
        setLoadingReal(true);
        const invSnap = await getDoc(doc(db, 'invoices', invoiceId!));
        if (invSnap.exists() && isMounted) {
          setRealInvoice({ id: invSnap.id, ...invSnap.data() } as Invoice);
          setUseSampleData(false);
        } else {
          // Check bills collection as fallback
          const billSnap = await getDoc(doc(db, 'bills', invoiceId!));
          if (billSnap.exists() && isMounted) {
            setRealInvoice({ id: billSnap.id, ...billSnap.data() } as Invoice);
            setUseSampleData(false);
          }
        }
      } catch (err) {
        console.error('Error fetching invoice:', err);
      } finally {
        if (isMounted) setLoadingReal(false);
      }
    }
    loadInvoice();
    return () => { isMounted = false; };
  }, [invoiceId]);

  // Mock sample invoice data
  const sampleInvoice: Invoice = useMemo(() => {
    const today = new Date();
    return {
      id: 'INV-2026-08492',
      invoice_number: 'INV-2026-08492',
      receipt_number: 'RCP-8921',
      visit_date: today.toISOString(),
      created_at: today.toISOString(),
      payment_status: 'paid',
      payment_method: 'upi',
      status: 'paid',
      subtotal: 1450,
      discount_amount: 100,
      tax: 0,
      total: 1350,
      amount: 1350,
      amount_paid: 1350,
      balance_due: 0,
      notes: 'Follow-up recommended in 5 days if fever persists. Take prescribed medications with food.',
      visit_type: 'new-visit',
      line_items: [
        {
          category: 'Consultation Fee',
          description: 'Specialist General Physician Consultation',
          quantity: 1,
          amount: 500,
          unit_price: 500
        },
        {
          category: 'Pharmacy',
          description: 'Tab. Paracetamol 650mg (Strip of 10) + Amoxicillin 500mg',
          quantity: 2,
          amount: 350,
          unit_price: 175
        },
        {
          category: 'Diagnostics & Lab',
          description: 'Complete Blood Count (CBC) with Platelet Indices',
          quantity: 1,
          amount: 450,
          unit_price: 450
        },
        {
          category: 'Procedure',
          description: 'Digital Vital Signs & Oxygen Saturation Check',
          quantity: 1,
          amount: 150,
          unit_price: 150
        }
      ]
    } as any;
  }, []);

  const samplePatient: Patient = useMemo(() => ({
    patient_id: 'PAT-00918',
    name: 'Aarav Sharma',
    phone: '+91 98765 43210',
    email: 'aarav.sharma@example.com',
    gender: 'Male',
    age: 34,
    display_id: 'UHID-2026-918',
    created_at: new Date().toISOString()
  } as any), []);

  const sampleDoctor: Doctor = useMemo(() => ({
    user_id: 'DOC-101',
    id: 'DOC-101',
    name: user?.name ? (user.name.startsWith('Dr.') ? user.name : `Dr. ${user.name}`) : 'Dr. Samantha Rao, MD',
    role: 'clinic_doctor',
    clinic_id: clinic?.clinic_id || 'DEMO-CLINIC',
    specialisation: (user as any)?.specialisation || 'Internal Medicine & Cardiology',
    email: user?.email || 'doctor@viitsa.com',
    phone: user?.phone || '+91 94400 12345',
    active: true
  } as any), [user, clinic]);

  const activeInvoice = useSampleData || !realInvoice ? sampleInvoice : realInvoice;
  const activePatient = (activeInvoice as any).patient || samplePatient;
  const activeDoctor = (activeInvoice as any).doctor || sampleDoctor;
  const activeClinic: Clinic = clinic || {
    clinic_id: 'DEMO-CLINIC',
    name: 'Apollo City Care Clinic',
    address: '42, Health City Boulevard, Near Metro Pillar 114, Jubilee Hills',
    city: 'Hyderabad, Telangana 500033',
    phone: '+91 73961 11081',
    email: 'care@apollocitycare.com',
    logo_url: null,
    gstin: '36AAAAA0000A1Z5',
    registration_number: 'TS/MED/2024/99120',
    owner_name: 'Dr. Samantha Rao',
    working_hours: { open: '09:00', close: '20:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
    created_at: new Date().toISOString()
  };

  const customizationOptions: InvoiceCustomizationOptions = useMemo(() => ({
    templateStyle,
    accentColor,
    showPlatformBranding,
    showSignatureBox,
    showUpiQr,
    customTerms
  }), [templateStyle, accentColor, showPlatformBranding, showSignatureBox, showUpiQr, customTerms]);

  // Save as clinic default
  const handleSaveClinicSettings = async () => {
    if (!clinic?.clinic_id) {
      toast('Please login as a clinic admin to save preferences permanently.', 'warning');
      return;
    }
    try {
      setSavingSettings(true);
      const payload = {
        template_style: templateStyle,
        accent_color: accentColor,
        show_platform_branding: showPlatformBranding,
        show_signature_box: showSignatureBox,
        show_upi_qr: showUpiQr,
        custom_terms: customTerms,
        updated_at: new Date().toISOString()
      };

      // 1. Update clinic_settings collection
      await setDoc(doc(db, 'clinic_settings', clinic.clinic_id), {
        clinic_id: clinic.clinic_id,
        invoice_settings: payload
      }, { merge: true });

      // 2. Also update clinics collection document
      await updateDoc(doc(db, 'clinics', clinic.clinic_id), {
        invoice_settings: payload
      }).catch(() => {});

      toast('Invoice template design saved as default for your clinic!', 'success');
    } catch (err: any) {
      console.error('Save error:', err);
      toast('Failed to save settings: ' + (err?.message || 'Unknown error'), 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const colorPresets = [
    { label: 'Viitsa Teal', hex: '#0F6E56', class: 'bg-[#0F6E56]' },
    { label: 'Navy Sapphire', hex: '#1E3A8A', class: 'bg-[#1E3A8A]' },
    { label: 'Medical Emerald', hex: '#059669', class: 'bg-[#059669]' },
    { label: 'Sky Azure', hex: '#0284C7', class: 'bg-[#0284C7]' },
    { label: 'Modern Indigo', hex: '#4F46E5', class: 'bg-[#4F46E5]' },
    { label: 'Executive Slate', hex: '#334155', class: 'bg-[#334155]' },
  ];

  const templateOptions = [
    {
      id: 'modern' as InvoiceTemplateStyle,
      title: 'Modern Medical',
      badge: 'Recommended',
      description: 'Dual card summary, rounded medical category icons, and high-contrast grand total callout.'
    },
    {
      id: 'minimal' as InvoiceTemplateStyle,
      title: 'Clean Minimalist',
      badge: 'Ink Efficient',
      description: 'Streamlined monochrome grid with low ink density, compact whitespace, and discrete borders.'
    },
    {
      id: 'classic' as InvoiceTemplateStyle,
      title: 'Classic Hospital',
      badge: 'Formal',
      description: 'Traditional hospital letterhead style with legal tax registration headers and authorized signatory block.'
    },
    {
      id: 'executive' as InvoiceTemplateStyle,
      title: 'Executive Navy',
      badge: 'Corporate',
      description: 'Premium corporate border banners, distinct balance due blocks, and instant UPI verification stamp.'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 py-3 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/clinic/billing')}
              className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
              title="Return to Billing"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center">
                  <Palette size={14} />
                </div>
                <h1 className="text-base font-bold text-slate-900">Invoice Template Studio</h1>
                <span className="badge bg-teal-100/70 text-teal-900 text-[10px] font-bold uppercase tracking-wider">
                  Live Preview & Customizer
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Route: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono text-teal-900">/invoice-preview</code> · Source: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-700">src/components/InvoiceView.tsx</code>
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Sample vs Real toggle */}
            {realInvoice && (
              <button
                type="button"
                onClick={() => setUseSampleData(!useSampleData)}
                className="btn-outline text-xs px-2.5 py-1.5"
              >
                {useSampleData ? 'Show Real Bill' : 'Show Sample Bill'}
              </button>
            )}

            <button
              type="button"
              onClick={() => downloadInvoicePDF(activeInvoice, activeClinic, activePatient?.name ?? 'Patient')}
              className="btn-outline text-xs px-3 py-1.5 flex items-center gap-1.5 font-semibold"
            >
              <Download size={14} /> PDF
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="btn-outline text-xs px-3 py-1.5 flex items-center gap-1.5 font-semibold"
            >
              <Printer size={14} /> Print
            </button>

            <button
              type="button"
              onClick={handleSaveClinicSettings}
              disabled={savingSettings}
              className="btn-primary text-xs px-3.5 py-1.5 flex items-center gap-1.5 font-bold shadow-xs"
            >
              <Save size={14} />
              {savingSettings ? 'Saving...' : 'Set as Clinic Default'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout: Left Sidebar Controls + Right Live Canvas */}
      <div className="max-w-7xl mx-auto w-full p-4 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Controls Sidebar (4 cols on lg) */}
        <aside className="lg:col-span-4 space-y-4">
          
          {/* 1. Template Design Picker */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={14} className="text-teal-700" /> 1. Select Template Layout
              </h2>
              <span className="text-[11px] text-slate-400 font-medium">4 Styles Available</span>
            </div>

            <div className="space-y-2">
              {templateOptions.map((opt) => {
                const isSelected = templateStyle === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTemplateStyle(opt.id)}
                    className={`w-full text-left p-3 rounded-xl border transition cursor-pointer flex flex-col gap-1 ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/50 ring-2 ring-teal-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center border text-[10px] ${
                          isSelected ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <Check size={10} strokeWidth={3} />}
                        </div>
                        <span className="text-sm font-bold text-slate-900">{opt.title}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isSelected ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {opt.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed pl-6">
                      {opt.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Color Theme Picker */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Palette size={14} className="text-teal-700" /> 2. Accent Color
            </h2>

            <div className="grid grid-cols-3 gap-2">
              {colorPresets.map((c) => {
                const active = accentColor.toLowerCase() === c.hex.toLowerCase();
                return (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setAccentColor(c.hex)}
                    className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 transition cursor-pointer ${
                      active ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-lg ${c.class} shadow-2xs flex items-center justify-center`}>
                      {active && <Check size={12} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-700 truncate w-full text-center">
                      {c.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Layout Options & Toggles */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3.5">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders size={14} className="text-teal-700" /> 3. Sections & Features
            </h2>

            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 cursor-pointer">
                <div>
                  <p className="font-semibold text-slate-900">VIITSA Platform Badges</p>
                  <p className="text-[11px] text-slate-500">Show security & patient engagement footer</p>
                </div>
                <input
                  type="checkbox"
                  checked={showPlatformBranding}
                  onChange={(e) => setShowPlatformBranding(e.target.checked)}
                  className="rounded text-teal-700 focus:ring-teal-500 h-4 w-4"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 cursor-pointer">
                <div>
                  <p className="font-semibold text-slate-900">Authorized Signature Box</p>
                  <p className="text-[11px] text-slate-500">Official stamp & medical signatory line</p>
                </div>
                <input
                  type="checkbox"
                  checked={showSignatureBox}
                  onChange={(e) => setShowSignatureBox(e.target.checked)}
                  className="rounded text-teal-700 focus:ring-teal-500 h-4 w-4"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 cursor-pointer">
                <div>
                  <p className="font-semibold text-slate-900">UPI QR / Payment Stamp</p>
                  <p className="text-[11px] text-slate-500">Instant UPI payment QR code for pending dues</p>
                </div>
                <input
                  type="checkbox"
                  checked={showUpiQr}
                  onChange={(e) => setShowUpiQr(e.target.checked)}
                  className="rounded text-teal-700 focus:ring-teal-500 h-4 w-4"
                />
              </label>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Custom Invoice Footer / Legal Terms
              </label>
              <textarea
                rows={2}
                value={customTerms}
                onChange={(e) => setCustomTerms(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                placeholder="e.g. Computer-generated tax invoice..."
              />
            </div>
          </div>

          {/* 4. Quick Code Reference & Direct Link */}
          <div className="bg-slate-900 text-slate-300 rounded-2xl p-4 text-xs space-y-2 shadow-sm">
            <div className="flex items-center justify-between text-white font-bold">
              <span className="flex items-center gap-1.5"><FileText size={14} className="text-teal-400" /> Developer File Info</span>
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded font-mono text-teal-300">React + PDF</span>
            </div>
            <p className="text-[11px] text-slate-400">
              To edit the underlying HTML/Tailwind templates directly, open:
            </p>
            <p className="font-mono text-[11px] text-emerald-400 break-all bg-slate-800/80 p-2 rounded-lg border border-slate-700">
              src/components/InvoiceView.tsx
            </p>
            <p className="text-[11px] text-slate-400 pt-1">
              Changes reflect instantly in both online screen modal and downloaded high-resolution A4 PDF.
            </p>
          </div>
        </aside>

        {/* Live Preview Canvas (8 cols on lg) */}
        <main className="lg:col-span-8 flex flex-col items-center">
          {/* Canvas Bar: Zoom & Status */}
          <div className="w-full bg-white px-4 py-2 rounded-t-2xl border border-slate-200 border-b-0 flex items-center justify-between text-xs text-slate-600 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">A4 Document Sheet</span>
              <span className="text-[11px] text-slate-400">· 210mm × 297mm Standard Print</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold">Scale:</span>
              {[75, 90, 100].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZoomLevel(z)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                    zoomLevel === z ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {z}%
                </button>
              ))}
            </div>
          </div>

          {/* Sheet Frame with scale */}
          <div className="w-full bg-slate-200/60 p-4 sm:p-6 rounded-b-2xl border border-slate-200 overflow-x-auto flex justify-center shadow-inner">
            <div 
              style={{ 
                transform: `scale(${zoomLevel / 100})`, 
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease-out'
              }}
              className="shadow-2xl rounded-sm"
            >
              <InvoiceView
                invoice={activeInvoice}
                clinic={activeClinic}
                patient={activePatient}
                doctor={activeDoctor}
                customizationOptions={customizationOptions}
              />
            </div>
          </div>
        </main>

      </div>
    </div>
  );
}
