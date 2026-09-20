# IBRA-BA Next/Nest migration runbook

## Services

- `ibra-ba-legacy`: current Express application and rollback target.
- `ibra-ba-api`: NestJS API with Prisma and Supabase PostgreSQL.
- `ibra-ba-web`: Next.js 14 App Router frontend. It proxies browser `/api/*` calls to `API_ORIGIN`.

## Required production secrets

Configure these in Render, never in the repository:

- `DATABASE_URL`: Supabase pooled PostgreSQL URL for runtime.
- `DIRECT_URL`: optional Supabase direct PostgreSQL URL for migration commands that require a non-pooled connection; the runtime schema uses `DATABASE_URL`.
- `JWT_SECRET`: long random secret shared only by `ibra-ba-api`.
- `SUPABASE_URL` and service role key only where storage/integration services require them.
- AI, SMTP/Brevo and Twilio secrets only on the API service.

The legacy service may keep `IBRA_JWT_SECRET` during the rollback period. After the final cutover, rotate the JWT secret and invalidate legacy sessions.

## Local checks

```powershell
npm install
npx prisma generate
npx prisma validate
npm run build
npm run lint
npm run test
npm run smoke:api
```

`smoke:api` always checks public or staging health. Set `API_BASE_URL`, `SMOKE_LOGIN_EMAIL`, `SMOKE_LOGIN_PASSWORD`, and optionally `SMOKE_PROJECT_ID` to run the authenticated parity checks.

The web preview can run independently:

```powershell
npm run dev --workspace @ibra-ba/web -- --port 3002
```

The API needs a reachable PostgreSQL `DATABASE_URL`; do not point the new API at the old SQLite `prisma/dev.db` or at a production `data.json` fallback.

## Data migration

1. Take a Supabase database backup and preserve the legacy `data.json` plus upload directory.
2. Apply the reviewed Prisma migration to the staging database.
3. Set staging variables in the process environment and run the importer:

```powershell
$env:DATABASE_URL = 'postgresql://...'
$env:DIRECT_URL = 'postgresql://...'
$env:MIGRATION_TARGET = 'staging'
$env:MIGRATION_REPORT_PATH = 'migration-reports/data-migration-staging.json'
npm run db:migrate:deploy
npm run migrate:data
```

4. Compare the importer count report with the source: users, projects, memberships, documents, budgets, schedules, controls and storage bytes.
5. Copy legacy upload objects into private Supabase Storage and keep their keys in `Document.storageKey`.
6. Verify signed downloads and auth-scoped project reads before any production write.
7. Repeat against production only after the staging report and browser smoke tests pass.

The importer is idempotent for the legacy IDs it owns. It is not a substitute for a backup or a storage copy.

## Staging acceptance

- `GET /api/health` returns `200` from the API service.
- Next `/api/health` rewrite returns the same healthy response.
- Login sets `ibra_session` as HttpOnly/Secure/SameSite=Lax in production.
- `/api/me` and `/api/projects` work with the cookie; Bearer remains compatibility-only.
- A user cannot read or mutate a project outside their company.
- `/`, `/login`, `/dashboard` and `/projects/:id` pass desktop and 390px mobile browser checks.
- Dashboard counts come from database records; no fabricated trend or completion values are shipped.
- Legacy `/api/health` and login remain available on the legacy Render URL.

## Cutover

1. Freeze the legacy deploy commit and take final database/storage backups.
2. Run the importer/reconciliation report and save it with the release artifacts.
3. Deploy `ibra-ba-api` and `ibra-ba-web` from the same commit.
4. Run health, auth, project scope, upload and logout smoke checks against staging URLs.
5. Attach `ibra-ba.net` to `ibra-ba-web` only after the checks pass.
6. Monitor 5xx, 401/403, database, upload and cookie failures.
7. Keep `ibra-ba-legacy` and its data snapshot until post-cutover reconciliation is signed off.

## Rollback

- Before any new production writes: move the custom domain back to `ibra-ba-legacy`.
- After new writes: do not rely on a DNS rollback alone. Restore/replay the verified database snapshot or use an explicitly tested legacy snapshot bridge.
- Do not delete legacy uploads, snapshots or the service during the rollback window.
