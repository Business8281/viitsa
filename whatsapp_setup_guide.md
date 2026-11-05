# VIITSA — WhatsApp Business Cloud API Setup & Environment Guide

This document preserves the required environment variables and the step-by-step instructions to retrieve all credentials from Meta.

---

## 1. Environment Variables Configuration (`functions/.env`)

```env
# ==========================================
# META WHATSAPP CLOUD API CONFIGURATION (VERIFIED)
# ==========================================
WHATSAPP_PHONE_NUMBER_ID=1446373325215641
WHATSAPP_BUSINESS_ACCOUNT_ID=1126013520183271
WHATSAPP_ACCESS_TOKEN=EAAedaYajQtMBSyegE379ga0qsYKrMhEGLqQuaOnbAPfVNiCzaINTcov3JjGhYtN8KWmScsdrOtto3tdmLXRqxRUQoXgWS3tD510ZCxkxSnaouA9iNkRHEbocEhLJqKWWxXQRfSv8WoPI8w11Oi8JNAX8ThIGoNZAfnWHZATVs0MVvupeLCi11f9NNVMbQZDZD
WHATSAPP_API_VERSION=v21.0

# Webhook Security (Delivery receipts, read status, patient replies)
WHATSAPP_WEBHOOK_VERIFY_TOKEN=viitsa_whatsapp_webhook_secret_2026
WHATSAPP_APP_SECRET=your_meta_app_secret_here

# Pre-Approved Meta Template Names (Active & Approved in your Meta Account)
WHATSAPP_DEFAULT_LANG=en_US
WHATSAPP_TEMPLATE_OTP=phone_login_otps
WHATSAPP_TEMPLATE_APPT_CONFIRM_ONLINE=viitsa_appt_confirm_online
WHATSAPP_TEMPLATE_APPT_CONFIRM_FOLLOWUP=viitsa_appt_confirm_followup
WHATSAPP_TEMPLATE_APPT_CONFIRM_REPORT=viitsa_appt_confirm_report
WHATSAPP_TEMPLATE_APPT_CONFIRM_WALKIN=viitsa_appt_confirm_walkin
WHATSAPP_TEMPLATE_APPT_REMINDER=viitsa_appointment_reminder
WHATSAPP_TEMPLATE_APPT_CANCELLED=viitsa_appointment_cancelled
WHATSAPP_TEMPLATE_INVOICE=viitsa_patient_invoice
WHATSAPP_TEMPLATE_PATIENT_PAYMENT_REMINDER=viitsa_patient_payment_reminder
WHATSAPP_TEMPLATE_PATIENT_FOLLOWUP_DUE=viitsa_patient_followup_due
WHATSAPP_TEMPLATE_PATIENT_LAB_REPORT=viitsa_patient_lab_report_ready

# Pre-Approved Meta Template Names (Clinic Subscriptions B2B)
WHATSAPP_TEMPLATE_CLINIC_TRIAL_ACTIVATED=viitsa_clinic_trial_activated
WHATSAPP_TEMPLATE_CLINIC_SUB_ACTIVATED=viitsa_clinic_sub_activated
WHATSAPP_TEMPLATE_CLINIC_PLAN_UPGRADED=viitsa_clinic_plan_upgraded
WHATSAPP_TEMPLATE_CLINIC_PLAN_DOWNGRADED=viitsa_clinic_plan_downgraded
WHATSAPP_TEMPLATE_CLINIC_RENEWAL_REMINDER=viitsa_clinic_sub_renewal_reminder
WHATSAPP_TEMPLATE_CLINIC_PAYMENT_SUCCESS=viitsa_clinic_payment_success
WHATSAPP_TEMPLATE_CLINIC_PAYMENT_FAILED=viitsa_clinic_payment_failed
WHATSAPP_TEMPLATE_CLINIC_SUB_DEACTIVATED=viitsa_clinic_sub_deactivated
WHATSAPP_TEMPLATE_CLINIC_SUB_CANCELLED=viitsa_clinic_sub_cancelled
WHATSAPP_TEMPLATE_CLINIC_SUB_INVOICE=viitsa_clinic_sub_invoice
WHATSAPP_TEMPLATE_CLINIC_QUOTA_ALERT=viitsa_clinic_quota_alert

# Pre-Approved Meta Template Names (Company Admin to Clinics / Governance)
WHATSAPP_TEMPLATE_CLINIC_PENDING_APPROVAL=viitsa_clinic_pending_approval
WHATSAPP_TEMPLATE_ADMIN_CLINIC_VERIFIED=viitsa_admin_clinic_verified
WHATSAPP_TEMPLATE_ADMIN_CLINIC_REJECTED=viitsa_admin_clinic_rejected
WHATSAPP_TEMPLATE_ADMIN_CLINIC_DOCS_NEEDED=viitsa_admin_clinic_docs_needed
WHATSAPP_TEMPLATE_ADMIN_DOCTOR_VERIFIED=viitsa_admin_doctor_verified
WHATSAPP_TEMPLATE_ADMIN_DOCTOR_REJECTED=viitsa_admin_doctor_rejected
WHATSAPP_TEMPLATE_ADMIN_PLAN_ACTIVATED=viitsa_admin_plan_activated
WHATSAPP_TEMPLATE_ADMIN_PLAN_FREE_GRANTED=viitsa_admin_plan_free_granted
WHATSAPP_TEMPLATE_ADMIN_PLAN_DEACTIVATED=viitsa_admin_plan_deactivated
WHATSAPP_TEMPLATE_ADMIN_PLAN_SUSPENDED=viitsa_admin_plan_suspended
WHATSAPP_TEMPLATE_ADMIN_PLAN_REACTIVATED=viitsa_admin_plan_reactivated
WHATSAPP_TEMPLATE_ADMIN_PAYMENT_REQUEST=viitsa_admin_payment_request
```

---

## 2. Step-by-Step Meta Portal Retrieval Guide

### Step 1: `WHATSAPP_BUSINESS_ACCOUNT_ID` (WABA ID)
1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps) > Select your App.
2. In the left sidebar, navigate to **WhatsApp** > **API Setup**.
3. Under **Send and receive messages**, locate **WhatsApp Business Account ID** directly beside/below your Phone Number ID.

### Step 2: `WHATSAPP_APP_SECRET`
1. In Meta Developer Dashboard, click **App settings** > **Basic** in the left sidebar.
2. Locate **App secret**, click **Show**, enter your account password, and copy it.

### Step 3: Permanent `WHATSAPP_ACCESS_TOKEN` (System User Token)
> [!WARNING]
> Never use temporary 24-hour tokens in production.

1. Open [business.facebook.com/settings](https://business.facebook.com/settings) (Meta Business Settings).
2. Under **Users**, click **System Users** > Click **Add**:
   * Name: `viitsa-backend-bot`
   * Role: **Admin**
3. Select the created System User > Click **Assign Assets**:
   * **Apps** > Select App > Grant **Manage App** (Full Control).
   * **WhatsApp Accounts** > Select Account > Grant **Manage WhatsApp Account** (Full Control).
4. Click **Generate New Token**:
   * App: Select your app.
   * Token Expiration: **Never**.
   * Permissions: `whatsapp_business_messaging` and `whatsapp_business_management`.
5. Copy and store the token immediately.

### Step 4: `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
* Define any secure random string (e.g. UUID).
* Set it in `functions/.env` and paste the identical string in Meta App Dashboard > **WhatsApp** > **Configuration** > **Webhook** > **Verify Token**.

---

## 3. Clinic Verification & Lifecycle Templates (Meta Manager Ready)

### 3.1 Clinic Registration Received / Wait for Approval (`viitsa_clinic_pending_approval`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates` → `Account creation confirmation`
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
  * Type: `Visit website` (URL)
  * Button Text: `Track Status`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/pending-approval`
  * Button Status: `Active`
* **Variables & Sample Values for Meta:**
  * `{{1}}`: Clinic Admin Name *(Sample: Dr. Vikram Patel)*
  * `{{2}}`: Clinic Name *(Sample: City Care Clinic)*
  * `{{3}}`: Clinic ID *(Sample: CLN-8492)*
  * `{{4}}`: Submission Date *(Sample: 03 Nov 2026)*
  * `{{5}}`: VIITSA Support Phone *(Sample: +91 73961 11081)*

---

### 3.2 Clinic Verification Approved (`viitsa_admin_clinic_verified`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates` → `Account creation confirmation`
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
  * Type: `Visit website` (URL)
  * Button Text: `Access Clinic Portal`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/dashboard`
  * Button Status: `Active`

---

### 3.3 Clinic Verification Rejected with Reason (`viitsa_admin_clinic_rejected`)
* **Category:** `UTILITY`
* **Sub-category:** `Account updates` → `Cancellation confirmation`
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
  * Type: `Visit website` (URL)
  * Button Text: `Review & Reapply`
  * URL Type: `Static`
  * Website URL: `https://viitsa.com/clinic/upload-documents`
  * Button Status: `Active`


