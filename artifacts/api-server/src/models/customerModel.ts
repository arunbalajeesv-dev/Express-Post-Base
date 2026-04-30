import { db, customersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export async function findByMobile(mobile: string) {
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.mobile, mobile));
  return customer ?? null;
}

export async function createCustomer(data: {
  name: string;
  mobile: string;
  companyName?: string;
}) {
  const [customer] = await db
    .insert(customersTable)
    .values({
      name: data.name,
      mobile: data.mobile,
      companyName: data.companyName ?? null,
    })
    .returning();

  if (!customer) throw new Error("Unable to create customer");
  return customer;
}

export async function updateCompanyName(id: number, companyName: string) {
  const [customer] = await db
    .update(customersTable)
    .set({ companyName })
    .where(eq(customersTable.id, id))
    .returning();

  if (!customer) throw new Error("Unable to update customer");
  return customer;
}

export async function updateCustomer(
  id: number,
  data: { name?: string; companyName?: string | null },
) {
  const [customer] = await db
    .update(customersTable)
    .set(data)
    .where(eq(customersTable.id, id))
    .returning();
  if (!customer) return null;
  return customer;
}

export async function listCustomersWithStats() {
  const rows = await db.execute(sql`
    SELECT
      c.id,
      c.name,
      c.mobile,
      c.company_name,
      COALESCE(vs.total_visits, 0)::int            AS total_visits,
      vs.current_site_stage,
      vs.current_area,
      (
        SELECT v.customer_type
        FROM visits v
        WHERE v.customer_id = c.id
        ORDER BY v.visit_date DESC, v.visit_time DESC
        LIMIT 1
      )                                             AS customer_type,
      (
        SELECT v.custom_customer_type
        FROM visits v
        WHERE v.customer_id = c.id
        ORDER BY v.visit_date DESC, v.visit_time DESC
        LIMIT 1
      )                                             AS custom_customer_type,
      COALESCE(fs.total_followups, 0)::int          AS total_followups,
      COALESCE(fs.converted_count, 0)::int          AS converted_count,
      COALESCE(fs.total_sales_value, 0)             AS total_sales_value,
      CASE
        WHEN COALESCE(fs.converted_count, 0) > 0      THEN 'Converted'
        WHEN COALESCE(fs.in_progress_count, 0) > 0    THEN 'In Progress'
        ELSE 'Not Converted'
      END                                           AS conversion_status
    FROM customers c
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS total_visits,
        (
          SELECT v2.site_stage
          FROM visits v2
          WHERE v2.customer_id = c.id
          ORDER BY v2.visit_date DESC, v2.visit_time DESC
          LIMIT 1
        ) AS current_site_stage,
        (
          SELECT v2.area
          FROM visits v2
          WHERE v2.customer_id = c.id
          ORDER BY v2.visit_date DESC, v2.visit_time DESC
          LIMIT 1
        ) AS current_area
      FROM visits v
      WHERE v.customer_id = c.id
    ) vs ON true
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int                                           AS total_followups,
        COUNT(*) FILTER (WHERE f.status = 'Converted')::int    AS converted_count,
        COUNT(*) FILTER (WHERE f.status IN ('Pending','Completed'))::int AS in_progress_count,
        COALESCE(SUM(f.sale_amount) FILTER (WHERE f.status = 'Converted'), 0) AS total_sales_value
      FROM followups f
      JOIN visits v ON f.visit_id = v.id
      WHERE v.customer_id = c.id
    ) fs ON true
    ORDER BY c.name
  `);
  return rows.rows as any[];
}

export async function getCustomerDetail(id: number) {
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, id));

  if (!customer) return null;

  const visitsResult = await db.execute(sql`
    SELECT
      v.id,
      v.area,
      v.layout,
      v.location_link,
      v.site_stage,
      v.feedback,
      v.visit_date,
      v.visit_time,
      v.notes,
      v.image_url,
      v.customer_type,
      v.custom_customer_type,
      u.name  AS agent_name,
      u.user_id AS agent_user_id,
      COALESCE(
        json_agg(
          json_build_object(
            'id',             vb.id,
            'brandId',        vb.brand_id,
            'brandName',      b.name,
            'customBrandName',vb.custom_brand_name
          )
        ) FILTER (WHERE vb.id IS NOT NULL),
        '[]'::json
      ) AS brands
    FROM visits v
    JOIN users u ON u.id = v.user_id
    LEFT JOIN visit_brands vb ON vb.visit_id = v.id
    LEFT JOIN brands b ON b.id = vb.brand_id
    WHERE v.customer_id = ${id}
    GROUP BY v.id, u.name, u.user_id
    ORDER BY v.visit_date DESC, v.visit_time DESC
  `);

  const followupsResult = await db.execute(sql`
    SELECT
      f.id,
      f.visit_id,
      f.followup_date,
      f.status,
      f.notes,
      f.converted_at,
      f.sale_amount,
      f.invoice_number,
      v.site_stage,
      v.area
    FROM followups f
    JOIN visits v ON f.visit_id = v.id
    WHERE v.customer_id = ${id}
    ORDER BY f.followup_date DESC
  `);

  const visits    = visitsResult.rows  as any[];
  const followups = followupsResult.rows as any[];

  const converted = followups.filter((f: any) => f.status === "Converted");
  const totalSalesValue = converted.reduce(
    (sum: number, f: any) => sum + parseFloat(f.sale_amount || "0"),
    0,
  );

  const latestVisit = visits[0];
  const displayCustomerType =
    latestVisit?.customer_type === "Others"
      ? (latestVisit?.custom_customer_type ?? "Others")
      : (latestVisit?.customer_type ?? null);

  const allBrands = new Map<string, { brandId: number | null; label: string }>();
  for (const v of visits) {
    for (const b of v.brands ?? []) {
      const key = b.brandId ? `id:${b.brandId}` : `custom:${b.customBrandName}`;
      if (!allBrands.has(key)) {
        allBrands.set(key, {
          brandId: b.brandId ?? null,
          label: b.brandName ?? b.customBrandName ?? "Unknown",
        });
      }
    }
  }

  return {
    customer,
    stats: {
      totalVisits:       visits.length,
      totalFollowups:    followups.length,
      totalConversions:  converted.length,
      totalSalesValue,
      currentSiteStage:  latestVisit?.site_stage ?? null,
      customerType:      displayCustomerType,
    },
    visits,
    followups,
    conversions: converted,
    brands:      Array.from(allBrands.values()),
  };
}
