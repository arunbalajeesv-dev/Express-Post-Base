import { db, customersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
