import { pgTable, text, uuid, timestamp, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { brandsTable } from "./brands";

export const mediaPostsTable = pgTable("media_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull().references(() => brandsTable.id, { onDelete: "cascade" }),
  mediaUrls: text("media_urls").array().default(sql`'{}'::text[]`),
  mediaLabels: text("media_labels").array().default(sql`'{}'::text[]`),
  mediaType: text("media_type"),
  category: text("category"),
  context: text("context"),
  existingCaption: text("existing_caption"),
  callToAction: text("call_to_action"),
  generatedCaptions: jsonb("generated_captions").default(sql`'{}'::jsonb`),
  platformsPosted: text("platforms_posted").array().default(sql`'{}'::text[]`),
  postStatus: text("post_status").default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MediaPost = typeof mediaPostsTable.$inferSelect;
export type InsertMediaPost = typeof mediaPostsTable.$inferInsert;
