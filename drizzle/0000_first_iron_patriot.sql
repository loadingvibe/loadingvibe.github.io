CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` integer,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_media_object_key` ON `media` (`object_key`);--> statement-breakpoint
CREATE INDEX `idx_media_note_id` ON `media` (`note_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`emoji` text DEFAULT '🌿' NOT NULL,
	`status` text DEFAULT 'visible' NOT NULL,
	`visitor_hash` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_messages_status_created` ON `messages` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '随笔' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`cover_url` text,
	`status` text DEFAULT 'published' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_notes_slug` ON `notes` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_notes_status_created` ON `notes` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_notes_category_created` ON `notes` (`category`,`created_at`);--> statement-breakpoint
INSERT INTO `notes` (`slug`, `title`, `summary`, `content`, `category`, `tags`, `status`, `created_at`, `updated_at`) VALUES (
	'eight-podcasts-worth-listening',
	'八档值得长期收听的播客',
	'从 AI、商业史与创业，到投资、城市与普通生活，这是旧站播客策展页留下的第一份收藏。',
	'# 八档值得长期收听的播客

这份清单最早来自「有点来电」播客策展页。网站改造后，我把它作为个人笔记库的第一篇记录保留下来。

## 科技与思想

1. **[Dwarkesh Podcast](https://www.dwarkesh.com/p/grant-sanderson-2)**  
   从 AI、科学与经济一路追问到文明未来。研究密度很高，却保留真正对话的开放感。

2. **[硅谷101](https://sv101.fireside.fm/)**  
   通过科学家、创业者与投资人的深度访谈，理解 AI、半导体、机器人等新技术如何工作，又将改变什么。

## 商业与创业

3. **[20VC](https://www.thetwentyminutevc.com/)**  
   快节奏、直接而有能量。顶尖创始人与投资人谈融资、战略、领导力，也谈他们最不温和的判断。

4. **[Acquired](https://open.spotify.com/show/7Fj0XEuUQLUqoMZQdsLXqp)**  
   用数小时讲透一家伟大公司如何长成：完整历史、商业模式、竞争优势与那些决定命运的选择。

5. **[OnBoard!](https://www.xiaoyuzhoufm.com/podcast/61cbaac48bb4cd867fcabe22)**  
   两位投资人与一线实践者聊 AI、SaaS、开源、产品增长和全球化，把投资框架落到真实的公司建设过程。

## 投资与生活

6. **[听懂涨声](https://www.xiaoyuzhoufm.com/podcast/6543750424e7ad2107e8b0b5)**  
   从家庭财富、房产与投资出发，讨论中国中产的现实选择、中年的精神出口和大城市的未来。

7. **[面基](https://www.xiaoyuzhoufm.com/podcast/6388760f22567e8ea6ad070f)**  
   对流行观点多问几个「为什么」。把投资、住房、科技与人生阶段，还原成普通人能够独立判断的问题。

8. **[肥话连篇](https://www.xiaoyuzhoufm.com/podcast/61d50d72ee197a3aac3dac42)**  
   把关系、工作、吃喝旅行与日常烦恼聊成笑声，像坐在两位老朋友旁边，轻松但不空泛。

---

这八档节目适合愿意听完整论证、关心变化，也想形成自己判断的人。',
	'收藏',
	'["播客","科技","商业","生活"]',
	'published',
	'2026-08-03 10:00:00',
	'2026-08-03 10:00:00'
);
