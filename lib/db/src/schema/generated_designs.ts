import { pgTable, text, uuid, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";

export const generatedDesignsTable = pgTable("generated_designs", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull().references(() => brandsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(),
  designType: text("design_type").notNull(),
  platform: text("platform"),
  title: text("title"),
  slides: jsonb("slides").default([]),
  imageUrls: text("image_urls").array().default([]),
  promptUsed: text("prompt_used"),
  isFavourite: boolean("is_favourite").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GeneratedDesign = typeof generatedDesignsTable.$inferSelect;
export type InsertGeneratedDesign = typeof generatedDesignsTable.$inferInsert;
