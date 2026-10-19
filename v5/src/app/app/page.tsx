import { Suspense } from "react";
import { requireUser } from "@/server/session";
import { resetDemo, signOut } from "../login/actions";

export default function AppHome() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-12">
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">Loading your sandbox…</p>
        }
      >
        <SandboxCard />
      </Suspense>
    </main>
  );
}

async function SandboxCard() {
  const user = await requireUser();
  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <h1 className="text-lg font-semibold" data-testid="signed-in-as">
        {user.name} · {user.title}
      </h1>
      <p className="text-sm text-muted-foreground">
        {user.companyName} sandbox{" "}
        <span className="font-mono" data-testid="sandbox-id">
          {user.companyId.slice(0, 8)}
        </span>
        , seeded{" "}
        <time data-testid="seeded-at" dateTime={user.seededAt.toISOString()}>
          {user.seededAt.toISOString()}
        </time>
      </p>
      <div className="flex gap-2">
        <form action={resetDemo}>
          <button
            type="submit"
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          >
            Reset demo
          </button>
        </form>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            Sign out
          </button>
        </form>
      </div>
    </section>
  );
}
