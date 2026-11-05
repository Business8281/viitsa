# VIITSA — Final WhatsApp Business Message Templates (A to Z Master Reference)

This document contains the complete, production-ready WhatsApp message templates for **VIITSA**, compliant with Meta's WhatsApp Cloud API requirements.

---

## Master Template Summary Index

### Part I: Patient Care & Appointments (B2C)
| # | Template Name | Category | Meta Sub-category | Button Text | Button URL | Button Status | Purpose |
|---|---|---|---|---|---|---|---|
| 1 | `phone_login_otps` *(alias: `viitsa_login_otp`)* | `AUTHENTICATION` | `One-time password (OTP)` | `Copy Code` | N/A | `Active` | Patient & Clinic staff login OTP |
| 2 | `viitsa_appt_confirm_online` *(alias: `viitsa_appt_confirm_new_visit`)* | `UTILITY` | `Reservations & appointments → Appointment confirmation` | `View Appointment` | `https://viitsa.com/appointment/manage` | `Active` | Online Booking & New Patient Consultation |
| 3 | `viitsa_appt_confirm_followup` | `UTILITY` | `Reservations & appointments → Appointment confirmation` | `View Appointment` | `https://viitsa.com/appointment/manage` | `Active` | Method 2: Follow-up Consultation |
| 4 | `viitsa_appt_confirm_report` | `UTILITY` | `Reservations & appointments → Appointment confirmation` | `View Appointment` | `https://viitsa.com/appointment/manage` | `Active` | Method 3: Lab / Diagnostic Report Review |
| 5 | `viitsa_appt_confirm_walkin` | `UTILITY` | `Reservations & appointments → Appointment confirmation` | `Track Live Queue` | `https://viitsa.com/qr-walkin` | `Active` | Walk-in Live Queue Token at Reception |
| 6 | `viitsa_appointment_rescheduled` | `UTILITY` | `Reservations & appointments → Appointment update` | `View New Schedule` | `https://viitsa.com/appointment/manage` | `Active` | Appointment Reschedule Notification |
| 7 | `viitsa_appointment_reminder` | `UTILITY` | `Reservations & appointments → Appointment reminder` | `Check Directions` | `https://viitsa.com/appointment/manage` | `Active` | Upcoming Appointment Reminder |
| 8 | `viitsa_appointment_cancelled` | `UTILITY` | `Account updates → Cancellation confirmation` | `Book New Appointment` | `https://viitsa.com/patient/book` | `Active` | Appointment Cancellation Notification |
| 9 | `viitsa_patient_invoice` | `UTILITY` | `Order & billing → Payment receipt / Invoice` | `View Invoice Details` | `https://viitsa.com/patient/payments` | `Active` | Patient Invoice & Bill with attached PDF |
| 10 | `viitsa_patient_payment_reminder` | `UTILITY` | `Order & billing → Payment reminder` | `Pay Bill Online` | `https://viitsa.com/patient/payments` | `Active` | Outstanding consultation/bill reminder |
| 11 | `viitsa_patient_followup_due` | `UTILITY` | `Reservations & appointments → Appointment reminder` | `Book Follow-up Now` | `https://viitsa.com/patient/book` | `Active` | Follow-up visit due notification |
| 12 | `viitsa_patient_medicine_reminder` | `UTILITY` | `Account updates → Renewal reminder` | `View Prescription` | `https://viitsa.com/patient/records` | `Active` | Prescription dosage & medicine reminder |
| 13 | `viitsa_patient_lab_report_ready` | `UTILITY` | `Reservations & appointments → Appointment update` | `Download Lab Report` | `https://viitsa.com/patient/records` | `Active` | Lab/diagnostic test report ready alert |

### Part II: Clinic Subscriptions & B2B Admin Lifecycle
| # | Template Name | Category | Meta Sub-category | Button Text | Button URL | Button Status | Purpose |
|---|---|---|---|---|---|---|---|
| 14 | `viitsa_clinic_trial_activated` | `UTILITY` | `Account updates → Account creation confirmation` | `Open Clinic Portal` | `https://viitsa.com/clinic/dashboard` | `Active` | 30-Day Free Trial confirmation |
| 15 | `viitsa_clinic_sub_activated` | `UTILITY` | `Account updates → Upgrade confirmation` | `View Subscription` | `https://viitsa.com/clinic/settings?tab=billing` | `Active` | New subscription plan activated |
| 16 | `viitsa_clinic_plan_upgraded` | `UTILITY` | `Account updates → Upgrade confirmation` | `View Plan Details` | `https://viitsa.com/clinic/settings?tab=billing` | `Active` | Plan upgrade confirmation (tier increase) |
| 17 | `viitsa_clinic_plan_downgraded` | `UTILITY` | `Account updates → Renewal reminder` | `Manage Subscription` | `https://viitsa.com/clinic/settings?tab=billing` | `Active` | Plan downgrade scheduled notification |
| 18 | `viitsa_clinic_sub_renewal_reminder` | `UTILITY` | `Account updates → Renewal reminder` | `Renew Subscription` | `https://viitsa.com/clinic/subscription-setup` | `Active` | Subscription renewal reminder with amount & date |
| 19 | `viitsa_clinic_payment_success` | `UTILITY` | `Account updates → Renewal confirmation` | `Download Invoice` | `https://viitsa.com/clinic/billing` | `Active` | Subscription payment / auto-debit success |
| 20 | `viitsa_clinic_payment_failed` | `UTILITY` | `Account updates → Renewal reminder` | `Retry Payment` | `https://viitsa.com/clinic/subscription-setup` | `Active` | Payment failed / retry alert |
| 21 | `viitsa_clinic_sub_deactivated` | `UTILITY` | `Account updates → Service disruption` | `Reactivate Account` | `https://viitsa.com/clinic/settings?tab=billing` | `Active` | Plan suspended / deactivated for overdue |
| 22 | `viitsa_clinic_sub_cancelled` | `UTILITY` | `Account updates → Cancellation confirmation` | `Reactivate Service` | `https://viitsa.com/clinic/settings?tab=billing` | `Active` | Subscription cancellation confirmed |
| 23 | `viitsa_clinic_sub_invoice` | `UTILITY` | `Order & billing → Payment receipt / Invoice` | `View Billing History` | `https://viitsa.com/clinic/billing` | `Active` | B2B Subscription Tax Invoice (PDF attachment) |
| 24 | `viitsa_clinic_quota_alert` | `MARKETING` | `Usage limit alert` | `Upgrade Quota` | `https://viitsa.com/clinic/settings?tab=billing` | `Active` | WhatsApp messages / AI intake quota usage warning |

### Part III: Company Admin to Clinics (Verifications & Plan Governance)
| # | Template Name | Category | Meta Sub-category | Button Text | Button URL | Button Status | Purpose |
|---|---|---|---|---|---|---|---|
| 25 | `viitsa_clinic_pending_approval` | `UTILITY` | `Account updates → Account creation confirmation` | `Check Status` | `https://viitsadb.web.app/clinic/login` | `Active` | Clinic registration received / wait for approval |
| 26 | `viitsa_admin_clinic_verified` | `UTILITY` | `Account updates → Account creation confirmation` | `Access Clinic Portal` | `https://viitsa.com/clinic/login` | `Active` | Clinic verification approved by platform admin |
| 27 | `viitsa_admin_clinic_rejected` | `UTILITY` | `Account updates → Cancellation confirmation` | `Review & Reapply` | `https://viitsa.com/clinic/login` | `Active` | Clinic verification rejected / action required |
| 28 | `viitsa_admin_clinic_docs_needed` | `UTILITY` | `Account updates → Account creation confirmation` | `Upload Documents` | `https://viitsa.com/clinic/upload-documents` | `Active` | Missing onboarding documents requested |
| 29 | `viitsa_admin_doctor_verified` | `UTILITY` | `Account updates → Account creation confirmation` | `Access Doctor Portal` | `https://viitsa.com/clinic/login` | `Active` | Doctor verified, membership activated & login welcome |
| 30 | `viitsa_admin_doctor_rejected` | `UTILITY` | `Account updates → Cancellation confirmation` | `Update Credentials` | `https://viitsa.com/clinic/settings?tab=doctors` | `Active` | Doctor verification rejected / update required |
| 31 | `viitsa_admin_plan_activated` | `UTILITY` | `Account updates → Upgrade confirmation` | `Open Clinic Dashboard` | `https://viitsa.com/clinic/dashboard` | `Active` | Plan manually activated by platform admin |
| 32 | `viitsa_admin_plan_free_granted` | `UTILITY` | `Account updates → Upgrade confirmation` | `Claim Free Access` | `https://viitsa.com/clinic/dashboard` | `Active` | Free / promotional sponsored plan granted |
| 33 | `viitsa_admin_plan_deactivated` | `UTILITY` | `Account updates → Cancellation confirmation` | `Contact Admin Support` | `https://viitsa.com/contact` | `Active` | Plan manually deactivated by platform admin |
| 34 | `viitsa_admin_plan_suspended` | `UTILITY` | `Account updates → Service disruption` | `Resolve Suspension` | `https://viitsa.com/clinic/pending-approval` | `Active` | Clinic account/plan suspended for compliance |
| 35 | `viitsa_admin_plan_reactivated` | `UTILITY` | `Account updates → Renewal confirmation` | `Resume Clinic Portal` | `https://viitsa.com/clinic/dashboard` | `Active` | Administrative suspension lifted / plan restored |
| 36 | `viitsa_admin_payment_request` | `UTILITY` | `Account updates → Renewal reminder` | `Pay Invoice Now` | `https://viitsa.com/clinic/billing` | `Active` | Custom subscription invoice payment request |
| 37 | `viitsa_doctor_added_by_clinic` | `UTILITY` | `Account updates → Account creation confirmation` | `Open Clinic Portal` | `https://viitsa.com/clinic/login` | `Active` | Doctor registered by clinic notification & setup invite |

# PART I: PATIENT CARE & APPOINTMENTS

## 1. Authentication (OTP)

### `viitsa_login_otp`
* **Category:** `AUTHENTICATION`
* **Sub-category:** `One-time password (OTP)`
* **Language:** `English (US)` (`en_US`)
* **Code Expiration:** `10 minutes`
* **Body:**
```text
{{1}} is your VIITSA verification code. For your security, do not share this code with anyone. It will expire in 10 minutes.
```
* **Buttons:**
  * Type: `Copy code`
  * Button Text: `Copy Code`
  * URL Type: `N/A (Native OTP)`
  * Website URL: `N/A`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: OTP Code *(Sample: `492015`)*

---

## 2. Appointment Confirmations (The 3 Methods + Walk-in)

### Method 1: New Patient Visit (`viitsa_appt_confirm_new_visit`)
* **Category:** `UTILITY`
* **Sub-category:** `Reservations & appointments → Appointment confirmation`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Appointment Confirmed: New Visit 🩺`
* **Body:**
```text
Dear {{1}},

Your new consultation with Dr. {{2}} at {{3}} has been confirmed.

📅 Date: {{4}}
⏰ Time: {{5}}
🎟️ Token / Slot: {{6}}

Please arrive 15 minutes early with any past medical records or government ID.

📞 For any enquiries, contact clinic at: {{7}}
```
* **Footer:** `VIITSA Healthcare`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `View Appointment`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/appointment/manage`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Patient Name *(Sample: Rahul Sharma)*
  * `{{2}}`: Doctor Name *(Sample: Dr. Anita Rao)*
  * `{{3}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{4}}`: Date *(Sample: 15 Nov 2026)*
  * `{{5}}`: Time *(Sample: 10:30 AM)*
  * `{{6}}`: Token / Slot *(Sample: A-12)*
  * `{{7}}`: Clinic Phone *(Sample: +91 98765 43210)*

---

### Method 2: Follow-up Consultation (`viitsa_appt_confirm_followup`)
* **Category:** `UTILITY`
* **Sub-category:** `Reservations & appointments → Appointment confirmation`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Follow-up Confirmed 📋`
* **Body:**
```text
Dear {{1}},

Your follow-up consultation with Dr. {{2}} at {{3}} has been confirmed.

📅 Date: {{4}}
⏰ Time: {{5}}
🎟️ Token / Slot: {{6}}

Please carry your previous prescription and current medicines.

📞 For any enquiries, contact clinic at: {{7}}
```
* **Footer:** `VIITSA Healthcare`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `View Appointment`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/appointment/manage`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Patient Name *(Sample: Rahul Sharma)*
  * `{{2}}`: Doctor Name *(Sample: Dr. Anita Rao)*
  * `{{3}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{4}}`: Date *(Sample: 15 Nov 2026)*
  * `{{5}}`: Time *(Sample: 11:00 AM)*
  * `{{6}}`: Token / Slot *(Sample: B-08)*
  * `{{7}}`: Clinic Phone *(Sample: +91 98765 43210)*

---

### Method 3: Lab / Report Discussion (`viitsa_appt_confirm_report`)
* **Category:** `UTILITY`
* **Sub-category:** `Reservations & appointments → Appointment confirmation`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Report Review Confirmed 📑`
* **Body:**
```text
Dear {{1}},

Your lab / diagnostic report discussion with Dr. {{2}} at {{3}} has been confirmed.

📅 Date: {{4}}
⏰ Time: {{5}}
🎟️ Token / Slot: {{6}}

Please bring all original diagnostic reports and scan films for doctor review.

📞 For any enquiries, contact clinic at: {{7}}
```
* **Footer:** `VIITSA Healthcare`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `View Appointment`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/appointment/manage`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Patient Name *(Sample: Rahul Sharma)*
  * `{{2}}`: Doctor Name *(Sample: Dr. Anita Rao)*
  * `{{3}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{4}}`: Date *(Sample: 15 Nov 2026)*
  * `{{5}}`: Time *(Sample: 11:30 AM)*
  * `{{6}}`: Token / Slot *(Sample: R-03)*
  * `{{7}}`: Clinic Phone *(Sample: +91 98765 43210)*

---

### Reception Walk-in Live Queue Token (`viitsa_appt_confirm_walkin`)
* **Category:** `UTILITY`
* **Sub-category:** `Reservations & appointments → Appointment confirmation`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Walk-in Confirmed 🏥`
* **Body:**
```text
Dear {{1}},

Your walk-in registration at {{2}} has been confirmed.

🎟️ Token / Slot: {{3}}
🩺 Doctor: Dr. {{4}}
⏰ Estimated Time: {{5}}

Please wait in the clinic lounge. Our team will call your token number shortly.

📞 For any enquiries, contact reception at: {{6}}
```
* **Footer:** `VIITSA Healthcare`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Track Live Queue`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/qr-walkin`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Patient Name *(Sample: Rahul Sharma)*
  * `{{2}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{3}}`: Token / Slot *(Sample: W-07)*
  * `{{4}}`: Doctor Name *(Sample: Dr. Anita Rao)*
  * `{{5}}`: Estimated Time *(Sample: Today around 11:15 AM)*
  * `{{6}}`: Clinic Reception Phone *(Sample: +91 98765 43210)*

---

## 3. Reschedules, Reminders & Cancellations

### Appointment Rescheduled (`viitsa_appointment_rescheduled`)
* **Category:** `UTILITY`
* **Sub-category:** `Reservations & appointments → Appointment update`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Appointment Rescheduled 🔄`
* **Body:**
```text
Dear {{1}},

Your appointment with Dr. {{2}} at {{3}} has been rescheduled.

📅 New Date: {{4}}
⏰ New Time: {{5}}
🎟️ New Token / Slot: {{6}}
📌 Reason: {{7}}

📞 For any enquiries or changes, contact clinic at: {{8}}
```
* **Footer:** `VIITSA Healthcare`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `View New Schedule`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/appointment/manage`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Patient Name *(Sample: Rahul Sharma)*
  * `{{2}}`: Doctor Name *(Sample: Dr. Anita Rao)*
  * `{{3}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{4}}`: New Date *(Sample: 18 Nov 2026)*
  * `{{5}}`: New Time *(Sample: 04:00 PM)*
  * `{{6}}`: New Token / Slot *(Sample: B-04)*
  * `{{7}}`: Reason *(Sample: Doctor schedule change)*
  * `{{8}}`: Clinic Phone *(Sample: +91 98765 43210)*

---

### Appointment Reminder (`viitsa_appointment_reminder`)
* **Category:** `UTILITY`
* **Sub-category:** `Reservations & appointments → Appointment reminder`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Upcoming Appointment Reminder ⏰`
* **Body:**
```text
Dear {{1}},

This is a reminder for your upcoming appointment with Dr. {{2}} at {{3}}.

📅 Date: {{4}}
⏰ Time: {{5}}
📍 Location: {{6}}

Please bring any relevant past medical reports and arrive 10 minutes early.

📞 For any enquiries, contact clinic at: {{7}}
```
* **Footer:** `VIITSA Healthcare`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Check Directions`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/appointment/manage`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Patient Name *(Sample: Rahul Sharma)*
  * `{{2}}`: Doctor Name *(Sample: Dr. Anita Rao)*
  * `{{3}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{4}}`: Date *(Sample: Tomorrow, 16 Nov 2026)*
  * `{{5}}`: Time *(Sample: 10:30 AM)*
  * `{{6}}`: Clinic Room / Address *(Sample: Room 204, City Care Clinic)*
  * `{{7}}`: Clinic Phone *(Sample: +91 98765 43210)*

---

### Appointment Cancelled (`viitsa_appointment_cancelled`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Cancellation confirmation`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Appointment Cancelled ❌`
* **Body:**
```text
Dear {{1}},

Your appointment with Dr. {{2}} at {{3}} scheduled for {{4}} at {{5}} has been cancelled.

📌 Reason: {{6}}

📞 For any enquiries or to rebook, contact clinic at: {{7}}
```
* **Footer:** `VIITSA Healthcare`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Book New Appointment`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/patient/book`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Patient Name *(Sample: Rahul Sharma)*
  * `{{2}}`: Doctor Name *(Sample: Dr. Anita Rao)*
  * `{{3}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{4}}`: Scheduled Date *(Sample: 15 Nov 2026)*
  * `{{5}}`: Scheduled Time *(Sample: 10:30 AM)*
  * `{{6}}`: Reason *(Sample: Cancelled upon patient request)*
  * `{{7}}`: Clinic Phone *(Sample: +91 98765 43210)*

---

## 4. Patient Billing & Clinical Follow-ups

### Patient Consultation Invoice with PDF (`viitsa_patient_invoice`)
* **Category:** `UTILITY`
* **Sub-category:** `Order & billing → Payment receipt / Invoice`
* **Language:** `English (US)` (`en_US`)
* **Header:** Select Type: **Media** → Choose **Document** *(Do not type text. Choose the "Media" option, select "Document", and upload any sample PDF invoice for Meta review)*
* **Body:**
```text
Dear {{1}},

Thank you for visiting {{2}}. Please find your invoice #{{3}} attached with this message.

💰 Total Amount: ₹{{4}}
💳 Payment Status: {{5}}
📅 Billing Date: {{6}}

📞 For any billing enquiries, contact clinic at: {{7}}
```
* **Footer:** `VIITSA Healthcare`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `View Invoice Details`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/patient/payments`
  * Button Status: `Active`
* **Variables:**
  * Header Document: PDF download link
  * `{{1}}`: Patient Name *(Sample: Rahul Sharma)*
  * `{{2}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{3}}`: Invoice Number *(Sample: INV-2026-0042)*
  * `{{4}}`: Total Amount *(Sample: 850.00)*
  * `{{5}}`: Status *(Sample: Paid)*
  * `{{6}}`: Date *(Sample: 15 Nov 2026)*
  * `{{7}}`: Clinic Phone *(Sample: +91 98765 43210)*

---

### Patient Outstanding Bill Reminder (`viitsa_patient_payment_reminder`)
* **Category:** `UTILITY`
* **Sub-category:** `Order & billing → Payment reminder`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Payment Reminder 💳`
* **Body:**
```text
Dear {{1}},

This is a gentle reminder regarding your outstanding balance from {{2}}.

💰 Pending Amount: ₹{{3}}
📅 Visit Date: {{4}}
💳 UPI Payment ID: {{5}}

Please mention your name as the reference note when paying.

📞 For any billing queries, contact clinic at: {{6}}
```
* **Footer:** `VIITSA Healthcare`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Pay Bill Online`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/patient/payments`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Patient Name *(Sample: Rahul Sharma)*
  * `{{2}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{3}}`: Pending Amount *(Sample: 500.00)*
  * `{{4}}`: Visit Date *(Sample: 10 Nov 2026)*
  * `{{5}}`: UPI ID *(Sample: citycare@icici)*
  * `{{6}}`: Clinic Phone *(Sample: +91 98765 43210)*

---

### Patient Follow-up Due Notice (`viitsa_patient_followup_due`)
* **Category:** `UTILITY`
* **Sub-category:** `Reservations & appointments → Appointment reminder`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Follow-up Due 🩺`
* **Body:**
```text
Dear {{1}},

Your follow-up consultation with Dr. {{2}} at {{3}} is due on {{4}}.

Regular medical follow-ups ensure your recovery stays on track. Please book your preferred slot online or contact the clinic reception.

📞 For bookings or enquiries, contact clinic at: {{5}}
```
* **Footer:** `VIITSA Healthcare`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Book Follow-up Now`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/patient/book`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Patient Name *(Sample: Rahul Sharma)*
  * `{{2}}`: Doctor Name *(Sample: Dr. Anita Rao)*
  * `{{3}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{4}}`: Due Date *(Sample: 22 Nov 2026)*
  * `{{5}}`: Clinic Phone *(Sample: +91 98765 43210)*

---

### Patient Medicine Dosage Reminder (`viitsa_patient_medicine_reminder`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Renewal reminder`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Medicine Reminder 💊`
* **Body:**
```text
Dear {{1}},

This is a reminder to take your prescribed medicine from {{2}}.

💊 Medicine: {{3}}
⏰ Dosage / Timing: {{4}}
📌 Instructions: {{5}}

Please stay consistent with your prescribed course for optimal recovery.

📞 For medical queries, contact clinic at: {{6}}
```
* **Footer:** `VIITSA Healthcare`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `View Prescription`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/patient/records`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Patient Name *(Sample: Rahul Sharma)*
  * `{{2}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{3}}`: Medicine Name *(Sample: Amoxicillin 500mg)*
  * `{{4}}`: Timing *(Sample: 1 tablet after lunch)*
  * `{{5}}`: Instructions *(Sample: Complete full 5-day course)*
  * `{{6}}`: Clinic Phone *(Sample: +91 98765 43210)*

---

### Patient Lab Report Ready (`viitsa_patient_lab_report_ready`)
* **Category:** `UTILITY`
* **Sub-category:** `Reservations & appointments → Appointment update`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Diagnostic Report Ready 🔬`
* **Body:**
```text
Dear {{1}},

Your diagnostic test report from {{2}} is now ready.

🧪 Test: {{3}}
👨‍⚕️ Prescribed By: Dr. {{4}}
📅 Report Date: {{5}}

You can view and download your report from the VIITSA patient portal or collect a printed copy at the clinic reception.

📞 For any enquiries, contact clinic at: {{6}}
```
* **Footer:** `VIITSA Healthcare`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Download Lab Report`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/patient/records`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Patient Name *(Sample: Rahul Sharma)*
  * `{{2}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{3}}`: Test Name *(Sample: Complete Blood Count - CBC)*
  * `{{4}}`: Doctor Name *(Sample: Dr. Anita Rao)*
  * `{{5}}`: Date *(Sample: 15 Nov 2026)*
  * `{{6}}`: Clinic Phone *(Sample: +91 98765 43210)*

---

# PART II: CLINIC SUBSCRIPTION & B2B ADMIN NOTIFICATIONS

## 5. Clinic Subscription Lifecycle Templates

### 5.1 30-Day Free Trial Activated (`viitsa_clinic_trial_activated`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Account creation confirmation`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `30-Day Free Trial Activated 🎉`
* **Body:**
```text
Dear {{1}},

Welcome to VIITSA Healthcare! Your 30-day free trial for {{2}} has been successfully activated.

⚡ Plan Tier: {{3}}
📅 Trial Valid Until: {{4}}
💰 Amount Billed Today: ₹0.00

You now have full access to AI health navigation, smart appointments, and digital billing.

📞 For onboarding support, contact VIITSA at: {{5}}
```
* **Footer:** `VIITSA Healthcare Intelligence`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Open Clinic Portal`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/dashboard`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Clinic Admin Name *(Sample: Dr. Vikram Patel)*
  * `{{2}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{3}}`: Plan Name *(Sample: Clinic Pro Plan)*
  * `{{4}}`: Trial Expiry Date *(Sample: 30 Nov 2026)*
  * `{{5}}`: VIITSA Support Phone *(Sample: +91 99999 88888)*

---

### 5.2 Subscription Plan Activated (`viitsa_clinic_sub_activated`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Upgrade confirmation`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Subscription Activated 🚀`
* **Body:**
```text
Dear {{1}},

Your VIITSA subscription for {{2}} is now active.

⚡ Plan: {{3}}
🔄 Billing Cycle: {{4}}
💰 Amount Paid: ₹{{5}}
📅 Next Renewal Date: {{6}}

Thank you for choosing VIITSA to power your digital clinic operations.

📞 For any support, contact VIITSA partner desk at: {{7}}
```
* **Footer:** `VIITSA Healthcare Intelligence`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `View Subscription`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/settings?tab=billing`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Clinic Admin Name *(Sample: Dr. Vikram Patel)*
  * `{{2}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{3}}`: Plan Name *(Sample: Clinic Plan)*
  * `{{4}}`: Billing Cycle *(Sample: Monthly)*
  * `{{5}}`: Amount Paid *(Sample: 5,999.00)*
  * `{{6}}`: Next Renewal Date *(Sample: 15 Dec 2026)*
  * `{{7}}`: VIITSA Support Phone *(Sample: +91 99999 88888)*

---

### 5.3 Subscription Plan Upgraded (`viitsa_clinic_plan_upgraded`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Upgrade confirmation`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Plan Upgrade Confirmed ⬆️`
* **Body:**
```text
Dear {{1}},

Your VIITSA subscription for {{2}} has been successfully upgraded!

📊 Previous Tier: {{3}}
⚡ Upgraded Tier: {{4}}
📅 Effective Date: {{5}}
💰 New Plan Price: ₹{{6}}

Your increased limits for doctors, staff accounts, and AI intakes are now active in real time.

📞 For any billing queries, contact VIITSA at: {{7}}
```
* **Footer:** `VIITSA Healthcare Intelligence`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `View Plan Details`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/settings?tab=billing`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Clinic Admin Name *(Sample: Dr. Vikram Patel)*
  * `{{2}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{3}}`: Previous Plan *(Sample: Solo Plan)*
  * `{{4}}`: Upgraded Plan *(Sample: Clinic Plan)*
  * `{{5}}`: Effective Date *(Sample: 15 Nov 2026)*
  * `{{6}}`: New Price *(Sample: 5,999.00)*
  * `{{7}}`: VIITSA Support Phone *(Sample: +91 99999 88888)*

---

### 5.4 Subscription Plan Downgraded (`viitsa_clinic_plan_downgraded`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Renewal reminder`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Plan Change Scheduled ℹ️`
* **Body:**
```text
Dear {{1}},

We have scheduled a plan change for {{2}} as requested.

📊 Current Plan: {{3}}
⚡ New Scheduled Plan: {{4}}
📅 Effective Date: {{5}}

Your current plan privileges will remain active until the end of your billing cycle on {{6}}.

📞 To review or cancel this change, contact VIITSA at: {{7}}
```
* **Footer:** `VIITSA Healthcare Intelligence`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Manage Subscription`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/settings?tab=billing`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Clinic Admin Name *(Sample: Dr. Vikram Patel)*
  * `{{2}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{3}}`: Current Plan *(Sample: Multispecialty Plan)*
  * `{{4}}`: New Scheduled Plan *(Sample: Clinic Plan)*
  * `{{5}}`: Effective Date *(Sample: 01 Dec 2026)*
  * `{{6}}`: Current Cycle End Date *(Sample: 01 Dec 2026)*
  * `{{7}}`: VIITSA Support Phone *(Sample: +91 99999 88888)*

---

### 5.5 Subscription Renewal Reminder (`viitsa_clinic_sub_renewal_reminder`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Renewal reminder`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Upcoming Subscription Renewal 🔔`
* **Body:**
```text
Dear {{1}},

This is a reminder that the VIITSA subscription for {{2}} will renew shortly.

⚡ Plan: {{3}}
💰 Renewal Amount: ₹{{4}}
📅 Renewal Due Date: {{5}}
💳 Auto-Debit Status: {{6}}

Please ensure your payment method has sufficient funds to avoid service disruption.

📞 For any billing queries, contact VIITSA accounts at: {{7}}
```
* **Footer:** `VIITSA Healthcare Intelligence`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Renew Subscription`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/settings?tab=billing`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Clinic Admin Name *(Sample: Dr. Vikram Patel)*
  * `{{2}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{3}}`: Plan Name *(Sample: Clinic Plan - Monthly)*
  * `{{4}}`: Renewal Amount *(Sample: 5,999.00)*
  * `{{5}}`: Due Date *(Sample: 25 Nov 2026)*
  * `{{6}}`: Auto-Debit Status *(Sample: Scheduled via e-Mandate)*
  * `{{7}}`: VIITSA Support Phone *(Sample: +91 99999 88888)*

---

### 5.6 Subscription Payment Successful (`viitsa_clinic_payment_success`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Renewal confirmation`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Subscription Payment Successful ✅`
* **Body:**
```text
Dear {{1}},

We have successfully processed the subscription payment for {{2}}.

⚡ Plan: {{3}}
💰 Amount Paid: ₹{{4}}
🧾 Transaction Reference: {{5}}
📅 Subscription Active Until: {{6}}

Your official tax invoice has been generated and is available in your clinic dashboard.

📞 For any queries, contact VIITSA accounts at: {{7}}
```
* **Footer:** `VIITSA Healthcare Intelligence`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Download Invoice`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/billing`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Clinic Admin Name *(Sample: Dr. Vikram Patel)*
  * `{{2}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{3}}`: Plan Name *(Sample: Clinic Plan)*
  * `{{4}}`: Amount Paid *(Sample: 5,999.00)*
  * `{{5}}`: Transaction Ref *(Sample: pay_OjhG8374hgd)*
  * `{{6}}`: Active Until Date *(Sample: 25 Dec 2026)*
  * `{{7}}`: VIITSA Support Phone *(Sample: +91 99999 88888)*

---

### 5.7 Subscription Payment Failed (`viitsa_clinic_payment_failed`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Renewal reminder`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Subscription Payment Failed ⚠️`
* **Body:**
```text
Dear {{1}},

We were unable to process the renewal payment for {{2}}'s VIITSA subscription.

⚡ Plan: {{3}}
💰 Due Amount: ₹{{4}}
📌 Reason: {{5}}
⏰ Grace Period Closes On: {{6}}

Please update your card or UPI mandate in your clinic portal to maintain uninterrupted clinic services.

📞 For immediate billing assistance, contact VIITSA at: {{7}}
```
* **Footer:** `VIITSA Healthcare Intelligence`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Retry Payment`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/settings?tab=billing`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Clinic Admin Name *(Sample: Dr. Vikram Patel)*
  * `{{2}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{3}}`: Plan Name *(Sample: Clinic Plan)*
  * `{{4}}`: Due Amount *(Sample: 5,999.00)*
  * `{{5}}`: Decline Reason *(Sample: Insufficient funds or mandate limit reached)*
  * `{{6}}`: Grace Period End *(Sample: 30 Nov 2026)*
  * `{{7}}`: VIITSA Support Phone *(Sample: +91 99999 88888)*

---

### 5.8 Plan Suspended / Deactivated (`viitsa_clinic_sub_deactivated`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Service disruption`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Subscription Suspended ⏸️`
* **Body:**
```text
Dear {{1}},

The VIITSA subscription for {{2}} has been deactivated due to pending renewal.

⚡ Plan: {{3}}
📅 Deactivation Date: {{4}}
📌 Status: {{5}}

Your clinic records and patient history remain safely stored. To restore full access immediately, please log in to your clinic portal and complete renewal.

📞 For urgent reactivation assistance, contact VIITSA at: {{6}}
```
* **Footer:** `VIITSA Healthcare Intelligence`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Reactivate Account`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/settings?tab=billing`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Clinic Admin Name *(Sample: Dr. Vikram Patel)*
  * `{{2}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{3}}`: Plan Name *(Sample: Clinic Plan)*
  * `{{4}}`: Deactivation Date *(Sample: 01 Dec 2026)*
  * `{{5}}`: Status *(Sample: Payment overdue past grace period)*
  * `{{6}}`: VIITSA Support Phone *(Sample: +91 99999 88888)*

---

### 5.9 Subscription Cancelled (`viitsa_clinic_sub_cancelled`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Cancellation confirmation`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Subscription Cancelled 🛑`
* **Body:**
```text
Dear {{1}},

The VIITSA subscription for {{2}} has been cancelled as per your instruction.

⚡ Plan: {{3}}
📅 Access Concludes On: {{4}}

You may continue using your clinic features until {{5}}. Please ensure you export any necessary clinic audit and patient data before this date.

📞 If you wish to reactivate or speak with us, contact VIITSA at: {{6}}
```
* **Footer:** `VIITSA Healthcare Intelligence`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Reactivate Service`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/settings?tab=billing`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Clinic Admin Name *(Sample: Dr. Vikram Patel)*
  * `{{2}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{3}}`: Plan Name *(Sample: Clinic Plan)*
  * `{{4}}`: Final Access Date *(Sample: 30 Nov 2026)*
  * `{{5}}`: End Date *(Sample: 30 Nov 2026)*
  * `{{6}}`: VIITSA Support Phone *(Sample: +91 99999 88888)*

---

### 5.10 Clinic Subscription Tax Invoice with PDF (`viitsa_clinic_sub_invoice`)
* **Category:** `UTILITY`
* **Sub-category:** `Order & billing → Payment receipt / Invoice`
* **Language:** `English (US)` (`en_US`)
* **Header:** Select Type: **Media** → Choose **Document** *(Do not type text. Choose the "Media" option, select "Document", and upload any sample PDF invoice for Meta review)*
* **Body:**
```text
Dear {{1}},

Please find attached the official tax invoice for {{2}}'s VIITSA subscription.

🧾 Invoice No: {{3}}
⚡ Plan: {{4}}
💰 Total Amount: ₹{{5}}
📅 Invoice Date: {{6}}

You can use this invoice for your clinic accounting and GST input tax credit.

📞 For accounts assistance, contact VIITSA finance at: {{7}}
```
* **Footer:** `VIITSA Healthcare Intelligence`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `View Billing History`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/billing`
  * Button Status: `Active`
* **Variables:**
  * Header Document: PDF download URL
  * `{{1}}`: Clinic Admin Name *(Sample: Dr. Vikram Patel)*
  * `{{2}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{3}}`: Invoice Number *(Sample: VIITSA-SUB-829104)*
  * `{{4}}`: Plan Name *(Sample: Clinic Plan - Monthly)*
  * `{{5}}`: Total Amount *(Sample: 5,999.00)*
  * `{{6}}`: Invoice Date *(Sample: 15 Nov 2026)*
  * `{{7}}`: VIITSA Support Phone *(Sample: +91 99999 88888)*

---

### 5.11 Clinic Monthly Quota Warning Alert (`viitsa_clinic_quota_alert`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Service disruption`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Usage Limit Alert ⚠️`
* **Body:**
```text
Dear {{1}},

Your clinic {{2}} has reached {{3}}% of your monthly {{4}} limit on VIITSA.

📊 Used: {{5}} of {{6}}
📅 Quota Resets On: {{7}}

To avoid disruption in patient communications, consider upgrading your subscription or purchasing an add-on pack.

📞 For quota upgrade assistance, contact VIITSA at: {{8}}
```
* **Footer:** `VIITSA Healthcare Intelligence`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Upgrade Quota`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/settings?tab=billing`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Clinic Admin Name *(Sample: Dr. Vikram Patel)*
  * `{{2}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{3}}`: Usage Percentage *(Sample: 85)*
  * `{{4}}`: Quota Type *(Sample: WhatsApp Reminders)*
  * `{{5}}`: Messages Used *(Sample: 2,125)*
  * `{{6}}`: Total Limit *(Sample: 2,500)*
  * `{{7}}`: Reset Date *(Sample: 01 Dec 2026)*
  * `{{8}}`: VIITSA Support Phone *(Sample: +91 99999 88888)*

---

# PART III: COMPANY ADMIN TO CLINICS (VERIFICATIONS & GOVERNANCE)

## 6. Verification Center Templates

### 6.0 Clinic Registration Received / Wait for Approval (`viitsa_clinic_pending_approval`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Account creation confirmation`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Registration Received: Under Review ⏳`
* **Body:**
```text
Dear {{1}},

Thank you for registering {{2}} on VIITSA. Your clinic registration details and documents have been received and are currently under verification by our compliance team.

🏥 Clinic ID: {{3}}
📅 Submission Date: {{4}}
⏳ Review Timeline: 24 to 48 business hours

You will receive a notification as soon as your clinic verification is approved. You can track your approval status anytime from your portal.

📞 For onboarding assistance, contact VIITSA at: {{5}}
```
* **Footer:** `VIITSA Healthcare Intelligence`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Track Status`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/pending-approval`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Clinic Admin Name *(Sample: Dr. Vikram Patel)*
  * `{{2}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{3}}`: Clinic ID *(Sample: CLN-8492)*
  * `{{4}}`: Submission Date *(Sample: 03 Nov 2026)*
  * `{{5}}`: VIITSA Support Phone *(Sample: +91 73961 11081)*

---

### 6.1 Clinic Verification Approved (`viitsa_admin_clinic_verified`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Account creation confirmation`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Clinic Verified & Approved ✅`
* **Body:**
```text
Dear {{1}},

Congratulations! Your clinic {{2}} has been successfully verified and approved by the VIITSA Platform Compliance Team.

🏥 Clinic ID: {{3}}
📅 Verification Date: {{4}}
🔐 Status: Fully Verified & Operational

You now have unrestricted access to patient management, AI Health Navigator triage, and digital queues.

📞 For onboarding assistance, contact VIITSA support at: {{5}}
```
* **Footer:** `VIITSA Healthcare Intelligence`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Access Clinic Portal`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/dashboard`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Clinic Admin Name *(Sample: Dr. Vikram Patel)*
  * `{{2}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{3}}`: Clinic ID *(Sample: CLINIC-8492)*
  * `{{4}}`: Verification Date *(Sample: 15 Nov 2026)*
  * `{{5}}`: VIITSA Support Phone *(Sample: +91 99999 88888)*

---

### 6.2 Clinic Verification Rejected (`viitsa_admin_clinic_rejected`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Cancellation confirmation`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Clinic Verification Update ⚠️`
* **Body:**
```text
Dear {{1}},

We reviewed the registration details for {{2}} and could not verify your clinic at this time.

📌 Reason: {{3}}
📋 Current Status: Verification Incomplete

Please log in to your VIITSA portal to review the requirements and re-upload the necessary documents.

📞 For compliance enquiries, contact VIITSA at: {{4}}
```
* **Footer:** `VIITSA Healthcare Intelligence`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Review & Reapply`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/upload-documents`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Clinic Admin Name *(Sample: Dr. Vikram Patel)*
  * `{{2}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{3}}`: Reason *(Sample: Clinical Establishment Certificate blurred or expired)*
  * `{{4}}`: VIITSA Compliance Phone *(Sample: +91 99999 88888)*

---

### 6.3 Additional Documents Required (`viitsa_admin_clinic_docs_needed`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Account creation confirmation`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Documents Required 📄`
* **Body:**
```text
Dear {{1}},

The VIITSA verification desk requires additional documentation to complete onboarding for {{2}}.

📑 Required Documents: {{3}}
⏰ Upload Deadline: {{4}}

Please upload these documents under Clinic Settings > Verification in your portal to avoid activation delays.

📞 For assistance with uploads, contact VIITSA at: {{5}}
```
* **Footer:** `VIITSA Healthcare Intelligence`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Upload Documents`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/upload-documents`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Clinic Admin Name *(Sample: Dr. Vikram Patel)*
  * `{{2}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{3}}`: Missing Documents *(Sample: Medical Council Registration & Clinic GST Certificate)*
  * `{{4}}`: Deadline *(Sample: 20 Nov 2026)*
  * `{{5}}`: VIITSA Support Phone *(Sample: +91 99999 88888)*

---

### 6.4 Doctor Profile & License Verified / Welcome Member (`viitsa_admin_doctor_verified`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Account creation confirmation`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Doctor Verified & Active 🩺`
* **Body:**
```text
Dear Dr. {{1}},

Welcome! Your doctor profile has been verified and approved by VIITSA Platform Administration. You are now an active member and consulting doctor at {{2}}.

👨‍⚕️ Doctor: Dr. {{3}}
🔐 Consultation Status: Active
📧 Login Email: {{4}}

You can log in to your Doctor Dashboard using your registered email. To set or reset your password, click 'Forgot Password' on the login page or use the link sent to your email.

📞 For doctor desk assistance, contact VIITSA at: {{5}}
```
* **Footer:** `VIITSA Healthcare Intelligence`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Access Doctor Portal`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/login`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Doctor Name *(Sample: Anita Rao)*
  * `{{2}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{3}}`: Doctor Name *(Sample: Anita Rao)*
  * `{{4}}`: Login Email *(Sample: dr.anita@citycare.com)*
  * `{{5}}`: VIITSA Support Phone *(Sample: +91 99999 88888)*

---

### 6.5 Doctor Verification Rejected / Incomplete (`viitsa_admin_doctor_rejected`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Cancellation confirmation`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Doctor Verification Update ⚠️`
* **Body:**
```text
Dear {{1}},

The medical verification for Dr. {{2}} at {{3}} could not be approved.

📌 Reason: {{4}}
📋 Status: Action Required

Please update the doctor's registration certificate and state medical council details in the clinic portal.

📞 For assistance, contact VIITSA doctor desk at: {{5}}
```
* **Footer:** `VIITSA Healthcare Intelligence`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Update Credentials`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/settings?tab=doctors`
  * Button Status: `Active`
* **Variables:**
  * `{{1}}`: Clinic Admin Name *(Sample: Dr. Vikram Patel)*
  * `{{2}}`: Doctor Name *(Sample: Dr. Anita Rao)*
  * `{{3}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{4}}`: Reason *(Sample: State Medical Council certificate not matching full name)*
  * `{{5}}`: VIITSA Support Phone *(Sample: +91 99999 88888)*

---

### 6.6 Doctor Registered by Clinic (`viitsa_doctor_added_by_clinic`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Account creation confirmation`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Clinic Registration Notice`
* **Body:**
```text
Dear Dr. {{1}},

You have been registered as a practicing doctor at {{2}} on the VIITSA Healthcare Platform.

👨‍⚕️ Doctor: Dr. {{3}}
📧 Registered Email: {{4}}
📋 Status: Verification Under Process

A verification and password setup link has been sent to your email. Please verify your email and WhatsApp number to complete your profile.

📞 For clinic queries, contact: {{5}}.
```
* **Footer:** `VIITSA Healthcare`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Open Clinic Portal`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/login`
  * Button Status: `Active`
* **Variables & Sample Values (Click "Add sample" in Meta to fill):**
  * `{{1}}`: Anita Rao
  * `{{2}}`: City Care Clinic
  * `{{3}}`: Anita Rao
  * `{{4}}`: dr.anita@citycare.com
  * `{{5}}`: +91 98765 43210

---

## 7. Company Admin Plan Overrides & Governance

### 7.1 Plan Manually Activated by Company Admin (`viitsa_admin_plan_activated`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Upgrade confirmation`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Plan Activated by Admin`
* **Body:**
```text
Dear {{1}},

A VIITSA platform administrator has manually activated a subscription for {{2}}.

⚡ Activated Plan: {{3}}
📅 Valid Through: {{4}}
📝 Admin Remarks: {{5}}

Your upgraded doctor quotas, staff accounts, and automation flows are now immediately accessible.

📞 For any queries, contact VIITSA admin support at: {{6}}.
```
* **Footer:** `VIITSA Healthcare`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Open Clinic Dashboard`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/dashboard`
  * Button Status: `Active`
* **Variables & Sample Values (Click "Add sample" in Meta to fill):**
  * `{{1}}`: Dr. Vikram Patel
  * `{{2}}`: City Care Clinic
  * `{{3}}`: Clinic Pro Plan
  * `{{4}}`: 31 Dec 2026
  * `{{5}}`: Enterprise partner onboarding approved
  * `{{6}}`: +91 73961 11081

---

### 7.2 Complimentary / Promotional Plan Granted (`viitsa_admin_plan_free_granted`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Upgrade confirmation`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Complimentary Plan Granted`
* **Body:**
```text
Dear {{1}},

VIITSA Healthcare has granted a sponsored promotional plan for {{2}}!

⚡ Granted Tier: {{3}}
📅 Active Period: {{4}}
💰 Price: Free / Sponsored

Enjoy full access to our AI Healthcare Intelligence platform during this sponsorship period.

📞 For partner desk queries, contact VIITSA at: {{5}}.
```
* **Footer:** `VIITSA Healthcare`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Claim Free Access`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/dashboard`
  * Button Status: `Active`
* **Variables & Sample Values (Click "Add sample" in Meta to fill):**
  * `{{1}}`: Dr. Vikram Patel
  * `{{2}}`: City Care Clinic
  * `{{3}}`: Solo Pro Plan - Sponsored
  * `{{4}}`: 90 Days, valid until 15 Feb 2027
  * `{{5}}`: +91 73961 11081

---

### 7.3 Plan Manually Deactivated by Company Admin (`viitsa_admin_plan_deactivated`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Cancellation confirmation`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Plan Deactivated by Platform Admin`
* **Body:**
```text
Dear {{1}},

The VIITSA subscription for {{2}} has been deactivated by a platform administrator.

⚡ Plan: {{3}}
📅 Deactivation Date: {{4}}
📌 Reason: {{5}}

Access to paid features has been paused. Your clinic data and patient history remain safely stored.

📞 To discuss reactivation, contact VIITSA partner support at: {{6}}.
```
* **Footer:** `VIITSA Healthcare`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Contact Admin Support`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/contact`
  * Button Status: `Active`
* **Variables & Sample Values (Click "Add sample" in Meta to fill):**
  * `{{1}}`: Dr. Vikram Patel
  * `{{2}}`: City Care Clinic
  * `{{3}}`: Clinic Plan
  * `{{4}}`: 15 Nov 2026
  * `{{5}}`: Administrative review or request
  * `{{6}}`: +91 73961 11081

---

### 7.4 Clinic Account Suspended by Company Admin (`viitsa_admin_plan_suspended`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Service disruption`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Clinic Account Suspended`
* **Body:**
```text
Dear {{1}},

The account and services for {{2}} have been temporarily suspended by VIITSA platform administration.

📌 Reason: {{3}}
📅 Suspension Date: {{4}}
⚖️ Policy: VIITSA Healthcare Platform Terms & Governance

During suspension, booking queues and patient consultations are frozen. To appeal or resolve this issue, please contact our compliance desk immediately.

📞 For immediate assistance, contact VIITSA compliance at: {{5}}.
```
* **Footer:** `VIITSA Healthcare`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Resolve Suspension`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/pending-approval`
  * Button Status: `Active`
* **Variables & Sample Values (Click "Add sample" in Meta to fill):**
  * `{{1}}`: Dr. Vikram Patel
  * `{{2}}`: City Care Clinic
  * `{{3}}`: Compliance policy violation or regulatory review
  * `{{4}}`: 15 Nov 2026
  * `{{5}}`: +91 73961 11081

---

### 7.5 Suspension Lifted / Plan Restored (`viitsa_admin_plan_reactivated`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Renewal confirmation`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Clinic Account Restored`
* **Body:**
```text
Dear {{1}},

The administrative suspension on {{2}} has been lifted.

⚡ Restored Plan: {{3}}
📅 Reactivation Date: {{4}}
🔐 Account Status: Active & Operational

Your clinic portal, patient queues, and doctor dashboards have been fully restored.

📞 For any operational support, contact VIITSA at: {{5}}.
```
* **Footer:** `VIITSA Healthcare`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Resume Clinic Portal`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/dashboard`
  * Button Status: `Active`
* **Variables & Sample Values (Click "Add sample" in Meta to fill):**
  * `{{1}}`: Dr. Vikram Patel
  * `{{2}}`: City Care Clinic
  * `{{3}}`: Clinic Plan
  * `{{4}}`: 16 Nov 2026
  * `{{5}}`: +91 73961 11081

---

### 7.6 Custom Subscription Payment Request (`viitsa_admin_payment_request`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates → Renewal reminder`
* **Language:** `English (US)` (`en_US`)
* **Header (Text):** `Subscription Payment Request`
* **Body:**
```text
Dear {{1}},

VIITSA Platform Administration has generated a subscription invoice for {{2}}.

⚡ Plan / Add-on: {{3}}
💰 Amount Payable: ₹{{4}}
📅 Due Date: {{5}}
🧾 Invoice Reference: {{6}}

Please log in to your clinic billing dashboard to complete this payment.

📞 For billing assistance, contact VIITSA accounts at: {{7}}.
```
* **Footer:** `VIITSA Healthcare`
* **Buttons:**
  * Type: `Visit website`
  * Button Text: `Pay Invoice Now`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/billing`
  * Button Status: `Active`
* **Variables & Sample Values (Click "Add sample" in Meta to fill):**
  * `{{1}}`: Dr. Vikram Patel
  * `{{2}}`: City Care Clinic
  * `{{3}}`: Clinic Plan Renewal + 1,000 WhatsApp Pack
  * `{{4}}`: 6,999.00
  * `{{5}}`: 20 Nov 2026
  * `{{6}}`: VIITSA-REQ-93810
  * `{{7}}`: +91 73961 11081

