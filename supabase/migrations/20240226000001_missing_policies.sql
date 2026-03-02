-- Add missing RLS policies for Catalog management
CREATE POLICY "Allow authenticated insert products" ON products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update products" ON products FOR UPDATE TO authenticated USING (true);

-- Add missing RLS policies for Inventory Adjustments
CREATE POLICY "Allow authenticated insert adjustments" ON inventory_adjustments FOR INSERT TO authenticated WITH CHECK (true);
