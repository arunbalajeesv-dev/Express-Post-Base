import { desc, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  db,
  usersTable,
  type InsertUser,
  type UpdateUser,
} from "@workspace/db";

const SALT_ROUNDS = 10;

const safeUserFields = {
  id: usersTable.id,
  name: usersTable.name,
  mobile: usersTable.mobile,
  role: usersTable.role,
  userId: usersTable.userId,
} as const;

export function listUsers() {
  return db.select(safeUserFields).from(usersTable).orderBy(desc(usersTable.id));
}

export async function getUserById(id: number) {
  const [user] = await db.select(safeUserFields).from(usersTable).where(eq(usersTable.id, id));
  return user ?? null;
}

export async function findByUserId(userId: string) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.userId, userId));

  return user ?? null;
}

export async function createUser(data: InsertUser) {
  const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);
  const [user] = await db
    .insert(usersTable)
    .values({ ...data, password: hashedPassword })
    .returning();

  return user;
}

export async function verifyPassword(plain: string, hashed: string) {
  return bcrypt.compare(plain, hashed);
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