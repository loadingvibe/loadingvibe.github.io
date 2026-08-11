import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const notes = sqliteTable(
  "notes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    content: text("content").notNull().default(""),
    category: text("category").notNull().default("随笔"),
    tags: text("tags").notNull().default("[]"),
    coverUrl: text("cover_url"),
    status: text("status").notNull().default("published"),
    favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_notes_slug").on(table.slug),
    index("idx_notes_status_created").on(table.status, table.createdAt),
    index("idx_notes_category_created").on(table.category, table.createdAt),
  ],
);

export const media = sqliteTable(
  "media",
  {
    id: text("id").primaryKey(),
    noteId: integer("note_id").references(() => notes.id, { onDelete: "set null" }),
    objectKey: text("object_key").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("idx_media_object_key").on(table.objectKey),
    index("idx_media_note_id").on(table.noteId),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    content: text("content").notNull(),
    emoji: text("emoji").notNull().default("🌿"),
    status: text("status").notNull().default("visible"),
    visitorHash: text("visitor_hash"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("idx_messages_status_created").on(table.status, table.createdAt)],
);
