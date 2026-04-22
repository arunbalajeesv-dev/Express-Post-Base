import { db, followupsTable, visitsTable, customersTable, usersTable } from "@workspace/db";
import { eq, gte, lt, and, inArray } from "drizzle-orm";

function today() {
  return new Date().toISOString().slice(0, 10);
}

const followupWithDetails = (statusFilter?: string[]) => {
  const base = db
    .select({
      id: followupsTable.id,
      followupDate: followupsTable.followupDate,
      status: followupsTable.status,
      notes: followupsTable.notes,
      convertedAt: followupsTable.convertedAt,
      saleAmount: followupsTable.saleAmount,
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
    })
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

export async function getAllFollowups() {
  return followupWithDetails();
}

export async function getPendingFollowups() {
  return db
    .select({
      id: followupsTable.id,
      followupDate: followupsTable.followupDate,
      status: followupsTable.status,
      notes: followupsTable.notes,
      convertedAt: followupsTable.convertedAt,
      saleAmount: followupsTable.saleAmount,
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
    })
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
      .select({
        id: followupsTable.id,
        followupDate: followupsTable.followupDate,
        status: followupsTable.status,
        notes: followupsTable.notes,
        convertedAt: followupsTable.convertedAt,
        saleAmount: followupsTable.saleAmount,
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
      })
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
    status: "Pending" | "Completed" | "Converted";
    saleAmount?: string;
    followupDate?: string;
  },
) {
  const now = new Date();
  const updates: Partial<typeof followupsTable.$inferInsert> = {
    status: data.status,
  };

  if (data.status === "Converted") {
    updates.convertedAt = now;
    updates.saleAmount = data.saleAmount!;
  }

  if (data.status === "Pending" && data.followupDate) {
    updates.followupDate = data.followupDate;
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
