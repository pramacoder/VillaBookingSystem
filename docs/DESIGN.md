# Design System — Sagara Villas

## Shoreline Calm (Portfolio 02 edition)

- **Version:** 1.0 (inherits Shoreline Calm v1.1 from Portfolio 01)
- **Brand:** Sagara Villas (fictional)
- **Surfaces:** Public website + Admin dashboard
- **Primary language:** English · **Secondary:** Indonesian
- **Related:** [PRD](PRD.md) · [CONTENT_GUIDE](CONTENT_GUIDE.md) · [IMPLEMENTATION](IMPLEMENTATION.md) · [AGENTS](../AGENTS.md)

> **Source of truth rule:** the tokens in this file win over any skill, template, or reference image. Skills may improve execution (spacing, contrast, hierarchy) but must not introduce fonts or colors outside this document.

---

## 1. Design Vision

**Public site:** calm, premium, photography-led coastal hospitality — breezy, fresh, editorial.

**Admin dashboard:** the same calm identity, but **work-first**: dense enough to scan many reservations, quiet enough to use all day. Photography is minimal; typography, whitespace, and clear status signals carry the interface.

Principles (shared): generous whitespace on public pages, strong typographic hierarchy, restrained color, consistent grid, subtle motion, mobile-first public pages, **tablet-first admin** (staff often use a tablet at the front desk), accessible by default.

## 2. Reference Image Usage

The supplied "Room Details" page is a **structural reference only**. Borrow:

| Borrow (structure)                                                          | Do not borrow                                               |
| --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Hero banner with title + breadcrumb                                         | Brand name, logo, copy                                      |
| Thumbnail column + large main image                                         | Its dark-green palette (use Shoreline Calm)                 |
| Info card: title, tag, rate, quick facts (beds, baths, area, guests), share | Rating/review figures (**forbidden**, see CONTENT_GUIDE §7) |
| Overview → Amenities grid → Rules (Check-in / Check-out) → Location         | Real-looking address or map data                            |
| Sticky booking panel on the right                                           | "Book Now" wording (use **Request Booking**)                |
| Contact strip above the nav (optional, demo details only)                   | Any image or icon asset                                     |

## 3. Color Palette (unchanged from Portfolio 01)

| Token        | Hex       | Usage                                                                 |
| ------------ | --------- | --------------------------------------------------------------------- |
| `teal-300`   | `#A2B8B8` | Structural panels (header, booking bar, footer option), muted accents |
| `blue-600`   | `#006BB3` | Primary buttons, strong accents, active states                        |
| `blue-500`   | `#006DFF` | Links, interactive highlights                                         |
| `indigo-600` | `#4E37B6` | Secondary vibrant accent (sparingly)                                  |
| `white`      | `#FFFFFF` | Page and card background                                              |
| `gray-100`   | `#EEEEEE` | Secondary background, dividers                                        |
| `gray-600`   | `#4B4B4B` | Secondary text                                                        |
| `gray-800`   | `#212121` | Body text and headings                                                |
| `gray-900`   | `#111111` | Deep contrast, footer                                                 |
| `black`      | `#000000` | Strict typography only                                                |

### 3.1 Contrast reference (approximate; re-verify with a checker)

| Pair                         |      Ratio | Use                                                                    |
| ---------------------------- | ---------: | ---------------------------------------------------------------------- |
| `gray-800` on `white`        |      ~16:1 | Body text ✔                                                            |
| `gray-600` on `white`        |     ~8.7:1 | Secondary text ✔                                                       |
| `gray-600` on `gray-100`     |     ~7.5:1 | Muted text on tinted surface ✔                                         |
| `white` on `blue-600`        |     ~5.6:1 | Primary button ✔                                                       |
| `blue-500` on `white`        |     ~4.5:1 | Links — borderline; underline links, never use for small non-link text |
| `white` on `indigo-600`      |     ~8.3:1 | Accent chips ✔                                                         |
| `gray-800` on `teal-300`     |     ~7.7:1 | Text on teal panels ✔                                                  |
| **`white` on `teal-300`**    | **~2.1:1** | **Fails — never use**                                                  |
| **`blue-600` on `teal-300`** | **~2.7:1** | **Fails — never use for text**                                         |

Rules: dark text only on `teal-300`; primary buttons inside teal panels are `white` background with `gray-800` text.

### 3.2 Functional status tokens (documented extension)

Admin needs semantic states. These are the **only** extra colors, used for status badges, validation, and alerts. Always pair color with an icon and text label (never color alone).

| Token            | Background | Text      | Icon (lucide)  | Used for                             |
| ---------------- | ---------- | --------- | -------------- | ------------------------------------ |
| `status-neutral` | `#EEEEEE`  | `#212121` | `Circle`       | PENDING (reservation), DRAFT         |
| `status-info`    | `#E6F0F8`  | `#004C80` | `Info`         | CONFIRMED                            |
| `status-active`  | `#E8E4F7`  | `#3A2A8C` | `LogIn`        | CHECKED_IN                           |
| `status-success` | `#DCFCE7`  | `#14532D` | `CheckCircle2` | PAID, CHECKED_OUT                    |
| `status-warning` | `#FEF3C7`  | `#78350F` | `Clock`        | PARTIAL, expiring pending            |
| `status-danger`  | `#FEE2E2`  | `#7F1D1D` | `AlertCircle`  | UNPAID (past due), CANCELLED, errors |

Status mapping:

- **Reservation:** PENDING → neutral · CONFIRMED → info · CHECKED_IN → active · CHECKED_OUT → success · CANCELLED → danger (with strikethrough on dates in lists).
- **Payment:** UNPAID → danger-outline (neutral fill if the stay is in the future) · PARTIAL → warning · PAID → success.
- Verify every pair at ≥ 4.5:1 before shipping; adjust the _tint_, not the text darkness, if one fails.

## 4. Typography (unchanged)

- Display/headings: **Cormorant Garamond**
- Body/UI: **DM Sans**

| Token      | Public desktop |    Admin | Usage                |
| ---------- | -------------: | -------: | -------------------- |
| Display    |       64–88 px |        — | Hero                 |
| H1         |       48–64 px | 28–32 px | Page title           |
| H2         |       36–48 px | 22–24 px | Section / card group |
| H3         |       24–32 px | 18–20 px | Card title           |
| Body Large |       18–20 px |        — | Intro                |
| Body       |       15–17 px | 14–15 px | Main text            |
| Small      |       12–14 px | 12–13 px | Captions, table meta |

Admin rules:

- Cormorant Garamond is used for page titles and large numerals on dashboard cards only. **All tables, forms, buttons, badges, and calendar labels use DM Sans.**
- Use tabular numerals (`font-variant-numeric: tabular-nums`) for money, dates, and counts so columns align.
- Money format: `Rp 4.750.000` (id) and `IDR 4,750,000` (en). Dates: `26 Dec 2026` (en) and `26 Des 2026` (id).
- Use `clamp()` for public headings; fixed sizes are fine in admin.

## 5. Layout and Spacing

Inherited: max content width 1280 px; reading width 680–760 px; horizontal padding 64/32/20 px (desktop/tablet/mobile); spacing scale `space-1…space-30` (4 → 120 px); public section spacing 96–120 / 72–96 / 56–72 px.

Admin additions:

- App shell: fixed sidebar 248 px (collapsible to 72 px icon rail); top bar 64 px; content max 1440 px, padding 24 px (desktop) / 16 px (tablet).
- Tablet (≤ 1024 px): sidebar becomes an overlay drawer.
- Card padding 20–24 px; table row height 48 px (comfortable) or 40 px (compact toggle, P1).
- Border radius: slightly rounded — 8 px cards/inputs, 6 px buttons and badges. No pill-everything, no heavy shadows (a single subtle `0 1px 2px` elevation only for popovers/dialogs).

## 6. Public Page Patterns

### Unit detail (from the reference)

```text
[ Hero banner: title + breadcrumb (teal-300 overlay, dark text or photo with scrim) ]

[ thumbs ] [ main image ........................ ]     [ Request panel (sticky) ]
[ thumbs ] [ ................................... ]     [ dates / guests / unit  ]
                                                         [ price quote (demo)    ]
[ Info card: name · tag · rate (DEMO) · beds · baths ·  ]  [ Request Booking     ]
[ area · guests · share                                  ]
[ Overview ]
[ Amenities grid (3 cols desktop, 2 tablet, 1 mobile) ]
[ House rules: Check-in | Check-out ]
[ Location (illustrative map placeholder) ]
```

- Images: 4:5 or 3:2; main image 3:2; thumbnails 4:5. Reserve space to avoid layout shift.
- The request panel is sticky on desktop; on mobile it becomes a bottom bar showing "From … / Request Booking" that opens a full-height sheet.
- Rates always show a visible **Demo rate** label.
- Success state after request: heading "Request received", reference code, text that the request is **not yet confirmed**.

### Catalog, homepage, about, location, contact

Follow Portfolio 01 patterns (editorial split sections, restrained cards with `gray-100` borders, photography-led). Catalog cards: image (4:5), name, three quick facts, demo rate, "View Details".

## 7. Admin Patterns

### 7.1 App shell

Sidebar items (icon + label): Dashboard, Calendar, Reservations, Guests, Units, Reports, Users (ADMIN). Active item: `blue-600` left bar + `gray-100` background. Top bar: page title, language toggle, user menu. The sidebar background is `white` with a `gray-100` border; `teal-300` is reserved for the top bar accent strip and key summary panels.

### 7.2 Dashboard

Row of summary cards (Arrivals today, Departures today, In-house, Pending requests, Outstanding balance, 30-day occupancy) → two lists (Today's arrivals, Pending requests needing action) → mini calendar strip. Large numerals in Cormorant Garamond; labels in DM Sans Small.

### 7.3 Calendar (resource timeline)

- Rows = units (sticky first column), columns = days (sticky header). Week/14-day/month views.
- Reservation bars start at the **middle** of check-in day and end at the middle of check-out day, making same-day turnover visible.
- Bar fill uses status tokens; payment status shown as an icon + short text on the bar (e.g. "Partial"), not color only.
- Blocks use a hatched neutral pattern with label (e.g. "Maintenance").
- Today column has a `blue-600` marker line. Weekend columns get a faint `gray-100` tint.
- Keyboard: arrow keys move focus between bars; Enter opens detail; a "Create reservation" button covers mouse-free creation. Provide a list view fallback for screen readers.

### 7.4 Tables

Sticky header, sortable columns with `aria-sort`, filters above the table in a single row (collapse to a sheet on tablet), row actions in a menu, pagination footer with total. Empty state with explanation and primary action. Status columns use the badges from §3.2. Right-align numbers.

### 7.5 Forms and dialogs

Visible labels, helper text, inline errors tied with `aria-describedby`, required marker plus text "(required)" for screen readers. Destructive actions (cancel reservation, void payment) open a dialog with a required reason field and a clearly named confirm button ("Void payment", not "OK"). Disable the button and show progress while submitting.

### 7.6 Payment panel (reservation detail)

Summary header: Total · Paid · Balance + status badge. Below: payment list (date, method, reference, amount, recorder, voided rows struck through with reason). "Record payment" primary button; overpaid shows a `status-warning` banner with the difference.

### 7.7 Reports

Filter bar → totals row → table → export button. Charts are optional (P1) and limited to bar/line using palette tokens with direct labels; every chart has a table equivalent. Print stylesheet: hide chrome, use black on white, keep tables unbroken.

### 7.8 States

Every data view defines **loading** (skeleton, not spinner-only), **empty**, **error** (with retry), and **partial/permission** states. Toasts for success are polite live regions; errors persist until dismissed.

## 8. Components

- **Buttons:** primary (`blue-600`/white; or white/`gray-800` inside teal panels), secondary (transparent or `gray-100`, `gray-800` border/text), destructive (`status-danger` text on white with danger border; filled only inside confirmation dialogs). Same height and type across pages; visible hover, focus, active, disabled.
- **Inputs:** 44 px height minimum, 1 px `gray-100`→`gray-600` border on focus plus a 2 px `blue-600` focus ring with offset.
- **Badges:** 6 px radius, icon + label, DM Sans 12–13 px medium.
- **Cards:** `gray-100` border, white background, no heavy shadow.
- **Navigation (public):** `teal-300` or transparent over hero; distinct "Request Booking" CTA. Mobile menu closes with Escape.
- **Footer (public):** `gray-900` or `teal-300`, white or dark text accordingly (check contrast), demo disclosure.

## 9. Tailwind Token Mapping

```ts
// tailwind.config.ts (excerpt)
colors: {
  teal:   { 300: "#A2B8B8" },
  blue:   { 500: "#006DFF", 600: "#006BB3" },
  indigo: { 600: "#4E37B6" },
  gray:   { 100: "#EEEEEE", 600: "#4B4B4B", 800: "#212121", 900: "#111111" },
  status: {
    neutral: { bg: "#EEEEEE", fg: "#212121" },
    info:    { bg: "#E6F0F8", fg: "#004C80" },
    active:  { bg: "#E8E4F7", fg: "#3A2A8C" },
    success: { bg: "#DCFCE7", fg: "#14532D" },
    warning: { bg: "#FEF3C7", fg: "#78350F" },
    danger:  { bg: "#FEE2E2", fg: "#7F1D1D" },
  },
},
fontFamily: {
  display: ["var(--font-cormorant)", "Georgia", "serif"],
  sans:    ["var(--font-dm-sans)", "system-ui", "sans-serif"],
},
```

Load fonts with `next/font` (subset Latin; include weights actually used). Expose tokens as CSS variables in `globals.css` so shadcn/ui components inherit them.

## 10. Motion

200–300 ms hover, 250–400 ms menu/sheet, 300–500 ms subtle reveals on public pages only. Admin uses motion for state clarity only (dialogs, toasts, drawer). Respect `prefers-reduced-motion`. No scroll hijacking, no parallax, no 3D.

## 11. Responsive Behavior

| Surface | Required widths                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Public  | 375, 390, 768, 1440 px                                                                                                                           |
| Admin   | 768 and 1024 px (tablet), 1440 px (desktop); mobile 390 px must remain usable for read-only and quick actions (view reservation, record payment) |

Calendar on narrow screens: switch to a day-agenda list. No horizontal page overflow; wide tables and the calendar scroll inside their own container with a visible scroll affordance.

## 12. Accessibility

Semantic landmarks; one H1 per page; visible focus; keyboard operability including the calendar, dialogs (focus trap, Escape, return focus), and menus; labeled controls; errors announced; ≥ 44 px touch targets; status never by color alone; reduced motion; descriptive link text; alt text per CONTENT_GUIDE; target WCAG 2.2 AA.

## 13. Skills Policy for Design Work

| Skill (as listed by the owner)                           | Use       | Constraint                                                      |
| -------------------------------------------------------- | --------- | --------------------------------------------------------------- |
| better-typography / layout / colors / accessibility / ui | ✔ Primary | Audit against this document                                     |
| shadcn-ui, extract-design-md                             | ✔         | Keep `DESIGN.md` in sync with tokens in code                    |
| hallmark                                                 | ✔         | Run the self-critique gate before reporting a UI milestone PASS |
| stitch-loop                                              | Optional  | Only if the Stitch MCP connection is active                     |
| ui-ux-pro-max, taste-skill                               | Selective | Public pages only; palette/fonts stay as defined here           |
| scroll-world, frontend-slides, site-cloner               | ✖         | Out of scope (performance/accessibility; copying references)    |

## 14. Design Review Checklist

- [ ] Only documented colors (including status tokens) are used.
- [ ] Cormorant Garamond limited to headings/large numerals; DM Sans for all UI.
- [ ] No white text on `teal-300`; no `blue` text on `teal-300`.
- [ ] Status shown with icon + text, not color alone.
- [ ] Public unit detail follows §6; rates labeled as demo; no ratings.
- [ ] Admin tables, forms, dialogs follow §7; all four view states exist.
- [ ] Calendar bars show same-day turnover correctly; keyboard path exists.
- [ ] Focus visible everywhere; reduced motion honored.
- [ ] No horizontal overflow at required widths.
- [ ] Contrast of every text/background pair verified with a tool.
