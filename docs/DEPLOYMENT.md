# Deployment Guide — Sagara Villas

- **Version:** 1.0
- **Target:** Vercel (app) + managed PostgreSQL (Neon or Supabase Postgres)
- **Related:** [SECURITY](../SECURITY.md) · [DATABASE](DATABASE.md) · [IMPLEMENTATION](IMPLEMENTATION.md) · [TESTING](TESTING.md)

> Provider dashboards and CLI flags change. Verify each step against current provider and Prisma documentation before running it.

---

## 1. Environments

| Environment      | Database                 | Purpose     | Seed                        |
| ---------------- | ------------------------ | ----------- | --------------------------- |
| Local            | Docker Postgres          | Development | Demo seed (fictional)       |
| Preview (per PR) | Separate branch/database | Review      | Optional demo seed          |
| Production       | Dedicated database       | Public demo | Seed **once**, deliberately |

Rules: previews never connect to the production database; production credentials are never present on a developer machine's `.env`.

## 2. Environment Variables

| Variable                      | Scope             | Notes                                                     |
| ----------------------------- | ----------------- | --------------------------------------------------------- |
| `DATABASE_URL`                | Server            | **Pooled** connection string (runtime)                    |
| `DIRECT_URL`                  | Server / CI       | **Direct** connection (migrations)                        |
| `AUTH_SECRET`                 | Server            | Random 32+ bytes; rotate on exposure                      |
| `AUTH_URL`                    | Server            | Canonical site URL (HTTPS)                                |
| `NEXT_PUBLIC_SITE_URL`        | Public            | Used for canonical/OG/sitemap                             |
| `PROPERTY_TIMEZONE`           | Server            | `Asia/Makassar`                                           |
| `SEED_ADMIN_EMAIL`            | Seed only         | Remove after seeding                                      |
| `SEED_ADMIN_PASSWORD`         | Seed only         | Strong, unique; remove after seeding                      |
| `RATE_LIMIT_*`                | Server            | Redis URL/token or equivalent                             |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Public (optional) | Contact link shown **after** submission; demo number only |
| `TURNSTILE_*`                 | Optional          | CAPTCHA keys if enabled                                   |

`.env.example` lists names with placeholder values only. No secret may use the `NEXT_PUBLIC_` prefix.

## 3. Database Setup

1. Create a managed Postgres instance (region near Bali/Southeast Asia if available).
2. Enable required extension: `btree_gist` (created by the migration; confirm the provider allows it).
3. Create two roles if the provider supports it: a **migration** role (DDL) and a **runtime** role (DML only). Use the migration credential in `DIRECT_URL` for deployments only.
4. Enforce TLS.
5. Enable automated backups and point-in-time recovery if available; note retention period here once chosen.

## 4. Migration Strategy

- Production uses `prisma migrate deploy` only. Never `migrate dev` or `migrate reset` against production.
- Run migrations as a **separate CI/deploy step** before releasing the new app version, not inside request-time code.
- Compatible changes first (expand), remove old columns in a later release (contract).
- Before the first production migration: confirm that the empty-database migration applies cleanly in a fresh test database, including the hand-written constraint SQL.
- If a migration fails: stop the release, do not hand-edit the migrations table; fix forward with a new migration or restore from backup.

## 5. Vercel Setup

1. Import the repository; framework preset: Next.js.
2. Add environment variables per environment (Production / Preview / Development) — keep secrets out of Preview unless needed, and use preview-specific DB credentials.
3. Ensure `prisma generate` runs on install/build (e.g. `postinstall`).
4. Set Node.js version to match `package.json` engines.
5. Configure the production domain and HTTPS; confirm `AUTH_URL` and `NEXT_PUBLIC_SITE_URL` match it.
6. Verify security headers in the production response (SEC-15).

## 6. First Release Procedure

1. All tests and the release gate in TESTING §9 pass on the release commit.
2. Apply migrations to the production database (`db:deploy` with `DIRECT_URL`).
3. Deploy the application.
4. Run the production seed **once**, with an explicit confirmation flag and temporary seed variables; then delete those variables.
5. Log in as admin; change the seeded password if it was shared anywhere.
6. Smoke test (below).
7. Record deployment date, commit, and Lighthouse results in the test report.

## 7. Production Smoke Test

- [ ] `/api/health` returns `ok` with database `ok`.
- [ ] Root redirects to `/en`; `/id` renders; language switch preserves the page.
- [ ] Unit catalog and a unit detail page load; unknown slug shows not-found.
- [ ] Submit a booking request → success screen shows code and "not confirmed" text.
- [ ] Admin login works; the request appears as `PENDING`.
- [ ] Confirm the reservation; calendar shows it; attempting an overlapping confirmation fails cleanly.
- [ ] Record a partial payment → `PARTIAL`; complete it → `PAID`.
- [ ] Reports show the reservation and payment; CSV downloads and opens safely.
- [ ] STAFF user cannot open Users or edit Units.
- [ ] Admin pages are `noindex`; `sitemap.xml` lists public routes only.
- [ ] No secrets in client bundle; headers present.

## 8. Background and Scheduled Work

MVP needs none. Optional (P1): a Vercel Cron job (protected by a secret header) that flags `PENDING` requests older than N days as _stale_ (a display flag, not an automatic cancellation). Cron endpoints must verify the secret and be idempotent.

## 9. Observability

- Structured server logs with `requestId`; no personal data (SEC-18).
- Provider alerts for failed deployments and database connection errors.
- Uptime check on `/api/health`.
- Review the audit log after the demo period for unexpected actions.

## 10. Backup and Restore

- Rely on provider automated backups plus a manual logical dump before each production migration (`pg_dump` using the direct connection) stored outside the repository.
- **Rehearse a restore** into a scratch database before release and record the steps and elapsed time here.
- Never commit dumps; they contain guest data.

## 11. Rollback

| Situation                           | Action                                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| App bug, schema compatible          | Redeploy previous Vercel deployment                                                                            |
| Migration applied, app incompatible | Redeploy previous app **only if** the schema is backward compatible; otherwise fix forward                     |
| Data corruption                     | Stop writes (maintenance flag), restore to a scratch DB, verify, then restore/point-in-time recover production |

## 12. Demo Data Hygiene

- Production demo contains only fictional data (CONTENT_GUIDE §12).
- Periodically reset the **demo** dataset with a dedicated, guarded script that refuses to run unless `DEMO_RESET_ALLOWED=true` is set; this must never exist as an active toggle in a real-client deployment.
- Public requests submitted during the demo are real stored rows: the privacy notice says so. Purge or anonymize them on a schedule.

## 13. Handover Checklist

- [ ] Public demo URL works; admin demo credentials shared **privately** (never in README).
- [ ] README has quick start, env variable table, demo disclaimer, screenshots, known limitations.
- [ ] `docs/ASSETS.md` lists every image with license/credit.
- [ ] Production environment variables documented (names only).
- [ ] Backup and restore procedure documented and rehearsed.
- [ ] Release gate recorded as PASS with date and commit.
