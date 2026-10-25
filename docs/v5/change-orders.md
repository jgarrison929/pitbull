# Change orders

A change order revises a job's Current Budget after the estimate is approved. Original Budget stays at the figure Approve estimate froze. Pending (priced) change orders are exposure only. They are not in Current Budget and they are not in EAC.

## States

```text
(none) → draft → priced → approved
                  │  ↑         rejected
                  │  └── price again (revision + 1)
                  └── void, from draft or priced
```

Approved, rejected, and voided are final. Correcting an approved change order means raising a new one.

Who can do what:

| Command | Who |
|---|---|
| Raise, price, void | Project manager or executive |
| Approve, reject | Project manager or executive |

The job screen and the assistant both call `changeOrder.<command>` through `run()`. There is no second write path. Each of those commands is on the job change list. `changeOrder.show` is the read.

## What approve writes

Lines are signed labor, material, equipment, and sub amounts in integer cents, plus an optional quantity change.

- An existing cost item: Current Budget and budget quantity move by the line. Original Budget and Current Estimate are not written.
- A new cost item: inserted as a leaf with Original Budget 0, Current Estimate 0, Current Budget equal to the line, forecast method current budget, and nothing earned or spent. It is not inserted until approve, so a rejected or voided change order leaves no cost item behind.

EAC is the sum of per-item forecasts, the same math as the job page. On a new leaf, EAC moves by the same amount as Current Budget. On an item that already has earned value, EAC can move by less than the Current Budget change. The approve summary says so when the two differ.

Approve names the revision the screen showed. A reprice after that screen was rendered is refused until the new lines are reviewed. Approving the same change order again is refused and does not move Current Budget a second time.

After the write, the same transaction checks two things and rolls back if either fails. Original Budget on every touched item, and the job total, matches the pre-image, and every new leaf's Original Budget is 0. For each touched item, Current Budget minus Original Budget equals the sum of approved change-order lines on that item.

A job whose estimate is still a draft cannot take a change order. Approving the estimate would replace Current Budget.
