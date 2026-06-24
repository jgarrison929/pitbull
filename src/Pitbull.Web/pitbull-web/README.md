# Pitbull Web (Next.js frontend)

This is the Next.js 16 frontend for Pitbull Construction Solutions.

See root [README.md](../../README.md) and [docs/](../../docs/) for setup, architecture, and development workflow.

## Quick Start (from repo root)

```bash
cd src/Pitbull.Web/pitbull-web
npm ci
npm run dev
```

## Build/Lint (required before PRs)

```bash
npm run build
npm run lint
```

Frontend follows shadcn/ui + Tailwind + App Router. Use `src/lib/api.ts` for typed API calls.
