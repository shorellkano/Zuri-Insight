import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const appConfigTable = pgTable("app_config", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AppConfig = typeof appConfigTable.$inferSelect;
export type InsertAppConfig = typeof appConfigTable.$inferInsert;
