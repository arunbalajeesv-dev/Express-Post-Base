import { db, followupsTable, visitsTable, customersTable, usersTable } from "@workspace/db";
import { eq, gte, lt, and } from "drizzle-orm";

function today() {
  return new Date().toISOString().slice(0, 10);
}

const followupWithDetails = () =>
  db
    .select({
      id: followupsTable.id,
      followupDate: followupsTable.followupDate,
      status: followupsTable.status,
      notes: followupsTable.notes,
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

export async function getPendingFollowups() {
  return followupWithDetails().where(
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

export async function findVisitById(visitId: number) {
  const [visit] = await db
    .select()
    .from(visitsTable)
    .where(eq(visitsTable.id, visitId));
  return visit ?? null;
}
