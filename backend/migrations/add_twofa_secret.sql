-- Migration: Add twofa_secret column to users table
-- Purpose: Store 2FA secret for TOTP verification

ALTER TABLE users
ADD COLUMN IF NOT EXISTS twofa_secret VARCHAR(255);

-- Verify the column was added
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users';
