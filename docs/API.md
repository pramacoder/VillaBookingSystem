# API Specification — Sagara Villas

- **Version:** 1.0
- **Style:** REST over JSON, implemented as Next.js Route Handlers
- **Related:** [PRD](PRD.md) · [DATABASE](DATABASE.md) · [SECURITY](../SECURITY.md) · [TESTING](TESTING.md)

---

## 1. Conventions

| Topic          | Rule                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------- |
| Base path      | `/api/public/*` (anonymous), `/api/admin/*` (authenticated), `/api/auth/*` (Auth.js), `/api/health` |
| Format         | `application/json; charset=utf-8`                                                                   |
| Dates          | `YYYY-MM-DD` (calendar date, property timezone). Timestamps are ISO 8601 UTC.                       |
| Money          | Integer IDR, field names end with `Idr`.                                                            |
| IDs            | Opaque strings (`cuid`).                                                                            |
| Locale         | `Accept-Language` or `?locale=en                                                                    | id` for localized public text. Admin responses contain both languages. |
| Pagination     | `?page=1&pageSize=25` (max 100). Response includes `meta: { page, pageSize, total }`.               |
| Concurrency    | Reservation updates require `If-Match: <version>`; mismatch → `409 VERSION_CONFLICT`.               |
| Idempotency    | `POST /api/public/inquiries` accepts `Idempotency-Key`; same key returns the original result.       |
| Validation     | Zod schemas shared between client and server; server is authoritative.                              |
| Unknown fields | Rejected (strict schemas) to prevent mass assignment.                                               |

## 2. Error Format

```json
{
  "error": {
    "code": "DATE_CONFLICT",
    "message": "The selected dates are no longer available.",
    "details": { "unitId": "…", "conflictingRange": ["2026-12-20", "2026-12-24"] },
    "requestId": "req_8f3a…"
  }
}
```

| HTTP | Code                 | Meaning                                                               |
| ---- | -------------------- | --------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`   | `details.fields` maps field → message key                             |
| 401  | `UNAUTHENTICATED`    | No/expired session                                                    |
| 403  | `FORBIDDEN`          | Role not allowed, or origin check failed                              |
| 404  | `NOT_FOUND`          | Unknown id/slug (also used to avoid leaking existence where relevant) |
| 409  | `DATE_CONFLICT`      | Overlap with a blocking reservation or unit block                     |
| 409  | `INVALID_TRANSITION` | Status change not allowed (BR-12)                                     |
| 409  | `VERSION_CONFLICT`   | Stale `If-Match`                                                      |
| 409  | `HAS_DEPENDENCIES`   | e.g. archiving a unit with future reservations                        |
| 422  | `BUSINESS_RULE`      | e.g. guests exceed capacity, below min nights                         |
| 429  | `RATE_LIMITED`       | Includes `Retry-After`                                                |
| 500  | `INTERNAL`           | Generic message; details only in server logs                          |

Messages are keyed (`message` is localized for public endpoints). Never include stack traces or SQL.

## 3. Public Endpoints

### 3.1 `GET /api/public/units`

Active units only. Query: `?locale=`. Returns `{ data: UnitSummary[] }`.

### 3.2 `GET /api/public/units/{slug}`

Returns `UnitDetail` (localized text, images with alt text, amenities, capacity, rules, indicative rate with `isDemo: true`). `404` for `DRAFT`/`ARCHIVED`.

### 3.3 `GET /api/public/units/{slug}/availability?from=2026-12-01&to=2027-01-31`

Returns blocked nights only — no guest data.

```json
{
  "data": {
    "unit": "garden-villa",
    "blockedRanges": [["2026-12-20", "2026-12-24"]],
    "minNights": 2
  }
}
```

### 3.4 `POST /api/public/quote`

```json
{
  "unitSlug": "garden-villa",
  "checkIn": "2026-12-26",
  "checkOut": "2026-12-29",
  "adults": 2,
  "children": 0
}
```

Response:

```json
{
  "data": {
    "nights": 3,
    "nightlySubtotalIdr": 4500000,
    "cleaningFeeIdr": 250000,
    "discountIdr": 0,
    "totalIdr": 4750000,
    "isDemo": true,
    "available": true
  }
}
```

A quote is informational, **not** a hold.

### 3.5 `POST /api/public/inquiries`

Creates a guest (or matches an existing one) and a `PENDING` reservation with `source = WEBSITE`.

```json
{
  "unitSlug": "garden-villa",
  "checkIn": "2026-12-26",
  "checkOut": "2026-12-29",
  "adults": 2,
  "children": 0,
  "name": "Demo Guest",
  "email": "demo@example.com",
  "phone": "+62 812 0000 0000",
  "message": "Late arrival, around 9 PM.",
  "privacyAccepted": true,
  "locale": "en",
  "website": ""
}
```

- `website` is a honeypot; non-empty → respond `201` with a generic body but store nothing.
- Success `201`: `{ "data": { "code": "SGV-2612-K7P2", "status": "PENDING" } }`.
- The UI must say the request is **not confirmed** until the operator replies.
- Errors: `400`, `422 BUSINESS_RULE`, `409 DATE_CONFLICT` (if dates are already blocked), `429`.
- Rate limit: 5 requests / 10 min per IP + 3 / hour per email.

## 4. Auth

Handled by Auth.js at `/api/auth/*` (Credentials provider). Behavior requirements:

- Generic failure: "Email or password is incorrect."
- Account lockout after repeated failures (see SECURITY `SEC-04`).
- Sessions: HttpOnly, Secure, SameSite=Lax cookies; short max age.
- `GET /api/admin/me` → `{ id, name, email, role }`.

## 5. Admin Endpoints

All require a valid session. Role column: **A** = ADMIN, **S** = STAFF.

### 5.1 Units

| Method            | Path                                          | Role | Notes                                                        |
| ----------------- | --------------------------------------------- | ---- | ------------------------------------------------------------ |
| GET               | `/api/admin/units`                            | A, S | Includes drafts/archived with filter                         |
| POST              | `/api/admin/units`                            | A    | Create                                                       |
| GET               | `/api/admin/units/{id}`                       | A, S |                                                              |
| PATCH             | `/api/admin/units/{id}`                       | A    | Partial update; slug change allowed only for `DRAFT`         |
| POST              | `/api/admin/units/{id}/archive`               | A    | `409 HAS_DEPENDENCIES` if future blocking reservations exist |
| PUT               | `/api/admin/units/{id}/amenities`             | A    | Replace set                                                  |
| POST/PATCH/DELETE | `/api/admin/units/{id}/images[/{imageId}]`    | A    | Path + alt text + source/license required                    |
| GET/POST/DELETE   | `/api/admin/units/{id}/rate-rules[/{ruleId}]` | A    | P1                                                           |
| GET/POST/DELETE   | `/api/admin/blocks[/{id}]`                    | A, S | Blocks must not overlap blocking reservations                |

### 5.2 Reservations

| Method | Path                                     | Role | Notes                                                                                 |
| ------ | ---------------------------------------- | ---- | ------------------------------------------------------------------------------------- |
| GET    | `/api/admin/reservations`                | A, S | Filters: `status`, `paymentStatus`, `unitId`, `from`, `to`, `q`, `source`             |
| POST   | `/api/admin/reservations`                | A, S | Staff-created; `status` may be `PENDING` or `CONFIRMED`                               |
| GET    | `/api/admin/reservations/{id}`           | A, S | Includes guest, payments, audit trail                                                 |
| PATCH  | `/api/admin/reservations/{id}`           | A, S | Dates/unit/guests/notes/discount; requires `If-Match`; re-prices; re-checks conflicts |
| POST   | `/api/admin/reservations/{id}/confirm`   | A, S | BR-05                                                                                 |
| POST   | `/api/admin/reservations/{id}/check-in`  | A, S |                                                                                       |
| POST   | `/api/admin/reservations/{id}/check-out` | A, S |                                                                                       |
| POST   | `/api/admin/reservations/{id}/cancel`    | A, S | Body: `{ "reason": "…" }` required                                                    |

Confirm response example:

```json
{
  "data": {
    "id": "…",
    "code": "SGV-2612-K7P2",
    "status": "CONFIRMED",
    "paymentStatus": "UNPAID",
    "version": 3
  }
}
```

### 5.3 Calendar

`GET /api/admin/calendar?from=2026-12-01&to=2026-12-31&unitIds=a,b`
Returns units with `reservations` (id, code, guestName, status, paymentStatus, checkIn, checkOut) and `blocks`. Window limited to 62 days. One query, no N+1.

### 5.4 Guests

| Method | Path                               | Role |
| ------ | ---------------------------------- | ---- |
| GET    | `/api/admin/guests?q=`             | A, S |
| POST   | `/api/admin/guests`                | A, S |
| GET    | `/api/admin/guests/{id}`           | A, S |
| PATCH  | `/api/admin/guests/{id}`           | A, S |
| POST   | `/api/admin/guests/{id}/anonymize` | A    |

### 5.5 Payments

| Method | Path                                    | Role                                 | Notes                                |
| ------ | --------------------------------------- | ------------------------------------ | ------------------------------------ |
| POST   | `/api/admin/reservations/{id}/payments` | A, S                                 | Recompute status in same transaction |
| POST   | `/api/admin/payments/{paymentId}/void`  | A (S allowed same day, configurable) | `{ "reason": "…" }` required         |

Create payment:

```json
{
  "kind": "PAYMENT",
  "amountIdr": 1500000,
  "method": "BANK_TRANSFER",
  "paidAt": "2026-12-01T03:20:00Z",
  "reference": "TRX-001",
  "note": "Deposit"
}
```

Response includes the updated `netPaidIdr`, `paymentStatus`, and `overpaidIdr` (0 if none).

### 5.6 Reports

| Method | Path                                     | Notes                                                        |
| ------ | ---------------------------------------- | ------------------------------------------------------------ |
| GET    | `/api/admin/reports/reservations`        | `from`, `to`, `unitId`, `status`, `paymentStatus`            |
| GET    | `/api/admin/reports/payments`            | Cash received by day/method + outstanding balances list      |
| GET    | `/api/admin/reports/occupancy`           | Per unit: booked nights ÷ available nights (blocks excluded) |
| GET    | `/api/admin/reports/arrivals-departures` | `date` or `from`/`to`                                        |
| GET    | `/api/admin/reports/{name}.csv`          | Same filters; CSV is formula-injection-safe (SEC-12)         |

Report definitions:

- **Booked value** = Σ `totalIdr` of non-cancelled reservations (by check-in date in range).
- **Cash received** = Σ non-voided payments − refunds (by `paidAt` in range).
- **Outstanding** = Σ max(`totalIdr` − `netPaidIdr`, 0) for `CONFIRMED`/`CHECKED_IN`/`CHECKED_OUT`.
- **Occupancy** = occupied nights ÷ (days in range − blocked nights), per unit and overall.

### 5.7 Users and Audit

| Method   | Path                                               | Role                   |
| -------- | -------------------------------------------------- | ---------------------- |
| GET/POST | `/api/admin/users`                                 | A                      |
| PATCH    | `/api/admin/users/{id}`                            | A (role, active, name) |
| POST     | `/api/admin/users/{id}/reset-password`             | A                      |
| GET      | `/api/admin/audit?entityType=&entityId=&from=&to=` | A                      |

Guards: cannot deactivate or demote the last active admin; a user cannot change their own role.

## 6. Cross-Cutting Behavior

1. Every handler: authenticate → authorize → validate → call service → map errors → respond.
2. Business logic lives in `src/server/services/*`; handlers stay thin.
3. All admin mutations write an `AuditLog` row inside the same transaction.
4. State-changing requests (POST/PATCH/DELETE) verify `Origin`/`Sec-Fetch-Site` for same-origin (SEC-06).
5. Responses never include `passwordHash`, lock state, or internal notes on public endpoints.
6. Every response carries `x-request-id`.

## 7. Health

`GET /api/health` → `200 { "status": "ok", "db": "ok", "time": "…" }` (runs `SELECT 1`). Returns `503` if the database is unreachable. No version or environment details.
