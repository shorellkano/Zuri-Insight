import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";

export const brandVisualPrefsTable = pgTable("brand_visual_prefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull().unique().references(() => brandsTable.id, { onDelete: "cascade" }),
  includeLogo: text("include_logo").default("ask").notNull(),
  logoUrl: text("logo_url"),
  brandColors: text("brand_colors").array().default([]),
  designStyle: text("design_style").default("professional").notNull(),
  fontPreference: text("font_preference").default("modern"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BrandVisualPrefs = typeof brandVisualPrefsTable.$inferSelect;
export type InsertBrandVisualPrefs = typeof brandVisualPrefsTable.$inferInsert;
