# v5 design system

Pitbull v5 is a construction project controls platform. Screens share one set of tokens and a few layout components so a job, a cost code, and a change log read as the same product.

Color, radius, and the light and dark themes live in `v5/src/app/globals.css`. Layout components live in `v5/src/components/app/page.tsx`. Do not hard-code palette colors in product UI. Use the token utilities (`bg-card`, `text-muted-foreground`, `bg-primary`, `border`, and the status tokens).

## Components

`PageHeader`, `KpiStrip` / `Kpi`, `Section`, `Th` / `Td`, and `EmptyState` are the page anatomy. A screen is a header, then the numbers, then one section per list.

### EmptyState

`EmptyState` is the designed empty list. Use it whenever a list or table on a screen can render no rows. A grey sentence, a header with no body, and a table of column titles over zero rows are not empty states.

```tsx
<EmptyState
  title="No change orders on 24-077"
  body="Log one when the owner or a sub raises a change."
  icon={<ScrollText className="size-5" />}
  action={canCreate ? <button className={emptyStateActionClass}>New change order</button> : null}
/>
```

| Part | Rule |
|---|---|
| Icon | Optional. One small Lucide icon, `size-5`, `text-muted-foreground`, `aria-hidden`. The title carries the meaning. |
| Title | Names the thing and the job or cost code. `No change orders on 24-077`, `No cost posted on 05-120`. |
| Body | One sentence of construction explanation. Say who does the next real step and what it does to the job. |
| Action | The primary next step, only when this role can take it. Omit the control for every other role. The label is a verb: `New change order`, `Report day's work`, `Add a line`, `Price`, `Review the estimate`. |
| Target | The action uses `emptyStateActionClass` (`min-h-11`, 44px) so a phone tap lands. |
| Theme | Token classes only. The same component is correct in light and dark. |

Two different empties:

- **Nothing yet.** The job, plan, or cost code has no rows. Explain what creates the first row, and offer the action when this role can do it.
- **No results for this filter.** Rows exist and the current filter matches none. Title `No changes match this filter`. The action is `Clear filters`, which clears the filter and shows the list again. Do not use the nothing-yet copy for a filter miss.

The helpers in `v5/src/components/app/list-empty.tsx` are the copies for cost entries, plan lines, plan history, the change-order list, change-order lines, and the job change log. Add a new list there rather than writing a one-off grey line in the page.

Copy is plain and specific. No lorem, no placeholder sentences, and no "coming soon". A list that is empty on seeded data still gets this treatment. The verify crawl treats a leaf that starts "No … yet" as an undesigned empty state, except the change-order line title `No lines yet` on the two seeded cards that have no price. New titles name the job or cost code and do not use that opener.
