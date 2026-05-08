import { db, visitsTable, customersTable, usersTable, followupsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

export async function getAllVisitsForExport() {
  const latestFollowup = db
    .selectDistinctOn([followupsTable.visitId], {
      visitId: followupsTable.visitId,
      saleAmount: followupsTable.saleAmount,
      invoiceNumber: followupsTable.invoiceNumber,
    })
    .from(followupsTable)
    .orderBy(followupsTable.visitId, desc(followupsTable.id))
    .as("lf");

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
      saleAmount: latestFollowup.saleAmount,
      invoiceNumber: latestFollowup.invoiceNumber,
    })
    .from(visitsTable)
    .leftJoin(customersTable, eq(visitsTable.customerId, customersTable.id))
    .leftJoin(usersTable, eq(visitsTable.userId, usersTable.id))
    .leftJoin(latestFollowup, eq(latestFollowup.visitId, visitsTable.id))
    .orderBy(visitsTable.visitDate, visitsTable.visitTime);
}
