import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";

export const peopleAssetsTable = pgTable("people_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull().references(() => brandsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role"),
  photoUrl: text("photo_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PeopleAsset = typeof peopleAssetsTable.$inferSelect;
export type InsertPeopleAsset = typeof peopleAssetsTable.$inferInsert;
