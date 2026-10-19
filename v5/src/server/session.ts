import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { requireDb } from "@/db";
import { companies, sessions, users } from "@/db/schema";
import { seedId } from "@/seed";
import { SANDBOX_TTL_MS } from "./sandbox";

export const SESSION_COOKIE = "pcs_session";
export type Role = (typeof users.$inferSelect)["role"];

const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export type CurrentUser = {
  userId: string;
  companyId: string;
  name: string;
  title: string;
  role: Role;
  companyName: string;
  seededAt: Date;
  expiresAt: Date | null;
};

/** The signed-in user, or null. The cookie holds a random token; only its hash is stored. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Session validity depends on the clock and the database, so this always runs at request time.
  await connection();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = requireDb();
  const [row] = await db
    .select({
      userId: users.id,
      companyId: companies.id,
      name: users.name,
      title: users.title,
      role: users.role,
      companyName: companies.name,
      seededAt: companies.seededAt,
      expiresAt: companies.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(companies, eq(companies.id, sessions.companyId))
    .where(
      and(eq(sessions.id, hash(token)), gt(sessions.expiresAt, new Date())),
    )
    .limit(1);
  return row ?? null;
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Signs the visitor in as the seeded user for `role` in `companyId`, replacing any earlier session. */
export async function startSession(
  companyId: string,
  role: Role,
  now = new Date(),
) {
  const db = requireDb();
  const jar = await cookies();
  const previous = jar.get(SESSION_COOKIE)?.value;
  if (previous)
    await db.delete(sessions).where(eq(sessions.id, hash(previous)));
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SANDBOX_TTL_MS);
  await db
    .insert(sessions)
    .values({
      id: hash(token),
      userId: seedId(companyId, `user:${role}`),
      companyId,
      expiresAt,
    });
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token)
    await requireDb()
      .delete(sessions)
      .where(eq(sessions.id, hash(token)));
  jar.delete(SESSION_COOKIE);
}
