-- ============================================================
-- Branch Visit Tracker — Database Reset Script
-- Run this ONCE in your MySQL client (Railway, TablePlus, etc.)
-- Then run: pnpm db:push && pnpm seed
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Drop all old tables (including Manus-era tables)
DROP TABLE IF EXISTS `visits`;
DROP TABLE IF EXISTS `managerBranches`;
DROP TABLE IF EXISTS `managers`;
DROP TABLE IF EXISTS `branches`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `__drizzle_migrations`;
DROP TABLE IF EXISTS `drizzle_migrations`;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- Create fresh tables matching the new schema
-- ============================================================

CREATE TABLE `users` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `username`     VARCHAR(64)  NOT NULL UNIQUE,
  `passwordHash` VARCHAR(255) NOT NULL,
  `name`         TEXT,
  `email`        VARCHAR(320),
  `role`         ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  `createdAt`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE `branches` (
  `id`                   INT AUTO_INCREMENT PRIMARY KEY,
  `name`                 VARCHAR(255) NOT NULL,
  `code`                 VARCHAR(64)  NOT NULL UNIQUE,
  `address`              TEXT,
  `latitude`             TEXT NOT NULL,
  `longitude`            TEXT NOT NULL,
  `geofenceRadiusMeters` INT  NOT NULL DEFAULT 200,
  `isActive`             ENUM('yes', 'no') NOT NULL DEFAULT 'yes',
  `createdAt`            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE `managers` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `userId`       INT NOT NULL,
  `employeeCode` VARCHAR(64),
  `phone`        VARCHAR(32),
  `isActive`     ENUM('yes', 'no') NOT NULL DEFAULT 'yes',
  `createdAt`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

CREATE TABLE `managerBranches` (
  `id`        INT AUTO_INCREMENT PRIMARY KEY,
  `managerId` INT NOT NULL,
  `branchId`  INT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`managerId`) REFERENCES `managers`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`branchId`)  REFERENCES `branches`(`id`) ON DELETE CASCADE
);

CREATE TABLE `visits` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `managerId`   INT NOT NULL,
  `branchId`    INT NOT NULL,
  `checkInAt`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `checkOutAt`  TIMESTAMP NULL,
  `latitudeIn`  TEXT NOT NULL,
  `longitudeIn` TEXT NOT NULL,
  `accuracyIn`  TEXT,
  `photoUrl`    TEXT,
  `notes`       TEXT,
  `status`      ENUM('checked_in', 'checked_out') NOT NULL DEFAULT 'checked_in',
  `createdAt`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`managerId`) REFERENCES `managers`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`branchId`)  REFERENCES `branches`(`id`) ON DELETE CASCADE
);

-- ============================================================
-- Done! Now run:  pnpm seed
-- Login with:     admin / admin123
-- ============================================================
SELECT 'Database reset complete! Run: pnpm seed' AS status;
