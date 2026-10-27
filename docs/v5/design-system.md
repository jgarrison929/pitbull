# Design system

Pitbull v5 is a construction project controls platform. Screens share one set of tokens and a few layout components so a job, a cost code, and a change log read as the same product.

Color tokens for the v5 app. They live in [`v5/src/app/globals.css`](../../v5/src/app/globals.css) and map into Tailwind through `@theme inline`. Light values are on `:root`. Dark values are on `.dark`. The theme is the `pcs_theme` cookie. With no cookie the app is light.

Status is a color plus a word or a dollar variance. The color never stands alone.

Hex values below are the sRGB color Chromium paints for the `oklch()` token. Contrast is WCAG relative luminance on those painted colors. Normal text needs **4.5:1**. Large text (18pt regular, or 14pt bold) and non-text UI need **3:1**. Status pills are 12px, and the index figures axe treats as normal-weight text, so the text bar is 4.5:1.

## Color tokens

### Light (`:root`)

| Token | oklch | Hex | Role |
|---|---|---|---|
| `--background`, `--card`, `--popover` | `oklch(1 0 0)` | `#ffffff` | Page and card surface |
| `--foreground`, `--card-foreground` | `oklch(0.145 0 0)` | `#0a0a0a` | Body text |
| `--muted` | `oklch(0.97 0 0)` | `#f5f5f5` | Quiet surface, draft pill |
| `--muted-foreground` | `oklch(0.525 0 0)` | `#6a6a6a` | Secondary text |
| `--primary` | `oklch(0.22 0.02 260)` | `#151b24` | Primary fill |
| `--primary-foreground` | `oklch(0.985 0 0)` | `#fafafa` | Text on primary |
| `--brand` | `oklch(0.82 0.16 80)` | `#fab72a` | Safety amber mark |
| `--brand-foreground` | `oklch(0.2 0.02 260)` | `#11161f` | Text on the brand mark |
| `--positive` | `oklch(0.52 0.13 155)` | `#007e46` | On track |
| `--positive-soft` | `oklch(0.96 0.04 155)` | `#defae6` | On-track tint |
| `--caution` | `oklch(0.532 0.115 70)` | `#965e01` | Watch (amber) |
| `--caution-soft` | `oklch(0.97 0.05 85)` | `#fff3d0` | Watch tint |
| `--negative` | `oklch(0.55 0.2 20)` | `#cc243d` | At risk |
| `--negative-soft` | `oklch(0.96 0.03 15)` | `#ffeaeb` | At-risk tint |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `#e7000b` | Destructive action |
| `--chrome` | `oklch(0.18 0.02 260)` | `#0c121a` | Icon rail (always dark) |
| `--chrome-foreground` | `oklch(0.75 0.02 260)` | `#a7aebb` | Rail icon |
| `--border`, `--input` | `oklch(0.922 0 0)` | `#e5e5e5` | Hairline |

`--chart-2` stays `oklch(0.556 0 0)` (`#737373`). It is a chart swatch, not text.

### Dark (`.dark`)

| Token | oklch | Hex | Role |
|---|---|---|---|
| `--background` | `oklch(0.145 0 0)` | `#0a0a0a` | Page |
| `--foreground` | `oklch(0.985 0 0)` | `#fafafa` | Body text |
| `--card`, `--popover` | `oklch(0.205 0 0)` | `#171717` | Card |
| `--muted` | `oklch(0.269 0 0)` | `#262626` | Quiet surface |
| `--muted-foreground` | `oklch(0.708 0 0)` | `#a1a1a1` | Secondary text |
| `--positive` | `oklch(0.72 0.14 155)` | `#4ebe7d` | On track |
| `--positive-soft` | `oklch(0.3 0.05 155)` | `#173523` | On-track tint |
| `--caution` | `oklch(0.8 0.14 80)` | `#edb345` | Watch |
| `--caution-soft` | `oklch(0.32 0.05 80)` | `#403012` | Watch tint |
| `--negative` | `oklch(0.72 0.17 20)` | `#fd7277` | At risk |
| `--negative-soft` | `oklch(0.32 0.06 20)` | `#4d2526` | At-risk tint |
| `--chrome` | `oklch(0.12 0.01 260)` | `#040609` | Icon rail |
| `--chrome-foreground` | `oklch(0.7 0.02 260)` | `#979fab` | Rail icon |

Dark `--brand` and `--brand-foreground` match light.

## Contrast

Ratios are for the foreground token on the background token. Soft-tint rows also use those tokens at 60% or 80% over white; those blends are lighter than the full tint, so the full tint is the harder case.

### Light

| Foreground | Background | Ratio |
|---|---|---|
| `--foreground` `#0a0a0a` | `--background` `#ffffff` | 19.80:1 |
| `--muted-foreground` `#6a6a6a` | `--background` `#ffffff` | 5.41:1 |
| `--muted-foreground` `#6a6a6a` | `--muted` `#f5f5f5` | 4.96:1 |
| `--muted-foreground` `#6a6a6a` | `--caution-soft` `#fff3d0` | 4.89:1 |
| `--muted-foreground` `#6a6a6a` | `--positive-soft` `#defae6` | 4.87:1 |
| `--muted-foreground` `#6a6a6a` | `--negative-soft` `#ffeaeb` | 4.69:1 |
| `--caution` `#965e01` | `--background` `#ffffff` | 5.39:1 |
| `--caution` `#965e01` | `--caution-soft` `#fff3d0` | 4.87:1 |
| `--caution` `#965e01` | `--muted` `#f5f5f5` | 4.94:1 |
| `--caution` `#965e01` | `--negative-soft` `#ffeaeb` | 4.67:1 |
| `--positive` `#007e46` | `--positive-soft` `#defae6` | 4.65:1 |
| `--positive` `#007e46` | `--background` `#ffffff` | 5.16:1 |
| `--negative` `#cc243d` | `--negative-soft` `#ffeaeb` | 4.69:1 |
| `--negative` `#cc243d` | `--background` `#ffffff` | 5.40:1 |
| `--brand-foreground` `#11161f` | `--brand` `#fab72a` | 10.25:1 |
| `--destructive` `#e7000b` | `--background` `#ffffff` | 4.77:1 |

### Dark

| Foreground | Background | Ratio |
|---|---|---|
| `--foreground` `#fafafa` | `--background` `#0a0a0a` | 18.97:1 |
| `--muted-foreground` `#a1a1a1` | `--muted` `#262626` | 5.86:1 |
| `--muted-foreground` `#a1a1a1` | `--background` `#0a0a0a` | 7.66:1 |
| `--muted-foreground` `#a1a1a1` | `--card` `#171717` | 6.94:1 |
| `--caution` `#edb345` | `--caution-soft` `#403012` | 6.75:1 |
| `--caution` `#edb345` | `--background` `#0a0a0a` | 10.50:1 |
| `--positive` `#4ebe7d` | `--positive-soft` `#173523` | 5.72:1 |
| `--positive` `#4ebe7d` | `--background` `#0a0a0a` | 8.47:1 |
| `--negative` `#fd7277` | `--negative-soft` `#4d2526` | 4.88:1 |
| `--negative` `#fd7277` | `--background` `#0a0a0a` | 7.40:1 |

### What changed (light only)

Dark tokens are unchanged.

| Token | Old oklch | Old hex | New oklch | New hex | Hard pairing | Old | New |
|---|---|---|---|---|---|---|---|
| `--caution` | `oklch(0.6 0.14 70)` | `#b46e00` | `oklch(0.532 0.115 70)` | `#965e01` | on `--caution-soft` `#fff3d0` | 3.67:1 | 4.87:1 |
| `--caution` | `oklch(0.6 0.14 70)` | `#b46e00` | `oklch(0.532 0.115 70)` | `#965e01` | on white `#ffffff` | 4.06:1 | 5.39:1 |
| `--muted-foreground` | `oklch(0.556 0 0)` | `#737373` | `oklch(0.525 0 0)` | `#6a6a6a` | on `--muted` `#f5f5f5` | 4.34:1 | 4.96:1 |
| `--muted-foreground` | `oklch(0.556 0 0)` | `#737373` | `oklch(0.525 0 0)` | `#6a6a6a` | on `--negative-soft` `#ffeaeb` | 4.11:1 | 4.69:1 |
| `--muted-foreground` | `oklch(0.556 0 0)` | `#737373` | `oklch(0.525 0 0)` | `#6a6a6a` | on `--caution-soft` `#fff3d0` | 4.29:1 | 4.89:1 |

`--positive` and `--negative` already cleared 4.5:1 on white and on their soft tints, so they stayed put. Watch amber is darker and still amber (hue 70), separate from at-risk red `#cc243d` and on-track green `#007e46`.

## Components

`PageHeader`, `KpiStrip` / `Kpi`, `Section`, `Th` / `Td`, and `EmptyState` are the page anatomy. A screen is a header, then the numbers, then one section per list. Layout components live in `v5/src/components/app/page.tsx`. Do not hard-code palette colors in product UI. Use the token utilities (`bg-card`, `text-muted-foreground`, `bg-primary`, `border`, and the status tokens).

`v5/src/components/ui/button.tsx`, `badge.tsx`, and `card.tsx` are the shadcn primitives on Radix, themed with the tokens above. `/status` uses them. Most job screens still draw their own buttons with the same tokens.

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

### ConfirmDialog

`v5/src/components/ui/confirm-dialog.tsx`, opened from forms through `v5/src/components/form/confirm-form.tsx`.

Built on Radix Alert Dialog:

- Modal. Focus stays inside the dialog.
- The title is the accessible name. The body is the description.
- Esc and Cancel close the dialog and return focus to the control that opened it. They do not run the action.
- Clicking the scrim does not close it and does not run the action.
- The primary button is the verb (`Void change order`, `Remove plan line`), not a generic Confirm.
- Void, reject, and remove use the destructive button variant. Approve, return, lock period, and approve estimate use the primary button.
- Cancel and the verb button are 44px tall (`h-11`) and full width on a phone.
- Light and dark use `bg-popover`, `text-popover-foreground`, `bg-chrome/70`, and the button variants. No one-off colors.

Copy names the object and the consequence. Example: title `Void change order CO-014 on 24-077?`, body `This removes $48,200.00 from pending changes and cannot be undone.` Builders in `v5/src/lib/confirm-copy.ts` keep that wording next to the action.

Wired today:

| Action | Where |
|---|---|
| Change order approve, reject, void | `v5/src/components/app/change-orders.tsx` |
| Remove a plan line | `v5/src/components/app/plan-card.tsx` |
| Approve a daily report, return it to the foreman | `v5/src/components/app/approve-return-forms.tsx` |
| Lock a progress period | `v5/src/app/app/jobs/[number]/page.tsx` |
| Approve an estimate | `v5/src/app/app/jobs/[number]/page.tsx` |

The same server actions run after confirm. Lock period and Approve estimate use the primary button. The dialog names the period, or the Current Estimate amount that becomes Current Budget.

### Phone fit

At widths of 640 px and under:

- The header brand mark and the user menu are at least 44×44 px. The desktop rail mark stays 32 px.
- Assistant suggestion chips on the phone page wrap onto more lines. That row does not scroll sideways, and each chip is at least 44 px tall. The desktop rail keeps one row of chips (at least 24 px) that scrolls inside the rail, so the rail does not set the page height.
- A cost-item KPI of $10,000.00 or more shows the short form (`$690K`) with the exact dollars in `title` and `data-cents`. Smaller KPI amounts stay exact. Cost entry amounts and totals stay exact.
- Card figures use tabular numbers and stay start-aligned. Cost-tree and table numeric cells use tabular numbers and sit flush right.
- A cost-table CPI or SPI shows the index, the dollar variance, and a word: On track, Watch, or At risk.
- A cost-tree expand control is named with the cost code and the description, for example "Expand 02 Earthwork", and it sets `aria-expanded` and `aria-controls`.
- A cost-tree scroll region is in the tab order, so sideways and vertical scrolling is reachable from the keyboard.

On a phone, a project manager or executive job page puts the EAC and CPI cards above the title. The job strip spells the first cost-index pill as "Cost performance (CPI)" and "Schedule performance (SPI)". Later pills stay short (`CPI 0.96 · SPI 0.91`) so the strip stays one row on a desktop. Buttons that are 44 px on a phone stay the compact control size on a desktop (at least 24 px).

### Fields

`v5/src/components/form/form.tsx` and `combobox.tsx` for labelled inputs. A required reason (reject, void, return) stays on the form. The dialog opens only after that field validates. Confirm posts the reason with the action.
