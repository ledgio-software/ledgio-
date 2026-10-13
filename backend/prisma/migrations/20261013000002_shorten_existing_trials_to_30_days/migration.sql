-- Free trial is now 30 days. Shorten existing running trials to 30 days after signup.
-- Tenants already past 30 days have their trial end now (migration time), so they still get
-- the 7-day read-only grace instead of being locked out instantly.
-- Only trial_ends_at changes; never lengthens a trial; paid (ACTIVE) and null-trial tenants untouched.
UPDATE "public"."tenants"
SET "trial_ends_at" = LEAST("trial_ends_at", GREATEST("created_at" + INTERVAL '30 days', NOW())),
    "updated_at" = NOW()
WHERE "subscription_status" = 'TRIAL'
  AND "trial_ends_at" IS NOT NULL
  AND "trial_ends_at" > "created_at" + INTERVAL '30 days';
