CREATE TABLE `records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`amount` integer,
	`status` text DEFAULT 'Active' NOT NULL,
	`date` text,
	`created_at` text NOT NULL
);
