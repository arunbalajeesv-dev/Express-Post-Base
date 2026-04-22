import {
  db,
  visitsTable,
  visitBrandsTable,
  customersTable,
  usersTable,
  type InsertVisitBrand,
} from "@workspace/db";
import { eq } from "drizzle-orm";

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

export async function listVisits(userId?: number) {
  const rows = await db
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
    .innerJoin(usersTable, eq(visitsTable.userId, usersTable.id))
    .orderBy(visitsTable.id);

  if (userId !== undefined) {
    return rows.filter((r) => r.user.id === userId);
  }
  return rows;
}
