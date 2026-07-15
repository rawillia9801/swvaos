CREATE TABLE `dog_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dog_id` integer NOT NULL,
	`document_type` text NOT NULL,
	`registry` text,
	`registration_number` text,
	`title` text NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`dog_id`) REFERENCES `dogs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dog_documents_object_key_unique` ON `dog_documents` (`object_key`);--> statement-breakpoint
CREATE INDEX `dog_documents_dog_idx` ON `dog_documents` (`dog_id`);--> statement-breakpoint
CREATE INDEX `dog_documents_type_idx` ON `dog_documents` (`document_type`);--> statement-breakpoint
CREATE TABLE `dog_medical_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dog_id` integer NOT NULL,
	`record_type` text NOT NULL,
	`title` text NOT NULL,
	`record_date` text,
	`provider` text,
	`cost_cents` integer DEFAULT 0 NOT NULL,
	`next_due_date` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`dog_id`) REFERENCES `dogs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dog_medical_records_dog_idx` ON `dog_medical_records` (`dog_id`);--> statement-breakpoint
CREATE INDEX `dog_medical_records_date_idx` ON `dog_medical_records` (`record_date`);--> statement-breakpoint
ALTER TABLE `dogs` ADD `acquired_from` text;--> statement-breakpoint
ALTER TABLE `dogs` ADD `acquisition_date` text;--> statement-breakpoint
ALTER TABLE `dogs` ADD `purchase_price_cents` integer;--> statement-breakpoint
ALTER TABLE `dogs` ADD `acquisition_notes` text;