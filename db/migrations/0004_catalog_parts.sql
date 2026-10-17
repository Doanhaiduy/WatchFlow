-- 0004_catalog_parts.sql — Danh mục & kho: brands, watch_models, storage_locations, watch_units (+accessories, cost entries,
-- status/price history, movements), part_categories, parts, part_costs, part_compatibility, part_stock_movements.
-- Ma trận trạng thái chiếc (state-machines §1) + trigger bảo vệ; fn_set_unit_price, fn_move_unit, fn_release_unit, fn_writeoff_unit,
-- fn_restore_unit, fn_update_unit_identity, fn_adjust_part_stock; view v_stock_units, v_unit_aging, v_unit_costs, v_part_low_stock.
-- BR-UNIT-01…10, BR-PART-01…06, BR-INV-04, BR-SEC-02. Chiếc CHỈ được tạo bởi fn_confirm_purchase (M4, ADR-020). Idempotent.
BEGIN;

-- ===== Bảng danh mục =====
CREATE TABLE IF NOT EXISTS public.brands (
  id          uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  name        text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  country     text,
  is_active   boolean NOT NULL DEFAULT true,
  version     integer NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES public.users(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_brands_name ON public.brands (lower(name));
CREATE INDEX IF NOT EXISTS ix_brands_created_by ON public.brands (created_by);
CREATE INDEX IF NOT EXISTS ix_brands_updated_by ON public.brands (updated_by);

CREATE TABLE IF NOT EXISTS public.watch_models (
  id                 uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  code               text NOT NULL CHECK (code ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,40}$'),
  brand_id           uuid NOT NULL REFERENCES public.brands(id) ON DELETE RESTRICT,
  name               text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  reference_no       text,
  caliber            text,
  movement_type      text CHECK (movement_type IN ('automatic','manual','quartz','solar','smart','other')),
  case_size_mm       numeric(5,1) CHECK (case_size_mm > 0 AND case_size_mm < 100),
  case_material      text,
  strap_type         text,
  dial_color         text,
  glass_type         text,
  water_resistance_m integer CHECK (water_resistance_m >= 0),
  gender             text CHECK (gender IN ('male','female','unisex')),
  origin_country     text,
  specs              jsonb NOT NULL DEFAULT '{}',
  description        text,
  is_active          boolean NOT NULL DEFAULT true,
  search_text        text,
  version            integer NOT NULL DEFAULT 1,
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid REFERENCES public.users(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_watch_models_code ON public.watch_models (upper(code));
CREATE INDEX IF NOT EXISTS ix_watch_models_brand ON public.watch_models (brand_id);
CREATE INDEX IF NOT EXISTS ix_watch_models_search ON public.watch_models USING gin (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_watch_models_created_by ON public.watch_models (created_by);
CREATE INDEX IF NOT EXISTS ix_watch_models_updated_by ON public.watch_models (updated_by);

CREATE TABLE IF NOT EXISTS public.storage_locations (
  id         uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  name       text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  kind       text NOT NULL DEFAULT 'other' CHECK (kind IN ('safe','cabinet','display','workshop','other')),
  note       text,
  is_active  boolean NOT NULL DEFAULT true,
  version    integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_storage_locations_name ON public.storage_locations (lower(name));
CREATE INDEX IF NOT EXISTS ix_storage_locations_created_by ON public.storage_locations (created_by);
CREATE INDEX IF NOT EXISTS ix_storage_locations_updated_by ON public.storage_locations (updated_by);

-- ===== Chiếc đồng hồ =====
CREATE TABLE IF NOT EXISTS public.watch_units (
  id                          uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  asset_code                  text NOT NULL UNIQUE,
  model_id                    uuid NOT NULL REFERENCES public.watch_models(id) ON DELETE RESTRICT,
  brand_id                    uuid NOT NULL REFERENCES public.brands(id) ON DELETE RESTRICT,
  serial_no                   text,
  serial_norm                 text GENERATED ALWAYS AS (app.norm_serial(serial_no)) STORED,
  has_serial                  boolean NOT NULL DEFAULT true,
  condition                   text NOT NULL CHECK (condition IN ('new','used','refurbished')),
  condition_grade             text CHECK (condition_grade ~ '^([ABC]|\d{1,3}%)$'),
  condition_note              text,
  status                      text NOT NULL CHECK (status IN ('in_stock','reserved','with_collaborator','sold','in_repair','inspecting','written_off','cancelled')),
  location_id                 uuid REFERENCES public.storage_locations(id) ON DELETE RESTRICT,
  held_by_collaborator_id     uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  list_price_vnd              bigint NOT NULL DEFAULT 0 CHECK (list_price_vnd >= 0),
  promo_price_vnd             bigint CHECK (promo_price_vnd >= 0),
  promo_from                  date,
  promo_to                    date,
  manufacturer_warranty_until date,
  cost_cycle                  integer NOT NULL DEFAULT 1 CHECK (cost_cycle >= 1),
  stock_since                 date,
  note                        text,
  search_text                 text,
  version                     integer NOT NULL DEFAULT 1,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  created_by                  uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  updated_by                  uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT watch_units_promo_valid CHECK (
    (promo_price_vnd IS NULL AND promo_from IS NULL AND promo_to IS NULL)
    OR (promo_price_vnd IS NOT NULL AND promo_from IS NOT NULL AND promo_to IS NOT NULL AND promo_from <= promo_to)),
  CONSTRAINT watch_units_collab_holder CHECK ((status = 'with_collaborator') = (held_by_collaborator_id IS NOT NULL)),
  CONSTRAINT watch_units_location_required CHECK (status NOT IN ('in_stock','reserved','inspecting') OR location_id IS NOT NULL),
  CONSTRAINT watch_units_collab_no_location CHECK (status <> 'with_collaborator' OR location_id IS NULL),
  CONSTRAINT watch_units_serial_flag CHECK (has_serial OR serial_no IS NULL),
  CONSTRAINT watch_units_grade_for_sale CHECK (condition = 'new' OR status <> 'in_stock' OR condition_grade IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_watch_units_serial ON public.watch_units (brand_id, serial_norm) WHERE serial_norm IS NOT NULL AND status <> 'cancelled';
CREATE INDEX IF NOT EXISTS ix_watch_units_status ON public.watch_units (status);
CREATE INDEX IF NOT EXISTS ix_watch_units_model ON public.watch_units (model_id);
CREATE INDEX IF NOT EXISTS ix_watch_units_brand ON public.watch_units (brand_id);
CREATE INDEX IF NOT EXISTS ix_watch_units_location ON public.watch_units (location_id);
CREATE INDEX IF NOT EXISTS ix_watch_units_holder ON public.watch_units (held_by_collaborator_id);
CREATE INDEX IF NOT EXISTS ix_watch_units_search ON public.watch_units USING gin (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_watch_units_created_by ON public.watch_units (created_by);
CREATE INDEX IF NOT EXISTS ix_watch_units_updated_by ON public.watch_units (updated_by);

CREATE TABLE IF NOT EXISTS public.unit_accessories (
  id         uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  unit_id    uuid NOT NULL REFERENCES public.watch_units(id) ON DELETE RESTRICT,
  kind       text NOT NULL CHECK (kind IN ('box','papers','warranty_card','extra_strap','tool','other')),
  present    boolean NOT NULL DEFAULT true,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_unit_accessories_unit ON public.unit_accessories (unit_id);
CREATE INDEX IF NOT EXISTS ix_unit_accessories_created_by ON public.unit_accessories (created_by);

CREATE TABLE IF NOT EXISTS public.unit_cost_entries (
  id         uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  unit_id    uuid NOT NULL REFERENCES public.watch_units(id) ON DELETE RESTRICT,
  cycle      integer NOT NULL CHECK (cycle >= 1),
  kind       text NOT NULL CHECK (kind IN ('purchase','purchase_cost','repair_part','repair_other','other','adjustment')),
  amount_vnd bigint NOT NULL,
  ref_table  text,
  ref_id     uuid,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT unit_cost_entries_sign CHECK (amount_vnd >= 0 OR kind IN ('adjustment','purchase','purchase_cost'))
);
CREATE INDEX IF NOT EXISTS ix_unit_cost_entries_unit ON public.unit_cost_entries (unit_id, cycle);
CREATE INDEX IF NOT EXISTS ix_unit_cost_entries_created_by ON public.unit_cost_entries (created_by);
CREATE INDEX IF NOT EXISTS ix_unit_cost_entries_ref ON public.unit_cost_entries (ref_table, ref_id);

CREATE TABLE IF NOT EXISTS public.unit_status_history (
  id          uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  unit_id     uuid NOT NULL REFERENCES public.watch_units(id) ON DELETE RESTRICT,
  from_status text,
  to_status   text NOT NULL,
  at          timestamptz NOT NULL DEFAULT now(),
  actor_id    uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  reason      text,
  ref_table   text,
  ref_id      uuid
);
CREATE INDEX IF NOT EXISTS ix_unit_status_history_unit ON public.unit_status_history (unit_id, at);
CREATE INDEX IF NOT EXISTS ix_unit_status_history_actor ON public.unit_status_history (actor_id);

CREATE TABLE IF NOT EXISTS public.unit_price_history (
  id        uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  unit_id   uuid NOT NULL REFERENCES public.watch_units(id) ON DELETE RESTRICT,
  field     text NOT NULL CHECK (field IN ('list_price','promo_price','promo_range')),
  old_value text,
  new_value text,
  at        timestamptz NOT NULL DEFAULT now(),
  actor_id  uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  reason    text
);
CREATE INDEX IF NOT EXISTS ix_unit_price_history_unit ON public.unit_price_history (unit_id, at);
CREATE INDEX IF NOT EXISTS ix_unit_price_history_actor ON public.unit_price_history (actor_id);

CREATE TABLE IF NOT EXISTS public.unit_movements (
  id               uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  unit_id          uuid NOT NULL REFERENCES public.watch_units(id) ON DELETE RESTRICT,
  from_location_id uuid REFERENCES public.storage_locations(id) ON DELETE RESTRICT,
  to_location_id   uuid REFERENCES public.storage_locations(id) ON DELETE RESTRICT,
  at               timestamptz NOT NULL DEFAULT now(),
  actor_id         uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  note             text
);
CREATE INDEX IF NOT EXISTS ix_unit_movements_unit ON public.unit_movements (unit_id, at);
CREATE INDEX IF NOT EXISTS ix_unit_movements_from ON public.unit_movements (from_location_id);
CREATE INDEX IF NOT EXISTS ix_unit_movements_to ON public.unit_movements (to_location_id);
CREATE INDEX IF NOT EXISTS ix_unit_movements_actor ON public.unit_movements (actor_id);

-- ===== Linh kiện =====
CREATE TABLE IF NOT EXISTS public.part_categories (
  id         uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  name       text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  is_active  boolean NOT NULL DEFAULT true,
  version    integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_part_categories_name ON public.part_categories (lower(name));

CREATE TABLE IF NOT EXISTS public.parts (
  id             uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  code           text NOT NULL,
  name           text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 160),
  category_id    uuid NOT NULL REFERENCES public.part_categories(id) ON DELETE RESTRICT,
  uom            text NOT NULL DEFAULT 'cái' CHECK (char_length(uom) BETWEEN 1 AND 20),
  specs          text,
  sale_price_vnd bigint NOT NULL DEFAULT 0 CHECK (sale_price_vnd >= 0),
  reorder_level  integer NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  qty_on_hand    integer NOT NULL DEFAULT 0 CHECK (qty_on_hand >= 0),
  is_active      boolean NOT NULL DEFAULT true,
  search_text    text,
  version        integer NOT NULL DEFAULT 1,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid REFERENCES public.users(id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_parts_code ON public.parts (upper(code));
CREATE INDEX IF NOT EXISTS ix_parts_category ON public.parts (category_id);
CREATE INDEX IF NOT EXISTS ix_parts_search ON public.parts USING gin (search_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_parts_created_by ON public.parts (created_by);
CREATE INDEX IF NOT EXISTS ix_parts_updated_by ON public.parts (updated_by);

CREATE TABLE IF NOT EXISTS public.part_costs (
  part_id    uuid PRIMARY KEY REFERENCES public.parts(id) ON DELETE RESTRICT,
  avg_cost   numeric(14,4) NOT NULL DEFAULT 0 CHECK (avg_cost >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.part_compatibility (
  id         uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  part_id    uuid NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  brand_id   uuid NOT NULL REFERENCES public.brands(id) ON DELETE RESTRICT,
  model_id   uuid REFERENCES public.watch_models(id) ON DELETE RESTRICT,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_part_compat_part ON public.part_compatibility (part_id);
CREATE INDEX IF NOT EXISTS ix_part_compat_brand ON public.part_compatibility (brand_id);
CREATE INDEX IF NOT EXISTS ix_part_compat_model ON public.part_compatibility (model_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_part_compat ON public.part_compatibility (part_id, brand_id, coalesce(model_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE TABLE IF NOT EXISTS public.part_stock_movements (
  id        uuid PRIMARY KEY DEFAULT app.uuid_v7(),
  part_id   uuid NOT NULL REFERENCES public.parts(id) ON DELETE RESTRICT,
  qty_delta integer NOT NULL CHECK (qty_delta <> 0),
  unit_cost numeric(14,4) NOT NULL DEFAULT 0,
  kind      text NOT NULL CHECK (kind IN ('purchase','repair_use','repair_return','sale','sale_void','adjustment','stocktake','purchase_void','opening')),
  prev_qty  integer NOT NULL,
  prev_avg  numeric(14,4) NOT NULL,
  ref_table text,
  ref_id    uuid,
  reason    text,
  at        timestamptz NOT NULL DEFAULT now(),
  actor_id  uuid REFERENCES public.users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS ix_part_stock_movements_part ON public.part_stock_movements (part_id, at);
CREATE INDEX IF NOT EXISTS ix_part_stock_movements_actor ON public.part_stock_movements (actor_id);
CREATE INDEX IF NOT EXISTS ix_part_stock_movements_ref ON public.part_stock_movements (ref_table, ref_id);

-- ===== Sở hữu / RLS =====
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['brands','watch_models','storage_locations','watch_units','unit_accessories','unit_cost_entries',
    'unit_status_history','unit_price_history','unit_movements','part_categories','parts','part_costs','part_compatibility','part_stock_movements'] LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO wf_owner', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, wf_app, wf_auth, wf_worker, wf_api', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO wf_definer', t);
    EXECUTE format('GRANT SELECT ON public.%I TO wf_worker, wf_backup', t);
  END LOOP;
END $$;

-- Append-only (B6)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['unit_cost_entries','unit_status_history','unit_price_history','unit_movements','part_stock_movements'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s__immutable ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s__immutable BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.tg_immutable()', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s__no_truncate ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s__no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION app.tg_no_truncate()', t, t);
  END LOOP;
END $$;

-- Danh mục đơn giản: đọc theo quyền xem, ghi trực tiếp theo quyền quản lý (security-model §5)
GRANT SELECT ON public.brands, public.watch_models, public.storage_locations TO wf_app;
GRANT INSERT (name, country, created_by) ON public.brands TO wf_app;
GRANT UPDATE (name, country, is_active) ON public.brands TO wf_app;
GRANT INSERT (code, brand_id, name, reference_no, caliber, movement_type, case_size_mm, case_material, strap_type, dial_color, glass_type,
              water_resistance_m, gender, origin_country, specs, description, created_by) ON public.watch_models TO wf_app;
GRANT UPDATE (code, brand_id, name, reference_no, caliber, movement_type, case_size_mm, case_material, strap_type, dial_color, glass_type,
              water_resistance_m, gender, origin_country, specs, description, is_active) ON public.watch_models TO wf_app;
GRANT INSERT (name, kind, note, created_by) ON public.storage_locations TO wf_app;
GRANT UPDATE (name, kind, note, is_active) ON public.storage_locations TO wf_app;

DROP POLICY IF EXISTS brands_select ON public.brands;
CREATE POLICY brands_select ON public.brands FOR SELECT TO wf_app USING (app.has_any_permission(ARRAY['catalog.view','part.view','collab.view_own']));
DROP POLICY IF EXISTS brands_insert ON public.brands;
CREATE POLICY brands_insert ON public.brands FOR INSERT TO wf_app WITH CHECK (app.has_permission('catalog.manage') AND created_by = app.current_user_id());
DROP POLICY IF EXISTS brands_update ON public.brands;
CREATE POLICY brands_update ON public.brands FOR UPDATE TO wf_app USING (app.has_permission('catalog.manage')) WITH CHECK (true);

DROP POLICY IF EXISTS watch_models_select ON public.watch_models;
CREATE POLICY watch_models_select ON public.watch_models FOR SELECT TO wf_app USING (app.has_any_permission(ARRAY['catalog.view','part.view','collab.view_own']));
DROP POLICY IF EXISTS watch_models_insert ON public.watch_models;
CREATE POLICY watch_models_insert ON public.watch_models FOR INSERT TO wf_app WITH CHECK (app.has_permission('catalog.manage') AND created_by = app.current_user_id());
DROP POLICY IF EXISTS watch_models_update ON public.watch_models;
CREATE POLICY watch_models_update ON public.watch_models FOR UPDATE TO wf_app USING (app.has_permission('catalog.manage')) WITH CHECK (true);

DROP POLICY IF EXISTS storage_locations_select ON public.storage_locations;
CREATE POLICY storage_locations_select ON public.storage_locations FOR SELECT TO wf_app USING (app.has_any_permission(ARRAY['catalog.view','location.manage']));
DROP POLICY IF EXISTS storage_locations_insert ON public.storage_locations;
CREATE POLICY storage_locations_insert ON public.storage_locations FOR INSERT TO wf_app WITH CHECK (app.has_permission('location.manage') AND created_by = app.current_user_id());
DROP POLICY IF EXISTS storage_locations_update ON public.storage_locations;
CREATE POLICY storage_locations_update ON public.storage_locations FOR UPDATE TO wf_app USING (app.has_permission('location.manage')) WITH CHECK (true);

-- watch_units: đọc theo catalog.view (CTV: chỉ chiếc đang giữ — chi tiết qua v_units_collab ở M5b);
-- wf_app chỉ UPDATE các cột phi tài chính / phi trạng thái (B1, mass-assignment)
GRANT SELECT ON public.watch_units TO wf_app;
GRANT UPDATE (condition, condition_grade, condition_note, note, manufacturer_warranty_until) ON public.watch_units TO wf_app;
DROP POLICY IF EXISTS watch_units_select ON public.watch_units;
CREATE POLICY watch_units_select ON public.watch_units FOR SELECT TO wf_app
  USING (app.has_permission('catalog.view') OR (app.has_permission('collab.view_own') AND held_by_collaborator_id = app.current_user_id()));
DROP POLICY IF EXISTS watch_units_update ON public.watch_units;
CREATE POLICY watch_units_update ON public.watch_units FOR UPDATE TO wf_app
  USING (app.has_permission('catalog.manage') AND status NOT IN ('cancelled')) WITH CHECK (true);

GRANT SELECT ON public.unit_accessories TO wf_app;
GRANT INSERT (unit_id, kind, present, note, created_by) ON public.unit_accessories TO wf_app;
GRANT UPDATE (present, note) ON public.unit_accessories TO wf_app;
GRANT DELETE ON public.unit_accessories TO wf_app;
DROP POLICY IF EXISTS unit_accessories_select ON public.unit_accessories;
CREATE POLICY unit_accessories_select ON public.unit_accessories FOR SELECT TO wf_app
  USING (EXISTS (SELECT 1 FROM public.watch_units u WHERE u.id = unit_id));
DROP POLICY IF EXISTS unit_accessories_write ON public.unit_accessories;
CREATE POLICY unit_accessories_write ON public.unit_accessories FOR ALL TO wf_app
  USING (app.has_permission('catalog.manage')) WITH CHECK (app.has_permission('catalog.manage'));

-- Giá vốn: chỉ cost.view (BR-SEC-02)
GRANT SELECT ON public.unit_cost_entries TO wf_app;
DROP POLICY IF EXISTS unit_cost_entries_select ON public.unit_cost_entries;
CREATE POLICY unit_cost_entries_select ON public.unit_cost_entries FOR SELECT TO wf_app USING (app.has_permission('cost.view'));

GRANT SELECT ON public.unit_status_history, public.unit_price_history, public.unit_movements TO wf_app;
DROP POLICY IF EXISTS unit_status_history_select ON public.unit_status_history;
CREATE POLICY unit_status_history_select ON public.unit_status_history FOR SELECT TO wf_app USING (app.has_permission('catalog.view'));
DROP POLICY IF EXISTS unit_price_history_select ON public.unit_price_history;
CREATE POLICY unit_price_history_select ON public.unit_price_history FOR SELECT TO wf_app USING (app.has_permission('catalog.view'));
DROP POLICY IF EXISTS unit_movements_select ON public.unit_movements;
CREATE POLICY unit_movements_select ON public.unit_movements FOR SELECT TO wf_app USING (app.has_permission('catalog.view'));

-- Linh kiện
GRANT SELECT ON public.part_categories, public.parts, public.part_compatibility TO wf_app;
GRANT INSERT (name) ON public.part_categories TO wf_app;
GRANT UPDATE (name, is_active) ON public.part_categories TO wf_app;
GRANT INSERT (code, name, category_id, uom, specs, sale_price_vnd, reorder_level, created_by) ON public.parts TO wf_app;
GRANT UPDATE (code, name, category_id, uom, specs, sale_price_vnd, reorder_level, is_active) ON public.parts TO wf_app;
GRANT INSERT (part_id, brand_id, model_id, note), DELETE ON public.part_compatibility TO wf_app;
DROP POLICY IF EXISTS part_categories_select ON public.part_categories;
CREATE POLICY part_categories_select ON public.part_categories FOR SELECT TO wf_app USING (app.has_permission('part.view'));
DROP POLICY IF EXISTS part_categories_write ON public.part_categories;
CREATE POLICY part_categories_write ON public.part_categories FOR ALL TO wf_app USING (app.has_permission('part.manage')) WITH CHECK (app.has_permission('part.manage'));
DROP POLICY IF EXISTS parts_select ON public.parts;
CREATE POLICY parts_select ON public.parts FOR SELECT TO wf_app USING (app.has_permission('part.view'));
DROP POLICY IF EXISTS parts_insert ON public.parts;
CREATE POLICY parts_insert ON public.parts FOR INSERT TO wf_app WITH CHECK (app.has_permission('part.manage') AND created_by = app.current_user_id());
DROP POLICY IF EXISTS parts_update ON public.parts;
CREATE POLICY parts_update ON public.parts FOR UPDATE TO wf_app USING (app.has_permission('part.manage')) WITH CHECK (true);
DROP POLICY IF EXISTS part_compat_select ON public.part_compatibility;
CREATE POLICY part_compat_select ON public.part_compatibility FOR SELECT TO wf_app USING (app.has_permission('part.view'));
DROP POLICY IF EXISTS part_compat_write ON public.part_compatibility;
CREATE POLICY part_compat_write ON public.part_compatibility FOR ALL TO wf_app USING (app.has_permission('part.manage')) WITH CHECK (app.has_permission('part.manage'));

GRANT SELECT ON public.part_costs TO wf_app;
DROP POLICY IF EXISTS part_costs_select ON public.part_costs;
CREATE POLICY part_costs_select ON public.part_costs FOR SELECT TO wf_app USING (app.has_permission('cost.view'));

-- Lịch sử xuất nhập linh kiện: cột giá vốn (unit_cost, prev_avg) KHÔNG cấp cho wf_app — xem qua app.fn_part_movement_costs (cost.view)
GRANT SELECT (id, part_id, qty_delta, kind, prev_qty, ref_table, ref_id, reason, at, actor_id) ON public.part_stock_movements TO wf_app;
DROP POLICY IF EXISTS part_stock_movements_select ON public.part_stock_movements;
CREATE POLICY part_stock_movements_select ON public.part_stock_movements FOR SELECT TO wf_app
  USING (app.has_any_permission(ARRAY['part.manage','cost.view']));

-- ===== Trigger chung =====
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['brands','watch_models','storage_locations','watch_units','part_categories','parts'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s__updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s__updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.tg_updated_at()', t, t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['brands','watch_models','storage_locations','watch_units','unit_accessories','part_categories','parts','part_costs','part_compatibility'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s__audit ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s__audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.tg_audit()', t, t);
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS trg_watch_models__search ON public.watch_models;
CREATE TRIGGER trg_watch_models__search BEFORE INSERT OR UPDATE ON public.watch_models
  FOR EACH ROW EXECUTE FUNCTION app.tg_search_text('code', 'name', 'reference_no', 'caliber');
DROP TRIGGER IF EXISTS trg_parts__search ON public.parts;
CREATE TRIGGER trg_parts__search BEFORE INSERT OR UPDATE ON public.parts
  FOR EACH ROW EXECUTE FUNCTION app.tg_search_text('code', 'name', 'specs');

-- search_text của chiếc: mã nội bộ, serial, mã/tên loại, thương hiệu
CREATE OR REPLACE FUNCTION app.tg_unit_search() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE m record;
BEGIN
  SELECT wm.code, wm.name, wm.reference_no, b.name AS brand INTO m
  FROM public.watch_models wm JOIN public.brands b ON b.id = wm.brand_id WHERE wm.id = NEW.model_id;
  NEW.brand_id := (SELECT brand_id FROM public.watch_models WHERE id = NEW.model_id);
  NEW.search_text := app.norm_text(concat_ws(' ', NEW.asset_code, NEW.serial_no, NEW.serial_norm, m.code, m.name, m.reference_no, m.brand));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_watch_units__search ON public.watch_units;
CREATE TRIGGER trg_watch_units__search BEFORE INSERT OR UPDATE OF model_id, serial_no, asset_code ON public.watch_units
  FOR EACH ROW EXECUTE FUNCTION app.tg_unit_search();

-- Đổi tên loại/thương hiệu ⇒ cập nhật search_text các chiếc
CREATE OR REPLACE FUNCTION app.tg_model_refresh_units() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME = 'watch_models' THEN
    UPDATE public.watch_units SET model_id = model_id WHERE model_id = NEW.id;
  ELSIF TG_TABLE_NAME = 'brands' THEN
    UPDATE public.watch_units SET model_id = model_id WHERE brand_id = NEW.id;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_watch_models__refresh_units ON public.watch_models;
CREATE TRIGGER trg_watch_models__refresh_units AFTER UPDATE OF name, code, reference_no, brand_id ON public.watch_models
  FOR EACH ROW EXECUTE FUNCTION app.tg_model_refresh_units();
DROP TRIGGER IF EXISTS trg_brands__refresh_units ON public.brands;
CREATE TRIGGER trg_brands__refresh_units AFTER UPDATE OF name ON public.brands
  FOR EACH ROW EXECUTE FUNCTION app.tg_model_refresh_units();

-- part_costs tự tạo khi thêm linh kiện
CREATE OR REPLACE FUNCTION app.tg_part_cost_row() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  INSERT INTO public.part_costs (part_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_parts__cost_row ON public.parts;
CREATE TRIGGER trg_parts__cost_row AFTER INSERT ON public.parts FOR EACH ROW EXECUTE FUNCTION app.tg_part_cost_row();

-- qty_on_hand chỉ đổi trong fn_* (cờ app.in_fn) — lớp phòng thủ thứ hai (wf_app vốn không có quyền UPDATE cột này)
CREATE OR REPLACE FUNCTION app.tg_part_qty_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.qty_on_hand IS DISTINCT FROM OLD.qty_on_hand AND coalesce(current_setting('app.in_fn', true), '') <> 'on' THEN
    PERFORM app.raise_wf('WF-IMMUTABLE', 'Tồn linh kiện chỉ thay đổi qua phiếu nhập/sửa/bán/điều chỉnh.');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_parts__qty_guard ON public.parts;
CREATE TRIGGER trg_parts__qty_guard BEFORE UPDATE OF qty_on_hand ON public.parts FOR EACH ROW EXECUTE FUNCTION app.tg_part_qty_guard();

-- ===== Ma trận trạng thái chiếc (state-machines §1) =====
CREATE OR REPLACE FUNCTION app.unit_transition_allowed(p_from text, p_to text) RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT (p_from, p_to) IN (
    ('in_stock','reserved'), ('reserved','in_stock'), ('in_stock','sold'), ('reserved','sold'),
    ('in_stock','with_collaborator'), ('with_collaborator','in_stock'), ('with_collaborator','sold'), ('sold','with_collaborator'),
    ('sold','in_stock'), ('sold','inspecting'), ('inspecting','in_stock'),
    ('in_stock','in_repair'), ('inspecting','in_repair'), ('in_repair','in_stock'), ('in_repair','inspecting'),
    ('in_stock','written_off'), ('inspecting','written_off'), ('in_repair','written_off'), ('with_collaborator','written_off'),
    ('written_off','in_stock'), ('in_stock','cancelled'), ('inspecting','cancelled'))
$$;

-- Bảo vệ cột trạng thái (B1): chỉ trong fn_* + đúng ma trận; ghi unit_status_history; cập nhật stock_since
CREATE OR REPLACE FUNCTION app.tg_unit_status_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF coalesce(current_setting('app.in_fn', true), '') <> 'on' AND current_setting('app.seed', true) IS DISTINCT FROM 'on' THEN
      PERFORM app.raise_wf('WF-UNIT-INVALID-TRANSITION', 'Chiếc đồng hồ chỉ được tạo khi xác nhận phiếu nhập.');
    END IF;
    IF NEW.status = 'in_stock' THEN NEW.stock_since := coalesce(NEW.stock_since, app.today_vn()); END IF;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.held_by_collaborator_id IS DISTINCT FROM OLD.held_by_collaborator_id
     OR NEW.cost_cycle IS DISTINCT FROM OLD.cost_cycle OR NEW.list_price_vnd IS DISTINCT FROM OLD.list_price_vnd
     OR NEW.promo_price_vnd IS DISTINCT FROM OLD.promo_price_vnd OR NEW.location_id IS DISTINCT FROM OLD.location_id
     OR NEW.asset_code IS DISTINCT FROM OLD.asset_code OR NEW.model_id IS DISTINCT FROM OLD.model_id OR NEW.serial_no IS DISTINCT FROM OLD.serial_no THEN
    IF coalesce(current_setting('app.in_fn', true), '') <> 'on' THEN
      PERFORM app.raise_wf('WF-UNIT-INVALID-TRANSITION', 'Thông tin này của chiếc đồng hồ chỉ đổi qua nghiệp vụ (nhập, bán, giao CTV, sửa giá…).');
    END IF;
  END IF;
  IF NEW.asset_code IS DISTINCT FROM OLD.asset_code THEN
    PERFORM app.raise_wf('WF-IMMUTABLE', 'Mã nội bộ không được thay đổi.');
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT app.unit_transition_allowed(OLD.status, NEW.status) THEN
      PERFORM app.raise_wf('WF-UNIT-INVALID-TRANSITION', format('Không thể chuyển chiếc %s từ "%s" sang "%s".', OLD.asset_code, OLD.status, NEW.status));
    END IF;
    IF NEW.status = 'in_stock' THEN NEW.stock_since := app.today_vn(); END IF;
    INSERT INTO public.unit_status_history (unit_id, from_status, to_status, actor_id, reason, ref_table, ref_id)
    VALUES (NEW.id, OLD.status, NEW.status, app.current_user_id(), nullif(current_setting('app.status_reason', true), ''),
            nullif(current_setting('app.status_ref_table', true), ''), nullif(current_setting('app.status_ref_id', true), '')::uuid);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_watch_units__status_guard ON public.watch_units;
CREATE TRIGGER trg_watch_units__status_guard BEFORE INSERT OR UPDATE ON public.watch_units FOR EACH ROW EXECUTE FUNCTION app.tg_unit_status_guard();

-- Lịch sử trạng thái ban đầu khi tạo chiếc
CREATE OR REPLACE FUNCTION app.tg_unit_initial_history() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  INSERT INTO public.unit_status_history (unit_id, from_status, to_status, actor_id, reason, ref_table, ref_id)
  VALUES (NEW.id, NULL, NEW.status, app.current_user_id(), nullif(current_setting('app.status_reason', true), ''),
          nullif(current_setting('app.status_ref_table', true), ''), nullif(current_setting('app.status_ref_id', true), '')::uuid);
  PERFORM app.fn_emit_event('unit.created', jsonb_build_object('unitId', NEW.id, 'assetCode', NEW.asset_code));
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_watch_units__initial_history ON public.watch_units;
CREATE TRIGGER trg_watch_units__initial_history AFTER INSERT ON public.watch_units FOR EACH ROW EXECUTE FUNCTION app.tg_unit_initial_history();

-- Đổi trạng thái chiếc trong fn_* (caller đã khóa FOR UPDATE). Ghi lý do/chứng từ nguồn vào lịch sử qua biến phiên.
CREATE OR REPLACE FUNCTION app.set_unit_status(p_unit uuid, p_to text, p_reason text, p_ref_table text, p_ref_id uuid,
                                               p_location uuid DEFAULT NULL, p_holder uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE v_from text;
BEGIN
  PERFORM set_config('app.in_fn', 'on', true);
  PERFORM set_config('app.status_reason', coalesce(p_reason, ''), true);
  PERFORM set_config('app.status_ref_table', coalesce(p_ref_table, ''), true);
  PERFORM set_config('app.status_ref_id', coalesce(p_ref_id::text, ''), true);
  SELECT status INTO v_from FROM public.watch_units WHERE id = p_unit;
  UPDATE public.watch_units SET status = p_to,
    held_by_collaborator_id = CASE WHEN p_to = 'with_collaborator' THEN p_holder ELSE NULL END,
    location_id = CASE WHEN p_to = 'with_collaborator' THEN NULL WHEN p_location IS NOT NULL THEN p_location ELSE location_id END
  WHERE id = p_unit;
  PERFORM app.fn_emit_event('unit.status_changed', jsonb_build_object('unitId', p_unit, 'from', v_from, 'to', p_to));
  PERFORM set_config('app.status_reason', '', true);
  PERFORM set_config('app.status_ref_table', '', true);
  PERFORM set_config('app.status_ref_id', '', true);
END $$;

-- Giá hiệu lực (BR-UNIT-05)
CREATE OR REPLACE FUNCTION app.unit_effective_price(p_list bigint, p_promo bigint, p_from date, p_to date, p_day date DEFAULT NULL) RETURNS bigint
LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p_promo IS NOT NULL AND coalesce(p_day, app.today_vn()) BETWEEN p_from AND p_to THEN p_promo ELSE p_list END
$$;

-- ===== Hàm nghiệp vụ =====
-- Khóa chiếc + kiểm phiên bản (khóa lạc quan khi có)
CREATE OR REPLACE FUNCTION app.lock_unit(p_unit uuid, p_version int DEFAULT NULL) RETURNS public.watch_units
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE u public.watch_units;
BEGIN
  SELECT * INTO u FROM public.watch_units WHERE id = p_unit FOR UPDATE;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy chiếc đồng hồ.'); END IF;
  IF p_version IS NOT NULL AND u.version <> p_version THEN
    PERFORM app.raise_wf('WF-CONFLICT-VERSION', 'Chiếc đồng hồ vừa được người khác cập nhật. Hãy tải lại.');
  END IF;
  RETURN u;
END $$;

CREATE OR REPLACE FUNCTION app.fn_set_unit_price(p_unit uuid, p_list bigint, p_promo bigint, p_promo_from date, p_promo_to date,
                                                 p_reason text, p_version int DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE u public.watch_units;
BEGIN
  PERFORM app.require_permission('unit.price.edit');
  SET LOCAL lock_timeout = '5s';
  u := app.lock_unit(p_unit, p_version);
  IF u.status IN ('sold','cancelled','written_off') THEN
    PERFORM app.raise_wf('WF-UNIT-INVALID-TRANSITION', 'Không sửa giá chiếc đã bán/đã hủy/đã thanh lý.');
  END IF;
  IF p_list IS NULL OR p_list < 0 THEN PERFORM app.raise_wf('WF-VALIDATION', 'Giá niêm yết không hợp lệ.'); END IF;
  IF p_promo IS NOT NULL AND (p_promo_from IS NULL OR p_promo_to IS NULL OR p_promo_from > p_promo_to OR p_promo > p_list) THEN
    PERFORM app.raise_wf('WF-VALIDATION', 'Khuyến mãi cần giá ≤ giá niêm yết và khoảng ngày hợp lệ.');
  END IF;
  PERFORM set_config('app.in_fn', 'on', true);
  UPDATE public.watch_units SET list_price_vnd = p_list, promo_price_vnd = p_promo,
    promo_from = CASE WHEN p_promo IS NULL THEN NULL ELSE p_promo_from END, promo_to = CASE WHEN p_promo IS NULL THEN NULL ELSE p_promo_to END
  WHERE id = p_unit;
  IF u.list_price_vnd IS DISTINCT FROM p_list THEN
    INSERT INTO public.unit_price_history (unit_id, field, old_value, new_value, actor_id, reason) VALUES (p_unit, 'list_price', u.list_price_vnd::text, p_list::text, app.current_user_id(), p_reason);
  END IF;
  IF u.promo_price_vnd IS DISTINCT FROM p_promo THEN
    INSERT INTO public.unit_price_history (unit_id, field, old_value, new_value, actor_id, reason) VALUES (p_unit, 'promo_price', u.promo_price_vnd::text, p_promo::text, app.current_user_id(), p_reason);
  END IF;
  IF (u.promo_from, u.promo_to) IS DISTINCT FROM (CASE WHEN p_promo IS NULL THEN NULL ELSE p_promo_from END, CASE WHEN p_promo IS NULL THEN NULL ELSE p_promo_to END) THEN
    INSERT INTO public.unit_price_history (unit_id, field, old_value, new_value, actor_id, reason)
    VALUES (p_unit, 'promo_range', concat_ws('→', u.promo_from, u.promo_to), concat_ws('→', p_promo_from, p_promo_to), app.current_user_id(), p_reason);
  END IF;
  RETURN jsonb_build_object('id', p_unit);
END $$;

CREATE OR REPLACE FUNCTION app.fn_move_unit(p_unit uuid, p_location uuid, p_note text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE u public.watch_units;
BEGIN
  PERFORM app.require_permission('location.manage');
  SET LOCAL lock_timeout = '5s';
  u := app.lock_unit(p_unit);
  IF u.status NOT IN ('in_stock','reserved','inspecting','in_repair') THEN
    PERFORM app.raise_wf('WF-UNIT-INVALID-TRANSITION', 'Chỉ đổi vị trí chiếc đang ở kho cửa hàng.');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.storage_locations WHERE id = p_location AND is_active) THEN
    PERFORM app.raise_wf('WF-VALIDATION', 'Vị trí không tồn tại hoặc đã ngừng dùng.');
  END IF;
  IF u.location_id IS NOT DISTINCT FROM p_location THEN RETURN jsonb_build_object('id', p_unit, 'unchanged', true); END IF;
  PERFORM set_config('app.in_fn', 'on', true);
  UPDATE public.watch_units SET location_id = p_location WHERE id = p_unit;
  INSERT INTO public.unit_movements (unit_id, from_location_id, to_location_id, actor_id, note) VALUES (p_unit, u.location_id, p_location, app.current_user_id(), p_note);
  RETURN jsonb_build_object('id', p_unit);
END $$;

-- inspecting → in_stock (BR-UNIT-10: hàng cũ cần hạng + ≥ 1 ảnh tình trạng)
CREATE OR REPLACE FUNCTION app.fn_release_unit(p_unit uuid, p_note text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE u public.watch_units;
BEGIN
  PERFORM app.require_permission('unit.release');
  SET LOCAL lock_timeout = '5s';
  u := app.lock_unit(p_unit);
  IF u.status <> 'inspecting' THEN PERFORM app.raise_wf('WF-UNIT-INVALID-TRANSITION', 'Chỉ chiếc đang "Chờ kiểm tra" mới chuyển sang sẵn sàng bán.'); END IF;
  IF u.condition <> 'new' THEN
    IF u.condition_grade IS NULL THEN PERFORM app.raise_wf('WF-UNIT-GRADE-REQUIRED', 'Hàng cũ/đã sửa cần ghi hạng tình trạng (A/B/C hoặc % mới) trước khi bán.'); END IF;
    IF NOT EXISTS (SELECT 1 FROM public.files f WHERE f.entity_table = 'watch_units' AND f.entity_id = p_unit AND f.kind IN ('condition','product') AND NOT f.is_deleted) THEN
      PERFORM app.raise_wf('WF-UNIT-PHOTO-REQUIRED', 'Hàng cũ/đã sửa cần ít nhất một ảnh tình trạng trước khi bán.');
    END IF;
  END IF;
  PERFORM app.set_unit_status(p_unit, 'in_stock', coalesce(nullif(btrim(p_note), ''), 'Kiểm tra đạt'), NULL, NULL);
  RETURN jsonb_build_object('id', p_unit, 'status', 'in_stock');
END $$;

-- Ghi mất/thanh lý (lý do ≥ 10 ký tự). Từ with_collaborator cần thêm collab.manage (M5b đóng dòng phiếu giao).
CREATE OR REPLACE FUNCTION app.fn_writeoff_unit(p_unit uuid, p_reason text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE u public.watch_units; v_reason text;
BEGIN
  PERFORM app.require_permission('stock.writeoff');
  v_reason := app.require_reason(p_reason);
  SET LOCAL lock_timeout = '5s';
  u := app.lock_unit(p_unit);
  IF u.status = 'with_collaborator' THEN PERFORM app.require_permission('collab.manage'); END IF;
  IF u.status NOT IN ('in_stock','inspecting','in_repair','with_collaborator') THEN
    PERFORM app.raise_wf('WF-UNIT-INVALID-TRANSITION', 'Không thể ghi mất/thanh lý chiếc ở trạng thái hiện tại (đang giữ hàng phải hủy giữ trước; đã bán thì dùng bảo hành).');
  END IF;
  PERFORM app.set_unit_status(p_unit, 'written_off', v_reason, NULL, NULL);
  PERFORM app.fn_audit_event('unit.written_off', 'watch_units', p_unit::text, jsonb_build_object('status', u.status), jsonb_build_object('status', 'written_off'), v_reason, 'high');
  RETURN jsonb_build_object('id', p_unit, 'status', 'written_off');
END $$;

CREATE OR REPLACE FUNCTION app.fn_restore_unit(p_unit uuid, p_location uuid, p_reason text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE u public.watch_units; v_reason text;
BEGIN
  PERFORM app.require_permission('stock.writeoff');
  v_reason := app.require_reason(p_reason);
  SET LOCAL lock_timeout = '5s';
  u := app.lock_unit(p_unit);
  IF u.status <> 'written_off' THEN PERFORM app.raise_wf('WF-UNIT-INVALID-TRANSITION', 'Chỉ khôi phục chiếc đã ghi mất/thanh lý.'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.storage_locations WHERE id = p_location AND is_active) THEN
    PERFORM app.raise_wf('WF-VALIDATION', 'Chọn vị trí lưu kho cho chiếc tìm lại.');
  END IF;
  IF u.condition <> 'new' AND u.condition_grade IS NULL THEN
    PERFORM app.raise_wf('WF-UNIT-GRADE-REQUIRED', 'Hàng cũ/đã sửa cần ghi hạng tình trạng trước khi đưa lại vào kho.');
  END IF;
  PERFORM app.set_unit_status(p_unit, 'in_stock', v_reason, NULL, NULL, p_location);
  PERFORM app.fn_audit_event('unit.restored', 'watch_units', p_unit::text, NULL, jsonb_build_object('location', p_location), v_reason, 'high');
  RETURN jsonb_build_object('id', p_unit, 'status', 'in_stock');
END $$;

-- Sửa loại/serial (BR-UNIT-06): chiếc đã bán cần lý do; luôn audit
CREATE OR REPLACE FUNCTION app.fn_update_unit_identity(p_unit uuid, p_model uuid, p_serial text, p_has_serial boolean, p_reason text, p_version int DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE u public.watch_units; v_reason text := nullif(btrim(coalesce(p_reason, '')), ''); v_brand uuid;
BEGIN
  PERFORM app.require_permission('catalog.manage');
  SET LOCAL lock_timeout = '5s';
  u := app.lock_unit(p_unit, p_version);
  IF u.status = 'cancelled' THEN PERFORM app.raise_wf('WF-UNIT-INVALID-TRANSITION', 'Chiếc đã hủy (nhập nhầm) không sửa được.'); END IF;
  IF u.status = 'sold' THEN v_reason := app.require_reason(p_reason); END IF;
  SELECT brand_id INTO v_brand FROM public.watch_models WHERE id = p_model;
  IF v_brand IS NULL THEN PERFORM app.raise_wf('WF-VALIDATION', 'Loại đồng hồ không tồn tại.'); END IF;
  IF coalesce(p_has_serial, true) AND app.norm_serial(p_serial) IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.watch_units w WHERE w.brand_id = v_brand AND w.serial_norm = app.norm_serial(p_serial) AND w.status <> 'cancelled' AND w.id <> p_unit) THEN
    PERFORM app.raise_wf('WF-UNIT-SERIAL-DUPLICATE', 'Serial này đã có ở chiếc khác cùng thương hiệu.');
  END IF;
  PERFORM set_config('app.in_fn', 'on', true);
  UPDATE public.watch_units SET model_id = p_model, has_serial = coalesce(p_has_serial, true),
    serial_no = CASE WHEN coalesce(p_has_serial, true) THEN nullif(btrim(p_serial), '') ELSE NULL END
  WHERE id = p_unit;
  PERFORM app.fn_audit_event('unit.identity_changed', 'watch_units', p_unit::text,
    jsonb_build_object('model_id', u.model_id, 'serial_no', u.serial_no), jsonb_build_object('model_id', p_model, 'serial_no', p_serial), v_reason, 'high');
  RETURN jsonb_build_object('id', p_unit);
END $$;

-- Điều chỉnh tồn linh kiện (BR-PART-05): lý do bắt buộc; movement; avg giữ nguyên (costing §4)
CREATE OR REPLACE FUNCTION app.fn_adjust_part_stock(p_part uuid, p_delta int, p_reason text, p_kind text DEFAULT 'adjustment') RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
DECLARE p record; v_avg numeric(14,4); v_reason text;
BEGIN
  PERFORM app.require_permission('part.stock.adjust');
  v_reason := app.require_reason(p_reason);
  IF p_delta IS NULL OR p_delta = 0 THEN PERFORM app.raise_wf('WF-VALIDATION', 'Số lượng điều chỉnh phải khác 0.'); END IF;
  IF p_kind NOT IN ('adjustment','stocktake') THEN PERFORM app.raise_wf('WF-VALIDATION', 'Loại điều chỉnh không hợp lệ.'); END IF;
  SET LOCAL lock_timeout = '5s';
  SELECT id, code, qty_on_hand INTO p FROM public.parts WHERE id = p_part FOR UPDATE;
  IF NOT FOUND THEN PERFORM app.raise_wf('WF-NOT-FOUND', 'Không tìm thấy linh kiện.'); END IF;
  IF p.qty_on_hand + p_delta < 0 THEN
    PERFORM app.raise_wf('WF-SALE-STOCK-INSUFFICIENT', format('Linh kiện %s chỉ còn %s, không thể giảm %s.', p.code, p.qty_on_hand, -p_delta));
  END IF;
  SELECT avg_cost INTO v_avg FROM public.part_costs WHERE part_id = p_part;
  PERFORM set_config('app.in_fn', 'on', true);
  UPDATE public.parts SET qty_on_hand = qty_on_hand + p_delta WHERE id = p_part;
  INSERT INTO public.part_stock_movements (part_id, qty_delta, unit_cost, kind, prev_qty, prev_avg, reason, actor_id)
  VALUES (p_part, p_delta, coalesce(v_avg, 0), p_kind, p.qty_on_hand, coalesce(v_avg, 0), v_reason, app.current_user_id());
  PERFORM app.fn_audit_event('part.stock_adjusted', 'parts', p_part::text, jsonb_build_object('qty', p.qty_on_hand), jsonb_build_object('qty', p.qty_on_hand + p_delta), v_reason);
  IF p.qty_on_hand + p_delta <= (SELECT reorder_level FROM public.parts WHERE id = p_part) THEN
    PERFORM app.fn_emit_event('part.low_stock', jsonb_build_object('partId', p_part));
  END IF;
  RETURN jsonb_build_object('id', p_part, 'qtyOnHand', p.qty_on_hand + p_delta);
END $$;

-- Lịch sử xuất nhập linh kiện kèm giá vốn (chỉ cost.view)
CREATE OR REPLACE FUNCTION app.fn_part_movement_costs(p_part uuid) RETURNS TABLE (id uuid, unit_cost numeric, prev_avg numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app, pg_temp AS $$
BEGIN
  PERFORM app.require_permission('cost.view');
  RETURN QUERY SELECT m.id, m.unit_cost, m.prev_avg FROM public.part_stock_movements m WHERE m.part_id = p_part;
END $$;

-- ===== View (security_invoker ⇒ RLS của người gọi) =====
CREATE OR REPLACE VIEW public.v_stock_units WITH (security_invoker = true) AS
  SELECT u.* FROM public.watch_units u WHERE u.status IN ('in_stock','reserved','with_collaborator','in_repair','inspecting');

CREATE OR REPLACE VIEW public.v_unit_aging WITH (security_invoker = true) AS
  SELECT u.id, u.asset_code, u.model_id, u.brand_id, u.stock_since, (app.today_vn() - u.stock_since) AS days_in_stock,
         (app.today_vn() - u.stock_since) > app.setting_int('inventory.aging_days', 90) AS is_aging
  FROM public.watch_units u WHERE u.status = 'in_stock' AND u.stock_since IS NOT NULL;

-- Giá vốn chu kỳ hiện hành (RLS unit_cost_entries ⇒ chỉ cost.view thấy dòng)
CREATE OR REPLACE VIEW public.v_unit_costs WITH (security_invoker = true) AS
  SELECT e.unit_id, sum(e.amount_vnd)::bigint AS cost_vnd
  FROM public.unit_cost_entries e JOIN public.watch_units u ON u.id = e.unit_id AND e.cycle = u.cost_cycle
  GROUP BY e.unit_id;

CREATE OR REPLACE VIEW public.v_part_low_stock WITH (security_invoker = true) AS
  SELECT p.id, p.code, p.name, p.qty_on_hand, p.reorder_level FROM public.parts p WHERE p.is_active AND p.qty_on_hand <= p.reorder_level;

ALTER VIEW public.v_stock_units OWNER TO wf_owner;
ALTER VIEW public.v_unit_aging OWNER TO wf_owner;
ALTER VIEW public.v_unit_costs OWNER TO wf_owner;
ALTER VIEW public.v_part_low_stock OWNER TO wf_owner;
REVOKE ALL ON public.v_stock_units, public.v_unit_aging, public.v_unit_costs, public.v_part_low_stock FROM PUBLIC;
GRANT SELECT ON public.v_stock_units, public.v_unit_aging, public.v_unit_costs, public.v_part_low_stock TO wf_app, wf_worker, wf_backup;

-- ===== Sở hữu / EXECUTE hàm =====
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['app.tg_unit_search()','app.tg_model_refresh_units()','app.tg_part_cost_row()','app.tg_unit_status_guard()',
    'app.tg_unit_initial_history()','app.set_unit_status(uuid,text,text,text,uuid,uuid,uuid)','app.lock_unit(uuid,int)',
    'app.fn_set_unit_price(uuid,bigint,bigint,date,date,text,int)','app.fn_move_unit(uuid,uuid,text)','app.fn_release_unit(uuid,text)',
    'app.fn_writeoff_unit(uuid,text)','app.fn_restore_unit(uuid,uuid,text)','app.fn_update_unit_identity(uuid,uuid,text,boolean,text,int)',
    'app.fn_adjust_part_stock(uuid,int,text,text)','app.fn_part_movement_costs(uuid)'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO wf_definer', f);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['app.unit_transition_allowed(text,text)','app.unit_effective_price(bigint,bigint,date,date,date)','app.tg_part_qty_guard()'] LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO wf_owner', f);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO wf_app, wf_worker, wf_definer', f);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION app.tg_unit_search(), app.tg_model_refresh_units(), app.tg_part_cost_row(), app.tg_unit_status_guard(),
  app.tg_unit_initial_history() TO wf_app, wf_worker, wf_definer;
GRANT EXECUTE ON FUNCTION app.set_unit_status(uuid,text,text,text,uuid,uuid,uuid), app.lock_unit(uuid,int) TO wf_definer;
GRANT EXECUTE ON FUNCTION app.fn_set_unit_price(uuid,bigint,bigint,date,date,text,int), app.fn_move_unit(uuid,uuid,text),
  app.fn_release_unit(uuid,text), app.fn_writeoff_unit(uuid,text), app.fn_restore_unit(uuid,uuid,text),
  app.fn_update_unit_identity(uuid,uuid,text,boolean,text,int), app.fn_adjust_part_stock(uuid,int,text,text),
  app.fn_part_movement_costs(uuid) TO wf_app;

-- ===== Dữ liệu tham chiếu =====
INSERT INTO public.part_categories (name) VALUES ('Kim'), ('Núm'), ('Ron'), ('Kính sapphire'), ('Dây'), ('Chốt'), ('Bộ máy'), ('Pin'), ('Khác')
ON CONFLICT DO NOTHING;

COMMIT;
