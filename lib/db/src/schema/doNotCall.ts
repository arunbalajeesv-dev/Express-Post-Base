import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { usersTable } from "./users";

export const doNotCallTable = pgTable("do_not_call", {
  id:         serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().unique().references(() => customersTable.id),
  addedBy:    integer("added_by").notNull().references(() => usersTable.id),
  reason:     text("reason"),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const selectDoNotCallSchema = createSelectSchema(doNotCallTable);
export const insertDoNotCallSchema = createInsertSchema(doNotCallTable, {
  customerId: z.number().int().positive(),
  addedBy:    z.number().int().positive(),
}).omit({ id: true });

export type DoNotCall = typeof doNotCallTable.$inferSelect;
export type InsertDoNotCall = z.infer<typeof insertDoNotCallSchema>;
