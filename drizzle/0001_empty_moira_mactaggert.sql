CREATE TABLE `buyers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`city` text,
	`state` text,
	`application_status` text DEFAULT 'Inquiry' NOT NULL,
	`preferred_sex` text,
	`preferred_color` text,
	`household_notes` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `buyers_email_idx` ON `buyers` (`email`);--> statement-breakpoint
CREATE TABLE `dogs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`registered_name` text,
	`sex` text NOT NULL,
	`role` text NOT NULL,
	`date_of_birth` text,
	`color` text,
	`weight` real,
	`registration_number` text,
	`microchip_number` text,
	`health_testing` text,
	`status` text DEFAULT 'Active' NOT NULL,
	`next_heat_date` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `dogs_name_idx` ON `dogs` (`name`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`event_type` text NOT NULL,
	`event_date` text NOT NULL,
	`event_time` text,
	`related_type` text,
	`related_id` integer,
	`location` text,
	`status` text DEFAULT 'Scheduled' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_date_idx` ON `events` (`event_date`);--> statement-breakpoint
CREATE TABLE `litters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`dam_id` integer,
	`sire_id` integer,
	`breeding_date` text,
	`due_date` text,
	`birth_date` text,
	`expected_count` integer,
	`status` text DEFAULT 'Planned' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`dam_id`) REFERENCES `dogs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sire_id`) REFERENCES `dogs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `litters_status_idx` ON `litters` (`status`);--> statement-breakpoint
CREATE TABLE `puppies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`litter_id` integer NOT NULL,
	`buyer_id` integer,
	`name` text NOT NULL,
	`sex` text,
	`color` text,
	`birth_date` text,
	`birth_weight` real,
	`current_weight` real,
	`status` text DEFAULT 'Available' NOT NULL,
	`price_cents` integer,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`litter_id`) REFERENCES `litters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`buyer_id`) REFERENCES `buyers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `puppies_litter_idx` ON `puppies` (`litter_id`);--> statement-breakpoint
CREATE TABLE `puppy_updates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`puppy_id` integer NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`week_number` integer,
	`weight` real,
	`published` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`puppy_id`) REFERENCES `puppies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `updates_puppy_idx` ON `puppy_updates` (`puppy_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`buyer_id` integer,
	`litter_id` integer,
	`puppy_id` integer,
	`category` text,
	`description` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`due_date` text,
	`paid_date` text,
	`status` text DEFAULT 'Pending' NOT NULL,
	`method` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`buyer_id`) REFERENCES `buyers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`litter_id`) REFERENCES `litters`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`puppy_id`) REFERENCES `puppies`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `transactions_type_idx` ON `transactions` (`type`);