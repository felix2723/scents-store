'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const INPUT = "w-full bg-transparent border-b border-[#232327] py-2 text-[#F3F3F3] placeholder:text-[#555555] focus:border-[#22C55E] focus:outline-none transition-colors text-sm"
const LABEL = "text-[10px] font-bold uppercase tracking-widest text-[#A0A0A8]"

const REASONS = ['Daño', 'Robo/Pérdida', 'Conteo físico', 'Error de registro', 'Otro']

export default function AdjustmentsPage() {
    const [products, setProducts] = useState<any[]>([])
    const [productId, setProductId] = useState('')
    const [currentStock, setCurrentStock] = useState<number | null>(null)
    const [type, setType] = useState<'entrada' | 'salida'>('entrada')
    const [qty, setQty] = useState('')
    const [reason, setReason] = useState(REASONS[0])
    const [notes, setNotes] = useState('')
    const [adjustedAt, setAdjustedAt] = useState(new Date().toISOString().split('T')[0])
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [userId, setUserId] = useState<string | null>(null)

    // Recent adjustments
    const [adjustments, setAdjustments] = useState<any[]>([])
    const [adjLoading, setAdjLoading] = useState(true)

    useEffect(() => {
        const supabase = createClient()
        supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUserId(user.id) })
        supabase.from('products').select('id, name, brand, current_stock').eq('is_active', true).order('name')
            .then(({ data }) => { if (data) setProducts(data) })
        loadAdjustments(supabase)
    }, [])

    async function loadAdjustments(supabase?: any) {
        const sb = supabase || createClient()
        setAdjLoading(true)
        const { data } = await sb
            .from('inventory_adjustments')
            .select('*, products(name, brand)')
            .order('adjusted_at', { ascending: false })
            .limit(30)
        if (data) setAdjustments(data)
        setAdjLoading(false)
    }

    function handleProductChange(id: string) {
        setProductId(id)
        const p = products.find(p => p.id === id)
        setCurrentStock(p ? p.current_stock : null)
        setError(null)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        if (!userId) { setError('Sesión no encontrada.'); return }
        const qtyNum = parseInt(qty)
        if (!qtyNum || qtyNum <= 0) { setError('Cantidad debe ser mayor a 0.'); return }

        const delta = type === 'entrada' ? qtyNum : -qtyNum

        if (type === 'salida' && currentStock !== null && qtyNum > currentStock) {
            setError(`Stock insuficiente. Disponible: ${currentStock}, solicitado: ${qtyNum}`)
            return
        }

        setLoading(true)
        const supabase = createClient()
        const { error: rpcError } = await supabase.rpc('create_inventory_adjustment', {
            p_product_id: productId,
            p_delta_qty: delta,
            p_reason: reason,
            p_notes: notes || null,
            p_adjusted_at: new Date(adjustedAt).toISOString(),
            p_created_by: userId
        })

        if (rpcError) {
            setError(rpcError.message)
        } else {
            setSuccess(true)
            setQty('')
            setNotes('')
            // Refresh product stock display
            const p = products.find(p => p.id === productId)
            if (p) setCurrentStock((currentStock ?? 0) + delta)
            loadAdjustments()
            setTimeout(() => setSuccess(false), 3000)
        }
        setLoading(false)
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            <div>
                <h1 className="serif-title text-5xl font-light text-[#F3F3F3]">Ajustes de Inventario</h1>
                <p className="mt-3 text-[#A0A0A8]">Corrige el stock real por daños, robos o conteo físico.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form */}
                <div className="premium-card">
                    <h2 className="serif-title text-xl font-light text-[#F3F3F3] mb-6">Nuevo Ajuste</h2>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Product */}
                        <div className="space-y-2">
                            <label className={LABEL}>Producto *</label>
                            <select required value={productId} onChange={e => handleProductChange(e.target.value)}
                                className={INPUT + " cursor-pointer"} style={{ colorScheme: 'dark' }}>
                                <option value="" className="bg-[#141418]">Seleccionar...</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id} className="bg-[#141418]">
                                        {p.brand} – {p.name} (stock: {p.current_stock})
                                    </option>
                                ))}
                            </select>
                            {currentStock !== null && (
                                <p className="text-xs text-[#A0A0A8]">Stock actual: <span className="text-[#F3F3F3] font-semibold">{currentStock}</span></p>
                            )}
                        </div>

                        {/* Type */}
                        <div className="space-y-2">
                            <label className={LABEL}>Tipo</label>
                            <div className="flex rounded-xl overflow-hidden border border-[#232327]">
                                {(['entrada', 'salida'] as const).map(t => (
                                    <button key={t} type="button" onClick={() => setType(t)}
                                        className={cn("flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition-all",
                                            type === t
                                                ? t === 'entrada'
                                                    ? "bg-white/10 text-[#F3F3F3] border-r border-white/10"
                                                    : "bg-red-500/10 text-red-400"
                                                : "text-[#A0A0A8] hover:text-[#F3F3F3] border-r border-[#232327] last:border-0"
                                        )}>
                                        {t === 'entrada' ? '+ Entrada' : '− Salida'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Quantity */}
                        <div className="space-y-2">
                            <label className={LABEL}>Cantidad *</label>
                            <input type="number" required min="1" value={qty} onChange={e => setQty(e.target.value)}
                                className={INPUT} placeholder="0" />
                            {type === 'salida' && currentStock !== null && qty && (
                                <p className="text-xs text-[#A0A0A8]">
                                    Stock resultante:{' '}
                                    <span className={cn("font-semibold",
                                        currentStock - parseInt(qty) < 0 ? "text-red-400" : "text-[#22C55E]"
                                    )}>
                                        {currentStock - (parseInt(qty) || 0)}
                                    </span>
                                </p>
                            )}
                        </div>

                        {/* Reason */}
                        <div className="space-y-2">
                            <label className={LABEL}>Motivo *</label>
                            <select required value={reason} onChange={e => setReason(e.target.value)}
                                className={INPUT + " cursor-pointer"} style={{ colorScheme: 'dark' }}>
                                {REASONS.map(r => <option key={r} value={r} className="bg-[#141418]">{r}</option>)}
                            </select>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <label className={LABEL}>Notas</label>
                            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                                className={INPUT} placeholder="Detalle opcional..." />
                        </div>

                        {/* Date */}
                        <div className="space-y-2">
                            <label className={LABEL}>Fecha</label>
                            <input type="date" value={adjustedAt} onChange={e => setAdjustedAt(e.target.value)}
                                className={INPUT} style={{ colorScheme: 'dark' }} />
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="flex items-start gap-2 bg-red-900/20 border border-red-700/30 rounded-xl p-3">
                                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                                <p className="text-sm text-red-400">{error}</p>
                            </div>
                        )}

                        <button type="submit" disabled={loading || !productId}
                            className={cn("w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40 flex items-center justify-center gap-2",
                                type === 'entrada'
                                    ? "bg-white/10 text-[#F3F3F3] hover:bg-white/15 border border-white/15"
                                    : "bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-700/30"
                            )}>
                            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : success ? <Check className="h-4 w-4" /> : `Registrar ${type}`}
                        </button>
                    </form>
                </div>

                {/* Recent Adjustments Table */}
                <div className="lg:col-span-2">
                    <h2 className="font-serif text-2xl font-light text-[#F3F3F3] mb-5">Ajustes Recientes</h2>
                    {adjLoading ? (
                        <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-[#F3F3F3]" /></div>
                    ) : adjustments.length === 0 ? (
                        <div className="premium-card text-center py-16">
                            <p className="text-[#A0A0A8] font-serif italic">Sin ajustes registrados aún.</p>
                        </div>
                    ) : (
                        <div className="premium-card p-0 overflow-hidden divide-y divide-[#232327]">
                            <div className="grid grid-cols-5 px-6 py-3 bg-[#0E0E10] text-[10px] font-bold uppercase tracking-widest text-[#A0A0A8]">
                                <div className="col-span-2">Producto</div>
                                <div className="text-center">Cantidad</div>
                                <div className="text-center">Motivo</div>
                                <div className="text-right">Fecha</div>
                            </div>
                            {adjustments.map((adj: any) => (
                                <div key={adj.id} className="grid grid-cols-5 items-center px-6 py-4 hover:bg-[#1a1a1e] transition-colors">
                                    <div className="col-span-2">
                                        <p className="text-sm font-medium text-[#F3F3F3]">{adj.products?.name}</p>
                                        <p className="text-xs text-[#A0A0A8]">{adj.products?.brand}</p>
                                    </div>
                                    <div className="text-center">
                                        <span className={cn("text-sm font-bold", adj.delta_qty > 0 ? "text-[#22C55E]" : "text-red-400")}>
                                            {adj.delta_qty > 0 ? '+' : ''}{adj.delta_qty}
                                        </span>
                                    </div>
                                    <div className="text-center">
                                        <span className="text-xs text-[#A0A0A8]">{adj.reason}</span>
                                        {adj.notes && <p className="text-[10px] text-[#555555] mt-0.5">{adj.notes}</p>}
                                    </div>
                                    <div className="text-right text-xs text-[#A0A0A8]">
                                        {new Date(adj.adjusted_at).toLocaleDateString('es-CO')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
