CREATE TABLE `venue_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`latitude_e6` integer NOT NULL,
	`longitude_e6` integer NOT NULL,
	`sports` text NOT NULL,
	`image` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`reviewed_at` integer,
	`approved_venue_id` text,
	FOREIGN KEY (`approved_venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `venue_request_status_idx` ON `venue_requests` (`status`,`created_at`);