# Content and Brand Guide — Sagara Villas

- **Version:** 1.0
- **Brand:** Sagara Villas (fictional)
- **Tagline:** Calm Stays, Close to the Shore.
- **Languages:** English and Bahasa Indonesia
- **Related:** [PRD](PRD.md) · [DESIGN](DESIGN.md) · [DATABASE](DATABASE.md) · [SECURITY](../SECURITY.md)

> The brand name and tagline are working choices for this portfolio. Changing them requires updating this file, `messages/*.json`, metadata, and seed data.

---

## 1. Brand Identity

Sagara Villas is a fictional operator of several boutique villa units on the Bali coast, built to demonstrate a complete booking-management product.

**Attributes:** calm, warm, clear, reliable, refined.
**Promise (concept):** a simple, transparent way to request a stay, and a team that responds.

Never imply Sagara Villas is a real operating business. The README and footer carry a demo disclosure.

## 2. Audiences

| Audience               | Language                                                 | Tone             |
| ---------------------- | -------------------------------------------------------- | ---------------- |
| International guest    | Clear, natural English; avoid unexplained local terms    | Warm, concise    |
| Domestic guest         | Warm, clear Bahasa Indonesia; not stiff or overly formal | Friendly, direct |
| Operator staff (admin) | Plain, task-focused labels                               | Neutral, precise |
| Portfolio evaluator    | Shows professional hospitality communication             | Specific, honest |

## 3. Voice

**Do:** be calm and specific; describe the experience and practical facts; use consistent terms; state what happens next.
**Avoid:** exaggerated luxury claims; unsupported superlatives; fake awards/ratings/reviews; false urgency ("Only 1 left!"); guaranteed availability or instant confirmation; filler copy.

## 4. Sample Copy

**EN hero:** _A Quiet Stay by the Coast._ Choose from our villa units, check the dates, and send a booking request. Our team confirms personally.
CTA: **Explore Our Villas**

**ID hero:** _Menginap Tenang di Tepi Pantai._ Pilih unit villa, cek tanggal, lalu ajukan permintaan reservasi. Tim kami akan mengonfirmasi secara langsung.
CTA: **Jelajahi Villa Kami**

All sample copy is demonstration content, not factual claims about a real property.

## 5. Terminology

### 5.1 Public

| English                   | Indonesian           |
| ------------------------- | -------------------- |
| Request Booking           | Ajukan Reservasi     |
| Booking Request           | Permintaan Reservasi |
| Villas / Unit             | Villa / Unit         |
| Facilities                | Fasilitas            |
| Check-in / Check-out      | Check-in / Check-out |
| Guests (Adults, Children) | Tamu (Dewasa, Anak)  |
| View Details              | Lihat Detail         |
| Demo rate                 | Tarif demo           |
| Per night                 | Per malam            |
| Contact Us                | Hubungi Kami         |

### 5.2 Admin

| English               | Indonesian                 |
| --------------------- | -------------------------- |
| Dashboard             | Dasbor                     |
| Calendar              | Kalender                   |
| Reservation(s)        | Reservasi                  |
| Guest(s)              | Tamu                       |
| Payment(s)            | Pembayaran                 |
| Refund                | Pengembalian dana          |
| Balance               | Sisa tagihan               |
| Report(s)             | Laporan                    |
| Arrivals / Departures | Kedatangan / Keberangkatan |
| Block dates           | Blokir tanggal             |

### 5.3 Statuses (use exactly)

| Code          | English        | Indonesian       |
| ------------- | -------------- | ---------------- |
| `PENDING`     | Pending        | Menunggu         |
| `CONFIRMED`   | Confirmed      | Terkonfirmasi    |
| `CHECKED_IN`  | Checked in     | Sudah check-in   |
| `CHECKED_OUT` | Checked out    | Sudah check-out  |
| `CANCELLED`   | Cancelled      | Dibatalkan       |
| `UNPAID`      | Unpaid         | Belum dibayar    |
| `PARTIAL`     | Partially paid | Dibayar sebagian |
| `PAID`        | Paid           | Lunas            |

Use "Ajukan Reservasi" / "Permintaan Reservasi" for public actions. Never use wording that implies instant confirmation ("Booked!", "Reservasi berhasil dikonfirmasi") before staff confirm.

## 6. Fictional Property Data

Allowed as illustration:

- Brand: Sagara Villas. General area: coastal Bali.
- Units (examples): **Sagara Garden Villa**, **Sagara Pool Villa**, **Sagara Family Residence**, **Sagara Loft Suite**. Final names live in seed data.
- Capacity, rooms, areas, rates: simulated. Rates are shown with **Demo rate** or replaced by "Contact for rates".
- House rules (check-in/out times, policies): illustrative and labeled as demo.

Do **not** invent: street address, coordinates, license numbers, real contact details, real availability claims, or real people.

## 7. Forbidden Claims and Placeholders

Never publish: guest testimonials, guest names or photos, star ratings, review counts (the reference design's "4.9 (245 Review)" is **not** to be reproduced), awards, certifications, press mentions, occupancy or conversion statistics.

If a layout needs a testimonial/rating slot, omit it, or use a development-only placeholder that is excluded from production builds.

## 8. Image and Asset Policy

Use only original images, generated images where permitted, properly licensed stock, or images with explicit permission. Do not copy images from other villa websites, social media, or the reference mockup.

Each image is recorded in the `UnitImage` table (`source`, `license`, `credit`, `obtainedOn`) and mirrored in `docs/ASSETS.md`:

| Filename               | Purpose       | Source/Creator | License/Permission | Credit | Date obtained |
| ---------------------- | ------------- | -------------- | ------------------ | ------ | ------------- |
| `hero-*.webp`          | Homepage hero | _fill_         | _fill_             | _fill_ | _fill_        |
| `unit-<slug>-<n>.webp` | Unit gallery  | _fill_         | _fill_             | _fill_ | _fill_        |

Rules: descriptive filenames; stored under `public/images/`; alt text in both languages; decorative images use empty alt; do not imply that stock imagery depicts a real property.

## 9. Alt Text and Microcopy Rules

- Alt text describes content, not purpose ("Bedroom with a wooden bed and green headboard facing a garden window").
- Buttons say what they do: "Record payment", "Void payment", "Confirm reservation".
- Error messages state the problem and the fix: "Check-out must be after check-in."
- Empty states explain and offer an action: "No reservations match these filters. Clear filters or create a reservation."
- Destructive dialogs name the consequence and require a reason.

## 10. Localization Quality

- Translate meaning, not structure; keep CTA intent identical across languages.
- Locale-appropriate dates, currency, and number formats (`IDR 4,750,000` vs `Rp 4.750.000`).
- No mixed-language labels; brand names unchanged.
- All validation messages, emails/templates (when added), metadata, and admin labels have both languages.
- Switching language must not lose user-entered form data.
- Translation parity check: `messages/en.json` and `messages/id.json` must have identical keys (automated test, TESTING `TC-L01`).

## 11. Privacy Copy for the Booking Request (data **is stored**)

English:
"By submitting, you agree that the information you provide is stored and used to respond to your request. This is a demo: submitting a request does not create a confirmed reservation."

Indonesian:
"Dengan mengirim, Anda menyetujui bahwa informasi yang Anda berikan disimpan dan digunakan untuk menanggapi permintaan Anda. Ini adalah demo: mengirim permintaan tidak membuat reservasi yang telah dikonfirmasi."

Success message (EN): "Request received. Your reference is **{code}**. This is not a confirmed reservation. Our team will contact you."
Success message (ID): "Permintaan diterima. Kode referensi Anda **{code}**. Ini bukan reservasi yang telah dikonfirmasi. Tim kami akan menghubungi Anda."

For a real client, replace with a privacy notice reviewed for the actual business and applicable law.

## 12. Demo and Seed Data Content

- Guest names are invented; emails use `@example.com`; phone numbers are obviously fictional.
- Notes and special requests are neutral (e.g. "Late arrival", "Extra pillows"); no health, religion, or other sensitive details.
- Reservation dates are generated relative to the current date so the demo never looks stale.

## 13. Content Review Checklist

- [ ] Brand name and tagline consistent everywhere.
- [ ] English and Indonesian complete; key parity test passes.
- [ ] Status labels match §5.3 in every view.
- [ ] No fabricated reviews, ratings, awards, or statistics.
- [ ] All rates labeled as demo (or "Contact for rates").
- [ ] No copy implies instant confirmation or live availability beyond what the system enforces.
- [ ] Every image has source/license recorded and bilingual alt text.
- [ ] Privacy notice matches real behavior (data is stored).
- [ ] Demo disclosure present in README and footer.
