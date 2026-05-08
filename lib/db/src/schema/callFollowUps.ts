import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { integer, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { callsTable } from "./calls";
import { customersTable } from "./customers";
import { usersTable } from "./users";

export const callFollowUpTypeEnum = pgEnum("call_followup_type", [
  "call_back",
  "send_proposal",
  "demo",
  "check_in",
]);

export const callFollowUpStatusEnum = pgEnum("call_followup_status", [
  "pending",
  "done",
  "snoozed",
]);

export const callFollowUpsTable = pgTable("call_follow_ups", {
  id:          serial("id").primaryKey(),
  callId:      integer("call_id").notNull().references(() => callsTable.id),
  customerId:  integer("customer_id").notNull().references(() => customersTable.id),
  assignedTo:  integer("assigned_to").notNull().references(() => usersTable.id),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  type:        callFollowUpTypeEnum("type").notNull(),
  status:      callFollowUpStatusEnum("status").notNull().default("pending"),
  notes:       text("notes"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const selectCallFollowUpSchema = createSelectSchema(callFollowUpsTable);
export const insertCallFollowUpSchema = createInsertSchema(callFollowUpsTable, {
  callId:     z.number().int().positive(),
  customerId: z.number().int().positive(),
  assignedTo: z.number().int().positive(),
}).omit({ id: true });

export type CallFollowUp = typeof callFollowUpsTable.$inferSelect;
export type InsertCallFollowUp = z.infer<typeof insertCallFollowUpSchema>;
