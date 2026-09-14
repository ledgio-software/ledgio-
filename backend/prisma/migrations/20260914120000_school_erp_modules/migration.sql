-- CreateTable: SchoolAttendance
CREATE TABLE "school_attendance" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_attendance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_attendance_tenant_id_student_id_date_key" ON "school_attendance"("tenant_id", "student_id", "date");
CREATE INDEX "school_attendance_tenant_id_idx" ON "school_attendance"("tenant_id");
CREATE INDEX "school_attendance_tenant_id_date_idx" ON "school_attendance"("tenant_id", "date");
CREATE INDEX "school_attendance_tenant_id_term_id_idx" ON "school_attendance"("tenant_id", "term_id");

-- CreateTable: StudentAssessment
CREATE TABLE "student_assessments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "term_id" TEXT NOT NULL,
    "subject_name" TEXT NOT NULL,
    "exam_type" TEXT NOT NULL,
    "score" DECIMAL(8,2) NOT NULL,
    "max_score" DECIMAL(8,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_assessments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "student_assessments_tenant_id_idx" ON "student_assessments"("tenant_id");
CREATE INDEX "student_assessments_tenant_id_term_id_idx" ON "student_assessments"("tenant_id", "term_id");
CREATE INDEX "student_assessments_tenant_id_student_id_idx" ON "student_assessments"("tenant_id", "student_id");

-- CreateTable: Admission
CREATE TABLE "admissions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "application_number" TEXT NOT NULL,
    "applicant_first_name" TEXT NOT NULL,
    "applicant_last_name" TEXT NOT NULL,
    "date_of_birth" TIMESTAMP(3),
    "applying_class" TEXT NOT NULL,
    "parent_name" TEXT NOT NULL,
    "parent_phone" TEXT NOT NULL,
    "parent_email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admissions_tenant_id_application_number_key" ON "admissions"("tenant_id", "application_number");
CREATE INDEX "admissions_tenant_id_idx" ON "admissions"("tenant_id");
CREATE INDEX "admissions_tenant_id_status_idx" ON "admissions"("tenant_id", "status");

-- CreateTable: TimetableSlot
CREATE TABLE "timetable_slots" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "class_name" TEXT NOT NULL,
    "day_of_week" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "subject_name" TEXT NOT NULL,
    "teacher_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timetable_slots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "timetable_slots_tenant_id_idx" ON "timetable_slots"("tenant_id");
CREATE INDEX "timetable_slots_tenant_id_class_name_idx" ON "timetable_slots"("tenant_id", "class_name");

-- CreateTable: SchoolCertificate
CREATE TABLE "school_certificates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "certificate_type" TEXT NOT NULL,
    "issued_date" TIMESTAMP(3) NOT NULL,
    "issued_by" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_certificates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_certificates_tenant_id_idx" ON "school_certificates"("tenant_id");
CREATE INDEX "school_certificates_tenant_id_student_id_idx" ON "school_certificates"("tenant_id", "student_id");

-- CreateTable: Scholarship
CREATE TABLE "scholarships" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "term_id" TEXT,
    "scholarship_name" TEXT NOT NULL,
    "discount_type" TEXT NOT NULL,
    "discount_value" DECIMAL(15,2) NOT NULL,
    "reason" TEXT,
    "awarded_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scholarships_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "scholarships_tenant_id_idx" ON "scholarships"("tenant_id");
CREATE INDEX "scholarships_tenant_id_student_id_idx" ON "scholarships"("tenant_id", "student_id");

-- CreateTable: StudentHealth
CREATE TABLE "student_health" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "blood_group" TEXT,
    "allergies" TEXT NOT NULL DEFAULT '',
    "medical_conditions" TEXT NOT NULL DEFAULT '',
    "emergency_contact" TEXT,
    "emergency_phone" TEXT,
    "vaccination_notes" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_health_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_health_tenant_id_student_id_key" ON "student_health"("tenant_id", "student_id");
CREATE INDEX "student_health_tenant_id_idx" ON "student_health"("tenant_id");

-- CreateTable: SchoolEvent
CREATE TABLE "school_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "event_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "event_type" TEXT NOT NULL,
    "location" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_events_tenant_id_idx" ON "school_events"("tenant_id");
CREATE INDEX "school_events_tenant_id_event_date_idx" ON "school_events"("tenant_id", "event_date");
