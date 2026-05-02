import { db, visitsTable, customersTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function getAllVisitsForExport() {
  return db
    .select({
      visitId: visitsTable.id,
      visitDate: visitsTable.visitDate,
      visitTime: visitsTable.visitTime,
      area: visitsTable.area,
      siteStage: visitsTable.siteStage,
      feedback: visitsTable.feedback,
      notes: visitsTable.notes,
      imageUrl: visitsTable.imageUrl,
      customerName: customersTable.name,
      customerMobile: customersTable.mobile,
      companyName: customersTable.companyName,
      salesPerson: usersTable.name,
      salesPersonId: usersTable.userId,
    })
    .from(visitsTable)
    .leftJoin(customersTable, eq(visitsTable.customerId, customersTable.id))
    .leftJoin(usersTable, eq(visitsTable.userId, usersTable.id))
    .orderBy(visitsTable.visitDate, visitsTable.visitTime);
}
