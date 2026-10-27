# Pitbull v5 design system

Pitbull is a construction project controls platform. This page lists the UI kit the live app in `v5/` shares. Color and radius tokens live in `v5/src/app/globals.css` (light and `.dark`). The theme is the `pcs_theme` cookie, read on the server so the first paint matches the choice. There is no type, spacing, or elevation scale yet: screens use Tailwind utilities on top of the color tokens.

## Tokens

| Token | Use |
|---|---|
| `--background`, `--foreground`, `--card`, `--popover`, `--muted`, `--border`, `--ring` | Page, cards, dialogs, secondary text, focus |
| `--primary`, `--primary-foreground` | Primary actions (approve) |
| `--destructive` | Destructive confirm (void, reject, remove) |
| `--brand` | Safety amber mark |
| `--positive`, `--caution`, `--negative` and each `-soft` | Status, always with a text label |
| `--chrome` | Always-dark icon rail, and the confirm dialog scrim |

Do not put raw palette classes (`text-red-600`, `bg-white`) or hex colors in product UI. `v5/src/lib/no-raw-colors.test.ts` checks `src/components` and `src/app`.

## Components

### Button, Badge, Card

`v5/src/components/ui/button.tsx`, `badge.tsx`, and `card.tsx`. shadcn primitives on Radix, themed with the tokens above. `/status` uses them. Most job screens still draw their own buttons with the same tokens (`bg-primary`, `border`, `text-muted-foreground`).

### Page anatomy

`v5/src/components/app/page.tsx`: `PageHeader`, `KpiStrip`, `Kpi`, `Section`, `Th`, `Td`, `EmptyState`.

### ConfirmDialog

`v5/src/components/ui/confirm-dialog.tsx`, opened from forms through `v5/src/components/form/confirm-form.tsx`.

Built on Radix Alert Dialog:

- Modal. Focus stays inside the dialog.
- The title is the accessible name. The body is the description.
- Esc and Cancel close the dialog and return focus to the control that opened it. They do not run the action.
- Clicking the scrim does not close it and does not run the action.
- The primary button is the verb (`Void change order`, `Remove plan line`), not a generic Confirm.
- Void, reject, and remove use the destructive button variant. Approve and return use the primary button.
- Cancel and the verb button are 44px tall (`h-11`) and full width on a phone.
- Light and dark use `bg-popover`, `text-popover-foreground`, `bg-chrome/70`, and the button variants. No one-off colors.

Copy names the object and the consequence. Example: title `Void change order CO-014 on 24-077?`, body `This removes $48,200.00 from pending changes and cannot be undone.` Builders in `v5/src/lib/confirm-copy.ts` keep that wording next to the action.

Wired today:

| Action | Where |
|---|---|
| Change order approve, reject, void | `v5/src/components/app/change-orders.tsx` |
| Remove a plan line | `v5/src/components/app/plan-card.tsx` |
| Approve a daily report, return it to the foreman | `v5/src/components/app/approve-return-forms.tsx` |

The same server actions run after confirm. Lock Period and Approve estimate on the job page are not on this dialog yet.

### Fields

`v5/src/components/form/form.tsx` and `combobox.tsx` for labelled inputs. A required reason (reject, void, return) stays on the form. The dialog opens only after that field validates. Confirm posts the reason with the action.
