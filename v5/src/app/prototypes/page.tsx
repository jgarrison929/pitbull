import Link from "next/link";
import { shells } from "@/prototypes/switcher";
import { DEMO_LABEL } from "@/prototypes/scenario";

export default function PrototypesIndex() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12">
      <div>
        <h1 className="text-xl font-semibold">M1 shell prototypes</h1>
        <p className="text-sm text-muted-foreground">
          Three app shells over one seeded heavy-civil scenario. {DEMO_LABEL}.
        </p>
      </div>
      <ul className="grid gap-3">
        {shells.map((s) => (
          <li key={s.slug}>
            <Link
              href={`/prototypes/${s.slug}`}
              className="block rounded-lg border px-4 py-3 hover:bg-muted"
            >
              <div className="font-medium">
                {s.letter} · {s.name}
              </div>
              <div className="text-sm text-muted-foreground">{s.blurb}</div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
