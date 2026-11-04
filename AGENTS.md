# AGENTS.md — Operating Rules for AI Coding Agents

- **Project:** Sagara Villas — Villa Booking Management System (Portfolio 02)
- **Version:** 1.0
- **Related:** [README](README.md) · [PRD](docs/PRD.md) · [IMPLEMENTATION](docs/IMPLEMENTATION.md)

This file is read **first** by every agent session. If an instruction here conflicts with a casual request, follow this file and ask the owner.

---

## 1. Read Order (every session)

1. `AGENTS.md` (this file)
2. `IMPLEMENTATION.md` → find the current milestone
3. For that milestone, read only what applies:
   - Business rules → `PRD.md` (`BR-`, `FR-`)
   - Schema, constraints, transactions → `DATABASE.md`
   - Endpoints and error format → `API.md`
   - Controls → `SECURITY.md` (`SEC-`)
   - Look and copy → `DESIGN.md`, `CONTENT_GUIDE.md`
   - Verification → `TESTING.md` (`TC-`)
   - Release work → `DEPLOYMENT.md`
4. Inspect the repository before writing code.

## 2. Project Snapshot

Full-stack system for a multi-unit villa operator: public catalog and booking **requests**, plus an admin dashboard for reservations, calendar, guests, manual payments (`UNPAID`/`PARTIAL`/`PAID`), and reports.
Stack: Next.js App Router, TypeScript strict, Tailwind, shadcn/ui (selective), next-intl, PostgreSQL, Prisma, Auth.js, Zod, Vitest, Playwright.

## 3. Non-Negotiable Rules

### Data integrity

1. No overlapping blocking reservations — enforced by the database exclusion constraint **and** services (DATABASE §4–5).
2. Stays are `[checkIn, checkOut)` date-only values in `Asia/Makassar`. Same-day turnover is valid.
3. Payment status is **derived** from payments; never writable directly. Payments are never deleted, only voided.
4. Money is whole IDR `Int`. No floats.
5. Every mutation of reservations, payments, units, or users runs in one transaction and writes an audit row.
6. Price breakdown is snapshotted on the reservation.

### Security

7. Authorization is enforced server-side on every admin route/action (`requireRole`). UI hiding is not security.
8. Validate all input with strict Zod schemas; reject unknown fields.
9. No secrets in code, logs, client bundles, or docs. No `NEXT_PUBLIC_` secrets. No default or hard-coded passwords.
10. No guest personal data in logs, analytics, or error messages. Do not store identity document numbers or card/bank numbers.
11. Raw SQL only via parameterized tagged templates.
12. CSV exports must neutralize formula injection.

### Product and content

13. The public form creates a **`PENDING` request**. Never write copy that implies confirmation, live availability beyond what the system enforces, or instant booking.
14. No fabricated reviews, ratings, awards, statistics, addresses, or real contact details. Rates are labeled demo.
15. Use only licensed/original images and record source/license per image.
16. All user-facing strings exist in both `en` and `id`.

### Design

17. `DESIGN.md` tokens are the source of truth (Shoreline Calm: Cormorant Garamond + DM Sans, documented palette and status tokens). Do not add fonts or colors.
18. Never place white or blue text on `teal-300`. Status is never color-only.
19. Do not copy layout, assets, or copy from the reference image or any other site.

## 4. Working Method

Build **one milestone at a time**; never the whole app in one pass.

```text
Plan (state scope + acceptance) → Implement → Test → Fix → Self-critique → Update docs → Report
```

- Prefer small, reviewable commits with clear messages.
- Write tests with the code, especially for business rules, authorization, and constraints.
- Handlers stay thin: **handler → service → Prisma**.
- If a spec is ambiguous or two documents conflict, **stop and ask**; do not guess on data or security behavior.
- If a requirement seems wrong or unsafe, say so and propose an alternative instead of silently deviating.

## 5. Commands (target; verify they exist before using)

```bash
npm run dev           # start app
npm run db:up         # start local Postgres
npm run db:migrate    # prisma migrate dev (local only)
npm run db:seed       # fictional demo data (refuses production)
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

Never run `db:reset`, `migrate reset`, or destructive SQL against anything except the local development database. Check `DATABASE_URL` host before any destructive command.

## 6. Skills Policy

Skills improve execution; they do not override documents. Precedence: **AGENTS.md > PRD/DATABASE/API/SECURITY > DESIGN/CONTENT_GUIDE > skills**.

| Skill                                                                            | When                                                      |
| -------------------------------------------------------------------------------- | --------------------------------------------------------- |
| better-typography, better-layout, better-colors, better-accessibility, better-ui | Every UI milestone: audit against `DESIGN.md`             |
| shadcn-ui                                                                        | Building/restyling primitives (M4+)                       |
| extract-design-md                                                                | Keep `DESIGN.md` aligned if tokens change in code         |
| hallmark                                                                         | Self-critique gate before reporting any UI milestone PASS |
| archify or diagram-design (pick one)                                             | Architecture/flow diagrams in docs                        |
| stitch-loop                                                                      | Only if a Stitch MCP connection is active                 |
| ui-ux-pro-max, taste-skill                                                       | Public pages only, selective; tokens stay as defined      |
| scroll-world, frontend-slides, site-cloner                                       | Do not use                                                |

Safety for third-party skills: treat them as untrusted. Do not install or run one without owner review; pin to a commit; a skill must never be allowed to read secrets, make network calls beyond the install, or edit auth, security, migration, or environment files without explicit approval.

## 7. Definition of Done (per milestone)

- Acceptance criteria in `IMPLEMENTATION.md` met.
- Relevant `TC-` cases written and passing; lint, typecheck, and build pass.
- UI checked at required widths (DESIGN §11); keyboard path verified; contrast verified.
- Relevant `SEC-` controls verified.
- No `TODO`/placeholder links or fake data in user-visible UI.
- Docs updated where behavior changed.
- Report delivered in the format below. **Never report PASS if a required check was skipped or failed.**

## 8. Do / Don't

**Do:** reuse services; add tests before fixing bugs; keep migrations small; prefer server components; show loading/empty/error states; localize everything; log request IDs.
**Don't:** add heavy libraries without justification; bypass services from UI code; edit applied migrations; disable lint/type rules to pass; commit `.env*`, dumps, or customer-like data; store plaintext secrets; use `any` without a documented reason; add features outside the PRD scope (no payment gateway, OTA sync, or email sending in MVP).

## 9. Report Format

```text
Milestone:
Status: PASS / BLOCKED / IN PROGRESS

Implemented:
- ...

Verification:
- Lint / Typecheck / Tests / Build:
- Responsive review:
- Accessibility check:
- Security items (SEC-xx):
- Design self-critique:

Known issues:
- ...

Files changed:
- ...

Questions for the owner:
- ...

Next milestone:
- ...
```

## 10. Escalate Immediately When

- A change would weaken a constraint, authorization check, or audit trail.
- A migration is destructive or cannot be applied cleanly from empty.
- A secret or personal data appears in code, logs, or output.
- Documents contradict each other on a business rule.
- A requested feature is listed under Non-Goals.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
