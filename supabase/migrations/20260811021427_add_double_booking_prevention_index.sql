/*
# Add Double-Booking Prevention Index

## Summary
First removes duplicate appointment rows that conflict with the unique
constraint, then creates a partial unique index to prevent double-booking
at the database level.

## Changes
1. Deletes duplicate appointments keeping only the earliest created one
   per (clinic_id, doctor_id, date, time_slot) where status is active.
2. Creates a partial unique index on appointments for active statuses.
*/

-- Remove duplicate active appointments, keeping the earliest created
DELETE FROM appointments a
WHERE a.appt_id IN (
  SELECT appt_id FROM (
    SELECT
      appt_id,
      ROW_NUMBER() OVER (
        PARTITION BY clinic_id, doctor_id, date, time_slot
        ORDER BY created_at ASC
      ) AS rn
    FROM appointments
    WHERE status NOT IN ('cancelled', 'done', 'no-show')
  ) dupes
  WHERE rn > 1
);

-- Create partial unique index to prevent double-booking
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_no_double_book
  ON appointments(clinic_id, doctor_id, date, time_slot)
  WHERE status NOT IN ('cancelled', 'done', 'no-show');
