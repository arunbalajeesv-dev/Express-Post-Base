import { db, visitsTable, usersTable, followupsTable, visitBrandsTable, brandsTable, customersTable } from "@workspace/db";
import { eq, gte, lte, and, sql, notInArray, ne } from "drizzle-orm";

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

function monthStartStr() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
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

export async function visitsPerUserMonthly() {
  const monthStart = monthStartStr();
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
        gte(visitsTable.visitDate, monthStart),
      ),
    )
    .where(ne(usersTable.role, "manager"))
    .groupBy(usersTable.id, usersTable.name, usersTable.userId)
    .orderBy(usersTable.name);

  return { monthStart, users: rows };
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
  };

  for (const row of rows) {
    const key = row.feedback ?? "";
    if (key in summary) {
      summary[key] = row.count;
    }
  }

  return summary;
}

export async function brandUsageStats() {
  const rows = await db
    .select({
      brandName: sql<string>`coalesce(${brandsTable.name}, ${visitBrandsTable.customBrandName}, 'Other')`,
      count: sql<number>`count(*)::int`,
    })
    .from(visitBrandsTable)
    .leftJoin(brandsTable, eq(visitBrandsTable.brandId, brandsTable.id))
    .groupBy(sql`coalesce(${brandsTable.name}, ${visitBrandsTable.customBrandName}, 'Other')`)
    .orderBy(sql`count(*) desc`)
    .limit(10);

  return rows;
}

export async function conversionSummary() {
  const rows = await db
    .select({
      userId: usersTable.id,
      userName: usersTable.name,
      userLoginId: usersTable.userId,
      totalVisits: sql<number>`count(distinct ${visitsTable.id})::int`,
      totalFollowups: sql<number>`count(distinct ${followupsTable.id})::int`,
      convertedCount: sql<number>`count(distinct case when ${followupsTable.status} = 'Converted' then ${followupsTable.id} end)::int`,
      totalSalesValue: sql<string>`coalesce(sum(case when ${followupsTable.status} = 'Converted' then ${followupsTable.saleAmount} else 0 end), 0)::text`,
    })
    .from(usersTable)
    .leftJoin(visitsTable, eq(visitsTable.userId, usersTable.id))
    .leftJoin(followupsTable, eq(followupsTable.visitId, visitsTable.id))
    .where(ne(usersTable.role, "manager"))
    .groupBy(usersTable.id, usersTable.name, usersTable.userId)
    .orderBy(usersTable.name);

  return rows.map((r) => ({
    userId: r.userId,
    userName: r.userName,
    userLoginId: r.userLoginId,
    totalVisits: r.totalVisits,
    totalFollowups: r.totalFollowups,
    convertedCount: r.convertedCount,
    conversionRate:
      r.totalFollowups > 0
        ? Math.round((r.convertedCount / r.totalFollowups) * 100)
        : 0,
    totalSalesValue: parseFloat(r.totalSalesValue ?? "0"),
  }));
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

export async function followupAgentBreakdown(dateFrom?: string, dateTo?: string) {
  const dateClause = dateFrom && dateTo
    ? sql` AND f.followup_date >= ${dateFrom} AND f.followup_date <= ${dateTo}`
    : dateFrom
    ? sql` AND f.followup_date >= ${dateFrom}`
    : dateTo
    ? sql` AND f.followup_date <= ${dateTo}`
    : sql``;

  const result = await db.execute<{
    agentId: number;
    agentName: string;
    agentLoginId: string;
    totalCompleted: number;
    customerContacted: number;
    quotationsSent: number;
    converted: number;
  }>(sql`
    SELECT
      u.id            AS "agentId",
      u.name          AS "agentName",
      u.user_id       AS "agentLoginId",
      COUNT(DISTINCT CASE WHEN f.status IN ('Completed','Converted') THEN f.id END)::int AS "totalCompleted",
      COUNT(DISTINCT CASE WHEN f.spoke_to_customer = true             THEN f.id END)::int AS "customerContacted",
      COUNT(DISTINCT CASE WHEN f.quotation_sent    = true             THEN f.id END)::int AS "quotationsSent",
      COUNT(DISTINCT CASE WHEN f.status = 'Converted'                 THEN f.id END)::int AS "converted"
    FROM users u
    LEFT JOIN visits v    ON v.user_id   = u.id
    LEFT JOIN followups f ON f.visit_id  = v.id ${dateClause}
    WHERE u.role != 'manager'
    GROUP BY u.id, u.name, u.user_id
    ORDER BY u.name
  `);

  return result.rows.map((r) => ({
    agentId:           r.agentId,
    agentName:         r.agentName,
    agentLoginId:      r.agentLoginId,
    totalCompleted:    r.totalCompleted    ?? 0,
    customerContacted: r.customerContacted ?? 0,
    quotationsSent:    r.quotationsSent    ?? 0,
    converted:         r.converted         ?? 0,
    conversionRate:    (r.totalCompleted ?? 0) > 0
      ? Math.round(((r.converted ?? 0) / (r.totalCompleted ?? 0)) * 100)
      : 0,
  }));
}

export async function agentDetail(agentId: number, dateFrom?: string, dateTo?: string) {
  const agentRows = await db
    .select({ id: usersTable.id, name: usersTable.name, userId: usersTable.userId, mobile: usersTable.mobile, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, agentId));

  const agent = agentRows[0];
  if (!agent) return null;

  const visitDateClause = dateFrom && dateTo
    ? sql` AND v.visit_date >= ${dateFrom} AND v.visit_date <= ${dateTo}`
    : dateFrom
    ? sql` AND v.visit_date >= ${dateFrom}`
    : dateTo
    ? sql` AND v.visit_date <= ${dateTo}`
    : sql``;

  const fuDateClause = dateFrom && dateTo
    ? sql` AND f.followup_date >= ${dateFrom} AND f.followup_date <= ${dateTo}`
    : dateFrom
    ? sql` AND f.followup_date >= ${dateFrom}`
    : dateTo
    ? sql` AND f.followup_date <= ${dateTo}`
    : sql``;

  const [visitStatsResult, fuStatsResult, visitsResult, followupsResult] = await Promise.all([
    db.execute<{ totalVisits: number }>(sql`
      SELECT COUNT(*)::int AS "totalVisits"
      FROM visits v
      WHERE v.user_id = ${agentId} ${visitDateClause}
    `),
    db.execute<{
      totalFollowups: number;
      completed: number;
      customerContacted: number;
      quotationsSent: number;
      converted: number;
      totalSalesValue: string;
    }>(sql`
      SELECT
        COUNT(DISTINCT f.id)::int AS "totalFollowups",
        COUNT(DISTINCT CASE WHEN f.status IN ('Completed','Converted') THEN f.id END)::int AS "completed",
        COUNT(DISTINCT CASE WHEN f.spoke_to_customer = true THEN f.id END)::int AS "customerContacted",
        COUNT(DISTINCT CASE WHEN f.quotation_sent = true THEN f.id END)::int AS "quotationsSent",
        COUNT(DISTINCT CASE WHEN f.status = 'Converted' THEN f.id END)::int AS "converted",
        COALESCE(SUM(CASE WHEN f.status = 'Converted' THEN f.sale_amount ELSE 0 END), 0)::text AS "totalSalesValue"
      FROM followups f
      JOIN visits v ON v.id = f.visit_id
      WHERE v.user_id = ${agentId} ${fuDateClause}
    `),
    db.execute<{
      id: number; visitDate: string; area: string; siteStage: string;
      feedback: string; notes: string | null;
      customerName: string; customerMobile: string; customerId: number;
    }>(sql`
      SELECT
        v.id,
        v.visit_date  AS "visitDate",
        v.area,
        v.site_stage  AS "siteStage",
        v.feedback,
        v.notes,
        c.name        AS "customerName",
        c.mobile      AS "customerMobile",
        c.id          AS "customerId"
      FROM visits v
      JOIN customers c ON c.id = v.customer_id
      WHERE v.user_id = ${agentId} ${visitDateClause}
      ORDER BY v.visit_date DESC, v.visit_time DESC
      LIMIT 100
    `),
    db.execute<{
      id: number; followupDate: string; status: string;
      notes: string | null; saleAmount: string | null; invoiceNumber: string | null;
      customerName: string; customerMobile: string; customerId: number;
    }>(sql`
      SELECT
        f.id,
        f.followup_date  AS "followupDate",
        f.status,
        f.notes,
        f.sale_amount    AS "saleAmount",
        f.invoice_number AS "invoiceNumber",
        c.name           AS "customerName",
        c.mobile         AS "customerMobile",
        c.id             AS "customerId"
      FROM followups f
      JOIN visits v ON v.id = f.visit_id
      JOIN customers c ON c.id = v.customer_id
      WHERE v.user_id = ${agentId} ${fuDateClause}
      ORDER BY f.followup_date DESC
      LIMIT 100
    `),
  ]);

  const vs = visitStatsResult.rows[0];
  const fs = fuStatsResult.rows[0];

  return {
    agent,
    stats: {
      totalVisits:       vs?.totalVisits       ?? 0,
      totalFollowups:    fs?.totalFollowups    ?? 0,
      completed:         fs?.completed         ?? 0,
      customerContacted: fs?.customerContacted ?? 0,
      quotationsSent:    fs?.quotationsSent    ?? 0,
      converted:         fs?.converted         ?? 0,
      totalSalesValue:   parseFloat(fs?.totalSalesValue ?? "0"),
    },
    visits:    visitsResult.rows,
    followups: followupsResult.rows,
  };
}
