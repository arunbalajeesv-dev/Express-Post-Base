import { asc, eq, sql } from "drizzle-orm";
import { brandsTable, db, type InsertBrand } from "@workspace/db";

export function listBrands() {
  return db.select().from(brandsTable).orderBy(asc(brandsTable.name));
}

export async function findBrandById(id: number) {
  const [brand] = await db.select().from(brandsTable).where(eq(brandsTable.id, id));
  return brand ?? null;
}

export async function findBrandByNameInsensitive(name: string) {
  const normalized = name.trim().toLowerCase();
  const [brand] = await db
    .select()
    .from(brandsTable)
    .where(sql`lower(${brandsTable.name}) = ${normalized}`);

  return brand ?? null;
}

export async function createBrand(data: InsertBrand) {
  const [brand] = await db.insert(brandsTable).values(data).returning();
  return brand;
}