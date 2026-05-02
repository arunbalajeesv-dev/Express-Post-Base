import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const customersTable = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  mobile: text("mobile").notNull().unique(),
  companyName: text("company_name"),
  leadStatus: text("lead_status"),
  leadScore: integer("lead_score"),
  lastInteractionAt: timestamp("last_interaction_at", { withTimezone: true }),
});

export const selectCustomerSchema = createSelectSchema(customersTable);
export const insertCustomerSchema = createInsertSchema(customersTable, {
  name: z.string().min(1, "Name is required"),
  mobile: z.string().min(1, "Mobile is required"),
}).omit({
  id: true,
});

export type Customer = typeof customersTable.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;