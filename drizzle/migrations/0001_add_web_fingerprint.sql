-- Migration: Add Web Fingerprint Binding columns to users table
-- Date: 2026-09-03
-- Purpose: Allow managers to log in from iPhone browser (Safari/Chrome)
--          with the same security as Android Device Binding

ALTER TABLE users
  ADD COLUMN boundWebFingerprint VARCHAR(256) NULL AFTER deviceBoundAt,
  ADD COLUMN webFingerprintAt TIMESTAMP NULL AFTER boundWebFingerprint;
