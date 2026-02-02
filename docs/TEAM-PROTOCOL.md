# Team Protocol - Pitbull Construction Solutions

## How We Work

This project is built by a human (Josh) directing an AI lead (JoshuasTrees) who coordinates a team of sub-agents. Each sub-agent is specialized, isolated, and disposable. The lead maintains continuity.

## Roles

### Lead (JoshuasTrees)
- Maintains the backlog (`memory/pitbull-pipeline.md`)
- Spawns and coordinates sub-agents
- Reviews results, updates docs, keeps momentum
- Communicates with Josh via Discord
- Runs on 20-minute pipeline ticks via cron

### Developer
- Picks top unchecked task from the backlog
- Implements, tests, commits, pushes
- MUST: `git pull origin main` before starting
- MUST: `dotnet build` + `npm run build` before committing
- MUST: use conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`)
- Reports: what changed, which files, commit hash

### QA Tester
- Tests live deployment (API + frontend)
- Runs curl against every endpoint
- Documents bugs with severity (P0/P1/P2/P3)
- Appends new bugs to the pipeline backlog
- Writes reports to `/mnt/c/research/construction-platform/`

### Product/Research
- Analyzes competitors, market, user needs
- Writes findings to `/mnt/c/research/construction-platform/`
- Generates user stories and feature requests
- Adds new tasks to pipeline backlog with rationale

### Documentation Writer
- Reads actual codebase (not assumptions)
- Writes guides based on real patterns found in code
- Updates README, CHANGELOG, BEST-PRACTICES, module guides
- Notes inconsistencies for developers to fix

### Twitter/Social
- Posts build updates to @NotNahm
- Voice: authentic, tired builder energy, short posts
- NEVER: mention Lyles, iTransition, employer names
- NEVER: em dashes, hashtag spam, AI fluff
- Max 1-2 posts per session

## Coordination Rules

1. **Always pull before working.** `git pull origin main` is the first command.
2. **Never touch files another agent owns.** If your task says "don't modify AuthController," don't.
3. **Test before pushing.** Backend: `dotnet build`. Frontend: `npm run build`. Both must pass.
4. **One concern per commit.** Don't mix a bug fix with a feature.
5. **Report everything.** What you changed, what you tested, what broke, what you left alone.
6. **Read the docs first.** Check `docs/BEST-PRACTICES.md` and `docs/ADDING-A-MODULE.md` before writing code.
7. **Don't over-engineer.** MVP first. We can refactor later.
8. **If stuck, report back.** Don't spin for 10 minutes. Say what blocked you.

## Shared Knowledge Base

| Document | Location | Purpose |
|----------|----------|---------|
| Pipeline Backlog | `memory/pitbull-pipeline.md` | Task queue, priorities, status |
| Best Practices | `docs/BEST-PRACTICES.md` | Code patterns and conventions |
| Module Guide | `docs/ADDING-A-MODULE.md` | How to add new modules |
| Competitor Analysis | `/mnt/c/research/construction-platform/competitor-features.md` | Market intelligence |
| QA Reports | `/mnt/c/research/construction-platform/qa-report-*.md` | Bug reports and test results |
| Architecture | `/mnt/c/research/construction-platform/ARCHITECTURE-PROPOSAL.md` | System design decisions |

## Environment Setup (for every sub-agent)

```bash
# .NET
export DOTNET_ROOT=$HOME/.dotnet
export PATH=$PATH:$HOME/.dotnet:$HOME/.dotnet/tools

# Working directory
cd /mnt/c/pitbull

# Always start with
git pull origin main

# Railway CLI (already linked)
railway service pitbull-api   # switch to API service
railway service pitbull-web   # switch to web service
railway logs -n 20            # check deploy logs
```

## Live URLs

- **API:** https://pitbull-api-production.up.railway.app
- **Web:** https://pitbull-web-production.up.railway.app
- **Health:** https://pitbull-api-production.up.railway.app/health
- **Repo:** https://github.com/jgarrison929/pitbull (private)

## What NOT to Do

- Don't mention Lyles Construction Group or iTransition anywhere
- Don't use em dashes
- Don't force push
- Don't delete branches other agents might be using
- Don't post personal info publicly
- Don't skip tests to "save time"
- Don't make assumptions about the codebase without reading it
