import { pgTable, text, uuid, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const brandsTable = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  websiteUrl: text("website_url"),
  industry: text("industry"),
  targetMarket: text("target_market"),
  logoUrl: text("logo_url"),
  continent: text("continent"),
  country: text("country"),
  city: text("city"),
  language: text("language"),
  instagramHandle: text("instagram_handle"),
  twitterHandle: text("twitter_handle"),
  linkedinUrl: text("linkedin_url"),
  facebookUrl: text("facebook_url"),
  tiktokHandle: text("tiktok_handle"),
  youtubeHandle: text("youtube_handle"),
  whatsappHandle: text("whatsapp_handle"),
  dnaBuilt: boolean("dna_built").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBrandSchema = createInsertSchema(brandsTable).omit({ id: true, createdAt: true, updatedAt: true, dnaBuilt: true });
export type InsertBrand = z.infer<typeof insertBrandSchema>;
export type Brand = typeof brandsTable.$inferSelect;
