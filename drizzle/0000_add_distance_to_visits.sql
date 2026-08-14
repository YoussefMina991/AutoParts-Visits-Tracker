CREATE TABLE `branches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`code` varchar(64) NOT NULL,
	`address` text,
	`latitude` text NOT NULL,
	`longitude` text NOT NULL,
	`geofenceRadiusMeters` int NOT NULL DEFAULT 200,
	`isActive` enum('yes','no') NOT NULL DEFAULT 'yes',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `branches_id` PRIMARY KEY(`id`),
	CONSTRAINT `branches_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `locationLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`managerId` int NOT NULL,
	`latitude` text NOT NULL,
	`longitude` text NOT NULL,
	`accuracy` text,
	`timestamp` timestamp NOT NULL,
	`syncedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `locationLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `managerBranches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`managerId` int NOT NULL,
	`branchId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `managerBranches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `managers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`employeeCode` varchar(64),
	`phone` varchar(32),
	`isActive` enum('yes','no') NOT NULL DEFAULT 'yes',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `managers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(64) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`name` text,
	`email` varchar(320),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `visits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`managerId` int NOT NULL,
	`branchId` int NOT NULL,
	`checkInAt` timestamp NOT NULL DEFAULT (now()),
	`checkOutAt` timestamp,
	`latitudeIn` text NOT NULL,
	`longitudeIn` text NOT NULL,
	`accuracyIn` text,
	`photoUrl` text,
	`notes` text,
	`status` enum('checked_in','checked_out') NOT NULL DEFAULT 'checked_in',
	`distanceToPrevBranchKm` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `visits_id` PRIMARY KEY(`id`)
);
