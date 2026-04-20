import { desc, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  type InsertUser,
  type UpdateUser,
} from "@workspace/db";

export function listUsers() {
  return db.select().from(usersTable).orderBy(desc(usersTable.id));
}

export async function getUserById(id: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  return user ?? null;
}

export async function createUser(data: InsertUser) {
  const [user] = await db.insert(usersTable).values(data).returning();
  return user;
}

export async function updateUser(id: number, data: UpdateUser) {
  const [user] = await db
    .update(usersTable)
    .set(data)
    .where(eq(usersTable.id, id))
    .returning();

  return user ?? null;
}

export async function deleteUser(id: number) {
  const [user] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();
  return user ?? null;
}