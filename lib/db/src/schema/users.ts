import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  mobile: text("mobile").notNull(),
  role: text("role").notNull(),
  userId: text("user_id").notNull(),
  password: text("password").notNull(),
});

export const selectUserSchema = createSelectSchema(usersTable);
export const insertUserSchema = createInsertSchema(usersTable, {
  name: z.string().min(1, "Name is required"),
  mobile: z.string().min(1, "Mobile is required"),
  role: z.string().min(1, "Role is required"),
  userId: z.string().min(1, "User ID is required"),
  password: z.string().min(1, "Password is required"),
}).omit({
  id: true,
});
export const updateUserSchema = insertUserSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "At least one field is required",
);

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;