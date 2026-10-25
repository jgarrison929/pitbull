export type DbStatus = "ok" | "error" | "not-configured";

export type Health = {
  status: "ok" | "degraded";
  db: DbStatus;
};

/** Runs the DB ping when a database is configured. Unconfigured DB is healthy (scaffold stage); a failing DB is not. */
export async function checkHealth(ping: (() => Promise<void>) | null): Promise<Health> {
  if (!ping) return { status: "ok", db: "not-configured" };
  try {
    await ping();
    return { status: "ok", db: "ok" };
  } catch {
    return { status: "degraded", db: "error" };
  }
}
