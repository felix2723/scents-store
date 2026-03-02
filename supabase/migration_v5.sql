-- =============================================
-- MIGRATION V5 (REVISADO): RESET FUNCIONAL
-- Ejecutar en Supabase SQL Editor
-- Usa DELETE WHERE id IS NOT NULL (100% compatible con Supabase/PostgREST)
-- No usa TRUNCATE para evitar conflictos con RLS/triggers
-- =============================================

-- Primero eliminar versiones anteriores (por si hay conflicto de firmas)
DROP FUNCTION IF EXISTS reset_all_data();

CREATE OR REPLACE FUNCTION reset_all_data()
RETURNS JSONB AS $$
DECLARE
    v_wm    INTEGER := 0;
    v_exp   INTEGER := 0;
    v_adj   INTEGER := 0;
    v_cp    INTEGER := 0;
    v_cr    INTEGER := 0;
    v_sa    INTEGER := 0;
    v_ib    INTEGER := 0;
    v_pr    INTEGER := 0;
BEGIN
    -- Contar antes de borrar
    BEGIN SELECT COUNT(*) INTO v_wm  FROM wallet_movements;      EXCEPTION WHEN undefined_table THEN v_wm  := 0; END;
    BEGIN SELECT COUNT(*) INTO v_exp FROM expenses;              EXCEPTION WHEN undefined_table THEN v_exp := 0; END;
    BEGIN SELECT COUNT(*) INTO v_adj FROM inventory_adjustments; EXCEPTION WHEN undefined_table THEN v_adj := 0; END;
    BEGIN SELECT COUNT(*) INTO v_cp  FROM credit_payments;       EXCEPTION WHEN undefined_table THEN v_cp  := 0; END;
    BEGIN SELECT COUNT(*) INTO v_cr  FROM credits;               EXCEPTION WHEN undefined_table THEN v_cr  := 0; END;
    BEGIN SELECT COUNT(*) INTO v_sa  FROM sales;                 EXCEPTION WHEN undefined_table THEN v_sa  := 0; END;
    BEGIN SELECT COUNT(*) INTO v_ib  FROM inventory_batches;     EXCEPTION WHEN undefined_table THEN v_ib  := 0; END;
    BEGIN SELECT COUNT(*) INTO v_pr  FROM products;              EXCEPTION WHEN undefined_table THEN v_pr  := 0; END;

    -- Borrar en orden correcto (hijos antes que padres)
    -- WHERE id IS NOT NULL garantiza que Supabase acepte la operación
    BEGIN DELETE FROM wallet_movements      WHERE id IS NOT NULL; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM expenses              WHERE id IS NOT NULL; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM inventory_adjustments WHERE id IS NOT NULL; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM credit_payments       WHERE id IS NOT NULL; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM credits               WHERE id IS NOT NULL; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM sales                 WHERE id IS NOT NULL; EXCEPTION WHEN undefined_table THEN NULL; END;
    BEGIN DELETE FROM inventory_batches     WHERE id IS NOT NULL; EXCEPTION WHEN undefined_table THEN NULL; END;

    -- Productos: solo poner stock en 0, no eliminar el catálogo
    BEGIN UPDATE products SET current_stock = 0 WHERE id IS NOT NULL; EXCEPTION WHEN undefined_table THEN NULL; END;

    RETURN jsonb_build_object(
        'wallet_movements',      v_wm,
        'expenses',              v_exp,
        'inventory_adjustments', v_adj,
        'credit_payments',       v_cp,
        'credits',               v_cr,
        'sales',                 v_sa,
        'inventory_batches',     v_ib,
        'products_stock_reset',  v_pr
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION reset_all_data() TO authenticated;

-- Verificar que quedó bien:
SELECT 'reset_all_data function created successfully' AS status;
