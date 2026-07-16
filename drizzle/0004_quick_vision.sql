CREATE TABLE `dog_registrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dog_id` integer NOT NULL,
	`registry` text NOT NULL,
	`registration_number` text NOT NULL,
	`registered_name` text,
	`issue_date` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`dog_id`) REFERENCES `dogs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dog_registrations_dog_idx` ON `dog_registrations` (`dog_id`);--> statement-breakpoint
ALTER TABLE `dog_documents` ADD `registration_id` integer REFERENCES dog_registrations(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `dog_documents_registration_idx` ON `dog_documents` (`registration_id`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `dog_id` integer REFERENCES dogs(id) ON DELETE SET NULL;
