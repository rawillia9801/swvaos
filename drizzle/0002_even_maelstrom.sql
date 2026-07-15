CREATE TABLE `buyer_document_puppies` (
	`document_id` integer NOT NULL,
	`puppy_id` integer NOT NULL,
	PRIMARY KEY(`document_id`, `puppy_id`),
	FOREIGN KEY (`document_id`) REFERENCES `buyer_documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`puppy_id`) REFERENCES `puppies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `buyer_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`buyer_id` integer NOT NULL,
	`payment_plan_id` integer,
	`document_type` text NOT NULL,
	`title` text NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`buyer_id`) REFERENCES `buyers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`payment_plan_id`) REFERENCES `payment_plans`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `buyer_documents_object_key_unique` ON `buyer_documents` (`object_key`);--> statement-breakpoint
CREATE INDEX `buyer_documents_buyer_idx` ON `buyer_documents` (`buyer_id`);--> statement-breakpoint
CREATE INDEX `buyer_documents_plan_idx` ON `buyer_documents` (`payment_plan_id`);--> statement-breakpoint
CREATE TABLE `payment_plan_puppies` (
	`payment_plan_id` integer NOT NULL,
	`puppy_id` integer NOT NULL,
	PRIMARY KEY(`payment_plan_id`, `puppy_id`),
	FOREIGN KEY (`payment_plan_id`) REFERENCES `payment_plans`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`puppy_id`) REFERENCES `puppies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `payment_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`buyer_id` integer NOT NULL,
	`name` text DEFAULT 'Puppy payment plan' NOT NULL,
	`total_amount_cents` integer NOT NULL,
	`payment_amount_cents` integer NOT NULL,
	`term_count` integer NOT NULL,
	`frequency` text DEFAULT 'Monthly' NOT NULL,
	`start_date` text,
	`next_due_date` text,
	`on_time_credit_cents` integer DEFAULT 0 NOT NULL,
	`credit_eligible` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`buyer_id`) REFERENCES `buyers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payment_plans_buyer_idx` ON `payment_plans` (`buyer_id`);--> statement-breakpoint
CREATE INDEX `payment_plans_status_idx` ON `payment_plans` (`status`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `payment_plan_id` integer REFERENCES payment_plans(id);