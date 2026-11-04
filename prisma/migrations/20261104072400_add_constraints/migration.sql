CREATE EXTENSION IF NOT EXISTS btree_gist;

-- BR-04: no overlapping blocking reservations per unit
ALTER TABLE "Reservation"
  ADD CONSTRAINT reservation_no_overlap
  EXCLUDE USING gist (
    "unitId" WITH =,
    daterange("checkIn", "checkOut", '[)') WITH &&
  )
  WHERE ("status" IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'));

-- BR-02 and sanity checks
ALTER TABLE "Reservation"
  ADD CONSTRAINT reservation_dates_valid CHECK ("checkOut" > "checkIn"),
  ADD CONSTRAINT reservation_nights_matches CHECK ("nights" = ("checkOut" - "checkIn")),
  ADD CONSTRAINT reservation_guests_valid CHECK ("adults" >= 1 AND "children" >= 0),
  ADD CONSTRAINT reservation_amounts_valid CHECK (
    "nightlySubtotalIdr" >= 0 AND "cleaningFeeIdr" >= 0 AND
    "discountIdr" >= 0 AND "totalIdr" >= 0
  );

ALTER TABLE "UnitBlock"
  ADD CONSTRAINT unit_block_dates_valid CHECK ("endDate" > "startDate");

ALTER TABLE "RateRule"
  ADD CONSTRAINT rate_rule_dates_valid CHECK ("endDate" >= "startDate");

ALTER TABLE "Payment"
  ADD CONSTRAINT payment_amount_positive CHECK ("amountIdr" > 0);
