-- CONSOLIDATED FIX FOR SCENTS STORE MANAGER (v3 - POS Fix)
-- Run this in Supabase SQL Editor

-- 1. DELETE EXISTING POLICIES (To avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated read products" ON products;
DROP POLICY IF EXISTS "Allow authenticated all products" ON products;
DROP POLICY IF EXISTS "Allow authenticated read batches" ON inventory_batches;
DROP POLICY IF EXISTS "Allow authenticated all batches" ON inventory_batches;
DROP POLICY IF EXISTS "Allow authenticated read sales" ON sales;
DROP POLICY IF EXISTS "Allow authenticated all sales" ON sales;
DROP POLICY IF EXISTS "Allow authenticated insert adjustments" ON inventory_adjustments;
DROP POLICY IF EXISTS "Allow authenticated all adjustments" ON inventory_adjustments;
DROP POLICY IF EXISTS "Allow authenticated all users" ON users;

-- 2. CREATE NEW ALL-ENCOMPASSING POLICIES
-- Products
CREATE POLICY "Allow authenticated all products" ON products 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Inventory Batches
CREATE POLICY "Allow authenticated all batches" ON inventory_batches 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Sales
CREATE POLICY "Allow authenticated all sales" ON sales 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Inventory Adjustments
CREATE POLICY "Allow authenticated all adjustments" ON inventory_adjustments 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Users (Profiles)
CREATE POLICY "Allow authenticated all users" ON users 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. RE-CREATE RPC FUNCTIONS (Ensuring SECURITY DEFINER and DEFAULT NULL)

-- 1. Create Inventory Batch
CREATE OR REPLACE FUNCTION create_inventory_batch(
  p_product_id UUID,
  p_qty INTEGER,
  p_cost NUMERIC,
  p_sell_price NUMERIC,
  p_purchased_at DATE,
  p_supplier TEXT,
  p_notes TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO inventory_batches (product_id, quantity_in, cost_unit_cop, sell_price_unit_cop, purchased_at, supplier, notes)
  VALUES (p_product_id, p_qty, p_cost, p_sell_price, p_purchased_at, p_supplier, p_notes);
  
  UPDATE products 
  SET current_stock = current_stock + p_qty,
      updated_at = NOW()
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create Sale (Atomic)
CREATE OR REPLACE FUNCTION create_sale(
  p_items JSONB,
  p_sold_at TIMESTAMPTZ,
  p_notes TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_sale_id UUID;
  v_item RECORD;
  v_current_stock INTEGER;
  v_total_cop NUMERIC := 0;
  v_total_profit NUMERIC := 0;
  v_avg_cost NUMERIC;
  v_final_items JSONB := '[]'::JSONB;
BEGIN
  -- Validate stock first
  FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, qty INTEGER, sell_price NUMERIC)
  LOOP
    SELECT current_stock INTO v_current_stock FROM products WHERE id = v_item.product_id;
    IF v_current_stock < v_item.qty THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_item.product_id;
    END IF;
    
    -- Calculate CPP
    SELECT COALESCE(SUM(quantity_in * cost_unit_cop) / NULLIF(SUM(quantity_in), 0), 0)
    INTO v_avg_cost
    FROM inventory_batches 
    WHERE product_id = v_item.product_id;
    
    -- Update totals
    v_total_cop := v_total_cop + (v_item.qty * v_item.sell_price);
    v_total_profit := v_total_profit + (v_item.qty * (v_item.sell_price - v_avg_cost));
    
    -- Prepare final item
    v_final_items := v_final_items || jsonb_build_object(
      'product_id', v_item.product_id,
      'qty', v_item.qty,
      'sell_price', v_item.sell_price,
      'cost_unit_snapshot', v_avg_cost
    );
    
    -- Reduce stock
    UPDATE products SET current_stock = current_stock - v_item.qty WHERE id = v_item.product_id;
  END LOOP;
  
  -- Insert Sale record
  INSERT INTO sales (items, subtotal_cop, total_cop, total_profit_cop, notes, sold_at, created_by)
  VALUES (v_final_items, v_total_cop, v_total_cop, v_total_profit, p_notes, p_sold_at, p_created_by)
  RETURNING id INTO v_sale_id;
  
  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
