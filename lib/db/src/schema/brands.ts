import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const brandsTable = pgTable(
  "brands",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("brands_name_unique_idx").on(table.name)],
);

export const selectBrandSchema = createSelectSchema(brandsTable);
export const insertBrandSchema = createInsertSchema(brandsTable, {
  name: z.string().min(1, "Brand name is required").trim(),
}).omit({
  id: true,
  createdAt: true,
});

export type Brand = typeof brandsTable.$inferSelect;
export type InsertBrand = z.infer<typeof insertBrandSchema>;