import { db, visitsTable, usersTable } from "@workspace/db";
import { eq, gte, and, sql, notInArray, ne } from "drizzle-orm";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function weekStartStr() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

export async function visitsPerUserDaily() {
  const today = todayStr();
  const rows = await db
    .select({
      userId: usersTable.id,
      userName: usersTable.name,
      userLoginId: usersTable.userId,
      visitCount: sql<number>`count(${visitsTable.id})::int`,
    })
    .from(usersTable)
    .leftJoin(
      visitsTable,
      and(eq(visitsTable.userId, usersTable.id), eq(visitsTable.visitDate, today)),
    )
    .where(ne(usersTable.role, "manager"))
    .groupBy(usersTable.id, usersTable.name, usersTable.userId)
    .orderBy(usersTable.name);

  return { date: today, users: rows };
}

export async function visitsPerUserWeekly() {
  const weekStart = weekStartStr();
  const rows = await db
    .select({
      userId: usersTable.id,
      userName: usersTable.name,
      userLoginId: usersTable.userId,
      visitCount: sql<number>`count(${visitsTable.id})::int`,
    })
    .from(usersTable)
    .leftJoin(
      visitsTable,
      and(
        eq(visitsTable.userId, usersTable.id),
        gte(visitsTable.visitDate, weekStart),
      ),
    )
    .where(ne(usersTable.role, "manager"))
    .groupBy(usersTable.id, usersTable.name, usersTable.userId)
    .orderBy(usersTable.name);

  return { weekStart, users: rows };
}

export async function totalVisitsCounts() {
  const today = todayStr();
  const weekStart = weekStartStr();

  const [all, todayCount, weekCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(visitsTable),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(visitsTable)
      .where(eq(visitsTable.visitDate, today)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(visitsTable)
      .where(gte(visitsTable.visitDate, weekStart)),
  ]);

  return {
    total: all[0]?.count ?? 0,
    today: todayCount[0]?.count ?? 0,
    thisWeek: weekCount[0]?.count ?? 0,
  };
}

export async function feedbackSummary() {
  const rows = await db
    .select({
      feedback: visitsTable.feedback,
      count: sql<number>`count(*)::int`,
    })
    .from(visitsTable)
    .groupBy(visitsTable.feedback);

  const summary: Record<string, number> = {
    Interested: 0,
    "Not Interested": 0,
    Potential: 0,
    Unknown: 0,
  };

  for (const row of rows) {
    const key = row.feedback ?? "Unknown";
    if (key in summary) {
      summary[key] = row.count;
    } else {
      summary["Unknown"] = (summary["Unknown"] ?? 0) + row.count;
    }
  }

  return summary;
}

export async function inactiveUsersToday() {
  const today = todayStr();

  const activeUserIds = db
    .selectDistinct({ userId: visitsTable.userId })
    .from(visitsTable)
    .where(eq(visitsTable.visitDate, today));

  const inactive = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      userId: usersTable.userId,
      mobile: usersTable.mobile,
      role: usersTable.role,
    })
    .from(usersTable)
    .where(
      and(
        ne(usersTable.role, "manager"),
        notInArray(usersTable.id, activeUserIds),
      ),
    )
    .orderBy(usersTable.name);

  return { date: today, inactiveUsers: inactive };
}
