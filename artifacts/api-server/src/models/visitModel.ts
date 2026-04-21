import {
  db,
  visitsTable,
  visitBrandsTable,
  type InsertVisitBrand,
} from "@workspace/db";

export type AddVisitData = {
  userId: number;
  customerId: number;
  area?: string;
  siteStage?: string;
  feedback?: string;
  visitDate: string;
  visitTime: string;
  notes?: string;
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
