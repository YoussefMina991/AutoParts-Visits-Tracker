-- ============================================================
-- Migration: Add 'superadmin' to users.role enum
-- Run this manually on your MySQL database if db:push fails
-- ============================================================

ALTER TABLE `users`
  MODIFY COLUMN `role` ENUM('user', 'admin', 'superadmin') NOT NULL DEFAULT 'user';

-- ============================================================
-- To create a superadmin account, run this (change username/password hash as needed):
-- The password below is bcrypt hash for "SuperPass123!" — change it!
-- ============================================================
-- INSERT INTO `users` (`username`, `passwordHash`, `name`, `role`, `createdAt`, `updatedAt`)
-- VALUES ('superadmin', '$2b$10$YourHashHere', 'Super Admin', 'superadmin', NOW(), NOW());

-- To upgrade an existing user to superadmin:
-- UPDATE `users` SET `role` = 'superadmin' WHERE `username` = 'your_username_here';
