# VIITSA — Full Project Documentation
### AI Healthcare Intelligence Platform

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [URL & Routing Structure](#4-url--routing-structure)
5. [Authentication System](#5-authentication-system)
6. [Database — Firestore Collections](#6-database--firestore-collections)
7. [Data Models (Types)](#7-data-models-types)
8. [Clinic Portal — All Screens](#8-clinic-portal--all-screens)
9. [Patient Portal — All Screens](#9-patient-portal--all-screens)
10. [AI Systems](#10-ai-systems)
11. [Core Services & Libraries](#11-core-services--libraries)
12. [Components Library](#12-components-library)
13. [Role-Based Access Control](#13-role-based-access-control)
14. [Navigation System](#14-navigation-system)
15. [Payment System](#15-payment-system)
16. [Environment Variables](#16-environment-variables)
17. [File & Folder Structure](#17-file--folder-structure)
18. [End-to-End User Flows](#18-end-to-end-user-flows)

---

## 1. Project Overview

**VIITSA** (name stands for a healthcare platform) is a full-stack, AI-powered clinic management and patient health platform built for Indian healthcare. It serves two primary audiences:

| Audience | Portal | Purpose |
|---|---|---|
| **Clinic Owners / Admins** | Clinic Portal (`/clinic/*`) | Manage patients, appointments, billing, inventory, analytics |
| **Doctors** | Clinic Portal (restricted) | View queue, consult patients, see dashboard |
| **Clinic Staff** | Clinic Portal (restricted) | Appointments, billing, patient registration |
| **Patients** | Patient Portal (`/patient/*`) | Book appointments, view records, AI health check, payments |

**Key differentiator**: VIITSA integrates a **multilingual AI Health Navigator** that conducts pre-consultation symptom triage in English, Hindi, and Telugu — generating structured triage reports for doctors before the patient even sits down.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 18 + TypeScript |
| **Bundler / Dev Server** | Vite 5 |
| **Styling** | Vanilla CSS (custom design system in `index.css`) |
| **Routing** | React Router DOM v6 |
| **Authentication** | Firebase Auth (Email/Password, Email Link, Google OAuth, Phone OTP) |
| **Database** | Cloud Firestore (NoSQL) |
| **AI Backend** | Firebase Cloud Functions (`aiChat` callable function → LLM) |
| **Icons** | Lucide React |
| **Charts** | Custom SVG charts (`Charts.tsx`) |
| **Hosting** | Vercel (auto-deploys from GitHub) |
| **Source Control** | GitHub (repo: `Business8281/viitsa`) |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        VIITSA App (React + Vite)                │
│                                                                 │
│  ┌───────────────────┐      ┌───────────────────────────────┐  │
│  │  Clinic Portal    │      │      Patient Portal           │  │
│  │  /clinic/*        │      │      /patient/*               │  │
│  │                   │      │                               │  │
│  │  Admin Dashboard  │      │  Home / AI Chat / Booking     │  │
│  │  Doctor Dashboard │      │  Records / Payments           │  │
│  │  Appointments     │      │  Family Vault / Timeline      │  │
│  │  Billing          │      │                               │  │
│  │  Inventory        │      │                               │  │
│  │  Analytics        │      │                               │  │
│  │  AI Navigator     │      │                               │  │
│  │  Settings         │      │                               │  │
│  └────────┬──────────┘      └───────────┬───────────────────┘  │
│           │                             │                       │
│           └──────────────┬──────────────┘                       │
│                          ▼                                       │
│              Firebase Auth + Firestore                          │
│              Firebase Cloud Functions (AI)                      │
└─────────────────────────────────────────────────────────────────┘
```

**Provider hierarchy** (wraps entire app):
```
<BrowserRouter>
  <ToastProvider>        ← Global toast/notification messages
    <AuthProvider>       ← Admin/Doctor/Staff auth session
      <AppRoutes />      ← All routing
```

For the Patient Portal, an extra provider wraps it:
```
<PatientAuthProvider>    ← Patient phone-based auth session
  <PatientInner />
```

---

## 4. URL & Routing Structure

### Public Routes
| URL | Component | Description |
|---|---|---|
| `/` | `LandingPage` | Marketing homepage |
| `/login` | `AuthLoginPage` | Clinic staff login |
| `/register` | `AuthRegisterPage` | New clinic registration |
| `/setup` | `SetupWizardPage` | Post-registration clinic setup |

### Clinic Portal (Protected — requires login)
| URL | Component | Role Access |
|---|---|---|
| `/clinic` | Redirects → `/clinic/dashboard` | — |
| `/clinic/dashboard` | `DashboardScreen` or `DoctorDashboard` | All |
| `/clinic/patients` | `PatientsScreen` | All |
| `/clinic/appointments` | `AppointmentsScreen` | All |
| `/clinic/billing` | `BillingScreen` | Admin, Staff |
| `/clinic/inventory` | `InventoryScreen` | Admin, Staff |
| `/clinic/ai-navigator` | `AINavigatorScreen` | Admin, Doctor |
| `/clinic/analytics` | `AnalyticsScreen` | Admin |
| `/clinic/settings` | `SettingsScreen` | Admin |

> **Role-based redirect**: If a user navigates to a page their role doesn't have access to, they are redirected to `/clinic/dashboard`.

### Patient Portal (No login required to browse; OTP to book)
| URL | Component | Description |
|---|---|---|
| `/patient` | Redirects → `/patient/dashboard` | — |
| `/patient/dashboard` | `PatientHome` | Overview, upcoming appointments |
| `/patient/ai` | `PatientAINavigator` | AI symptom chat |
| `/patient/book` | `PatientBooking` | Book an appointment |
| `/patient/records` | `PatientRecords` | Health records & reports |
| `/patient/payments` | `PatientPayments` | Bills & invoices |
| `/patient/profile` | `PatientProfile` | Update profile |
| `/patient/family` | `FamilyVault` | Family member health records |
| `/patient/timeline` | `HealthTimeline` | Health history timeline |
| `/patient/doctors` | `PatientDoctorSearch` | Search for doctors |

---

## 5. Authentication System

VIITSA has **two completely separate auth flows** — one for clinic staff, one for patients.

### 5.1 Clinic Staff Auth (`src/lib/auth.tsx`)

**State managed by**: `AuthProvider` (wraps the entire app)

**Login methods available**:
1. **Email + Password** — via `signInWithEmailAndPassword`
2. **Email Magic Link** (OTP) — via `sendSignInLinkToEmail` + `signInWithEmailLink`
3. **Google Sign-In** — via `signInWithPopup(GoogleAuthProvider)` — auto-creates clinic profile if first-time

**What happens on login**:
1. Firebase Auth authenticates the user
2. `loadProfile(email)` queries the `users` Firestore collection by email
3. If user found + active → loads their `Clinic` data from `clinics` collection
4. Sets `user` and `clinic` in React context
5. App redirects to `/clinic/dashboard`

**What happens if Google user is new**:
- Auto-creates a new `Clinic` document in Firestore
- Auto-creates a new `User` document with `role: 'admin'`
- Grants immediate access

**Context values exposed** (`useAuth()`):
```typescript
user: User | null        // Logged-in staff user
clinic: Clinic | null    // Their clinic's data
loading: boolean         // Auth state loading
login(email, password)   // Email/password login
loginWithGoogle()        // Google OAuth login
loginWithOtp(email)      // Send magic link
verifyEmailOtp(...)      // Verify magic link
logout()                 // Sign out
refreshSession()         // Reload profile from Firestore
```

### 5.2 Patient Auth (`src/lib/patientAuth.tsx`)

**Login method**: Phone OTP via Firebase Phone Auth (`signInWithPhoneNumber`)

**State stored in**: `localStorage` (key: `viitsa_patient_v1`) — so patients stay logged in between visits

**What happens on OTP login**:
1. Patient enters phone number
2. Firebase sends OTP via SMS (invisible reCAPTCHA used)
3. Patient confirms OTP → `confirmationResult.confirm(otp)`
4. System checks if `patient_accounts` doc exists for this phone
5. If new → creates account with `name: 'New Patient'` (user registers profile next)
6. If existing → loads profile + links to clinic

**Context values exposed** (`usePatientAuth()`):
```typescript
account: PatientAccount | null   // Logged-in patient
clinic: Clinic | null            // Clinic they're visiting
clinicId: string | null          // Current clinic ID
sendOtp(phone)                   // Send OTP
verifyOtp(phone, otp)            // Verify OTP
register(data)                   // Complete profile
updateProfile(data)              // Edit profile
logout()                         // Sign out
setClinicId(id)                  // Set active clinic
```

---

## 6. Database — Firestore Collections

All data lives in **Cloud Firestore** under the project `viitsadb`.

| Collection | Purpose | Key Fields |
|---|---|---|
| `clinics` | Clinic profiles | `name`, `city`, `phone`, `working_hours` |
| `users` | Staff (Admin/Doctor/Staff) | `email`, `role`, `clinic_id`, `active` |
| `patients` | Patient records per clinic | `name`, `phone`, `clinic_id`, `chronic_conditions` |
| `patient_accounts` | Patient self-service accounts | `phone`, `otp_verified`, `name` |
| `patient_clinic_links` | Maps patient account → clinic patient record | `account_id`, `clinic_id`, `patient_id` |
| `appointments` | All appointments | `clinic_id`, `patient_id`, `date`, `status`, `triage_level` |
| `consultations` | Doctor consultation notes | `symptoms`, `diagnosis`, `prescription`, `follow_up_date` |
| `billing` | Bill records | `amount`, `payment_status`, `payment_method` |
| `invoices` | Detailed invoices | `invoice_number`, `line_items`, `discount_amount`, `total` |
| `inventory` | Medical supply items | `name`, `quantity`, `reorder_level`, `category` |
| `ai_sessions` | AI chat session logs | `symptoms_entered`, `triage_level`, `conversation` |
| `vitals` | Patient vitals | `bp`, `pulse`, `temperature`, `spo2`, `weight` |
| `health_reports` | Uploaded/AI-scanned reports | `key_findings`, `medications`, `urgent_flags` |
| `notifications` | Patient notifications | `type`, `title`, `message`, `read` |

---

## 7. Data Models (Types)

All TypeScript interfaces are defined in `src/lib/types.ts`.

### Core Types

**`Clinic`** — A healthcare clinic
```typescript
{ clinic_id, name, address, city, phone, email, logo_url, owner_name, working_hours, created_at }
```

**`User`** — A clinic staff member
```typescript
{ user_id, clinic_id, name, email, role: 'admin'|'doctor'|'staff', specialisation, active, avatar_color }
```

**`Patient`** — A patient registered at a clinic
```typescript
{ patient_id, clinic_id, name, age, gender, phone, blood_group, allergies, chronic_conditions, token_number }
```

**`PatientAccount`** — A patient's self-service account (across multiple clinics)
```typescript
{ account_id, phone, name, dob, gender, otp_verified, current_medications, emergency_contact_name }
```

**`Appointment`** — A scheduled or walk-in appointment
```typescript
{ appt_id, clinic_id, patient_id, doctor_id, date, time_slot, status, triage_level, token_number, ai_summary }
```

**`Bill`** + **`Invoice`** — Payment records
```typescript
{ amount, payment_status: 'paid'|'pending'|'partial', payment_method: 'cash'|'upi'|'card', line_items[] }
```

**`InventoryItem`** — Medical supply
```typescript
{ name, category, quantity, unit, reorder_level, supplier, cost_per_unit }
```

**`TriageSummary`** — AI-generated pre-consultation report
```typescript
{ level: 'URGENT'|'MODERATE'|'NORMAL', department, chief_complaint, severity, possible_differentials, suggested_investigations, red_flag_symptoms, next_steps, ai_confidence }
```

---

## 8. Clinic Portal — All Screens

### 8.1 `DashboardScreen` — Admin Dashboard (`/clinic/dashboard`)
**Purpose**: Overview of clinic health metrics.

**What it shows**:
- Today's appointment count, total patients, total revenue
- Appointment queue for today with triage status
- Recent activity feed
- Quick stats cards (urgent patients, pending bills, critical inventory)

**Data used**: `useClinicData()` hook — fetches appointments, patients, bills, inventory for the clinic

---

### 8.2 `DoctorDashboard` — Doctor-Specific Dashboard (`/clinic/dashboard` when role=doctor)
**Purpose**: Doctor's daily workflow view.

**What it shows**:
- My patients today (appointments assigned to this doctor)
- Patient waiting queue with triage priority
- Consultation notes entry panel
- AI summary if patient came via AI Navigator
- Patient vitals recording
- Risk analysis bars (cardiac, diabetes, hypertension) per patient

**Key features**:
- Start consultation → marks appointment as `in-progress`
- Complete consultation → saves notes to `consultations` collection, marks `done`
- Record vitals inline
- View AI triage summary before seeing patient

---

### 8.3 `AppointmentsScreen` — Appointments Management (`/clinic/appointments`)
**Purpose**: Full appointment management — schedule, walk-in, track, update.

**What it shows**:
- Calendar view + list view
- Filter by date, doctor, status
- Add new appointment (manual scheduling)
- Walk-in patient registration with token assignment
- Token queue display
- Update appointment status (waiting → in-progress → done)
- Triage level assignment

**Key features**:
- Auto-assigns token numbers per date per clinic
- Calls Firestore to create appointment + update patient record
- Supports online booking (from patient portal) + manual (clinic staff)

---

### 8.4 `PatientsScreen` — Patient Records (`/clinic/patients`)
**Purpose**: Full patient database for the clinic.

**What it shows**:
- All registered patients (searchable by name/phone)
- Patient detail view: demographics, medical history, vitals, past appointments
- Add new patient form
- Edit patient profile
- Risk score bars (from triage engine)

**Key features**:
- Patient search + filter
- Inline vitals recording
- Link to appointment history
- Quick "Book Appointment" shortcut

---

### 8.5 `BillingScreen` — Billing & Invoices (`/clinic/billing`)
**Purpose**: Create bills, manage payments, print invoices.

**What it shows**:
- Recent bills list with payment status
- Unpaid / overdue bills highlight
- Bill creation form (linked to appointment/patient/doctor)
- Invoice preview with line items

**Key features**:
- Creates both `billing` and `invoices` documents atomically (Firestore batch write)
- Supports Cash, UPI (with transaction ref), Card payments
- Discount support (amount or percent)
- Invoice PDF-ready print view (`InvoiceView` component)
- Payment status: `paid`, `pending`, `partial`

---

### 8.6 `InventoryScreen` — Inventory Management (`/clinic/inventory`)
**Purpose**: Track medical supplies, medicines, equipment.

**What it shows**:
- All inventory items per clinic
- Critical items (quantity ≤ 0 or ≤ 50% of reorder level) highlighted in red
- Add / Edit / Delete items
- Low-stock badge in sidebar

**Key features**:
- Reorder level alerts
- Category-based filtering
- Cost per unit tracking

---

### 8.7 `AINavigatorScreen` — Clinic-Side AI (`/clinic/ai-navigator`)
**Purpose**: Clinic staff can run AI triage for a patient sitting in front of them (tablet/kiosk mode).

**What it shows**:
- Chat interface with VIITSA AI
- Multilingual support (English / Hindi / Telugu)
- Triage result with urgency level
- Pre-consultation summary report

**Key features**:
- Same AI engine as Patient Portal
- Can be used on a waiting-room tablet
- Triage level auto-sets appointment priority
- Doctor gets notified if patient is URGENT

---

### 8.8 `AnalyticsScreen` — Reports & Analytics (`/clinic/analytics`)
**Purpose**: Business intelligence for clinic owners.

**What it shows**:
- Revenue over time (line/bar charts)
- Appointment trends (by date range)
- Patient visit frequency
- Doctor-wise appointment counts
- Top payment methods breakdown
- Consultation statistics

**Data source**: Queries `appointments`, `billing`, `consultations` with date filters

---

### 8.9 `SettingsScreen` — Clinic Settings (`/clinic/settings`)
**Purpose**: Configure clinic profile and operational settings.

**What it includes**:
- Clinic profile editing (name, address, phone, logo)
- Working hours configuration (open/close time, days)
- Slot duration (15/30/45/60 min)
- UPI ID and QR code for payments
- Default consultation fee
- WhatsApp/SMS reminder toggle
- Staff management (add/remove doctors and staff)
- Change password

---

### 8.10 `SetupWizardPage` — Initial Clinic Setup (`/setup`)
**Purpose**: Multi-step wizard for new clinic onboarding after registration.

**Steps**:
1. Clinic name, address, city
2. Working hours and days
3. Add first doctor
4. Configure payment preferences
5. Done → redirect to `/clinic/dashboard`

---

## 9. Patient Portal — All Screens

The Patient Portal lives under `/patient/*`. It is a **mobile-first** design (bottom navigation bar).

### 9.1 `PatientHome` — Patient Dashboard (`/patient/dashboard`)
**Purpose**: Patient's health summary home screen.

**What it shows**:
- Upcoming appointments (next 3)
- Pending payments badge
- Quick actions: Book Appointment, AI Health Check
- Health insights summary
- Linked clinic info

---

### 9.2 `PatientAINavigator` — AI Health Chat (`/patient/ai`)
**Purpose**: Patient chats with VIITSA AI about symptoms before visiting the clinic.

**What it does**:
1. Patient types (or speaks) symptoms in English/Hindi/Telugu
2. AI asks follow-up questions (one at a time)
3. After 4–6 exchanges, generates a **TRIAGE_JSON** summary
4. Shows: urgency level, recommended department, suggested investigations, red flags, self-care advice
5. Offers to **Book Appointment** with the pre-filled AI summary attached
6. Summary is passed to the doctor's dashboard when patient arrives

**AI features**:
- Voice input (`startListening()`) via Web Speech API
- Voice output (`speak()`) — AI reads response aloud
- Language auto-detection from patient input
- Translation of summary fields to Hindi/Telugu if needed

---

### 9.3 `PatientBooking` — Appointment Booking (`/patient/book`)
**Purpose**: Patient books a clinic appointment online.

**Steps**:
1. Search for clinic (or clinic link pre-fills from URL `?clinic=ID`)
2. Select date
3. Select doctor
4. See available time slots
5. Select slot → confirm booking
6. Appointment created in Firestore with `online_booking: true`

**If booking after AI chat**:
- AI summary (`TriageSummary`) is attached to the appointment
- Doctor can view it before the consultation

---

### 9.4 `PatientRecords` — Health Records (`/patient/records`)
**Purpose**: Patient's complete medical history.

**What it shows**:
- Past consultations (diagnosis, prescription, follow-up dates)
- Uploaded health reports (AI-analysed)
- Vitals history charts
- Report Scanner (`ReportScanner.tsx`) — AI reads uploaded medical reports and extracts key findings

**Report Scanner**:
- Patient uploads a photo/PDF of a lab report
- AI extracts: test name, value, normal range, is_abnormal flag
- Highlights abnormal findings in red
- Saves to `health_reports` collection

---

### 9.5 `PatientPayments` — Bills & Payments (`/patient/payments`)
**Purpose**: Patient views their billing history and pending dues.

**What it shows**:
- All invoices linked to this patient
- Payment status (paid/pending/partial)
- Invoice detail with line items
- UPI QR code for pending payments (if clinic has UPI configured)
- Download/share invoice

---

### 9.6 `PatientProfile` — Edit Profile (`/patient/profile`)
**Purpose**: Update personal and medical information.

**What can be edited**:
- Name, DOB, gender, blood group
- Address, email
- Chronic conditions, allergies
- Current medications
- Emergency contact name and phone

---

### 9.7 `FamilyVault` — Family Health Records (`/patient/family`)
**Purpose**: Manage health records for family members (spouse, children, parents) under one account.

**What it does**:
- Add family members with their health profiles
- View their records separately
- Upload and scan reports for family members
- Useful for parents managing children's health

---

### 9.8 `HealthTimeline` — Chronological Health History (`/patient/timeline`)
**Purpose**: Visual timeline of all health events.

**What it shows**:
- All consultations, reports, vitals, appointments in time order
- Color-coded by type
- Filter by date range or type
- Long-term health trend view

---

### 9.9 `PatientDoctorSearch` — Find Doctors (`/patient/doctors`)
**Purpose**: Search for available doctors across clinics.

**What it shows**:
- List of doctors by specialisation
- Clinic they belong to
- Working hours
- "Book with this doctor" shortcut → navigates to `/patient/book`

---

### 9.10 `PatientLanding` / `PatientAuthFlow` — Auth Screens
- `PatientLanding`: Entry screen with Book, AI Check, Guest Mode options
- `PatientAuthFlow`: Phone number input → OTP → Registration form (for new patients)

---

## 10. AI Systems

VIITSA has two AI systems working together.

### 10.1 AI Health Navigator (Patient-facing)

**File**: `src/lib/aiService.ts`

**Architecture**:
```
Patient types symptoms
       ↓
detectLanguage() — auto-detects English / Hindi / Telugu
       ↓
buildSystemPrompt() — creates doctor-role AI prompt with:
  - Clinic context (name, departments, doctors)
  - Language instruction
  - Clinical behavior rules
  - TRIAGE_JSON format (injected after 4 exchanges)
       ↓
sendToAI() — calls Firebase Cloud Function `aiChat`
  (LLM API key is NEVER exposed to browser)
       ↓
parseAIResponse() — extracts TRIAGE_JSON from response
       ↓
Returns: { text, summary: TriageSummary, rawLevel }
```

**Triage levels**: `URGENT` → `MODERATE` → `NORMAL`

**Language support**: English, Hindi (+ Hinglish), Telugu

**Voice features**:
- `startListening(lang, onTranscript, onEnd)` — Web Speech API microphone
- `speak(text, lang)` — Text-to-speech in patient's language
- `stopSpeaking()` — Cancel current speech

**Translation**:
- `translateSummary(summary, targetLanguage)` — Translates AI triage summary to Hindi/Telugu via a second AI call

### 10.2 Rule-Based Triage Engine (Clinic-side fallback)

**File**: `src/lib/triage.ts`

**Purpose**: Instant, rule-based triage (no API call needed) for clinic AI Navigator.

**How it works**:
- Pattern matching on symptom text using `RegExp` arrays
- Detects: chest pain, high fever (with temp + days), persistent vomiting, pain score
- Assigns: `urgent | moderate | normal`
- Returns recommendations for clinic staff
- Also calculates **patient risk bars**: Cardiac Risk, Diabetes Control, Hypertension based on chronic conditions and vitals

---

## 11. Core Services & Libraries

### `src/lib/auth.tsx` — Clinic Auth Context
Full authentication lifecycle for clinic staff. See Section 5.1.

### `src/lib/patientAuth.tsx` — Patient Auth Context
Patient phone-OTP authentication lifecycle. See Section 5.2.

### `src/lib/firebase.ts` — Firebase SDK Init
```typescript
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const DEMO_CLINIC_ID = '11111111-1111-1111-1111-111111111111';
```
All Firebase config values loaded from `.env` (`VITE_FIREBASE_*` variables).

### `src/lib/useClinicData.ts` — Clinic Data Hook
```typescript
useClinicData() → { appointments, patients, inventory, bills, todayAppointments, urgentQueue, pendingBills, criticalInventory, refresh }
```
Fetches all live clinic data from Firestore in parallel. Automatically re-fetches when clinic changes. Provides derived data:
- `todayAppointments` — filtered by today's ISO date
- `urgentQueue` — today's appointments with `triage_level === 'urgent'` and not done
- `pendingBills` — bills where `payment_status !== 'paid'`
- `criticalInventory` — items at 0 qty or ≤50% of reorder level

### `src/lib/paymentService.ts` — Payment Processing
```typescript
processPayment(input) → { ok, billId, invoiceId, invoiceNumber }
```
Atomically writes a `billing` record AND an `invoice` record in a single Firestore batch write.

Payment status logic:
- `cash` → always `paid`
- `upi` + has ref → `paid`
- `upi` without ref, `card` → `pending`

### `src/lib/format.ts` — Formatting Utilities
- `localDateISO()` — Current date in `YYYY-MM-DD` (Indian timezone aware)
- `formatDate(date)` — Human-readable date
- `formatLongDate(date)` — Full date with day name
- `formatCurrency(amount)` — Indian rupee format
- `formatPhone(phone)` — Phone number formatting

### `src/lib/emailService.ts` — Email Service
Handles email verification sending (Firebase Auth email link).

### `src/lib/nav.ts` — Navigation Config
Defines `NAV_ITEMS` array (key, label, icon, role access) used by `AppShell` sidebar.

### `src/lib/toast.ts` — Toast Notifications
Global toast notification system (success/error/info messages).

---

## 12. Components Library

### `AppShell.tsx` — Clinic Layout Shell
The main layout wrapper for all `/clinic/*` pages. Contains:
- **Left sidebar** (desktop): Logo, nav links, user info, sign out
- **Mobile sidebar**: Hamburger menu overlay
- **Top header**: Clinic name, date, notifications bell, urgent badge, user avatar
- Uses `useLocation()` to highlight active nav item based on URL

### `AISummaryPanel.tsx` — AI Triage Report Panel
Displays a formatted `TriageSummary` card:
- Urgency badge (URGENT red / MODERATE orange / NORMAL green)
- Chief complaint, severity, body location
- Possible differentials, suggested investigations
- Red flag symptoms, self-care advice
- Next steps
- AI confidence indicator

### `BillingForm.tsx` — Bill Creation Form
Reusable billing form component:
- Patient + Doctor selection
- Consultation fee input
- Add/remove line items (description + amount)
- Discount (amount or percent)
- Payment method selection
- UPI reference field (conditional)

### `Charts.tsx` — Data Visualization
Custom SVG-based charts (no external charting library):
- Bar chart
- Line chart
- Donut/pie chart
- Used in Analytics screen and Doctor Dashboard

### `InvoiceView.tsx` — Invoice Display
Print-ready invoice component:
- Clinic header with logo
- Patient details
- Line items table
- Subtotal, discount, total
- Payment details
- Suitable for printing or PDF export

### `Modal.tsx` — Dialog Component
Generic modal overlay with backdrop, close button, title slot, body, and footer actions.

### `Toast.tsx` — Toast Notification
Floating toast message with auto-dismiss. Supports success (green), error (red), info (blue) variants.

### `ViitsaLogo.tsx` — Brand Logo
VIITSA brand logo component in `sm`, `md`, `lg` sizes.

### `ui.tsx` — Common UI Primitives
- `Avatar` — Circular user avatar with initials fallback and custom color
- `Badge` — Status badge pill

---

## 13. Role-Based Access Control

Three staff roles exist: `admin`, `doctor`, `staff`.

| Feature / Screen | admin | doctor | staff |
|---|---|---|---|
| Dashboard | Admin view | Doctor view | Admin view |
| Patients | ✅ | ✅ | ✅ |
| Appointments | ✅ | ✅ | ✅ |
| Billing | ✅ | ❌ | ✅ |
| Inventory | ✅ | ❌ | ✅ |
| AI Navigator | ✅ | ✅ | ❌ |
| Analytics | ✅ | ❌ | ❌ |
| Settings | ✅ | ❌ | ❌ |

**Implementation**: `NAV_ITEMS` in `src/lib/nav.ts` has a `roles: Role[]` field per item. `AppShell` filters the sidebar nav to only show items allowed for the current user's role.

---

## 14. Navigation System

### Clinic Portal Navigation
- **Sidebar** (desktop): Fixed left sidebar, 256px wide
- **Hamburger menu** (mobile): Slides in from left as overlay
- **URL-based**: Each nav item is a `<Link to="/clinic/{key}">` — URL changes when navigating
- **Active state**: Determined by `location.pathname.split('/').pop()` matching the nav key
- **Badges**: Inventory shows out-of-stock count, Billing shows pending count

### Patient Portal Navigation
- **Bottom navigation bar**: Fixed at bottom of screen, 5 tabs
- Tabs: Home (→ `/patient/dashboard`), AI Check (→ `/patient/ai`), Book (→ `/patient/book`), Records (→ `/patient/records`), Payments (→ `/patient/payments`)
- **Active state**: Determined by URL path

---

## 15. Payment System

**Flow**:
```
Clinic Staff creates Bill
         ↓
BillingForm → processPayment()
         ↓
Firestore batch write:
  - billing/{id}  → Bill record
  - invoices/{id} → Invoice with line items, invoice number
         ↓
Invoice number format: INV-{timestamp}
         ↓
Invoice displayed in InvoiceView
         ↓
Patient can view in PatientPayments portal
```

**Payment methods**:
- **Cash** → Immediately marked `paid`
- **UPI** → Marked `paid` if staff enters transaction reference, else `pending`
- **Card** → Always `pending` until gateway confirmation (manual override)

**Discounts**:
- Flat amount (e.g., ₹100 off)
- Percent (e.g., 10% off)

---

## 16. Environment Variables

Stored in `.env` file (never committed to Git).

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=viitsadb.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=viitsadb
VITE_FIREBASE_STORAGE_BUCKET=viitsadb.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=521152211314
VITE_FIREBASE_APP_ID=1:521152211314:web:78d9850ea0386121a395eb
```

All accessed via `import.meta.env.VITE_*` in `src/lib/firebase.ts`.

---

## 17. File & Folder Structure

```
project/
├── .env                          ← Firebase secrets (not in Git)
├── index.html                    ← Entry HTML
├── package.json
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── main.tsx                  ← React entry point
    ├── App.tsx                   ← Root app with all routes
    ├── index.css                 ← Global CSS design system
    ├── vite-env.d.ts
    │
    ├── lib/                      ← Core business logic
    │   ├── firebase.ts           ← Firebase init
    │   ├── auth.tsx              ← Clinic staff auth context
    │   ├── patientAuth.tsx       ← Patient auth context
    │   ├── types.ts              ← All TypeScript types
    │   ├── aiService.ts          ← AI chat, triage, voice
    │   ├── triage.ts             ← Rule-based triage engine
    │   ├── paymentService.ts     ← Payment processing
    │   ├── useClinicData.ts      ← Clinic data fetching hook
    │   ├── emailService.ts       ← Email service
    │   ├── format.ts             ← Date/currency formatters
    │   ├── nav.ts                ← Navigation items config
    │   └── toast.ts              ← Toast notification context
    │
    ├── components/               ← Shared UI components
    │   ├── AppShell.tsx          ← Clinic layout (sidebar + topbar)
    │   ├── AISummaryPanel.tsx    ← AI triage report display
    │   ├── BillingForm.tsx       ← Bill creation form
    │   ├── Charts.tsx            ← SVG data charts
    │   ├── InvoiceView.tsx       ← Invoice print view
    │   ├── Modal.tsx             ← Dialog overlay
    │   ├── Toast.tsx             ← Toast notification
    │   ├── ViitsaLogo.tsx        ← Brand logo
    │   └── ui.tsx                ← Avatar, Badge primitives
    │
    ├── screens/                  ← Clinic portal screens
    │   ├── LandingPage.tsx       ← Marketing homepage
    │   ├── AuthLoginPage.tsx     ← Staff login
    │   ├── AuthRegisterPage.tsx  ← Clinic registration
    │   ├── SetupWizardPage.tsx   ← Post-registration setup
    │   ├── DashboardScreen.tsx   ← Admin dashboard
    │   ├── DoctorDashboard.tsx   ← Doctor-specific dashboard
    │   ├── AppointmentsScreen.tsx
    │   ├── PatientsScreen.tsx
    │   ├── BillingScreen.tsx
    │   ├── InventoryScreen.tsx
    │   ├── AINavigatorScreen.tsx
    │   ├── AnalyticsScreen.tsx
    │   └── SettingsScreen.tsx
    │
    └── patient/                  ← Patient portal
        ├── PatientApp.tsx        ← Patient app router + shell
        ├── PatientAuthFlow.tsx   ← Phone OTP auth screens
        ├── PatientLanding.tsx    ← Patient entry screen
        ├── PatientHome.tsx       ← Patient dashboard
        ├── PatientAINavigator.tsx← AI symptom chat
        ├── PatientBooking.tsx    ← Appointment booking
        ├── PatientRecords.tsx    ← Health records
        ├── PatientPayments.tsx   ← Bills & invoices
        ├── PatientProfile.tsx    ← Edit profile
        ├── PatientDoctorSearch.tsx← Find doctors
        ├── PatientBottomNav.tsx  ← Mobile bottom nav
        ├── FamilyVault.tsx       ← Family health records
        ├── HealthTimeline.tsx    ← Health history timeline
        ├── ReportScanner.tsx     ← AI report scanning
        └── ClinicSearch.tsx      ← Search clinics
```

---

## 18. End-to-End User Flows

### Flow 1: New Clinic Registration
```
1. Visit viitsa.app/register
2. Fill clinic name, owner name, email, phone, password
3. Submit → Firebase creates auth account + sends email verification
4. Verify email → auto-redirected to /setup
5. SetupWizard: enter clinic details, working hours, add first doctor
6. Submit → creates `clinics` + `users` docs in Firestore
7. Redirected to /clinic/dashboard
```

### Flow 2: Clinic Staff Login
```
1. Visit /login
2. Choose: Password / Email Link / Mobile OTP
3. Enter credentials
4. Firebase authenticates
5. loadProfile(email) fetches user + clinic from Firestore
6. Redirected to /clinic/dashboard
```

### Flow 3: Patient Walks In (Staff registers)
```
1. Staff goes to /clinic/appointments
2. Clicks "Walk-in" or "New Appointment"
3. Enters patient name/phone
4. System checks if patient exists in `patients` collection
5. Creates/finds patient → assigns token number
6. Appointment created with status: 'waiting'
7. Patient appears in doctor's queue
```

### Flow 4: Patient Uses AI Navigator (Patient Portal)
```
1. Patient visits /patient/ai
2. Types symptoms ("I have chest pain and fever")
3. AI detects language, asks follow-up questions
4. After 4-6 exchanges → TRIAGE_JSON generated
5. Patient sees: urgency level, recommended department, red flags
6. Clicks "Book Appointment" → goes to /patient/book
7. Books slot → appointment created with ai_summary attached
8. Doctor sees AI summary in their dashboard when patient arrives
```

### Flow 5: Doctor Completes Consultation
```
1. Doctor at /clinic/dashboard sees patient queue
2. Clicks "Start Consultation" on patient card
3. Reads AI summary (if available)
4. Records vitals (BP, pulse, temperature, SpO2, weight)
5. Enters: symptoms, diagnosis, prescription, follow-up date
6. Submits → creates `consultations` doc in Firestore
7. Appointment marked as 'done'
8. Patient can see consultation notes in /patient/records
```

### Flow 6: Billing & Invoice
```
1. Staff at /clinic/billing
2. Select patient and appointment
3. Enter consultation fee + additional line items (tests, medicines)
4. Apply discount if applicable
5. Select payment method (Cash/UPI/Card)
6. For UPI → optionally enter transaction reference
7. Submit → processPayment() creates billing + invoice atomically
8. Invoice displayed → can print or share
9. Patient can view in /patient/payments
```

---

## Quick Reference

### Key Constants
- `DEMO_CLINIC_ID` = `'11111111-1111-1111-1111-111111111111'` — Used as demo/fallback clinic

### Triage Levels
- 🔴 `urgent` — Immediate doctor attention, moved to top of queue
- 🟡 `moderate` — Priority today, flagged for doctor
- 🟢 `normal` — Routine, scheduled order

### Appointment Statuses
- `waiting` → `in-progress` → `done` | `cancelled`

### Invoice Number Format
`INV-{Unix timestamp}` (e.g., `INV-1725960000000`)

---

*Document generated: September 2026 | VIITSA v1.0*
