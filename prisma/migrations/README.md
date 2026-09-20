# Prisma migration workflow

The production database must be a reviewed Supabase PostgreSQL database. This repository intentionally does not auto-run a destructive migration against a developer machine or a Render service.

## Staging

Set a staging `DATABASE_URL` and, when required by the Supabase migration connection, `DIRECT_URL`, then run:

```powershell
npx prisma validate --schema prisma/schema.prisma
npx prisma migrate dev --schema prisma/schema.prisma --name relational_workspace
npx prisma generate --schema prisma/schema.prisma
```

Review the generated SQL and commit the generated migration directory. Do not use `prisma db push` for production.

## Render / production

After the reviewed migration is committed and a Supabase backup exists:

```powershell
npx prisma migrate deploy --schema prisma/schema.prisma
npx prisma generate --schema prisma/schema.prisma
npm run migrate:data
```

Run the importer only once per environment after the schema migration and before enabling production writes from the new API. Save its count report with the release artifact. The importer is idempotent for legacy IDs but does not copy binary uploads; upload objects must be copied to private Supabase Storage separately.
