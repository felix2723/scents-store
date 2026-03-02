-- 1. Create Inventory Batch
CREATE OR REPLACE FUNCTION create_inventory_batch(
  p_product_id UUID,
  p_qty INTEGER,
  p_cost NUMERIC,
  p_sell_price NUMERIC,
  p_purchased_at DATE,
  p_supplier TEXT,
  p_notes TEXT
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
  p_notes TEXT,
  p_created_by UUID
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
    
    -- Calculate CPP: Σ(qty_in * cost) / Σ(qty_in)
    SELECT COALESCE(SUM(quantity_in * cost_unit_cop) / NULLIF(SUM(quantity_in), 0), 0)
    INTO v_avg_cost
    FROM inventory_batches 
    WHERE product_id = v_item.product_id;
    
    -- Update totals
    v_total_cop := v_total_cop + (v_item.qty * v_item.sell_price);
    v_total_profit := v_total_profit + (v_item.qty * (v_item.sell_price - v_avg_cost));
    
    -- Prepare final item with snapshot
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

-- 3. Void Sale
CREATE OR REPLACE FUNCTION void_sale(
  p_sale_id UUID,
  p_reason TEXT
) RETURNS VOID AS $$
DECLARE
  v_item RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM sales WHERE id = p_sale_id AND is_voided = true) THEN
    RAISE EXCEPTION 'Sale is already voided';
  END IF;
  
  -- Restore stock
  FOR v_item IN SELECT * FROM sales, jsonb_to_recordset(items) AS x(product_id UUID, qty INTEGER) WHERE id = p_sale_id
  LOOP
    UPDATE products SET current_stock = current_stock + v_item.qty WHERE id = v_item.product_id;
  END LOOP;
  
  -- Mark as voided
  UPDATE sales SET is_voided = true, void_reason = p_reason WHERE id = p_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Adjust Inventory
CREATE OR REPLACE FUNCTION adjust_inventory(
  p_product_id UUID,
  p_delta_qty INTEGER,
  p_reason TEXT,
  p_created_by UUID
) RETURNS VOID AS $$
BEGIN
  INSERT INTO inventory_adjustments (product_id, delta_qty, reason, created_by)
  VALUES (p_product_id, p_delta_qty, p_reason, p_created_by);
  
  UPDATE products 
  SET current_stock = current_stock + p_delta_qty,
      updated_at = NOW()
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
