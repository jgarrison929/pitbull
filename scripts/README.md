# Scripts

Helpers for the live v5 app. The 3.8.2 health, smoke, and role-browser scripts were removed with that tree (tag `legacy-3.8.2-final`).

## `preflight.ps1`

Local checks before a PR: version stamps, vitest, and eslint. `-FullWeb` also runs lint and the Next.js build.

```powershell
./scripts/preflight.ps1
./scripts/preflight.ps1 -FullWeb
```

## Version stamps

`bump-version.ps1` and `stamp-version.ps1` update root `VERSION` and the `pcs-v5` version in `v5/package.json` / `v5/package-lock.json`.

```powershell
./scripts/bump-version.ps1 -From 5.0.3 -To 5.0.4
```

## Railway and DNS

- `railway-provision.ps1` — idempotent Railway project setup
- `railway-setup.ps1` — prints an environment-variable checklist
- `cloudflare-railway-dns.ps1` — syncs Railway custom-domain records to Cloudflare (`pcserp.app`)

See `deploy/RAILWAY-SETUP.md` and `deploy/RAILWAY-DEMO.md`.

## Screenshots and PR video

```bash
node scripts/capture-readme-screenshots.mjs
./scripts/upload-pr-demo.sh <PR_NUMBER> <VIDEO_PATH>
```

`capture-readme-screenshots.mjs` signs in through the v5 role picker on the public demo. `upload-pr-demo.sh` attaches an existing video to a pull request with `gh`.
