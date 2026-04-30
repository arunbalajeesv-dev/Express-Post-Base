import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { integer, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";
import { brandsTable } from "./brands";
import { visitsTable } from "./visits";

export const visitBrandsTable = pgTable(
  "visit_brands",
  {
    id: serial("id").primaryKey(),
    visitId: integer("visit_id").notNull().references(() => visitsTable.id),
    brandId: integer("brand_id").references(() => brandsTable.id),
    customBrandName: text("custom_brand_name"),
  },
  (table) => [
    uniqueIndex("visit_brands_visit_brand_unique_idx").on(table.visitId, table.brandId),
    uniqueIndex("visit_brands_visit_custom_unique_idx").on(
      table.visitId,
      table.customBrandName,
    ),
  ],
);

export const selectVisitBrandSchema = createSelectSchema(visitBrandsTable);
export const insertVisitBrandSchema = createInsertSchema(visitBrandsTable).omit({
  id: true,
});

export type VisitBrand = typeof visitBrandsTable.$inferSelect;
export type InsertVisitBrand = typeof visitBrandsTable.$inferInsert;