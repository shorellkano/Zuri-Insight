import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { brandsTable } from "./brands";

export const brandDnaTable = pgTable("brand_dna", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull().references(() => brandsTable.id, { onDelete: "cascade" }).unique(),
  buildStatus: text("build_status").notNull().default("complete"),
  errorMessage: text("error_message"),
  toneOfVoice: text("tone_of_voice").notNull().default(""),
  coreValues: text("core_values").array().notNull().default([]),
  targetAudience: text("target_audience").notNull().default(""),
  uniqueSellingPoints: text("unique_selling_points").array().notNull().default([]),
  culturalContext: text("cultural_context").notNull().default(""),
  brandPersonality: text("brand_personality").notNull().default(""),
  keyMessages: text("key_messages").array().notNull().default([]),
  writingStyle: text("writing_style").notNull().default(""),
  builtAt: timestamp("built_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBrandDnaSchema = createInsertSchema(brandDnaTable).omit({ id: true, builtAt: true });
export type InsertBrandDna = z.infer<typeof insertBrandDnaSchema>;
export type BrandDna = typeof brandDnaTable.$inferSelect;
