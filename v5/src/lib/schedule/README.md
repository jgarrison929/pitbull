# Schedule helpers

Do **not** add `working-days.ts` here.

Working-day arithmetic lives in **`src/lib/working-calendar.ts`** (indexed day list, not per-day `Date` walks). The CPM engine imports that module only.

A parallel `lib/schedule/working-days.ts` was deleted after it forked from the calendar — CI forbids recreating it (`agent-guards/paths.test.ts`).
