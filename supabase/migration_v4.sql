-- =============================================
-- MIGRATION V4: AJUSTES DE INVENTARIO + KARDEX + FINANZAS
-- Ejecutar DESPUÉS de migration_v3.sql
-- =============================================

-- ==========================================
-- 1. TABLA: inventory_adjustments
-- ==========================================
-- Drop en caso de que haya quedado con schema incorrecto de ejecución anterior
DROP TABLE IF EXISTS inventory_adjustments CASCADE;

CREATE TABLE inventory_adjustments (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    delta_qty    INTEGER NOT NULL,          -- positivo=entrada, negativo=salida
    reason       TEXT NOT NULL,
    notes        TEXT,
    adjusted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   UUID
);

CREATE INDEX idx_inv_adj_product ON inventory_adjustments(product_id);
CREATE INDEX idx_inv_adj_date    ON inventory_adjustments(adjusted_at DESC);

ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated adjustments" ON inventory_adjustments;
CREATE POLICY "Allow authenticated adjustments" ON inventory_adjustments
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON inventory_adjustments TO authenticated;

-- ==========================================
-- 2. RPC: create_inventory_adjustment
-- ==========================================
CREATE OR REPLACE FUNCTION create_inventory_adjustment(
    p_product_id  UUID,
    p_delta_qty   INTEGER,
    p_reason      TEXT,
    p_notes       TEXT DEFAULT NULL,
    p_adjusted_at TIMESTAMPTZ DEFAULT NOW(),
    p_created_by  UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_adj_id       UUID;
    v_curr_stock   INTEGER;
    v_new_stock    INTEGER;
BEGIN
    -- Lock product row
    SELECT current_stock INTO v_curr_stock
    FROM products WHERE id = p_product_id FOR UPDATE;

    IF v_curr_stock IS NULL THEN
        RAISE EXCEPTION 'Producto no encontrado.';
    END IF;
    IF p_delta_qty = 0 THEN
        RAISE EXCEPTION 'La cantidad del ajuste no puede ser 0.';
    END IF;

    v_new_stock := v_curr_stock + p_delta_qty;
    IF v_new_stock < 0 THEN
        RAISE EXCEPTION 'Stock insuficiente. Stock actual: %, ajuste solicitado: %', v_curr_stock, p_delta_qty;
    END IF;

    -- Update product stock
    UPDATE products
    SET current_stock = v_new_stock, updated_at = NOW()
    WHERE id = p_product_id;

    -- Insert audit record
    INSERT INTO inventory_adjustments (product_id, delta_qty, reason, notes, adjusted_at, created_by)
    VALUES (p_product_id, p_delta_qty, p_reason, p_notes, p_adjusted_at, p_created_by)
    RETURNING id INTO v_adj_id;

    RETURN v_adj_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_inventory_adjustment(UUID, INTEGER, TEXT, TEXT, TIMESTAMPTZ, UUID) TO authenticated;

-- ==========================================
-- 3. RPC: get_product_movements
-- Unifica batches + sales + adjustments + voided sales
-- ==========================================
CREATE OR REPLACE FUNCTION get_product_movements(
    p_product_id UUID,
    p_from       TIMESTAMPTZ DEFAULT '2000-01-01',
    p_to         TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSONB AS $$
DECLARE
    result JSONB := '[]'::JSONB;
BEGIN
    -- Inventory batches (entradas de compra)
    SELECT COALESCE(jsonb_agg(row ORDER BY row->>'moved_at' DESC), '[]')
    INTO result
    FROM (
        SELECT jsonb_build_object(
            'id',       id,
            'type',     'batch',
            'label',    'Ingreso de lote',
            'qty',      quantity_in,
            'detail',   COALESCE('Proveedor: ' || supplier, 'Sin proveedor'),
            'moved_at', purchased_at,
            'ref',      id
        ) AS row
        FROM inventory_batches
        WHERE product_id = p_product_id
          AND purchased_at::TIMESTAMPTZ BETWEEN p_from AND p_to
        UNION ALL
        -- Sales (salidas por ventas)
        SELECT jsonb_build_object(
            'id',       s.id || '-' || items->>'product_id',
            'type',     'sale',
            'label',    CASE WHEN s.is_voided THEN 'Venta (anulada)' ELSE 'Venta' END,
            'qty',      -((items->>'qty')::INTEGER),
            'detail',   COALESCE(s.notes, 'Venta ' || s.sale_type),
            'moved_at', s.sold_at,
            'ref',      s.id
        ) AS row
        FROM sales s,
             jsonb_array_elements(s.items) AS items
        WHERE (items->>'product_id')::UUID = p_product_id
          AND s.sold_at BETWEEN p_from AND p_to
        UNION ALL
        -- Adjustments
        SELECT jsonb_build_object(
            'id',       id,
            'type',     'adjustment',
            'label',    CASE WHEN delta_qty > 0 THEN 'Ajuste entrada' ELSE 'Ajuste salida' END,
            'qty',      delta_qty,
            'detail',   reason || COALESCE(': ' || notes, ''),
            'moved_at', adjusted_at,
            'ref',      id
        ) AS row
        FROM inventory_adjustments
        WHERE product_id = p_product_id
          AND adjusted_at BETWEEN p_from AND p_to
    ) sub;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_product_movements(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ==========================================
-- 4. RPC: get_finance_summary
-- ==========================================
CREATE OR REPLACE FUNCTION get_finance_summary(
    p_from TIMESTAMPTZ DEFAULT '2000-01-01',
    p_to   TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSONB AS $$
DECLARE
    methods      TEXT[] := ARRAY['cash','nequi','bancolombia','daviplata'];
    m            TEXT;
    v_income     NUMERIC;
    v_expenses   NUMERIC;
    v_rows       JSONB := '[]'::JSONB;
    v_row        JSONB;
    v_total_in   NUMERIC := 0;
    v_total_out  NUMERIC := 0;

    -- Movements feed
    v_movements  JSONB;
BEGIN
    FOREACH m IN ARRAY methods LOOP
        -- Ingresos: ventas contado + abonos a crédito
        SELECT COALESCE(SUM(total_cop), 0) INTO v_income
        FROM sales
        WHERE payment_method = m
          AND sale_type = 'contado'
          AND is_voided = false
          AND sold_at BETWEEN p_from AND p_to;

        SELECT v_income + COALESCE(SUM(amount_cop), 0) INTO v_income
        FROM credit_payments
        WHERE payment_method = m
          AND paid_at BETWEEN p_from AND p_to;

        -- Egresos: gastos
        SELECT COALESCE(SUM(amount_cop), 0) INTO v_expenses
        FROM expenses
        WHERE payment_method = m
          AND spent_at BETWEEN p_from AND p_to;

        v_rows := v_rows || jsonb_build_object(
            'method',   m,
            'income',   v_income,
            'expenses', v_expenses,
            'net',      v_income - v_expenses
        );

        v_total_in  := v_total_in  + v_income;
        v_total_out := v_total_out + v_expenses;
    END LOOP;

    -- Recent movements feed (last 30 events across all types)
    SELECT COALESCE(jsonb_agg(row ORDER BY row->>'moved_at' DESC), '[]')
    INTO v_movements
    FROM (
        SELECT jsonb_build_object(
            'type',       'sale',
            'label',      'Venta ' || sale_type,
            'amount',     total_cop,
            'method',     payment_method,
            'moved_at',   sold_at,
            'positive',   true
        ) AS row
        FROM sales
        WHERE is_voided = false AND sold_at BETWEEN p_from AND p_to
        UNION ALL
        SELECT jsonb_build_object(
            'type',       'credit_payment',
            'label',      'Abono crédito',
            'amount',     amount_cop,
            'method',     payment_method,
            'moved_at',   paid_at,
            'positive',   true
        ) AS row
        FROM credit_payments
        WHERE paid_at BETWEEN p_from AND p_to
        UNION ALL
        SELECT jsonb_build_object(
            'type',       'expense',
            'label',      concept,
            'amount',     amount_cop,
            'method',     payment_method,
            'moved_at',   spent_at,
            'positive',   false
        ) AS row
        FROM expenses
        WHERE spent_at BETWEEN p_from AND p_to
        UNION ALL
        SELECT jsonb_build_object(
            'type',       'transfer',
            'label',      'Transferencia ' || from_method || ' → ' || to_method,
            'amount',     amount_cop,
            'method',     COALESCE(to_method, from_method),
            'moved_at',   created_at,
            'positive',   (to_method IS NOT NULL)
        ) AS row
        FROM wallet_movements
        WHERE reason IN ('transfer_in','transfer_out')
          AND created_at BETWEEN p_from AND p_to
        LIMIT 50
    ) sub;

    RETURN jsonb_build_object(
        'by_method',  v_rows,
        'total_income',   v_total_in,
        'total_expenses', v_total_out,
        'net',            v_total_in - v_total_out,
        'movements',      v_movements
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_finance_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ==========================================
-- 5. Also update reset_all_data to clear adjustments
-- ==========================================
CREATE OR REPLACE FUNCTION reset_all_data()
RETURNS JSONB AS $$
DECLARE
    v_wm    INTEGER;
    v_exp   INTEGER;
    v_adj   INTEGER;
    v_cp    INTEGER;
    v_cr    INTEGER;
    v_sa    INTEGER;
    v_ib    INTEGER;
    v_pr    INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_wm  FROM wallet_movements;  DELETE FROM wallet_movements;
    SELECT COUNT(*) INTO v_exp FROM expenses;           DELETE FROM expenses;
    SELECT COUNT(*) INTO v_adj FROM inventory_adjustments; DELETE FROM inventory_adjustments;
    SELECT COUNT(*) INTO v_cp  FROM credit_payments;   DELETE FROM credit_payments;
    SELECT COUNT(*) INTO v_cr  FROM credits;            DELETE FROM credits;
    SELECT COUNT(*) INTO v_sa  FROM sales;              DELETE FROM sales;
    SELECT COUNT(*) INTO v_ib  FROM inventory_batches;  DELETE FROM inventory_batches;
    UPDATE products SET current_stock = 0;
    SELECT COUNT(*) INTO v_pr  FROM products;

    RETURN jsonb_build_object(
        'Movimientos cartera',   v_wm,
        'Gastos',                v_exp,
        'Ajustes inventario',    v_adj,
        'Abonos crédito',        v_cp,
        'Créditos',              v_cr,
        'Ventas',                v_sa,
        'Lotes inventario',      v_ib,
        'Productos (stock → 0)', v_pr
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION reset_all_data() TO authenticated;
