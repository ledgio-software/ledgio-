-- CreateTable: PharmacyPatient — patient registry with allergy flags and NHIS card number
CREATE TABLE "pharmacy_patients" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "nhis_card_number" TEXT,
    "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "chronic_conditions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pharmacy_patients_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pharmacy_patients_tenant_id_idx" ON "pharmacy_patients"("tenant_id");
CREATE INDEX "pharmacy_patients_tenant_id_phone_idx" ON "pharmacy_patients"("tenant_id", "phone");

-- AlterTable: add billingType and patientId to prescriptions
ALTER TABLE "prescriptions" ADD COLUMN "billing_type" TEXT NOT NULL DEFAULT 'CASH';
ALTER TABLE "prescriptions" ADD COLUMN "patient_id" TEXT;

CREATE INDEX "prescriptions_tenant_id_billing_type_idx" ON "prescriptions"("tenant_id", "billing_type");

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "pharmacy_patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
