/*
# Add auth_user_id column to patient_accounts

1. Changes
- Add `auth_user_id` column (uuid, nullable) to `patient_accounts` to link patient accounts with Supabase Auth users (for mobile OTP login).
- No RLS policy changes — existing policies remain intact.
- No data loss — column is nullable, existing rows keep their current values.

2. Security
- No new policies needed. Existing anon/authenticated policies on patient_accounts remain unchanged.
- The column is informational only — it links a patient_accounts row to its Supabase Auth user for OTP-based login.
*/

ALTER TABLE patient_accounts
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;
