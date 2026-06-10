import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";

export const socialConnectionsTable = pgTable("social_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull().references(() => brandsTable.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  accessToken: text("access_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  igUserId: text("ig_user_id"),
  igUsername: text("ig_username"),
  pageId: text("page_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SocialConnection = typeof socialConnectionsTable.$inferSelect;
export type InsertSocialConnection = typeof socialConnectionsTable.$inferInsert;
