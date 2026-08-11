ALTER TABLE `notes` ADD `favorite` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `notes` SET `favorite` = true WHERE `category` = '收藏';
