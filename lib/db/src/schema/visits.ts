import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { date, integer, pgTable, serial, text, time } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { usersTable } from "./users";

export const visitsTable = pgTable("visits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  area: text("area").notNull(),
  layout: text("layout").notNull(),
  locationLink: text("location_link").notNull(),
  siteStage: text("site_stage").notNull(),
  feedback: text("feedback").notNull(),
  visitDate: date("visit_date").notNull(),
  visitTime: time("visit_time").notNull(),
  notes: text("notes").notNull(),
  imageUrl: text("image_url").notNull(),
});

export const selectVisitSchema = createSelectSchema(visitsTable);
export const insertVisitSchema = createInsertSchema(visitsTable, {
  userId: z.number().int().positive(),
  customerId: z.number().int().positive(),
  visitDate: z.string().min(1, "Visit date is required"),
  visitTime: z.string().min(1, "Visit time is required"),
}).omit({
  id: true,
});

export type Visit = typeof visitsTable.$inferSelect;
export type InsertVisit = z.infer<typeof insertVisitSchema>;