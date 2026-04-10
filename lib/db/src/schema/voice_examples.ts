import { pgTable, text, uuid, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";

export const voiceExamplesTable = pgTable("voice_examples", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull().references(() => brandsTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  isPinned: boolean("is_pinned").notNull().default(false),
  qualityScore: integer("quality_score").notNull().default(5),
  contentType: text("content_type"),
  platform: text("platform"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type VoiceExample = typeof voiceExamplesTable.$inferSelect;
export type InsertVoiceExample = typeof voiceExamplesTable.$inferInsert;
