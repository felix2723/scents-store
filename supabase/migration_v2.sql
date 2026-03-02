-- =============================================
-- MIGRATION V2: CREDITS + DISCOUNT + RESET
-- Scents Store Manager
-- Ejecutar en Supabase SQL Editor
-- =============================================

-- ==========================================
-- 1. COLUMNAS NUEVAS EN TABLA sales
-- ==========================================
ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS discount_cop NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sale_type TEXT DEFAULT 'contado' CHECK (sale_type IN ('contado', 'credito'));

-- ==========================================
-- 2. TABLAS NUEVAS: credits y credit_payments
-- ==========================================

CREATE TABLE IF NOT EXISTS credits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id         UUID REFERENCES sales(id) ON DELETE SET NULL,
    customer_name   TEXT NOT NULL,
    customer_phone  TEXT,
    total_cop       NUMERIC NOT NULL DEFAULT 0,
    paid_cop        NUMERIC NOT NULL DEFAULT 0,
    due_cop         NUMERIC GENERATED ALWAYS AS (total_cop - paid_cop) STORED,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    due_date        TIMESTAMPTZ,
    purchased_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_payments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_id   UUID NOT NULL REFERENCES credits(id) ON DELETE CASCADE,
    amount_cop  NUMERIC NOT NULL CHECK (amount_cop > 0),
    paid_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 3. ROW LEVEL SECURITY
-- ==========================================
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated all credits" ON credits;
CREATE POLICY "Allow authenticated all credits" ON credits
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated all credit_payments" ON credit_payments;
CREATE POLICY "Allow authenticated all credit_payments" ON credit_payments
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Reconstruir políticas existentes para asegurar que todo tenga permisos
DROP POLICY IF EXISTS "Allow authenticated all products" ON products;
CREATE POLICY "Allow authenticated all products" ON products
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated all batches" ON inventory_batches;
CREATE POLICY "Allow authenticated all batches" ON inventory_batches
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated all sales" ON sales;
CREATE POLICY "Allow authenticated all sales" ON sales
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated all users" ON users;
CREATE POLICY "Allow authenticated all users" ON users
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==========================================
-- 4. RPC: create_inventory_batch
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
    SET current_stock = current_stock + p_qty,
        updated_at = NOW()
    WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 5. RPC: create_sale (con descuento + crédito)
-- ==========================================
CREATE OR REPLACE FUNCTION create_sale(
    p_items                 JSONB,
    p_sold_at               TIMESTAMPTZ,
    p_notes                 TEXT DEFAULT NULL,
    p_created_by            UUID DEFAULT NULL,
    p_discount_cop          NUMERIC DEFAULT 0,
    p_sale_type             TEXT DEFAULT 'contado',
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
BEGIN
    -- Validate stock for each item
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, qty INTEGER, sell_price NUMERIC)
    LOOP
        SELECT current_stock INTO v_current_stock
        FROM products WHERE id = v_item.product_id FOR UPDATE;

        IF v_current_stock IS NULL THEN
            RAISE EXCEPTION 'Producto no encontrado: %', v_item.product_id;
        END IF;

        IF v_current_stock < v_item.qty THEN
            RAISE EXCEPTION 'Stock insuficiente para el producto. Disponible: %, solicitado: %',
                v_current_stock, v_item.qty;
        END IF;

        -- Average cost (CPP)
        SELECT COALESCE(
            SUM(quantity_in * cost_unit_cop) / NULLIF(SUM(quantity_in), 0), 0
        )
        INTO v_avg_cost
        FROM inventory_batches
        WHERE product_id = v_item.product_id;

        v_total_cop    := v_total_cop    + (v_item.qty * v_item.sell_price);
        v_total_profit := v_total_profit + (v_item.qty * (v_item.sell_price - v_avg_cost));

        v_final_items := v_final_items || jsonb_build_object(
            'product_id',         v_item.product_id,
            'qty',                v_item.qty,
            'sell_price',         v_item.sell_price,
            'cost_unit_snapshot', v_avg_cost
        );

        UPDATE products
        SET current_stock = current_stock - v_item.qty
        WHERE id = v_item.product_id;
    END LOOP;

    -- Apply discount (cannot exceed subtotal)
    DECLARE
        v_discount NUMERIC := LEAST(p_discount_cop, v_total_cop);
        v_net_total NUMERIC := v_total_cop - v_discount;
    BEGIN
        -- Insert sale
        INSERT INTO sales (
            items, subtotal_cop, total_cop, discount_cop, total_profit_cop,
            notes, sold_at, created_by, sale_type, is_voided
        ) VALUES (
            v_final_items, v_total_cop, v_net_total, v_discount, v_total_profit,
            p_notes, p_sold_at, p_created_by, p_sale_type, false
        )
        RETURNING id INTO v_sale_id;

        -- Create credit record if sale_type = credito
        IF p_sale_type = 'credito' THEN
            IF p_credit_customer_name IS NULL OR trim(p_credit_customer_name) = '' THEN
                RAISE EXCEPTION 'El nombre del cliente es obligatorio para ventas a crédito.';
            END IF;

            DECLARE
                v_deposit NUMERIC := LEAST(p_credit_deposit, v_net_total);
                v_paid_status TEXT := CASE WHEN v_deposit >= v_net_total THEN 'paid' ELSE 'pending' END;
            BEGIN
                INSERT INTO credits (
                    sale_id, customer_name, customer_phone,
                    total_cop, paid_cop, status,
                    due_date, purchased_at
                ) VALUES (
                    v_sale_id, p_credit_customer_name, p_credit_customer_phone,
                    v_net_total, v_deposit, v_paid_status,
                    p_credit_due_date, p_sold_at
                )
                RETURNING id INTO v_credit_id;

                -- Register initial deposit as a payment if > 0
                IF v_deposit > 0 THEN
                    INSERT INTO credit_payments (credit_id, amount_cop, paid_at, notes)
                    VALUES (v_credit_id, v_deposit, p_sold_at, 'Abono inicial');
                END IF;
            END;
        END IF;
    END;

    RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 6. RPC: add_credit_payment
-- ==========================================
CREATE OR REPLACE FUNCTION add_credit_payment(
    p_credit_id UUID,
    p_amount    NUMERIC,
    p_paid_at   TIMESTAMPTZ DEFAULT NOW(),
    p_notes     TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_current_due   NUMERIC;
    v_current_paid  NUMERIC;
    v_total         NUMERIC;
BEGIN
    SELECT due_cop, paid_cop, total_cop
    INTO v_current_due, v_current_paid, v_total
    FROM credits WHERE id = p_credit_id FOR UPDATE;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto del abono debe ser mayor a 0.';
    END IF;

    IF p_amount > v_current_due THEN
        RAISE EXCEPTION 'El abono (%) supera la deuda actual (%)', p_amount, v_current_due;
    END IF;

    INSERT INTO credit_payments (credit_id, amount_cop, paid_at, notes)
    VALUES (p_credit_id, p_amount, p_paid_at, p_notes);

    UPDATE credits
    SET paid_cop = paid_cop + p_amount,
        status   = CASE WHEN (paid_cop + p_amount) >= total_cop THEN 'paid' ELSE 'pending' END
    WHERE id = p_credit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 7. RPC: reset_all_data (con resumen)
-- ==========================================
CREATE OR REPLACE FUNCTION reset_all_data()
RETURNS JSONB AS $$
DECLARE
    v_cp_count  INTEGER;
    v_cr_count  INTEGER;
    v_sa_count  INTEGER;
    v_ib_count  INTEGER;
    v_pr_count  INTEGER;
BEGIN
    -- Delete in FK-safe order
    SELECT COUNT(*) INTO v_cp_count FROM credit_payments;
    DELETE FROM credit_payments;

    SELECT COUNT(*) INTO v_cr_count FROM credits;
    DELETE FROM credits;

    SELECT COUNT(*) INTO v_sa_count FROM sales;
    DELETE FROM sales;

    SELECT COUNT(*) INTO v_ib_count FROM inventory_batches;
    DELETE FROM inventory_batches;

    -- Reset stock on products
    UPDATE products SET current_stock = 0;
    SELECT COUNT(*) INTO v_pr_count FROM products;

    RETURN jsonb_build_object(
        'Abonos de crédito',     v_cp_count,
        'Créditos',              v_cr_count,
        'Ventas',                v_sa_count,
        'Lotes de inventario',   v_ib_count,
        'Productos (stock → 0)', v_pr_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 8. COLUMNA subtotal_cop (si no existe ya)
-- ==========================================
ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS subtotal_cop NUMERIC DEFAULT 0;
