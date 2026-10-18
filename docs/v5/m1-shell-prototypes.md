# M1 shell prototypes

Three app shells render one seeded heavy-civil scenario (`v5/src/prototypes/scenario.ts`, fictional, labeled demo data). The scenario has a portfolio of 3 jobs, Cedar Creek Bridge's budget vs earned value by cost code, and Bridge Crew 2's daily plan for tomorrow. Each shell is at `/prototypes/<shell>`. No app page links to them, and they are marked noindex. The switcher bar at the top flips between them.

All three shells call the same typed actions (`portfolio.summary`, `job.costVariance`, `dailyPlan.draft`). The shells differ only in who drives those actions and how the results are shown.

| | A · Screen-first (`/prototypes/screen`) | B · Agent-first (`/prototypes/agent`) | C · Hybrid (`/prototypes/hybrid`) |
|---|---|---|---|
| Driver | The user, through navigation and tables | The user's typed or spoken request; the assistant runs actions | Screens lead; the assistant drafts and explains in a side rail |
| Does well | Densest view. Portfolio, all 12 cost codes and the plan fit one desktop screen. It is familiar to InEight buyers. Every number is visible, so it is easy to trust. | The foreman flow. A voice note becomes a checked plan in one step, which suits a phone in a truck. The answer ("why is Cedar Creek over?") comes before the table. | Proof sits next to the shortcut. Drafts land in the real screen for review, and every assistant step is shown as the typed action it ran. |
| Weak | It looks like InEight, minus the years of features. Nothing is new. On mobile the cost table needs horizontal scrolling. | Dense comparison is weak. A PM scanning 12 codes wants the table, and here it sits behind a disclosure. Errors in a transcript are hard to audit. Trust rests on the model being right. | Two surfaces to polish. The rail costs width on laptops. The agent's value is easy to underplay if the rail feels bolted on. |
| Mobile | Stacked cards; the table scrolls sideways | Best on mobile, since chat is native to a phone | Rail collapses into a bottom bar; the drafts stay inline |

Recommendation: **C · Hybrid**. Screens are the system of record and the proof (the trust bar). The assistant is a fast way to fill and query them, and every step it takes is a visible, typed action that lands as a reviewable draft. This avoids pitching "InEight + AI" by making the pitch "every number provable, and the field enters it by talking". The mobile path should borrow B's conversation for the foreman role.
