import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { date, integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { visitsTable } from "./visits";

export const followupsTable = pgTable("followups", {
  id: serial("id").primaryKey(),
  visitId: integer("visit_id").notNull().references(() => visitsTable.id),
  followupDate: date("followup_date").notNull(),
  status: text("status").notNull().default("Pending"),
  notes: text("notes"),
  convertedAt: timestamp("converted_at"),
  saleAmount: numeric("sale_amount", { precision: 12, scale: 2 }),
  invoiceNumber: text("invoice_number").unique(),
});

export const selectFollowupSchema = createSelectSchema(followupsTable);
export const insertFollowupSchema = createInsertSchema(followupsTable, {
  visitId: z.number().int().positive(),
  followupDate: z.string().min(1, "Follow-up date is required"),
  status: z.string().min(1, "Status is required"),
}).omit({
  id: true,
});

export type Followup = typeof followupsTable.$inferSelect;
export type InsertFollowup = z.infer<typeof insertFollowupSchema>;
