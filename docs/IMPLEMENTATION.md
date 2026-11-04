# Implementation Guide — Sagara Villas

- **Version:** 1.0
- **Framework:** Next.js App Router · TypeScript (strict) · PostgreSQL · Prisma
- **Scope:** Portfolio 02 MVP (P0) with P1 items scheduled last
- **Related:** [AGENTS](../AGENTS.md) · [PRD](PRD.md) · [DATABASE](DATABASE.md) · [API](API.md) · [SECURITY](../SECURITY.md) · [TESTING](TESTING.md) · [DEPLOYMENT](DEPLOYMENT.md)

---

## 1. Strategy

Build milestone by milestone. **Do not generate the whole application in one pass.** Data integrity first, then admin workflows, then the public experience, then polish.

Before each milestone:

1. Read `AGENTS.md`.
2. Read the relevant PRD rules (`BR-`, `FR-`), DATABASE, API, SECURITY items.
3. Inspect the repository state.
4. Confirm scope and acceptance criteria.

After each milestone:

1. Lint → typecheck → tests → build (as applicable).
2. Inspect UI at required viewports (DESIGN §11).
3. Run the design/a11y self-critique (hallmark + better-* skills where installed).
4. Update docs; report using §8.

## 2. Stack

| Layer         | Choice                                | Notes                                                             |
| ------------- | ------------------------------------- | ----------------------------------------------------------------- |
| Framework     | Next.js App Router                    | Server Components by default; client components only where needed |
| Language      | TypeScript strict                     | No undocumented `any`                                             |
| Styling       | Tailwind CSS + CSS variables          | Tokens from DESIGN §9                                             |
| Components    | shadcn/ui (selective)                 | Restyle to Shoreline Calm; don't accept defaults blindly          |
| i18n          | next-intl                             | Public routes `/[locale]`; admin via cookie                       |
| Database      | PostgreSQL                            | Local via Docker; hosted Neon or Supabase Postgres                |
| ORM           | Prisma                                | Hand-written SQL migration for constraints (DATABASE §4)          |
| Auth          | Auth.js (Credentials, JWT sessions)   | Verify the installed version's API before coding                  |
| Hashing       | argon2id (`@node-rs/argon2`)          | Fallback bcrypt ≥ 12                                              |
| Validation    | Zod                                   | Schemas shared by client and server                               |
| Forms         | React Hook Form                       | With Zod resolver                                                 |
| Tables        | TanStack Table                        | Server-side pagination and filters                                |
| Calendar      | Custom CSS-grid timeline              | No heavy calendar library                                         |
| Dates         | date-fns (+ property timezone helper) | Date-only handling; no ad-hoc `new Date()` conversions            |
| Icons         | lucide-react                          |                                                                   |
| Tests         | Vitest, Playwright, axe               | Real Postgres for integration tests                               |
| Rate limiting | Upstash Redis or Postgres table       | Not in-memory                                                     |
| Deployment    | Vercel + hosted Postgres              | See DEPLOYMENT                                                    |

Avoid: GraphQL, tRPC, state-management libraries, a CMS, or an animation library in MVP.

## 3. Target Folder Structure

```text
sagara-villas/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/                 # includes hand-written constraint migration
│   └── seed.ts
├── public/images/                  # hero/, units/
├── messages/                       # en.json, id.json (public + admin keys)
├── src/
│   ├── app/
│   │   ├── [locale]/               # public site
│   │   │   ├── page.tsx
│   │   │   ├── villas/ [slug]/
│   │   │   ├── about/ location/ contact/ book/
│   │   ├── admin/                  # admin dashboard (no locale prefix)
│   │   │   ├── login/
│   │   │   ├── (app)/              # authenticated shell
│   │   │   │   ├── page.tsx        # dashboard
│   │   │   │   ├── calendar/ reservations/ guests/ units/ reports/ users/
│   │   ├── api/
│   │   │   ├── public/ admin/ auth/ health/
│   │   ├── robots.ts  sitemap.ts
│   ├── components/
│   │   ├── ui/                     # primitives (button, input, badge, dialog…)
│   │   ├── public/                 # sections, unit-card, request-panel…
│   │   ├── admin/                  # shell, calendar, tables, payment-panel…
│   ├── server/
│   │   ├── db.ts                   # Prisma client singleton
│   │   ├── auth/                   # config, requireRole, password
│   │   ├── services/               # reservations, availability, pricing, payments, guests, units, reports, audit
│   │   ├── security/               # rate-limit, origin-check, csv
│   ├── lib/
│   │   ├── dates.ts                # property-timezone, date-only helpers
│   │   ├── money.ts                # IDR formatting
│   │   ├── validation/             # Zod schemas
│   │   ├── errors.ts               # error codes → HTTP mapping
│   ├── i18n/
│   └── styles/globals.css
├── tests/ (unit, integration, e2e)
├── docs/                           # these documents + ASSETS.md
├── AGENTS.md  README.md  .env.example  docker-compose.yml
```

Not a requirement to create empty files; adjust to installed versions while keeping the separation: **handlers → services → Prisma**.

## 4. Key Implementation Rules

1. **Services own business rules.** Route handlers and server components call services; they never touch Prisma directly for mutations.
2. **One transaction per mutation** that touches reservations/payments (DATABASE §5). Include the audit write.
3. **Dates:** parse `YYYY-MM-DD` strings to date-only values using one helper; compute "today" in `Asia/Makassar`. Add tests around midnight and DST-free but offset-sensitive cases (server in UTC).
4. **Errors:** services throw typed domain errors; one mapper converts them to the API error format. Translate `23P01` to `DATE_CONFLICT`.
5. **Pricing:** single `pricing` service used by quote, create, and edit. Never recompute in the UI for submission.
6. **Authorization:** `requireRole(["ADMIN"])` at the top of every admin handler/page; add a test that fails if a new admin route lacks it.
7. **i18n:** no hard-coded user-facing strings.
8. **Server-first UI:** the calendar and tables fetch on the server; client components handle interaction only.

## 5. Milestones

### M0 — Repository and Environment

Tasks: init Next.js (App Router, TS strict), Tailwind, ESLint, Prettier, Vitest, `docker-compose.yml` (Postgres), `.env.example`, scripts (`dev`, `build`, `lint`, `typecheck`, `test`, `db:migrate`, `db:seed`).
Acceptance: app starts; database container starts; lint/typecheck pass; README quick start works from a clean clone.

### M1 — Database Foundation

Tasks: Prisma schema (DATABASE §3), migrations including hand-written constraints (§4), seed script, `db.ts`, domain types.
Acceptance: `migrate` from empty DB succeeds; seed creates fictional data; **constraint tests** prove overlap, date-order, and amount checks (TC-D01…); same-day turnover accepted.

### M2 — Authentication and Authorization

Tasks: Auth.js credentials, argon2id, lockout, `requireRole`, admin layout guard, login page, logout, users seed, origin check helper, rate-limit helper.
Acceptance: SEC-01…SEC-06 tests pass; anonymous → redirect/401; STAFF cannot reach ADMIN-only routes.

### M3 — Core Services

Tasks: dates/money helpers, pricing, availability, reservation service (create, edit, confirm, cancel, check-in/out), guest matching, payment service, audit service, error mapper.
Acceptance: unit + integration tests for BR-01…BR-15; **concurrency test** (two parallel confirms → exactly one succeeds); payment transition table (DATABASE §5.4) passes.

### M4 — Design System and Admin Shell

Tasks: tokens/fonts, primitives (button, input, select, badge, dialog, toast, table, empty/loading/error states), admin shell (sidebar/top bar/drawer), language toggle, status badge component with icon + label.
Acceptance: DESIGN checklist items for components pass; keyboard focus visible; tablet drawer works; contrast verified.

### M5 — Admin: Reservations, Guests, Payments

Tasks: reservation list/filter/detail/create/edit, status actions with dialogs, guest list/detail, payment panel (record, void, overpaid banner), audit trail view.
Acceptance: FR-14, FR-16, FR-17 criteria; invalid transitions rejected; version conflict handled with a clear UI message.

### M6 — Admin: Calendar and Units

Tasks: resource timeline (week/14-day/month), blocks, create-from-range, unit CRUD with amenities/images/rate rules (rate rules may move to M9), archive guard.
Acceptance: FR-13, FR-15; same-day turnover rendered correctly; list-view fallback; keyboard path works; calendar query is a single query.

### M7 — Dashboard and Reports

Tasks: dashboard cards/lists, four reports, filters, totals, CSV export with formula-injection protection, print styles.
Acceptance: dashboard numbers equal report numbers on seeded data; aggregate overflow behavior verified (DATABASE §7); SEC-12 test passes.

### M8 — Public Website

Tasks: homepage, catalog, unit detail (per DESIGN §6), availability-aware date picker, quote, booking request flow with success state, about/location/contact, localization, SEO (metadata, sitemap, robots), honeypot + rate limit.
Acceptance: FR-01…FR-07; request creates `PENDING` and never claims confirmation; language switch preserves form data; unknown slug → not-found; Lighthouse reviewed.

### M9 — P1 Items and Hardening

Tasks (pick in order): rate rules, CSV polish, guest anonymize, admin image upload (Blob/S3 with MIME/size validation), PENDING staleness indicator, CSP tightening, a11y fixes from audits.
Acceptance: each item has tests; no regressions.

### M10 — QA, Deployment, Handover

Tasks: full test pass, viewport/a11y/SEO review, security checklist (SECURITY §11), deploy to Vercel, run `migrate deploy`, verify production flows, complete README/DEPLOYMENT, screenshots, demo script, known limitations.
Acceptance: release gate in TESTING §9 satisfied.

## 6. Scripts (target)

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "db:up": "docker compose up -d db",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:seed": "tsx prisma/seed.ts",
    "db:reset": "prisma migrate reset"
  }
}
```

Only reference tools that are installed. `db:reset` must refuse to run against a non-local `DATABASE_URL`.

## 7. Environment Variables (summary; details in DEPLOYMENT)

`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_SITE_URL`, `PROPERTY_TIMEZONE=Asia/Makassar`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, rate-limit store credentials, optional `NEXT_PUBLIC_WHATSAPP_NUMBER` (post-submit contact link only), optional CAPTCHA keys.

## 8. AI Agent Reporting Format

```text
Milestone:
Status: PASS / BLOCKED / IN PROGRESS

Implemented:
- ...

Verification:
- Lint:
- Typecheck:
- Unit/integration tests:
- E2E tests:
- Build:
- Responsive review (widths):
- Accessibility check:
- Security items touched (SEC-xx):
- Design self-critique (hallmark/better-*):

Known issues:
- ...

Files changed:
- ...

Next milestone:
- ...
```

Never report PASS if a required check was skipped or failed.
