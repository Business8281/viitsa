-- Add new fields to patient_accounts
ALTER TABLE patient_accounts
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS dob date,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS current_medications text[] DEFAULT '{}';

-- Add matching fields to patients
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS dob date,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS current_medications text[] DEFAULT '{}';

-- Family members table
CREATE TABLE IF NOT EXISTS family_members (
  family_member_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES patient_accounts(account_id) ON DELETE CASCADE,
  name text NOT NULL,
  relationship text NOT NULL,
  dob date,
  gender text,
  blood_group text,
  conditions text[] DEFAULT '{}',
  allergies text[] DEFAULT '{}',
  medications text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_family_members" ON family_members FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_own_family_members" ON family_members FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_own_family_members" ON family_members FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_own_family_members" ON family_members FOR DELETE
  TO anon, authenticated USING (true);

-- Reward points table
CREATE TABLE IF NOT EXISTS patient_reward_points (
  points_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES patient_accounts(account_id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  reason text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE patient_reward_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_rewards" ON patient_reward_points FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_own_rewards" ON patient_reward_points FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_own_rewards" ON patient_reward_points FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_own_rewards" ON patient_reward_points FOR DELETE
  TO anon, authenticated USING (true);

-- Add ai_summary column to appointments for attaching triage summary
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS ai_summary jsonb;
