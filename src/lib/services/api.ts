import { createClient } from '../supabase'

type PaymentMethod = 'cash' | 'nequi' | 'bancolombia' | 'daviplata'

export const inventoryService = {
    async createBatch(params: {
        productId: string
        qty: number
        cost: number
        sellPrice: number
        purchasedAt: string
        supplier?: string
        notes?: string
    }) {
        const supabase = createClient()
        return await supabase.rpc('create_inventory_batch', {
            p_product_id: params.productId,
            p_qty: params.qty,
            p_cost: params.cost,
            p_sell_price: params.sellPrice,
            p_purchased_at: params.purchasedAt,
            p_supplier: params.supplier,
            p_notes: params.notes
        })
    },

    async getBatches() {
        const supabase = createClient()
        return await supabase
            .from('inventory_batches')
            .select('*, products(name, brand)')
            .order('created_at', { ascending: false })
    }
}

export const salesService = {
    async createSale(params: {
        items: { product_id: string; qty: number; sell_price: number }[]
        soldAt: string
        notes?: string
        createdBy: string
        discountCop?: number
        saleType?: 'contado' | 'credito'
        paymentMethod?: PaymentMethod
        creditData?: {
            customerName: string
            customerPhone?: string
            depositAmount: number
            dueDate?: string | null
        }
    }) {
        const supabase = createClient()
        return await supabase.rpc('create_sale', {
            p_items: params.items,
            p_sold_at: params.soldAt,
            p_notes: params.notes ?? null,
            p_created_by: params.createdBy,
            p_discount_cop: params.discountCop ?? 0,
            p_sale_type: params.saleType ?? 'contado',
            p_payment_method: params.paymentMethod ?? 'cash',
            p_credit_customer_name: params.creditData?.customerName ?? null,
            p_credit_customer_phone: params.creditData?.customerPhone ?? null,
            p_credit_deposit: params.creditData?.depositAmount ?? 0,
            p_credit_due_date: params.creditData?.dueDate ?? null
        })
    },

    async getSales() {
        const supabase = createClient()
        return await supabase
            .from('sales')
            .select('*')
            .order('sold_at', { ascending: false })
    },

    async voidSale(saleId: string, reason: string) {
        const supabase = createClient()
        return await supabase.rpc('void_sale', {
            p_sale_id: saleId,
            p_reason: reason
        })
    }
}

export const creditsService = {
    async getCredits() {
        const supabase = createClient()
        return await supabase
            .from('credits')
            .select('*, credit_payments(*)')
            .order('created_at', { ascending: false })
    },

    async addPayment(params: {
        creditId: string
        amount: number
        paidAt: string
        notes?: string
        paymentMethod: PaymentMethod
    }) {
        const supabase = createClient()
        return await supabase.rpc('add_credit_payment', {
            p_credit_id: params.creditId,
            p_amount: params.amount,
            p_paid_at: params.paidAt,
            p_notes: params.notes ?? null,
            p_payment_method: params.paymentMethod
        })
    }
}

export const walletService = {
    async getSummary() {
        const supabase = createClient()
        return await supabase.rpc('get_wallet_summary')
    },

    async transfer(params: {
        fromMethod: PaymentMethod
        toMethod: PaymentMethod
        amount: number
        notes?: string
        createdBy: string
    }) {
        const supabase = createClient()
        return await supabase.rpc('transfer_funds', {
            p_from_method: params.fromMethod,
            p_to_method: params.toMethod,
            p_amount: params.amount,
            p_notes: params.notes ?? null,
            p_created_by: params.createdBy
        })
    },

    async getMovements() {
        const supabase = createClient()
        return await supabase
            .from('wallet_movements')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50)
    }
}

export const expensesService = {
    async create(params: {
        concept: string
        description?: string
        amountCop: number
        paymentMethod: PaymentMethod
        spentAt: string
        createdBy: string
    }) {
        const supabase = createClient()
        return await supabase.rpc('create_expense', {
            p_concept: params.concept,
            p_description: params.description ?? null,
            p_amount_cop: params.amountCop,
            p_payment_method: params.paymentMethod,
            p_spent_at: params.spentAt,
            p_created_by: params.createdBy
        })
    },

    async getAll() {
        const supabase = createClient()
        return await supabase
            .from('expenses')
            .select('*')
            .order('spent_at', { ascending: false })
    },

    async delete(id: string) {
        const supabase = createClient()
        // Reverse wallet impact before deleting
        return await supabase.rpc('delete_expense', { p_expense_id: id })
    }
}

export const reportsService = {
    async getProfitabilityReport() {
        const supabase = createClient()
        const { data: sales, error } = await supabase
            .from('sales')
            .select('items')
            .eq('is_voided', false)

        if (error) return { data: null, error }

        const report: Record<string, any> = {}
        sales.forEach((sale: any) => {
            sale.items.forEach((item: any) => {
                if (!report[item.product_id]) {
                    report[item.product_id] = { qty: 0, revenue: 0, cost: 0, profit: 0 }
                }
                report[item.product_id].qty += item.qty
                report[item.product_id].revenue += item.qty * item.sell_price
                report[item.product_id].cost += item.qty * item.cost_unit_snapshot
                report[item.product_id].profit += item.qty * (item.sell_price - item.cost_unit_snapshot)
            })
        })
        return { data: report, error: null }
    }
}

export const productsService = {
    async getProducts() {
        const supabase = createClient()
        return await supabase.from('products').select('*').order('name')
    },

    async deleteProduct(id: string) {
        const supabase = createClient()
        return await supabase.from('products').delete().eq('id', id)
    }
}
