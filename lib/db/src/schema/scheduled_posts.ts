import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";

export const scheduledPostsTable = pgTable("scheduled_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull().references(() => brandsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(),
  contentId: uuid("content_id"),
  designId: uuid("design_id"),
  platform: text("platform").notNull(),
  postType: text("post_type").notNull(),
  caption: text("caption"),
  hashtags: text("hashtags").array().default([]),
  mediaUrls: text("media_urls").array().default([]),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  timezone: text("timezone").default("Africa/Lagos"),
  status: text("status").default("scheduled").notNull(),
  platformPostId: text("platform_post_id"),
  errorMessage: text("error_message"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ScheduledPost = typeof scheduledPostsTable.$inferSelect;
export type InsertScheduledPost = typeof scheduledPostsTable.$inferInsert;
