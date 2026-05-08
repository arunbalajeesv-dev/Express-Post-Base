import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { integer, numeric, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { usersTable } from "./users";

export const callOutcomeEnum = pgEnum("call_outcome", [
  "answered",
  "no_answer",
  "voicemail",
  "wrong_number",
  "callback_requested",
]);

export const callDispositionEnum = pgEnum("call_disposition", [
  "interested",
  "not_interested",
  "do_not_call",
  "nurture_later",
]);

export const dealStageEnum = pgEnum("deal_stage", [
  "new_lead",
  "contacted",
  "interested",
  "proposal",
  "closed_won",
  "closed_lost",
]);

export const callsTable = pgTable("calls", {
  id:              serial("id").primaryKey(),
  customerId:      integer("customer_id").notNull().references(() => customersTable.id),
  repId:           integer("rep_id").notNull().references(() => usersTable.id),
  startedAt:       timestamp("started_at", { withTimezone: true }),
  endedAt:         timestamp("ended_at", { withTimezone: true }),
  durationSeconds: integer("duration_seconds"),
  outcome:         callOutcomeEnum("outcome"),
  disposition:     callDispositionEnum("disposition"),
  notes:           text("notes"),
  dealStage:       dealStageEnum("deal_stage"),
  dealValue:       numeric("deal_value", { precision: 12, scale: 2 }),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const selectCallSchema = createSelectSchema(callsTable);
export const insertCallSchema = createInsertSchema(callsTable, {
  customerId: z.number().int().positive(),
  repId:      z.number().int().positive(),
}).omit({ id: true });

export type Call = typeof callsTable.$inferSelect;
export type InsertCall = z.infer<typeof insertCallSchema>;
