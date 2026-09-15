-- NaSIA Self-Assessment (Inspection Evaluation Framework)

CREATE TABLE IF NOT EXISTS "nasia_assessments" (
  "id"         TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"  TEXT         NOT NULL,
  "title"      TEXT         NOT NULL,
  "date"       TIMESTAMP(3) NOT NULL,
  "status"     TEXT         NOT NULL DEFAULT 'draft',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "nasia_assessments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "nasia_assessments_tenant_id_idx"
  ON "nasia_assessments"("tenant_id");

CREATE TABLE IF NOT EXISTS "nasia_ratings" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "assessment_id"  TEXT NOT NULL,
  "indicator_code" TEXT NOT NULL,
  "score"          INTEGER NOT NULL,
  "notes"          TEXT,
  CONSTRAINT "nasia_ratings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "nasia_ratings_assessment_id_fkey"
    FOREIGN KEY ("assessment_id") REFERENCES "nasia_assessments"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "nasia_ratings_assessment_id_indicator_code_key"
  ON "nasia_ratings"("assessment_id", "indicator_code");
