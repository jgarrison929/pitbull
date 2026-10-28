import type { NextStepsResult } from "@/server/next-steps";

/**
 * Role home list: verb-first next actions above the portfolio KPIs.
 * When `titled` is false (5.0.4-b), PageHeader already owns the page h1
 * "What needs you today" + purpose — do not mount a second heading.
 */
export function NextSteps({
  data,
  titled = true,
  role,
}: {
  data: NextStepsResult;
  titled?: boolean;
  /** Signed-in role. The first next step carries data-role for the one-tap check. */
  role?: string;
}) {
  const { items, moreCount, doneMessage } = data;
  return (
    <section
      className="rounded-lg border bg-card"
      data-testid="next-steps"
      aria-labelledby={titled ? "next-steps-title" : undefined}
      aria-label={titled ? undefined : "What needs you today"}
    >
      {titled ? (
        <header className="border-b px-4 py-3 lg:px-6">
          <h2 id="next-steps-title" className="text-section font-semibold">
            What needs you today
          </h2>
        </header>
      ) : null}
      {items.length === 0 ? (
        <p
          className="px-4 py-3 text-body text-muted-foreground lg:px-6"
          data-testid="next-steps-done"
        >
          {doneMessage}
        </p>
      ) : (
        <ul className="divide-y">
          {items.map((step, index) => (
            <li key={step.id}>
              <a
                href={step.href}
                className="tap-target flex min-h-11 items-center px-4 py-3 text-body font-medium hover:bg-muted/60 lg:px-6"
                data-testid="next-step"
                data-step-id={step.id}
                data-role={
                  index === 0 &&
                  role &&
                  !step.label.startsWith("Approve the estimate")
                    ? role
                    : undefined
                }
              >
                {step.label}
              </a>
            </li>
          ))}
          {moreCount > 0 ? (
            <li>
              <a
                href="#jobs"
                className="tap-target flex min-h-11 items-center px-4 py-3 text-label text-muted-foreground hover:bg-muted/60 lg:px-6"
                data-testid="next-steps-more"
              >
                {moreCount} more on the Jobs list
              </a>
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}
