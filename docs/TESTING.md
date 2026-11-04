# Testing and Quality Assurance — Sagara Villas

- **Version:** 1.0
- **Scope:** Portfolio 02 MVP
- **Related:** [PRD](PRD.md) · [DATABASE](DATABASE.md) · [API](API.md) · [SECURITY](../SECURITY.md) · [IMPLEMENTATION](IMPLEMENTATION.md)

Test case IDs (`TC-xx`) map to PRD rules (`BR-`, `FR-`) and security controls (`SEC-`).

---

## 1. Objectives

Prove that the system: never double-books; computes payment status correctly; enforces roles; handles dates without timezone bugs; localizes completely; and is accessible, performant, and deployable.

## 2. Test Levels

| Level            | Tool                                                      | Target                                                                                  |
| ---------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Unit             | Vitest                                                    | Pricing, date helpers, payment status, validation schemas, CSV escaping, code generator |
| Integration (DB) | Vitest + **real PostgreSQL**                              | Constraints, services, transactions, concurrency, authorization                         |
| API              | Vitest (route handlers) or Playwright request             | Status codes, error format, RBAC matrix                                                 |
| Component        | Vitest + Testing Library                                  | Calendar, status badge, payment panel, request form, dialogs                            |
| E2E              | Playwright                                                | Key flows on desktop and tablet/mobile viewports                                        |
| Accessibility    | axe (via Playwright) + manual keyboard/screen-reader pass | Public and admin                                                                        |
| Performance/SEO  | Lighthouse                                                | Public pages                                                                            |

**Database tests must not use a mock for constraint behavior.** Use a disposable Postgres (docker-compose test service or Testcontainers); reset between suites; never point at a shared or production database.

## 3. Critical Test Cases

### 3.1 Dates and availability (BR-01…BR-03, BR-06, BR-14)

- [ ] TC-D01 Overlapping `CONFIRMED` stays on the same unit are rejected by the **database** (`23P01`).
- [ ] TC-D02 Same-day turnover (A checks out on D, B checks in on D) is accepted.
- [ ] TC-D03 Overlap on different units is accepted.
- [ ] TC-D04 `PENDING` reservations may overlap each other and an existing confirmed stay; **confirming** one that conflicts fails with `DATE_CONFLICT`.
- [ ] TC-D05 `CANCELLED` stays do not block.
- [ ] TC-D06 Unit block overlapping a stay is rejected; stay overlapping a block is rejected.
- [ ] TC-D07 `checkOut == checkIn` and `checkOut < checkIn` rejected (API and DB check).
- [ ] TC-D08 `minNights`/`maxNights` enforced.
- [ ] TC-D09 Past check-in rejected for public; allowed for staff and audited (BR-13).
- [ ] TC-D10 "Today" computed in `Asia/Makassar` with the process clock set to UTC around 15:59/16:01 UTC (WITA midnight rollover).
- [ ] TC-D11 Edit dates to a conflicting range fails and leaves the original unchanged (transaction rollback).

### 3.2 Concurrency

- [ ] TC-C01 Two simultaneous confirms of overlapping `PENDING` reservations → exactly one `CONFIRMED`, the other `DATE_CONFLICT`.
- [ ] TC-C02 Two simultaneous staff creations for the same range → one succeeds.
- [ ] TC-C03 Two edits with the same `If-Match` version → one succeeds, one `VERSION_CONFLICT`.
- [ ] TC-C04 Concurrent payment recordings on one reservation produce correct `netPaidIdr` (no lost update).

### 3.3 Pricing (BR-08)

- [ ] TC-P01 Base-rate multi-night total with cleaning fee and discount.
- [ ] TC-P02 Seasonal rule applies to covered nights only (P1).
- [ ] TC-P03 Total never negative when discount exceeds subtotal.
- [ ] TC-P04 Changing unit base rate does not change existing reservations (snapshot).
- [ ] TC-P05 Quote endpoint result equals the amount stored on creation.

### 3.4 Payments (BR-09…BR-11)

Run the table in DATABASE §5.4 as data-driven tests, plus:

- [ ] TC-Y01 Recording the first partial payment → `PARTIAL`; completing it → `PAID`.
- [ ] TC-Y02 Voiding a payment recomputes status; voided payment remains visible with reason.
- [ ] TC-Y03 Payments cannot be deleted (no endpoint; DB role cannot delete if restricted).
- [ ] TC-Y04 Refund reduces net; status updates.
- [ ] TC-Y05 Overpayment shows `PAID` with overpaid amount.
- [ ] TC-Y06 Cancelled reservation with `netPaid > 0` appears as _refund pending_ in the report.
- [ ] TC-Y07 Amount ≤ 0 or non-integer rejected.
- [ ] TC-Y08 Every payment action creates an audit entry.

### 3.5 Status workflow (BR-12)

- [ ] TC-S01 Every allowed transition succeeds with the correct timestamp set.
- [ ] TC-S02 Every disallowed transition returns `INVALID_TRANSITION` (generate the full matrix).
- [ ] TC-S03 Cancel requires a reason.
- [ ] TC-S04 Check-in is rejected before the check-in date unless staff override is audited (if implemented).

### 3.6 Guests (BR-15)

- [ ] TC-G01 Same email (different case/spacing) reuses the guest record.
- [ ] TC-G02 Same phone, no email → reuses by normalized phone.
- [ ] TC-G03 Different email, same phone → creates/merges per documented rule; behavior covered by a test.
- [ ] TC-G04 Anonymize removes name/email/phone, keeps reservations and payments.

### 3.7 Public booking request (FR-05)

- [ ] TC-R01 Valid request creates `PENDING` reservation + guest; response contains code, not "confirmed".
- [ ] TC-R02 Invalid email/dates/guests/over-capacity rejected with localized messages.
- [ ] TC-R03 Privacy consent required.
- [ ] TC-R04 Honeypot filled → generic success, nothing stored.
- [ ] TC-R05 Rate limit returns `429` with `Retry-After` (SEC-11).
- [ ] TC-R06 Idempotency key replay returns the original result without a duplicate row.
- [ ] TC-R07 Request for already blocked dates returns `DATE_CONFLICT`.
- [ ] TC-R08 Language switch mid-form preserves entered values.

## 4. Security Test Cases

| ID     | Control   | Test                                                                                                     |
| ------ | --------- | -------------------------------------------------------------------------------------------------------- |
| TC-X01 | SEC-01    | Password stored as argon2id/bcrypt hash; plaintext never persisted or logged                             |
| TC-X02 | SEC-02    | Unknown email and wrong password give identical response body and similar timing                         |
| TC-X03 | SEC-03    | Cookie flags `HttpOnly`, `Secure` (prod), `SameSite=Lax`                                                 |
| TC-X04 | SEC-04    | 5 failures lock the account; correct password during lock still fails; unlock after window               |
| TC-X05 | SEC-05    | RBAC matrix: for **every** admin endpoint × {anonymous, STAFF, ADMIN} assert 401/403/200 per SECURITY §3 |
| TC-X06 | SEC-05    | Meta-test: enumerate admin routes; fail if any lacks `requireRole`                                       |
| TC-X07 | SEC-06    | Cross-origin POST to admin mutation rejected `403`                                                       |
| TC-X08 | SEC-07    | Unknown fields rejected; oversize strings rejected                                                       |
| TC-X09 | SEC-08    | `<script>` in guest message/notes renders as text                                                        |
| TC-X10 | SEC-09    | Public endpoints never contain guest fields; `passwordHash` never returned                               |
| TC-X11 | SEC-12    | CSV cells starting `=`, `+`, `-`, `@` are neutralized                                                    |
| TC-X12 | SEC-14    | Production bundle scanned: no secrets, no server env in client chunks                                    |
| TC-X13 | SEC-15    | CSP and other headers present on public and admin pages                                                  |
| TC-X14 | SEC-16    | Admin responses `no-store`; admin pages `noindex`                                                        |
| TC-X15 | SEC-17/18 | Audit entry exists per mutation; logs contain no PII                                                     |
| TC-X16 | Users     | Cannot deactivate/demote the last active admin; cannot change own role                                   |
| TC-X17 | SQLi      | Fuzz search/filter params with injection strings; no error leakage                                       |
| TC-X18 | Seed      | Seeding refuses production env without explicit flag; no default password                                |

## 5. Admin UI Test Cases

### Calendar (FR-15)

- [ ] TC-U01 Bars render for every status; same-day turnover shows a visible gap/overlap at day midpoint.
- [ ] TC-U02 Blocks render with label and pattern.
- [ ] TC-U03 View switching (week/14-day/month) keeps the date context.
- [ ] TC-U04 Keyboard: focus moves between bars, Enter opens detail, Escape closes.
- [ ] TC-U05 List-view fallback available and equivalent.
- [ ] TC-U06 Creating from an empty range pre-fills dates and unit.

### Tables and forms

- [ ] TC-U10 Filters combine correctly; URL reflects filters; reload restores them.
- [ ] TC-U11 Sorting and pagination are server-side and stable.
- [ ] TC-U12 Loading, empty, and error states exist for each list.
- [ ] TC-U13 Destructive dialogs require a reason; confirm button is named by action.
- [ ] TC-U14 Status badges show icon + text (not color alone).
- [ ] TC-U15 Stale version shows a clear "updated by someone else" message with reload.

## 6. Localization (FR-06)

- [ ] TC-L01 Automated key-parity test: `en.json` and `id.json` have identical key sets.
- [ ] TC-L02 No raw keys rendered in either locale (crawl all public routes).
- [ ] TC-L03 Validation errors, metadata, status labels localized; money/date formats per locale.
- [ ] TC-L04 Language switcher keeps the equivalent page.
- [ ] TC-L05 Admin language toggle persists via cookie.

## 7. Viewports and Accessibility

| Surface | Widths                                            | Required |
| ------- | ------------------------------------------------- | -------- |
| Public  | 375, 390, 768, 1440 px                            | Yes      |
| Admin   | 390 (read-only/quick actions), 768, 1024, 1440 px | Yes      |

Check: no horizontal page overflow, no clipped text, intentional image crops, usable touch targets (≥ 44 px), sticky elements not covering content.

Accessibility checklist (WCAG 2.2 AA practices):

- [ ] Landmarks and one H1 per page; heading order logical.
- [ ] All controls keyboard-operable; focus visible and never trapped (except dialogs, which trap and restore).
- [ ] Form labels; errors programmatically associated and announced.
- [ ] Contrast verified for every token pair, including status badges and text over teal.
- [ ] Calendar, dialogs, menus, date pickers tested by keyboard and with one screen reader.
- [ ] Reduced motion respected.
- [ ] axe reports zero serious/critical violations on public pages and key admin pages.

## 8. SEO and Performance (public)

- [ ] Unique title/description per page and locale; canonical + alternates; Open Graph.
- [ ] `sitemap.xml` lists localized routes and active unit slugs only; `robots.txt` correct.
- [ ] Admin routes are `noindex` and excluded from the sitemap.
- [ ] Hero image optimized and prioritized; below-the-fold images lazy; dimensions defined; no avoidable layout shift.
- [ ] Lighthouse targets: Performance 85+, Accessibility 90+, Best Practices 90+, SEO 90+ (record actual scores; targets, not guarantees).

## 9. Release Gate

Do not mark release-ready until:

- [ ] All P0 PRD requirements pass.
- [ ] Sections 3 and 4 pass; concurrency tests (TC-C*) are green and repeated at least 20 times without flakes.
- [ ] RBAC matrix (TC-X05) complete.
- [ ] Both locales reviewed.
- [ ] Viewport and accessibility reviews recorded.
- [ ] `npm audit` reviewed; no unresolved high/critical.
- [ ] Production build succeeds; migrations apply cleanly to an empty database and to the previous release schema.
- [ ] Backup restore rehearsed.
- [ ] Production deployment manually verified (public request → admin sees it → confirm → payment → report).
- [ ] Demo disclaimer and asset credits present.

## 10. Test Report Template

```text
Test run date:
Commit/version:
Environment:

Unit:
Integration (DB):
API / RBAC matrix:
Component:
E2E:
Concurrency (runs / failures):

Viewport review:
- Public 375 / 390 / 768 / 1440:
- Admin 390 / 768 / 1024 / 1440:

Accessibility (axe + manual):
Security checklist (SEC-01…19):
SEO:
Lighthouse (P / A / BP / SEO):
Production build + migrations:

Bugs found:
Known limitations:
Release decision: PASS / BLOCKED
```
