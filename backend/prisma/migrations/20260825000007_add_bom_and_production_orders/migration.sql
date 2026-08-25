-- Gap #10: Manufacturing / Bill of Materials (BOM)
-- Adds bom_templates, bom_lines, production_orders tables.

CREATE TABLE IF NOT EXISTS bom_templates (
  id               UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL,
  name             TEXT        NOT NULL,
  description      TEXT,
  finished_item_id TEXT        NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  output_qty       NUMERIC(15,4) NOT NULL DEFAULT 1,
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_bom_templates PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_bom_templates_tenant ON bom_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bom_templates_finished_item ON bom_templates(finished_item_id);

CREATE TABLE IF NOT EXISTS bom_lines (
  id                UUID        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id         UUID        NOT NULL,
  bom_template_id   UUID        NOT NULL REFERENCES bom_templates(id) ON DELETE CASCADE,
  component_item_id TEXT        NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity          NUMERIC(15,4) NOT NULL,
  CONSTRAINT pk_bom_lines PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_bom_lines_tenant ON bom_lines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bom_lines_template ON bom_lines(bom_template_id);

CREATE TABLE IF NOT EXISTS production_orders (
  id              UUID          NOT NULL DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL,
  order_number    TEXT          NOT NULL,
  bom_template_id UUID          NOT NULL REFERENCES bom_templates(id) ON DELETE RESTRICT,
  warehouse_id    TEXT          NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  planned_qty     NUMERIC(15,4) NOT NULL,
  completed_qty   NUMERIC(15,4),
  status          TEXT          NOT NULL DEFAULT 'DRAFT',
  notes           TEXT,
  journal_id      UUID,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT pk_production_orders PRIMARY KEY (id),
  CONSTRAINT uq_production_orders_tenant_number UNIQUE (tenant_id, order_number)
);

CREATE INDEX IF NOT EXISTS idx_production_orders_tenant ON production_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_bom ON production_orders(bom_template_id);
CREATE INDEX IF NOT EXISTS idx_production_orders_status ON production_orders(status);
