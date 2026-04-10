import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { brandsTable } from "./brands";

export const contentTable = pgTable("content", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(), // ad-copy | social-posts | email | whatsapp | video-scripts
  brandId: uuid("brand_id").notNull().references(() => brandsTable.id, { onDelete: "cascade" }),
  prompt: text("prompt"),
  content: text("content").notNull(),
  platform: text("platform"),
  tone: text("tone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertContentSchema = createInsertSchema(contentTable).omit({ id: true, createdAt: true });
export type InsertContent = z.infer<typeof insertContentSchema>;
export type Content = typeof contentTable.$inferSelect;
