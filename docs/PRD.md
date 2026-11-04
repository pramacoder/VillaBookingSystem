# Product Requirements Document (PRD)

## Sagara Villas — Villa Booking Management System

- **Version:** 1.0
- **Status:** Draft for implementation
- **Product type:** Full-stack booking management system (public site + admin dashboard)
- **Brand:** Sagara Villas (fictional)
- **Public languages:** English (`en`), Indonesian (`id`)
- **Related:** [README](../README.md) · [DESIGN](DESIGN.md) · [DATABASE](DATABASE.md) · [API](API.md) · [SECURITY](../SECURITY.md) · [TESTING](TESTING.md)

---

## 1. Product Overview

Sagara Villas is a fictional operator of several boutique villa units in Bali. This project is **Portfolio 02**: a system an operator uses to run day-to-day reservations. It extends Portfolio 01 (a static property site with WhatsApp inquiry) into a database-backed product.

Two surfaces share one database:

1. **Public website** — unit catalog, unit detail, availability display, booking request.
2. **Admin dashboard** — reservations, calendar, guests, manual payment records, reports.

The system **does not** process online payments and **does not** auto-confirm bookings. A visitor submits a _request_; staff review and confirm it.

## 2. Problem Statement

Small villa operators commonly track bookings across chat apps, spreadsheets, and memory. This causes:

- Double bookings and missed turnovers.
- Unclear payment status (who paid a deposit, who owes the balance).
- Guest details scattered across chats.
- No reliable report of arrivals, occupancy, or outstanding balances.

## 3. Goals

### 3.1 Business goals

1. Replace spreadsheets with one source of truth for units, reservations, guests, and payments.
2. Make double booking technically impossible, not just unlikely.
3. Make payment status visible at a glance (`UNPAID`, `PARTIAL`, `PAID`).
4. Produce operational and financial-summary reports without manual work.

### 3.2 Portfolio goals

Demonstrate: relational data modeling, transactional integrity, authentication and role-based access, a calendar UI, secure form handling, reporting, testing against a real database, and deployment with migrations.

## 4. Non-Goals (MVP)

- Online payment gateway or card processing.
- OTA / channel-manager sync (Airbnb, Booking.com).
- Guest accounts or a guest self-service portal.
- Automated email/SMS/WhatsApp sending.
- Dynamic or AI pricing.
- Multi-tenant (multiple operator companies).
- Housekeeping, staff scheduling, accounting, or tax invoicing.
- Storing identity document numbers (passport/KTP).

## 5. Personas

| ID  | Persona                 | Needs                                                                                                  |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------ |
| A   | **Owner/Admin**         | Full control: units, rates, users, reports. Wants outstanding balances and occupancy.                  |
| B   | **Reservation Staff**   | Create/edit reservations, record payments, manage calendar and guests. No user or rate-policy changes. |
| C   | **International Guest** | English UI, clear unit info, easy request form.                                                        |
| D   | **Domestic Guest**      | Indonesian UI, familiar terms, clear next steps.                                                       |
| E   | **Portfolio Evaluator** | Judges data integrity, UX quality, security basics, documentation.                                     |

## 6. Scope and Priorities

### P0 — Must have (MVP)

- Public: homepage, unit catalog, unit detail, availability display, booking request, localized (en/id).
- Admin: login/logout, role-based access, dashboard, unit CRUD, reservation CRUD with status workflow, calendar, guest records, manual payments with derived status, reports, audit log.
- Database-enforced no-overlap for confirmed stays.
- SEO metadata, sitemap, robots, accessibility basics.

### P1 — Should have

- Seasonal rate rules; blocked dates UI; CSV export; guest search by trigram; admin image upload; dark-mode-free print styles for reports; Indonesian admin UI polish; PENDING auto-expiry flag.

### P2 — Later

- Email notifications, payment gateway, OTA sync, multi-property, invoices/PDF.

## 7. Sitemap

```text
Public  /[locale]
├── /                      Homepage
├── /villas                Unit catalog
│   └── /[slug]            Unit detail (+ request panel)
├── /about                 About
├── /location              Location (illustrative)
├── /contact               Contact (demo details)
└── /book                  Booking request (accepts ?unit=&checkIn=&checkOut=)

Admin   /admin  (no locale prefix; language toggle stored in cookie)
├── /login
├── /                      Dashboard
├── /calendar              Resource timeline (units × dates)
├── /reservations          List + filters
│   ├── /new
│   └── /[id]              Detail: status, guest, payments, audit
├── /guests                List + search
│   └── /[id]
├── /units                 Unit management (ADMIN: write; STAFF: read)
│   └── /[id]
├── /reports               Reservation, payment, occupancy, arrivals/departures
└── /users                 ADMIN only
```

## 8. Business Rules

| ID    | Rule                                                                                                                                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-01 | A stay is the half-open date range `[checkIn, checkOut)`. A guest checking out on day D does not conflict with a guest checking in on day D (same-day turnover is allowed).                             |
| BR-02 | `checkOut` must be after `checkIn`. Minimum 1 night; per-unit `minNights`/`maxNights` apply.                                                                                                            |
| BR-03 | Statuses `CONFIRMED`, `CHECKED_IN`, `CHECKED_OUT` **block** the unit. `PENDING` and `CANCELLED` do **not** block.                                                                                       |
| BR-04 | The database must reject overlapping blocking reservations for the same unit (exclusion constraint), independent of application checks.                                                                 |
| BR-05 | Confirming a `PENDING` reservation re-checks conflicts inside a transaction. If a conflict exists, confirmation fails with `DATE_CONFLICT`.                                                             |
| BR-06 | Admin-defined unit blocks (maintenance/owner use) also block availability.                                                                                                                              |
| BR-07 | Guest count: `adults ≥ 1`; `adults + children ≤ unit.maxGuests`.                                                                                                                                        |
| BR-08 | Prices are whole IDR (no decimals). Total = Σ nightly rates + cleaning fee − discount. The calculation is **snapshotted** on the reservation so later rate edits never change existing bookings.        |
| BR-09 | Payment status is **derived**, never typed in manually: `netPaid = Σ payments − Σ refunds` (excluding voided). `netPaid ≤ 0` → `UNPAID`; `0 < netPaid < total` → `PARTIAL`; `netPaid ≥ total` → `PAID`. |
| BR-10 | Payments are never deleted. Mistakes are **voided** with a reason and recorded in the audit log.                                                                                                        |
| BR-11 | A cancelled reservation keeps its payments. If `netPaid > 0` it is flagged _refund pending_ in reports.                                                                                                 |
| BR-12 | Allowed status transitions: `PENDING→CONFIRMED`, `PENDING→CANCELLED`, `CONFIRMED→CHECKED_IN`, `CONFIRMED→CANCELLED`, `CHECKED_IN→CHECKED_OUT`. Everything else is rejected with `INVALID_TRANSITION`.   |
| BR-13 | Check-in dates in the past are rejected for public requests. Staff may backdate (walk-in/correction) and the action is audited.                                                                         |
| BR-14 | "Today" and all dates use the property timezone (`Asia/Makassar`), treated as calendar dates, not timestamps.                                                                                           |
| BR-15 | Guests are de-duplicated: match by normalized email first, then normalized phone. Staff can merge manually (P1).                                                                                        |

## 9. Functional Requirements

### Public site

**FR-01 Homepage** — hero, intro, featured units, experience highlights, location preview, final CTA. _AC:_ valid CTAs, both locales, responsive at required widths.

**FR-02 Unit catalog** — cards from the database (`ACTIVE` units only), with capacity, bedrooms, bathrooms, indicative rate labeled as demo. _AC:_ no draft/archived units visible; cards link to detail.

**FR-03 Unit detail** — gallery (thumbnails + main image), overview, amenities grid, house rules (check-in/check-out), location block, sticky booking panel. _AC:_ unknown slug → not-found; rate shown as demo; no fake ratings or review counts.

**FR-04 Availability display** — date picker disables blocked nights; price quote updates for selected dates. _AC:_ quote matches server calculation; no guest data exposed.

**FR-05 Booking request** — dates, guests, unit, name, email, phone (optional), message, privacy consent. _AC:_ server validation; creates `PENDING` reservation and guest; success screen states the request is **not** confirmed; no auto-confirmation wording; spam protection (honeypot + rate limit).

**FR-06 Localization** — all public UI, validation messages, metadata localized; switching language preserves entered form data.

**FR-07 SEO** — unique title/description per page and locale, canonical + alternates, Open Graph, `sitemap.xml`, `robots.txt`.

### Admin

**FR-10 Authentication** — email + password; generic failure message; lockout after repeated failures; logout; session expiry. _AC:_ see [SECURITY](../SECURITY.md).

**FR-11 Authorization** — `ADMIN` and `STAFF` per the matrix in SECURITY. Enforced server-side on every route and action.

**FR-12 Dashboard** — today's arrivals, departures, in-house guests, pending requests, outstanding balances, 30-day occupancy. _AC:_ numbers match report queries.

**FR-13 Unit management** — create/edit/archive units, amenities, images (path + alt text + license fields), rates, capacity. Archiving a unit with future reservations is blocked.

**FR-14 Reservation management** — list with filters (status, payment status, unit, date range, text search), create (staff), edit dates/guests/unit with re-validation and re-pricing, status actions, internal notes. _AC:_ all BR rules enforced; every mutation audited.

**FR-15 Calendar** — resource timeline: rows = units, columns = dates; shows reservations by status, blocks, today marker; click to view; create reservation from empty range. _AC:_ keyboard operable; legend not color-only; month and 14-day views.

**FR-16 Guest records** — list, search, detail with stay history and totals; edit contact info and notes.

**FR-17 Manual payments** — record payment/refund (amount, method, date, reference, note); void with reason; derived status badge updates immediately. _AC:_ BR-09/BR-10 exactly; over-payment visible, not silently accepted.

**FR-18 Reports** — (R1) reservations in a date range, (R2) payments and outstanding balances, (R3) occupancy per unit, (R4) arrivals/departures for a day or week. Filters, totals, CSV export (formula-injection-safe).

**FR-19 User management (ADMIN)** — create/deactivate users, assign role, reset password. Cannot deactivate the last active admin.

**FR-20 Audit log** — who did what and when for reservations, payments, units, users. Read-only view for ADMIN.

## 10. Non-Functional Requirements

| ID     | Requirement                                                                                                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| NFR-01 | **Integrity:** all multi-step writes (confirm, edit dates, record payment) run in a single DB transaction.                                                                                       |
| NFR-02 | **Performance:** calendar query for 12 units × 60 days returns in a single query; Lighthouse (public) Performance 85+, Accessibility 90+, Best Practices 90+, SEO 90+ (targets, not guarantees). |
| NFR-03 | **Accessibility:** WCAG 2.2 AA practices on public and admin UI, including calendar and dialogs.                                                                                                 |
| NFR-04 | **Security:** see SECURITY.md; no known high-severity issue at release.                                                                                                                          |
| NFR-05 | **Maintainability:** strict TypeScript, service layer separate from route handlers, migrations committed.                                                                                        |
| NFR-06 | **Observability:** structured logs without personal data; `/api/health`.                                                                                                                         |
| NFR-07 | **Privacy:** collect minimum guest data; no identity document numbers; documented retention approach.                                                                                            |

## 11. Success Metrics

- All P0 requirements pass the test cases in TESTING.md.
- Concurrency test proves two simultaneous confirmations of overlapping stays cannot both succeed.
- Payment status test table passes for every transition.
- Production deployment verified for both public and admin flows.
- Demo can be walked through in under 10 minutes.

## 12. Risks and Mitigations

| Risk                                     | Mitigation                                                          |
| ---------------------------------------- | ------------------------------------------------------------------- |
| Double booking under concurrency         | DB exclusion constraint + transaction + row lock; concurrency test. |
| Scope creep into a full PMS              | P0/P2 boundary in this document.                                    |
| Timezone/date bugs                       | Date-only columns, property timezone helper, edge-case tests.       |
| Spam booking requests                    | Honeypot, rate limit, server validation.                            |
| Fake claims or unlicensed images         | CONTENT_GUIDE rules + asset manifest in the database.               |
| Weak admin security                      | SECURITY.md controls verified in TESTING.md.                        |
| Mixed concerns (UI doing business logic) | Service layer in `src/server/services`.                             |

## 13. Definition of Product Completion

Portfolio 02 is complete when all P0 requirements pass, the release gate in TESTING.md is met, migrations deploy cleanly to production, a seeded demo dataset exists, and README, DEPLOYMENT, and the demo disclaimer are complete.
