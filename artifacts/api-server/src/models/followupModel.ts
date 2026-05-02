import { db, followupsTable, visitsTable, customersTable, usersTable } from "@workspace/db";
import { eq, gte, lte, lt, and, inArray, ne } from "drizzle-orm";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

const followupSelect = {
  id: followupsTable.id,
  followupDate: followupsTable.followupDate,
  status: followupsTable.status,
  notes: followupsTable.notes,
  convertedAt: followupsTable.convertedAt,
  saleAmount: followupsTable.saleAmount,
  invoiceNumber: followupsTable.invoiceNumber,
  summary: followupsTable.summary,
  spokeToCustomer: followupsTable.spokeToCustomer,
  quotationSent: followupsTable.quotationSent,
  quotationNumber: followupsTable.quotationNumber,
  visit: {
    id: visitsTable.id,
    area: visitsTable.area,
    siteStage: visitsTable.siteStage,
    feedback: visitsTable.feedback,
    visitDate: visitsTable.visitDate,
  },
  customer: {
    id: customersTable.id,
    name: customersTable.name,
    mobile: customersTable.mobile,
    companyName: customersTable.companyName,
  },
  assignedTo: {
    id: usersTable.id,
    name: usersTable.name,
    userId: usersTable.userId,
  },
};

const followupWithDetails = (statusFilter?: string[]) => {
  const base = db
    .select(followupSelect)
    .from(followupsTable)
    .leftJoin(visitsTable, eq(followupsTable.visitId, visitsTable.id))
    .leftJoin(customersTable, eq(visitsTable.customerId, customersTable.id))
    .leftJoin(usersTable, eq(visitsTable.userId, usersTable.id));

  if (statusFilter && statusFilter.length > 0) {
    return base.where(inArray(followupsTable.status, statusFilter));
  }
  return base;
};

export async function addFollowup(data: {
  visitId: number;
  followupDate: string;
  notes?: string;
}) {
  const [followup] = await db
    .insert(followupsTable)
    .values({
      visitId: data.visitId,
      followupDate: data.followupDate,
      status: "Pending",
      notes: data.notes ?? null,
    })
    .returning();

  if (!followup) throw new Error("Unable to create follow-up");
  return followup;
}

export async function getAllFollowups(userId?: number, dateFrom?: string, dateTo?: string) {
  const conditions = [];

  if (userId !== undefined) conditions.push(eq(visitsTable.userId, userId));
  if (dateFrom) conditions.push(gte(followupsTable.followupDate, dateFrom));
  if (dateTo) conditions.push(lte(followupsTable.followupDate, dateTo));

  const base = db
    .select(followupSelect)
    .from(followupsTable)
    .leftJoin(visitsTable, eq(followupsTable.visitId, visitsTable.id))
    .leftJoin(customersTable, eq(visitsTable.customerId, customersTable.id))
    .leftJoin(usersTable, eq(visitsTable.userId, usersTable.id));

  return conditions.length > 0 ? base.where(and(...conditions)) : base;
}

export async function getPendingFollowups() {
  return db
    .select(followupSelect)
    .from(followupsTable)
    .leftJoin(visitsTable, eq(followupsTable.visitId, visitsTable.id))
    .leftJoin(customersTable, eq(visitsTable.customerId, customersTable.id))
    .leftJoin(usersTable, eq(visitsTable.userId, usersTable.id))
    .where(
      and(
        eq(followupsTable.status, "Pending"),
        gte(followupsTable.followupDate, today()),
      ),
    );
}

export async function getOverdueFollowups() {
  return db.transaction(async (tx) => {
    await tx
      .update(followupsTable)
      .set({ status: "Missed" })
      .where(
        and(
          eq(followupsTable.status, "Pending"),
          lt(followupsTable.followupDate, today()),
        ),
      );

    return tx
      .select(followupSelect)
      .from(followupsTable)
      .leftJoin(visitsTable, eq(followupsTable.visitId, visitsTable.id))
      .leftJoin(customersTable, eq(visitsTable.customerId, customersTable.id))
      .leftJoin(usersTable, eq(visitsTable.userId, usersTable.id))
      .where(eq(followupsTable.status, "Missed"));
  });
}

export async function getFollowupById(id: number) {
  const [followup] = await db
    .select()
    .from(followupsTable)
    .where(eq(followupsTable.id, id));
  return followup ?? null;
}

export async function updateFollowupStatus(
  id: number,
  data: {
    status: "Pending" | "Completed" | "Converted" | "Missed";
    saleAmount?: string;
    invoiceNumber?: string;
    followupDate?: string;
    summary?: string;
    spokeToCustomer?: boolean;
    quotationSent?: boolean;
    quotationNumber?: string | null;
  },
) {
  const now = new Date();
  const updates: Partial<typeof followupsTable.$inferInsert> = {
    status: data.status,
  };

  if (data.status === "Converted") {
    updates.convertedAt = now;
    updates.saleAmount = data.saleAmount!;
    updates.invoiceNumber = data.invoiceNumber!;
  }

  if (data.status === "Pending" && data.followupDate) {
    updates.followupDate = data.followupDate;
  }

  if (data.summary !== undefined)          updates.summary = data.summary;
  if (data.spokeToCustomer !== undefined)  updates.spokeToCustomer = data.spokeToCustomer;
  if (data.quotationSent !== undefined)    updates.quotationSent = data.quotationSent;
  if (data.quotationNumber !== undefined)  updates.quotationNumber = data.quotationNumber;

  if (data.invoiceNumber) {
    const [dupe] = await db
      .select({ id: followupsTable.id })
      .from(followupsTable)
      .where(
        and(
          eq(followupsTable.invoiceNumber, data.invoiceNumber),
          ne(followupsTable.id, id),
        ),
      );
    if (dupe) {
      throw Object.assign(
        new Error(`Invoice number '${data.invoiceNumber}' is already used on another conversion`),
        { statusCode: 409 },
      );
    }
  }

  const [updated] = await db
    .update(followupsTable)
    .set(updates)
    .where(eq(followupsTable.id, id))
    .returning();

  if (!updated) throw new Error("Follow-up not found or could not be updated");
  return updated;
}

export async function findVisitById(visitId: number) {
  const [visit] = await db
    .select()
    .from(visitsTable)
    .where(eq(visitsTable.id, visitId));
  return visit ?? null;
}

export async function findLatestVisitByCustomerId(customerId: number) {
  const [visit] = await db
    .select()
    .from(visitsTable)
    .where(eq(visitsTable.customerId, customerId))
    .orderBy(visitsTable.visitDate, visitsTable.id)
    .limit(1);
  return visit ?? null;
}

export async function getFollowupActivitySummary(dateFrom?: string, dateTo?: string) {
  const conditions = [];
  if (dateFrom) conditions.push(gte(followupsTable.followupDate, dateFrom));
  if (dateTo)   conditions.push(lte(followupsTable.followupDate, dateTo));

  const base = db
    .select({
      id: followupsTable.id,
      status: followupsTable.status,
      spokeToCustomer: followupsTable.spokeToCustomer,
      quotationSent: followupsTable.quotationSent,
    })
    .from(followupsTable);

  const rows = conditions.length > 0 ? await base.where(and(...conditions)) : await base;

  const completed   = rows.filter((r) => r.status === "Completed" || r.status === "Converted");
  const spoke       = rows.filter((r) => r.spokeToCustomer === true);
  const quotations  = rows.filter((r) => r.quotationSent === true);
  const converted   = rows.filter((r) => r.status === "Converted");

  return {
    totalCompleted:    completed.length,
    customerContacted: spoke.length,
    quotationsSent:    quotations.length,
    converted:         converted.length,
    conversionRate:    completed.length > 0 ? Math.round((converted.length / completed.length) * 100) : 0,
  };
}
