import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function seed() {
    console.log('🌱 Seeding database...')

    // 1. Create a Product: Dior Sauvage
    const { data: product, error: pError } = await supabase
        .from('products')
        .insert({
            name: 'Sauvage',
            brand: 'Dior',
            sku: 'DIOR-SAUV-EDP-100',
            concentration: 'EDP',
            size_ml: 100,
            tags: ['masculino', 'popular', 'best-seller'],
            is_active: true
        })
        .select()
        .single()

    if (pError) {
        console.error('Error creating product:', pError)
        return
    }

    console.log('✅ Product created:', product.name)

    // 2. Add 2 Batches for Dior Sauvage
    // Batch 1: 5 units at 400.000 COP each
    const { error: b1Error } = await supabase.rpc('create_inventory_batch', {
        p_product_id: product.id,
        p_qty: 5,
        p_cost: 400000,
        p_sell_price: 650000,
        p_purchased_at: '2024-02-01',
        p_supplier: 'Dior Distributor LATAM',
        p_notes: 'Initial stock'
    })

    // Batch 2: 3 units at 420.000 COP each (Price increased)
    const { error: b2Error } = await supabase.rpc('create_inventory_batch', {
        p_product_id: product.id,
        p_qty: 3,
        p_cost: 420000,
        p_sell_price: 680000,
        p_purchased_at: '2024-02-15',
        p_supplier: 'Dior Distributor LATAM',
        p_notes: 'Restock'
    })

    if (b1Error || b2Error) {
        console.error('Error creating batches:', b1Error || b2Error)
    } else {
        console.log('✅ Batches created for', product.name)
        // Total cost = (5 * 400000) + (3 * 420000) = 2.000.000 + 1.260.000 = 3.260.000
        // Total units = 8
        // CPP = 3.260.000 / 8 = 407.500
    }

    // 3. Create a Sale for Dior Sauvage
    // Sell 2 units at 650.000
    const { data: saleId, error: sError } = await supabase.rpc('create_sale', {
        p_items: [
            { product_id: product.id, qty: 2, sell_price: 650000 }
        ],
        p_sold_at: new Date().toISOString(),
        p_notes: 'First sale test',
        p_created_by: '00000000-0000-0000-0000-000000000000' // Placeholder, replace with real owner ID
    })

    if (sError) {
        console.error('Error creating sale:', sError)
    } else {
        console.log('✅ Sale created:', saleId)
        // Snapshot cost should be 407.500 in the sale record
    }

    console.log('✨ Seeding complete!')
}

seed()
