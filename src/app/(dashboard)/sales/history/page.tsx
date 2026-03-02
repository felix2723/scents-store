'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Search, Loader2, X, Ban } from 'lucide-react'
import { cn } from '@/lib/utils'

type Range = 'today' | 'week' | 'month' | 'all'

function getRangeDates(range: Range): { from: string; to: string } {
    const now = new Date()
    const to = new Date(now); to.setHours(23, 59, 59, 999)
    if (range === 'today') {
        const from = new Date(now); from.setHours(0, 0, 0, 0)
        return { from: from.toISOString(), to: to.toISOString() }
    }
    if (range === 'week') {
        const from = new Date(now); from.setDate(from.getDate() - 6); from.setHours(0, 0, 0, 0)
        return { from: from.toISOString(), to: to.toISOString() }
    }
    if (range === 'month') {
        const from = new Date(now.getFullYear(), now.getMonth(), 1)
        return { from: from.toISOString(), to: to.toISOString() }
    }
    return { from: '2000-01-01T00:00:00Z', to: to.toISOString() }
}

const METHOD_LABEL: Record<string, string> = {
    cash: '💵 Efectivo', nequi: '🟣 Nequi',
    bancolombia: '🟡 Bancolombia', daviplata: '🔴 Daviplata'
}

const RANGE_OPTIONS: { key: Range; label: string }[] = [
    { key: 'today', label: 'Hoy' },
    { key: 'week', label: '7 días' },
    { key: 'month', label: 'Mes actual' },
    { key: 'all', label: 'Total' },
]

export default function SalesHistoryPage() {
    const [range, setRange] = useState<Range>('month')
    const [search, setSearch] = useState('')
    const [sales, setSales] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState<any | null>(null)
    const [creditDetail, setCreditDetail] = useState<any | null>(null)
    const [voidingId, setVoidingId] = useState<string | null>(null)

    const fetchSales = useCallback(async (r: Range) => {
        setLoading(true)
        const supabase = createClient()
        const { from, to } = getRangeDates(r)
        const { data } = await supabase
            .from('sales')
            .select('*')
            .gte('sold_at', from)
            .lte('sold_at', to)
            .order('sold_at', { ascending: false })
        setSales(data || [])
        setLoading(false)
    }, [])

    useEffect(() => { fetchSales(range) }, [range, fetchSales])

    async function openDetail(sale: any) {
        setSelected(sale)
        setCreditDetail(null)
        if (sale.sale_type === 'credito') {
            const supabase = createClient()
            const { data } = await supabase
                .from('credits')
                .select('*, credit_payments(*)')
                .eq('sale_id', sale.id)
                .single()
            setCreditDetail(data)
        }
    }

    async function handleVoid(saleId: string) {
        const reason = prompt('Motivo de anulación:')
        if (!reason) return
        setVoidingId(saleId)
        const supabase = createClient()
        const { error } = await supabase.rpc('void_sale', {
            p_sale_id: saleId,
            p_reason: reason
        })
        if (!error) {
            fetchSales(range)
            setSelected(null)
        } else {
            alert('Error al anular: ' + error.message)
        }
        setVoidingId(null)
    }

    const filteredSales = sales.filter(s => {
        if (!search) return true
        const q = search.toLowerCase()
        return (
            s.notes?.toLowerCase().includes(q) ||
            s.payment_method?.includes(q) ||
            s.sale_type?.includes(q) ||
            String(s.total_cop).includes(q)
        )
    })

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="serif-title text-5xl font-light text-[#F3F3F3]">Historial de Ventas</h1>
                    <p className="mt-3 text-[#A0A0A8]">Registro completo de todas las transacciones.</p>
                </div>
                <div className="flex gap-1 bg-[#141418] border border-[#232327] rounded-xl p-1">
                    {RANGE_OPTIONS.map(o => (
                        <button key={o.key} onClick={() => setRange(o.key)}
                            className={cn("px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all",
                                range === o.key
                                    ? "bg-white/10 text-[#F3F3F3]"
                                    : "text-[#A0A0A8] hover:text-[#F3F3F3]"
                            )}>
                            {o.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A0A0A8]" />
                <input type="text" placeholder="Buscar por método, tipo o notas..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full bg-[#141418] border border-[#232327] rounded-xl pl-12 pr-4 py-3 text-sm text-[#F3F3F3] placeholder:text-[#A0A0A8] focus:border-white/30 focus:outline-none" />
            </div>

            {/* Summary */}
            {!loading && (
                <div className="flex items-center gap-6 text-sm text-[#A0A0A8]">
                    <span><strong className="text-[#F3F3F3]">{filteredSales.length}</strong> ventas</span>
                    <span>Total: <strong className="text-[#22C55E]">${filteredSales.filter(s => !s.is_voided).reduce((a, s) => a + Number(s.total_cop), 0).toLocaleString()}</strong></span>
                    <span>Anuladas: <strong className="text-red-400">{filteredSales.filter(s => s.is_voided).length}</strong></span>
                </div>
            )}

            {/* Table */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-[#F3F3F3]" /></div>
            ) : filteredSales.length === 0 ? (
                <div className="premium-card text-center py-20">
                    <p className="text-[#A0A0A8] font-serif italic">Sin ventas en este período.</p>
                </div>
            ) : (
                <div className="premium-card p-0 overflow-hidden divide-y divide-[#232327]">
                    {/* Header row */}
                    <div className="grid grid-cols-6 px-6 py-3 bg-[#0E0E10] text-[10px] font-bold uppercase tracking-widest text-[#A0A0A8]">
                        <div className="col-span-2">Fecha</div>
                        <div>Tipo</div>
                        <div className="text-right">Total</div>
                        <div className="text-right">Descuento</div>
                        <div>Método</div>
                    </div>
                    {/* Data rows */}
                    {filteredSales.map((sale: any) => (
                        <button key={sale.id} onClick={() => openDetail(sale)}
                            className="w-full grid grid-cols-6 items-center px-6 py-4 hover:bg-[#1a1a1e] transition-colors text-left">
                            <div className="col-span-2 text-sm text-[#F3F3F3]">
                                {new Date(sale.sold_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                                <p className="text-[10px] text-[#A0A0A8]">
                                    {new Date(sale.sold_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            <div>
                                <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase border",
                                    sale.sale_type === 'contado'
                                        ? "text-[#F3F3F3] bg-white/10 border-white/15"
                                        : "text-purple-400 bg-purple-500/10 border-purple-500/20"
                                )}>
                                    {sale.sale_type}
                                </span>
                            </div>
                            <div className={cn("text-right text-sm font-bold",
                                sale.is_voided ? "text-[#555555] line-through" : "text-[#F3F3F3]"
                            )}>
                                ${Number(sale.total_cop).toLocaleString()}
                            </div>
                            <div className="text-right text-sm text-red-400">
                                {Number(sale.discount_cop) > 0 ? `-$${Number(sale.discount_cop).toLocaleString()}` : '—'}
                            </div>
                            <div className="text-xs text-[#A0A0A8]">
                                {METHOD_LABEL[sale.payment_method] || sale.payment_method || '—'}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Detail Drawer */}
            {selected && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start justify-end z-50 p-4">
                    <div className="bg-[#141418] border border-[#232327] rounded-2xl w-full max-w-lg h-full overflow-y-auto animate-in slide-in-from-right-4 duration-300">
                        <div className="sticky top-0 bg-[#141418] border-b border-[#232327] px-6 py-5 flex items-center justify-between z-10">
                            <div>
                                <h2 className="text-lg font-semibold text-[#F3F3F3]">Detalle de Venta</h2>
                                <p className="text-xs text-[#A0A0A8] mt-0.5">{selected.id.slice(0, 8)}...</p>
                            </div>
                            <button onClick={() => setSelected(null)} className="text-[#A0A0A8] hover:text-[#F3F3F3] transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="px-6 py-6 space-y-6">
                            {/* Meta */}
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { label: 'Fecha', value: new Date(selected.sold_at).toLocaleString('es-CO') },
                                    { label: 'Tipo', value: selected.sale_type },
                                    { label: 'Método de pago', value: METHOD_LABEL[selected.payment_method] || selected.payment_method || '—' },
                                ].map((f, i) => (
                                    <div key={i}>
                                        <p className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">{f.label}</p>
                                        <p className="text-sm font-medium text-[#F3F3F3] mt-1">{f.value}</p>
                                    </div>
                                ))}
                            </div>

                            {selected.is_voided && (
                                <div className="p-3 bg-red-900/10 border border-red-500/20 rounded-xl">
                                    <p className="text-sm text-red-400 font-medium">🚫 Esta venta fue anulada</p>
                                </div>
                            )}

                            {selected.notes && (
                                <div className="p-3 bg-[#0E0E10] rounded-xl border border-[#232327]">
                                    <p className="text-xs text-[#A0A0A8]">Notas</p>
                                    <p className="text-sm text-[#F3F3F3] mt-1">{selected.notes}</p>
                                </div>
                            )}

                            {/* Items */}
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[#A0A0A8] mb-3">Productos vendidos</p>
                                <div className="rounded-xl overflow-hidden border border-[#232327] divide-y divide-[#232327]">
                                    {(selected.items || []).length === 0 ? (
                                        <p className="text-sm text-[#A0A0A8] px-4 py-3 italic">Sin detalle de ítems disponible.</p>
                                    ) : (selected.items || []).map((item: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-[#0E0E10]">
                                            <div className="flex-1">
                                                <p className="text-sm text-[#F3F3F3]">{item.product_id?.slice(0, 8)}...</p>
                                                <p className="text-xs text-[#A0A0A8]">Cant: {item.qty} × ${Number(item.sell_price).toLocaleString()}</p>
                                            </div>
                                            <p className="text-sm font-bold text-[#F3F3F3]">
                                                ${(item.qty * Number(item.sell_price)).toLocaleString()}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Financial Summary */}
                            <div className="space-y-2 border-t border-[#232327] pt-4">
                                <div className="flex justify-between text-sm text-[#A0A0A8]">
                                    <span>Subtotal</span>
                                    <span>${Number(selected.subtotal_cop || selected.total_cop).toLocaleString()}</span>
                                </div>
                                {Number(selected.discount_cop) > 0 && (
                                    <div className="flex justify-between text-sm text-red-400">
                                        <span>Descuento</span>
                                        <span>-${Number(selected.discount_cop).toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-base font-bold text-[#F3F3F3] pt-1 border-t border-[#232327]">
                                    <span>Total</span>
                                    <span className="text-[#22C55E]">${Number(selected.total_cop).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-xs text-[#A0A0A8]">
                                    <span>Utilidad estimada</span>
                                    <span>${Number(selected.total_profit_cop || 0).toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Credit Detail */}
                            {selected.sale_type === 'credito' && (
                                <div className="border border-purple-500/20 rounded-xl p-4 bg-purple-500/5 space-y-3">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Crédito</p>
                                    {!creditDetail ? (
                                        <div className="flex justify-center py-4"><Loader2 className="animate-spin h-5 w-5 text-purple-400" /></div>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <p className="text-[10px] text-[#A0A0A8]">Cliente</p>
                                                    <p className="text-sm text-[#F3F3F3]">{creditDetail.customer_name}</p>
                                                </div>
                                                {creditDetail.customer_phone && (
                                                    <div>
                                                        <p className="text-[10px] text-[#A0A0A8]">Teléfono</p>
                                                        <p className="text-sm text-[#F3F3F3]">{creditDetail.customer_phone}</p>
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-[10px] text-[#A0A0A8]">Abonado</p>
                                                    <p className="text-sm font-bold text-[#22C55E]">${Number(creditDetail.paid_cop).toLocaleString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-[#A0A0A8]">Deuda actual</p>
                                                    <p className="text-sm font-bold text-amber-400">${Number(creditDetail.due_cop).toLocaleString()}</p>
                                                </div>
                                            </div>
                                            {creditDetail.credit_payments?.length > 0 && (
                                                <div className="space-y-2 border-t border-purple-500/20 pt-3">
                                                    <p className="text-[10px] text-purple-400 uppercase tracking-widest">Historial de abonos</p>
                                                    {creditDetail.credit_payments.map((p: any) => (
                                                        <div key={p.id} className="flex items-center justify-between text-xs">
                                                            <span className="text-[#A0A0A8]">{new Date(p.paid_at).toLocaleDateString('es-CO')}</span>
                                                            <span className="text-[#A0A0A8]">{METHOD_LABEL[p.payment_method] || p.payment_method}</span>
                                                            <span className="font-bold text-[#22C55E]">+${Number(p.amount_cop).toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Void Button */}
                            {!selected.is_voided && (
                                <button onClick={() => handleVoid(selected.id)} disabled={voidingId === selected.id}
                                    className="w-full py-3 border border-red-700/30 rounded-xl text-sm text-red-400 hover:bg-red-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-40">
                                    <Ban className="h-4 w-4" />
                                    {voidingId === selected.id ? 'Anulando...' : 'Anular esta venta'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
