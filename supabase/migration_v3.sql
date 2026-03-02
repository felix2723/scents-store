-- =============================================
-- MIGRATION V3: PAYMENT METHODS + WALLET + EXPENSES
-- Scents Store Manager
-- Ejecutar en Supabase SQL Editor DESPUÉS de migration_v2.sql
-- =============================================

-- Helper: tipo enum para métodos de pago
DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('cash','nequi','bancolombia','daviplata');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ==========================================
-- 1. COLUMNAS DE MÉTODO DE PAGO EN TABLAS EXISTENTES
-- ==========================================
ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash'
        CHECK (payment_method IN ('cash','nequi','bancolombia','daviplata'));

ALTER TABLE credit_payments
    ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash' NOT NULL
        CHECK (payment_method IN ('cash','nequi','bancolombia','daviplata'));

-- ==========================================
-- 2. TABLA: wallet_movements
-- ==========================================
CREATE TABLE IF NOT EXISTS wallet_movements (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_method TEXT CHECK (from_method IN ('cash','nequi','bancolombia','daviplata')),
    to_method   TEXT CHECK (to_method IN ('cash','nequi','bancolombia','daviplata')),
    amount_cop  NUMERIC NOT NULL CHECK (amount_cop > 0),
    reason      TEXT NOT NULL DEFAULT 'adjustment',
    notes       TEXT,
    created_by  UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wallet_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated wallet_movements" ON wallet_movements;
CREATE POLICY "Allow authenticated wallet_movements" ON wallet_movements
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON wallet_movements TO authenticated;

-- ==========================================
-- 3. TABLA: expenses
-- ==========================================
CREATE TABLE IF NOT EXISTS expenses (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concept        TEXT NOT NULL,
    description    TEXT,
    amount_cop     NUMERIC NOT NULL CHECK (amount_cop > 0),
    payment_method TEXT NOT NULL DEFAULT 'cash'
        CHECK (payment_method IN ('cash','nequi','bancolombia','daviplata')),
    spent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by     UUID
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated expenses" ON expenses;
CREATE POLICY "Allow authenticated expenses" ON expenses
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON expenses TO authenticated;

-- ==========================================
-- 4. RPC: create_inventory_batch (unchanged, keep safe)
-- ==========================================
CREATE OR REPLACE FUNCTION create_inventory_batch(
    p_product_id    UUID,
    p_qty           INTEGER,
    p_cost          NUMERIC,
    p_sell_price    NUMERIC,
    p_purchased_at  DATE,
    p_supplier      TEXT DEFAULT NULL,
    p_notes         TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO inventory_batches (
        product_id, quantity_in, cost_unit_cop, sell_price_unit_cop,
        purchased_at, supplier, notes
    ) VALUES (
        p_product_id, p_qty, p_cost, p_sell_price,
        p_purchased_at, p_supplier, p_notes
    );
    UPDATE products
    SET current_stock = current_stock + p_qty, updated_at = NOW()
    WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 5. RPC: create_sale (con payment_method)
-- Drop old overloads first
-- ==========================================
DROP FUNCTION IF EXISTS create_sale(JSONB, TIMESTAMPTZ, TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT, NUMERIC, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS create_sale(JSONB, TIMESTAMPTZ, TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, NUMERIC, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION create_sale(
    p_items                 JSONB,
    p_sold_at               TIMESTAMPTZ,
    p_notes                 TEXT DEFAULT NULL,
    p_created_by            UUID DEFAULT NULL,
    p_discount_cop          NUMERIC DEFAULT 0,
    p_sale_type             TEXT DEFAULT 'contado',
    p_payment_method        TEXT DEFAULT 'cash',
    p_credit_customer_name  TEXT DEFAULT NULL,
    p_credit_customer_phone TEXT DEFAULT NULL,
    p_credit_deposit        NUMERIC DEFAULT 0,
    p_credit_due_date       TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_sale_id       UUID;
    v_item          RECORD;
    v_current_stock INTEGER;
    v_total_cop     NUMERIC := 0;
    v_total_profit  NUMERIC := 0;
    v_avg_cost      NUMERIC;
    v_final_items   JSONB := '[]'::JSONB;
    v_credit_id     UUID;
    v_discount      NUMERIC;
    v_net_total     NUMERIC;
    v_deposit       NUMERIC;
    v_paid_status   TEXT;
BEGIN
    -- Validate + accumulate items
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, qty INTEGER, sell_price NUMERIC)
    LOOP
        SELECT current_stock INTO v_current_stock FROM products WHERE id = v_item.product_id FOR UPDATE;
        IF v_current_stock IS NULL THEN
            RAISE EXCEPTION 'Producto no encontrado: %', v_item.product_id;
        END IF;
        IF v_current_stock < v_item.qty THEN
            RAISE EXCEPTION 'Stock insuficiente. Disponible: %, solicitado: %', v_current_stock, v_item.qty;
        END IF;

        SELECT COALESCE(SUM(quantity_in * cost_unit_cop) / NULLIF(SUM(quantity_in),0), 0)
        INTO v_avg_cost FROM inventory_batches WHERE product_id = v_item.product_id;

        v_total_cop    := v_total_cop    + (v_item.qty * v_item.sell_price);
        v_total_profit := v_total_profit + (v_item.qty * (v_item.sell_price - v_avg_cost));
        v_final_items  := v_final_items  || jsonb_build_object(
            'product_id', v_item.product_id, 'qty', v_item.qty,
            'sell_price', v_item.sell_price, 'cost_unit_snapshot', v_avg_cost
        );

        UPDATE products SET current_stock = current_stock - v_item.qty WHERE id = v_item.product_id;
    END LOOP;

    v_discount  := LEAST(p_discount_cop, v_total_cop);
    v_net_total := v_total_cop - v_discount;

    -- Insert sale
    INSERT INTO sales (
        items, subtotal_cop, total_cop, discount_cop, total_profit_cop,
        notes, sold_at, created_by, sale_type, payment_method, is_voided
    ) VALUES (
        v_final_items, v_total_cop, v_net_total, v_discount, v_total_profit,
        p_notes, p_sold_at, p_created_by, p_sale_type, p_payment_method, false
    ) RETURNING id INTO v_sale_id;

    -- Wallet movement for contado sales
    IF p_sale_type = 'contado' AND v_net_total > 0 THEN
        INSERT INTO wallet_movements (to_method, amount_cop, reason, notes, created_by)
        VALUES (p_payment_method, v_net_total, 'sale', 'Venta contado', p_created_by);
    END IF;

    -- Credit logic
    IF p_sale_type = 'credito' THEN
        IF p_credit_customer_name IS NULL OR trim(p_credit_customer_name) = '' THEN
            RAISE EXCEPTION 'El nombre del cliente es obligatorio para ventas a crédito.';
        END IF;

        v_deposit    := LEAST(p_credit_deposit, v_net_total);
        v_paid_status := CASE WHEN v_deposit >= v_net_total THEN 'paid' ELSE 'pending' END;

        INSERT INTO credits (
            sale_id, customer_name, customer_phone,
            total_cop, paid_cop, status, due_date, purchased_at
        ) VALUES (
            v_sale_id, p_credit_customer_name, p_credit_customer_phone,
            v_net_total, v_deposit, v_paid_status, p_credit_due_date, p_sold_at
        ) RETURNING id INTO v_credit_id;

        -- Register initial deposit as payment and wallet movement
        IF v_deposit > 0 THEN
            INSERT INTO credit_payments (credit_id, amount_cop, paid_at, notes, payment_method)
            VALUES (v_credit_id, v_deposit, p_sold_at, 'Abono inicial', p_payment_method);

            INSERT INTO wallet_movements (to_method, amount_cop, reason, notes, created_by)
            VALUES (p_payment_method, v_deposit, 'credit_payment', 'Abono inicial crédito', p_created_by);
        END IF;
    END IF;

    RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 6. RPC: add_credit_payment (con payment_method)
-- Drop old overload first
-- ==========================================
DROP FUNCTION IF EXISTS add_credit_payment(UUID, NUMERIC, TIMESTAMPTZ, TEXT);

CREATE OR REPLACE FUNCTION add_credit_payment(
    p_credit_id      UUID,
    p_amount         NUMERIC,
    p_paid_at        TIMESTAMPTZ DEFAULT NOW(),
    p_notes          TEXT DEFAULT NULL,
    p_payment_method TEXT DEFAULT 'cash'
) RETURNS VOID AS $$
DECLARE
    v_current_due   NUMERIC;
    v_current_paid  NUMERIC;
    v_total         NUMERIC;
    v_credit_owner  UUID;
BEGIN
    SELECT due_cop, paid_cop, total_cop INTO v_current_due, v_current_paid, v_total
    FROM credits WHERE id = p_credit_id FOR UPDATE;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto debe ser mayor a 0.';
    END IF;
    IF p_amount > v_current_due THEN
        RAISE EXCEPTION 'El abono (%) supera la deuda actual (%)', p_amount, v_current_due;
    END IF;

    INSERT INTO credit_payments (credit_id, amount_cop, paid_at, notes, payment_method)
    VALUES (p_credit_id, p_amount, p_paid_at, p_notes, p_payment_method);

    UPDATE credits
    SET paid_cop = paid_cop + p_amount,
        status   = CASE WHEN (paid_cop + p_amount) >= total_cop THEN 'paid' ELSE 'pending' END
    WHERE id = p_credit_id;

    -- Wallet movement
    INSERT INTO wallet_movements (to_method, amount_cop, reason, notes)
    VALUES (p_payment_method, p_amount, 'credit_payment', COALESCE(p_notes, 'Abono a crédito'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 7. RPC: transfer_funds
-- ==========================================
CREATE OR REPLACE FUNCTION transfer_funds(
    p_from_method   TEXT,
    p_to_method     TEXT,
    p_amount        NUMERIC,
    p_notes         TEXT DEFAULT NULL,
    p_created_by    UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    IF p_from_method = p_to_method THEN
        RAISE EXCEPTION 'El origen y destino no pueden ser iguales.';
    END IF;
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto debe ser mayor a 0.';
    END IF;

    -- Out movement
    INSERT INTO wallet_movements (from_method, amount_cop, reason, notes, created_by)
    VALUES (p_from_method, p_amount, 'transfer_out', p_notes, p_created_by);

    -- In movement
    INSERT INTO wallet_movements (to_method, amount_cop, reason, notes, created_by)
    VALUES (p_to_method, p_amount, 'transfer_in', p_notes, p_created_by);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 8. RPC: get_wallet_summary
-- ==========================================
CREATE OR REPLACE FUNCTION get_wallet_summary()
RETURNS JSONB AS $$
DECLARE
    methods TEXT[] := ARRAY['cash','nequi','bancolombia','daviplata'];
    m       TEXT;
    result  JSONB := '{}'::JSONB;
    inflow  NUMERIC;
    outflow NUMERIC;
BEGIN
    FOREACH m IN ARRAY methods LOOP
        SELECT COALESCE(SUM(amount_cop), 0) INTO inflow
        FROM wallet_movements WHERE to_method = m;

        SELECT COALESCE(SUM(amount_cop), 0) INTO outflow
        FROM wallet_movements WHERE from_method = m;

        result := result || jsonb_build_object(m, inflow - outflow);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 9. RPC: create_expense
-- ==========================================
CREATE OR REPLACE FUNCTION create_expense(
    p_concept        TEXT,
    p_amount_cop     NUMERIC,
    p_payment_method TEXT DEFAULT 'cash',
    p_description    TEXT DEFAULT NULL,
    p_spent_at       TIMESTAMPTZ DEFAULT NOW(),
    p_created_by     UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_expense_id UUID;
BEGIN
    IF p_amount_cop <= 0 THEN
        RAISE EXCEPTION 'El monto del gasto debe ser mayor a 0.';
    END IF;

    INSERT INTO expenses (concept, description, amount_cop, payment_method, spent_at, created_by)
    VALUES (p_concept, p_description, p_amount_cop, p_payment_method, p_spent_at, p_created_by)
    RETURNING id INTO v_expense_id;

    -- Wallet: dinero sale del método indicado
    INSERT INTO wallet_movements (from_method, amount_cop, reason, notes, created_by)
    VALUES (p_payment_method, p_amount_cop, 'expense', p_concept, p_created_by);

    RETURN v_expense_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 10. RPC: delete_expense (con reversión en cartera)
-- ==========================================
CREATE OR REPLACE FUNCTION delete_expense(
    p_expense_id UUID
) RETURNS VOID AS $$
DECLARE
    v_expense expenses%ROWTYPE;
BEGIN
    SELECT * INTO v_expense FROM expenses WHERE id = p_expense_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Gasto no encontrado.';
    END IF;

    -- Reverse wallet movement
    INSERT INTO wallet_movements (to_method, amount_cop, reason, notes)
    VALUES (v_expense.payment_method, v_expense.amount_cop, 'adjustment', 'Reversión gasto: ' || v_expense.concept);

    DELETE FROM expenses WHERE id = p_expense_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 11. RPC: reset_all_data (actualizado)
-- ==========================================
CREATE OR REPLACE FUNCTION reset_all_data()
RETURNS JSONB AS $$
DECLARE
    v_wm    INTEGER;
    v_exp   INTEGER;
    v_cp    INTEGER;
    v_cr    INTEGER;
    v_sa    INTEGER;
    v_ib    INTEGER;
    v_pr    INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_wm  FROM wallet_movements;  DELETE FROM wallet_movements;
    SELECT COUNT(*) INTO v_exp FROM expenses;           DELETE FROM expenses;
    SELECT COUNT(*) INTO v_cp  FROM credit_payments;   DELETE FROM credit_payments;
    SELECT COUNT(*) INTO v_cr  FROM credits;            DELETE FROM credits;
    SELECT COUNT(*) INTO v_sa  FROM sales;              DELETE FROM sales;
    SELECT COUNT(*) INTO v_ib  FROM inventory_batches;  DELETE FROM inventory_batches;
    UPDATE products SET current_stock = 0;
    SELECT COUNT(*) INTO v_pr  FROM products;

    RETURN jsonb_build_object(
        'Movimientos cartera',   v_wm,
        'Gastos',                v_exp,
        'Abonos de crédito',     v_cp,
        'Créditos',              v_cr,
        'Ventas',                v_sa,
        'Lotes de inventario',   v_ib,
        'Productos (stock → 0)', v_pr
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 12. GRANTS para RPCs (con firmas completas para evitar ambigüedad)
-- ==========================================
GRANT EXECUTE ON FUNCTION create_inventory_batch(UUID, INTEGER, NUMERIC, NUMERIC, DATE, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_sale(JSONB, TIMESTAMPTZ, TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, NUMERIC, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION add_credit_payment(UUID, NUMERIC, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_funds(TEXT, TEXT, NUMERIC, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_wallet_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION create_expense(TEXT, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_expense(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_all_data() TO authenticated;
