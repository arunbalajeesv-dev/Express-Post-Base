import {
  db,
  visitsTable,
  visitBrandsTable,
  customersTable,
  usersTable,
  type InsertVisitBrand,
} from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";

export type AddVisitData = {
  userId: number;
  customerId: number;
  area: string;
  layout?: string;
  locationLink: string;
  siteStage: string;
  feedback: string;
  visitDate: string;
  visitTime: string;
  notes: string;
  imageUrl: string;
  customerType: string;
  customCustomerType?: string | null;
};

export async function createVisitWithBrands(
  visitData: AddVisitData,
  brandLinks: Omit<InsertVisitBrand, "visitId">[] = [],
) {
  return db.transaction(async (tx) => {
    const [visit] = await tx
      .insert(visitsTable)
      .values(visitData)
      .returning();

    if (!visit) {
      throw new Error("Unable to create visit");
    }

    let visitBrands: typeof visitBrandsTable.$inferSelect[] = [];

    if (brandLinks.length > 0) {
      const links = brandLinks.map((brandLink) => ({
        ...brandLink,
        visitId: visit.id,
      }));
      visitBrands = await tx.insert(visitBrandsTable).values(links).returning();
    }

    return { visit, brandsUsed: visitBrands };
  });
}

export async function listVisits(userId?: number, dateFrom?: string, dateTo?: string) {
  const conditions = [];

  if (userId !== undefined) conditions.push(eq(visitsTable.userId, userId));
  if (dateFrom) conditions.push(gte(visitsTable.visitDate, dateFrom));
  if (dateTo) conditions.push(lte(visitsTable.visitDate, dateTo));

  const base = db
    .select({
      id: visitsTable.id,
      feedback: visitsTable.feedback,
      area: visitsTable.area,
      layout: visitsTable.layout,
      locationLink: visitsTable.locationLink,
      siteStage: visitsTable.siteStage,
      visitDate: visitsTable.visitDate,
      visitTime: visitsTable.visitTime,
      imageUrl: visitsTable.imageUrl,
      notes: visitsTable.notes,
      customerType: visitsTable.customerType,
      customCustomerType: visitsTable.customCustomerType,
      customer: {
        id: customersTable.id,
        name: customersTable.name,
        mobile: customersTable.mobile,
      },
      user: {
        id: usersTable.id,
        name: usersTable.name,
        userId: usersTable.userId,
      },
    })
    .from(visitsTable)
    .innerJoin(customersTable, eq(visitsTable.customerId, customersTable.id))
    .innerJoin(usersTable, eq(visitsTable.userId, usersTable.id));

  return conditions.length > 0
    ? base.where(and(...conditions)).orderBy(visitsTable.visitDate, visitsTable.id)
    : base.orderBy(visitsTable.visitDate, visitsTable.id);
}
