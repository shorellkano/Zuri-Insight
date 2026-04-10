import { pgTable, text, uuid, boolean, timestamp } from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";

export const lessonsTable = pgTable("lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull().references(() => brandsTable.id, { onDelete: "cascade" }),
  rule: text("rule").notNull(),
  contentType: text("content_type"),
  platform: text("platform"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Lesson = typeof lessonsTable.$inferSelect;
export type InsertLesson = typeof lessonsTable.$inferInsert;
