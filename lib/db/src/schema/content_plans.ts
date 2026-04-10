import { pgTable, text, uuid, date, timestamp } from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";

export const contentPlansTable = pgTable("content_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull().references(() => brandsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(),
  planName: text("plan_name"),
  periodType: text("period_type"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  platforms: text("platforms").array().default([]),
  status: text("status").default("draft").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contentPlanItemsTable = pgTable("content_plan_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  planId: uuid("plan_id").notNull().references(() => contentPlansTable.id, { onDelete: "cascade" }),
  brandId: uuid("brand_id").notNull().references(() => brandsTable.id, { onDelete: "cascade" }),
  platform: text("platform"),
  postType: text("post_type"),
  suggestedDate: date("suggested_date").notNull(),
  suggestedTime: text("suggested_time").default("09:00"),
  contentTheme: text("content_theme"),
  calendarEvent: text("calendar_event"),
  captionDraft: text("caption_draft"),
  designBrief: text("design_brief"),
  contentAngle: text("content_angle"),
  status: text("status").default("draft").notNull(),
  contentId: uuid("content_id"),
  designId: uuid("design_id"),
  scheduledPostId: uuid("scheduled_post_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ContentPlan = typeof contentPlansTable.$inferSelect;
export type InsertContentPlan = typeof contentPlansTable.$inferInsert;
export type ContentPlanItem = typeof contentPlanItemsTable.$inferSelect;
export type InsertContentPlanItem = typeof contentPlanItemsTable.$inferInsert;
