# Security Specification — Sagara Villas

- **Version:** 1.0
- **Scope:** Public site, admin dashboard, API, database, deployment
- **Related:** [PRD](docs/PRD.md) · [API](docs/API.md) · [DATABASE](docs/DATABASE.md) · [TESTING](docs/TESTING.md) · [DEPLOYMENT](docs/DEPLOYMENT.md)

Each control has an ID (`SEC-xx`) that TESTING.md references.

---

## 1. Assets and Threats

| Asset                                    | Threat                           | Primary controls       |
| ---------------------------------------- | -------------------------------- | ---------------------- |
| Admin accounts                           | Credential stuffing, brute force | SEC-01, SEC-02, SEC-04 |
| Guest personal data (name, email, phone) | Leak, IDOR, over-collection      | SEC-07, SEC-08, SEC-13 |
| Reservation and payment records          | Tampering, unauthorized edits    | SEC-05, SEC-09, SEC-10 |
| Availability integrity                   | Double booking, race conditions  | DATABASE §4–5          |
| Public forms                             | Spam, injection                  | SEC-11, SEC-03         |
| Secrets                                  | Exposure in repo/logs/client     | SEC-14                 |
| Exports                                  | CSV formula injection            | SEC-12                 |

## 2. Authentication

| ID     | Control                                                                                                                                                                                                                       |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-01 | Passwords hashed with **argon2id** (or bcrypt cost ≥ 12 if argon2 is unavailable on the host). Minimum length 12; check against a common-password list; no composition rules theater.                                         |
| SEC-02 | Login errors are generic and timing-similar for unknown email vs wrong password.                                                                                                                                              |
| SEC-03 | Cookies: `HttpOnly`, `Secure` (production), `SameSite=Lax`, scoped path, short max age (e.g. 8 h) with sliding refresh. Logout invalidates the session client-side; sensitive actions re-check that the user is still active. |
| SEC-04 | Lockout: after 5 consecutive failures lock the account for 15 minutes (`failedLoginCount`, `lockedUntil`); also rate-limit login by IP. Locked responses remain generic.                                                      |

Admin bootstrap: the first admin is created by the seed script from environment variables. There is **no default password** and no public sign-up route. Seeding in production requires an explicit confirmation flag.

## 3. Authorization

| ID     | Control                                                                                                                                                                          |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-05 | Authorization is enforced **server-side** in every route handler, server component data fetch, and action via one shared `requireRole()` helper. UI hiding is cosmetic only.     |
| SEC-09 | Object access: every admin query is scoped by authenticated context; there is no endpoint that accepts a raw ID without an auth check. Public endpoints never return guest data. |

### Permission matrix

| Capability                                     | Public |            STAFF             | ADMIN |
| ---------------------------------------------- | :----: | :--------------------------: | :---: |
| View active units / availability / quote       |   ✔    |              ✔               |   ✔   |
| Submit booking request                         |   ✔    |              ✔               |   ✔   |
| View dashboard, calendar, reservations, guests |   ✖    |              ✔               |   ✔   |
| Create/edit/confirm/cancel reservations        |   ✖    |              ✔               |   ✔   |
| Record payments                                |   ✖    |              ✔               |   ✔   |
| Void payments                                  |   ✖    | same-day only (configurable) |   ✔   |
| Create/edit units, rates, images               |   ✖    |              ✖               |   ✔   |
| Create/remove blocks                           |   ✖    |              ✔               |   ✔   |
| Reports and CSV export                         |   ✖    |              ✔               |   ✔   |
| Anonymize guest                                |   ✖    |              ✖               |   ✔   |
| Manage users, view audit log                   |   ✖    |              ✖               |   ✔   |

## 4. Request Integrity

| ID     | Control                                                                                                                                                                                            |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-06 | CSRF: state-changing requests must be same-origin. Verify `Origin` (fallback `Referer`) against the site URL and reject cross-site `Sec-Fetch-Site`. Auth.js routes use their built-in CSRF token. |
| SEC-10 | Optimistic concurrency via `If-Match`/`version` on reservations to prevent lost updates.                                                                                                           |
| SEC-11 | Public booking form: honeypot field, rate limiting, server-side validation, optional CAPTCHA (e.g. Cloudflare Turnstile) behind a feature flag if abuse appears.                                   |

**Rate limiting note:** in-memory counters do not work reliably on serverless. Use a shared store (e.g. Upstash Redis) or a small Postgres table with expiring rows. Document the choice in DEPLOYMENT.

## 5. Input, Output, and Data Handling

| ID     | Control                                                                                                                                                                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-07 | Validate all input with strict Zod schemas (types, lengths, enums, date formats). Reject unknown fields. Bound every string length.                                                                                                               |
| SEC-08 | Output encoding: React escapes by default; never use `dangerouslySetInnerHTML` for user content. User-supplied text (messages, notes) is rendered as plain text.                                                                                  |
| SEC-12 | CSV export: prefix cells beginning with `=`, `+`, `-`, `@`, tab, or CR with a single quote; quote all fields; set `Content-Disposition` and `X-Content-Type-Options: nosniff`.                                                                    |
| SEC-13 | Data minimization: collect only name, contact, dates, party size, and message. **Do not store** passport/KTP numbers, card data, or bank account numbers. Payment `reference` is free text and the UI warns not to paste card or account numbers. |

SQL: use Prisma's query API. Any `$queryRaw` must use tagged templates (parameterized). No string-built SQL.

## 6. Secrets, Config, and Headers

| ID     | Control                                                                                                                                                                                                                                                                                                                                                     |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-14 | Secrets only in environment variables; `.env*` git-ignored; `.env.example` has placeholders. No secret uses the `NEXT_PUBLIC_` prefix. Rotate `AUTH_SECRET` and DB credentials if exposed.                                                                                                                                                                  |
| SEC-15 | Security headers: `Content-Security-Policy` (no `unsafe-eval`; nonces or hashes for inline scripts), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (disable unused features), `frame-ancestors 'none'`. Map embeds, if used, are explicitly allow-listed in CSP. |
| SEC-16 | `/admin` and `/api/admin` responses set `Cache-Control: no-store`; admin pages carry `noindex`.                                                                                                                                                                                                                                                             |

## 7. Logging, Audit, and Monitoring

| ID     | Control                                                                                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-17 | Every admin mutation writes an `AuditLog` row (actor, action, entity, changed fields) in the same transaction. Audit entries never contain passwords, tokens, or full message bodies. |
| SEC-18 | Application logs are structured JSON with `requestId`; **no** guest names, emails, phones, or request bodies. Log authentication failures with account email hash, not the plaintext. |
| SEC-19 | `/api/health` exposes no version, environment, or configuration.                                                                                                                      |

## 8. Dependencies and Supply Chain

- Lockfile committed; install with a frozen lockfile in CI.
- Run `npm audit` (or equivalent) in CI; triage high/critical before release.
- Enable automated dependency update PRs; review changelogs for auth/ORM/framework packages.
- **Third-party agent skills** (design/UI skill packs): treat as untrusted instructions. Review before install, pin to a commit, never allow them to read secrets, run network commands, or modify auth, security, or database files without explicit review.

## 9. Database and Infrastructure

- Separate databases per environment (development, preview, production). Previews never point at production data.
- Least-privilege DB role for the runtime (no `CREATE EXTENSION`/DDL); migrations run with a separate credential.
- TLS to the database (`sslmode=require` or provider default).
- Automated backups enabled; restore procedure tested once before release and documented in DEPLOYMENT.
- Production seed disabled by default.

## 10. Privacy Notes (portfolio level)

- Inquiry form shows a notice that information is stored to respond to the request (copy in CONTENT_GUIDE §10).
- Admin can anonymize a guest record (DATABASE §11).
- Analytics, if added, must not receive form contents or guest identifiers.
- For a real operator, have a qualified professional review privacy obligations (for Indonesia, Law No. 27 of 2022) before launch.

## 11. Pre-Release Security Checklist

- [ ] SEC-01 … SEC-19 each verified by a test or documented manual check.
- [ ] No default or shared credentials exist anywhere.
- [ ] RBAC matrix verified for every admin endpoint with both roles and anonymous.
- [ ] Rate limits verified on login and public inquiry.
- [ ] CSP does not block required features and contains no `unsafe-eval`.
- [ ] Source and client bundles scanned for secrets.
- [ ] Last-admin protection verified.
- [ ] Backup restore rehearsed.
- [ ] Dependency audit reviewed.

## 12. Incident Basics

1. Revoke exposed credentials; rotate `AUTH_SECRET` (invalidates all sessions).
2. Review `AuditLog` and host logs for the window.
3. Restore from backup if data integrity is in question.
4. Record cause, impact, and fix in `docs/incidents/` (no personal data).
