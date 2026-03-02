'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { inventoryService } from '@/lib/services/api'
import { Check, Loader2 } from 'lucide-react'

const INPUT = "block w-full border-b border-[#232327] bg-transparent py-2 text-[#F3F3F3] placeholder:text-[#555555] focus:border-[#22C55E] focus:outline-none transition-colors text-sm"
const LABEL = "text-xs font-semibold uppercase tracking-wider text-[#A0A0A8]"

export default function InventoryPage() {
    const [products, setProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    const [productId, setProductId] = useState('')
    const [qty, setQty] = useState('')
    const [cost, setCost] = useState('')
    const [sellPrice, setSellPrice] = useState('')
    const [purchasedAt, setPurchasedAt] = useState(new Date().toISOString().split('T')[0])
    const [supplier, setSupplier] = useState('')

    useEffect(() => {
        const supabase = createClient()
        supabase.from('products').select('id, name, brand').eq('is_active', true).then(({ data }) => {
            if (data) setProducts(data)
        })
    }, [])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        const { error } = await inventoryService.createBatch({
            productId,
            qty: parseInt(qty),
            cost: parseFloat(cost),
            sellPrice: parseFloat(sellPrice),
            purchasedAt,
            supplier,
        })
        if (!error) {
            setSuccess(true)
            setProductId('')
            setQty('')
            setCost('')
            setSellPrice('')
            setTimeout(() => setSuccess(false), 3000)
        } else {
            alert('Error: ' + error.message)
        }
        setLoading(false)
    }

    return (
        <div className="space-y-12 animate-in fade-in duration-700">
            <div>
                <h1 className="font-serif text-4xl font-light tracking-tight text-[#F3F3F3]">
                    Ingreso de Inventario
                </h1>
                <p className="mt-2 text-[#A0A0A8]">
                    Registra nuevos lotes de perfumes recibidos
                </p>
            </div>

            <div className="max-w-xl high-end-glass rounded-2xl p-10">
                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="space-y-2">
                        <label className={LABEL}>Perfume</label>
                        <select
                            required
                            value={productId}
                            onChange={(e) => setProductId(e.target.value)}
                            className={INPUT + " cursor-pointer"}
                            style={{ colorScheme: 'dark' }}
                        >
                            <option value="" className="bg-[#141418]">Seleccionar perfume...</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id} className="bg-[#141418]">{p.brand} - {p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className={LABEL}>Cantidad</label>
                            <input type="number" required min="1" value={qty}
                                onChange={(e) => setQty(e.target.value)}
                                className={INPUT} placeholder="0" />
                        </div>
                        <div className="space-y-2">
                            <label className={LABEL}>Fecha Compra</label>
                            <input type="date" required value={purchasedAt}
                                onChange={(e) => setPurchasedAt(e.target.value)}
                                className={INPUT} style={{ colorScheme: 'dark' }} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className={LABEL}>Costo Unitario (COP)</label>
                            <input type="number" required value={cost}
                                onChange={(e) => setCost(e.target.value)}
                                className={INPUT} placeholder="400000" />
                        </div>
                        <div className="space-y-2">
                            <label className={LABEL}>Precio Venta (COP)</label>
                            <input type="number" required value={sellPrice}
                                onChange={(e) => setSellPrice(e.target.value)}
                                className={INPUT} placeholder="650000" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className={LABEL}>Proveedor (Opcional)</label>
                        <input type="text" value={supplier}
                            onChange={(e) => setSupplier(e.target.value)}
                            className={INPUT} placeholder="Nombre del proveedor..." />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="flex w-full items-center justify-center bg-[#22C55E] hover:bg-[#16A34A] px-4 py-4 text-sm font-bold text-black uppercase tracking-widest disabled:opacity-50 transition-all duration-300 rounded-xl"
                    >
                        {loading ? <Loader2 className="animate-spin h-5 w-5" /> : success ? <Check className="h-5 w-5" /> : 'REGISTRAR LOTE'}
                    </button>
                </form>
            </div>
        </div>
    )
}
