import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const selectUserSchema = createSelectSchema(usersTable);
export const insertUserSchema = createInsertSchema(usersTable, {
  name: z.string().min(1, "Name is required"),
  email: z.email("A valid email is required"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateUserSchema = insertUserSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "At least one field is required",
);

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;