import { pgTable, text, uuid, integer, boolean, date, timestamp } from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";
import { peopleAssetsTable } from "./people_assets";

export const calendarEventsTable = pgTable("calendar_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  eventType: text("event_type").notNull(),
  month: integer("month"),
  day: integer("day"),
  isFloating: boolean("is_floating").default(false),
  floatingRule: text("floating_rule"),
  countries: text("countries").array().default([]),
  continent: text("continent"),
  religions: text("religions").array().default([]),
  contentAngle: text("content_angle"),
  leadDays: integer("lead_days").default(3),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const brandCalendarEventsTable = pgTable("brand_calendar_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull().references(() => brandsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  eventType: text("event_type"),
  eventDate: date("event_date").notNull(),
  isRecurring: boolean("is_recurring").default(true),
  personName: text("person_name"),
  personRole: text("person_role"),
  peopleAssetId: uuid("people_asset_id").references(() => peopleAssetsTable.id, { onDelete: "set null" }),
  notes: text("notes"),
  autoGenerate: boolean("auto_generate").default(true),
  leadDays: integer("lead_days").default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CalendarEvent = typeof calendarEventsTable.$inferSelect;
export type InsertCalendarEvent = typeof calendarEventsTable.$inferInsert;
export type BrandCalendarEvent = typeof brandCalendarEventsTable.$inferSelect;
export type InsertBrandCalendarEvent = typeof brandCalendarEventsTable.$inferInsert;
