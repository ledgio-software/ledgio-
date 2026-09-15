-- Payroll: employees, payroll_runs, payslips

CREATE TABLE IF NOT EXISTS "employees" (
  "id"                    TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"             TEXT          NOT NULL,
  "employee_number"       TEXT          NOT NULL,
  "first_name"            TEXT          NOT NULL,
  "last_name"             TEXT          NOT NULL,
  "email"                 TEXT,
  "phone"                 TEXT,
  "position"              TEXT,
  "department"            TEXT,
  "gross_salary"          DECIMAL(15,2) NOT NULL DEFAULT 0,
  "salary_currency"       TEXT          NOT NULL DEFAULT 'GHS',
  "salary_exchange_rate"  DECIMAL(15,6) NOT NULL DEFAULT 1,
  "date_of_joining"       DATE,
  "date_of_leaving"       DATE,
  "is_active"             BOOLEAN       NOT NULL DEFAULT true,
  "created_at"            TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "payroll_runs" (
  "id"                    TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id"             TEXT          NOT NULL,
  "run_number"            TEXT          NOT NULL,
  "period_month"          INTEGER       NOT NULL,
  "period_year"           INTEGER       NOT NULL,
  "status"                TEXT          NOT NULL DEFAULT 'DRAFT',
  "total_gross"           DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total_paye"            DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total_ssnit_employee"  DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total_ssnit_employer"  DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total_net_pay"         DECIMAL(15,2) NOT NULL DEFAULT 0,
  "journal_entry_id"      TEXT,
  "created_at"            TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "payslips" (
  "id"                      TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "payroll_run_id"          TEXT          NOT NULL,
  "employee_id"             TEXT          NOT NULL,
  "gross_salary"            DECIMAL(15,2) NOT NULL DEFAULT 0,
  "gross_salary_foreign"    DECIMAL(15,2) NOT NULL DEFAULT 0,
  "salary_currency"         TEXT          NOT NULL DEFAULT 'GHS',
  "exchange_rate"           DECIMAL(15,6) NOT NULL DEFAULT 1,
  "unpaid_leave_deduction"  DECIMAL(15,2) NOT NULL DEFAULT 0,
  "paye"                    DECIMAL(15,2) NOT NULL DEFAULT 0,
  "ssnit_employee"          DECIMAL(15,2) NOT NULL DEFAULT 0,
  "ssnit_employer"          DECIMAL(15,2) NOT NULL DEFAULT 0,
  "loan_deduction"          DECIMAL(15,2) NOT NULL DEFAULT 0,
  "net_pay"                 DECIMAL(15,2) NOT NULL DEFAULT 0,
  "created_at"              TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payslips_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payslips_payroll_run_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE,
  CONSTRAINT "payslips_employee_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "employees_tenant_id_idx" ON "employees"("tenant_id");
CREATE INDEX IF NOT EXISTS "employees_is_active_idx" ON "employees"("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "payroll_runs_tenant_id_idx" ON "payroll_runs"("tenant_id");
CREATE INDEX IF NOT EXISTS "payroll_runs_period_idx" ON "payroll_runs"("tenant_id", "period_year", "period_month");
CREATE INDEX IF NOT EXISTS "payslips_payroll_run_id_idx" ON "payslips"("payroll_run_id");
CREATE INDEX IF NOT EXISTS "payslips_employee_id_idx" ON "payslips"("employee_id");
