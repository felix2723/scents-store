'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { ArrowLeft, Download, Loader2, Filter } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { use } from 'react'

const TYPE_STYLE: Record<string, string> = {
    batch: 'text-blue-400 bg-blue-900/20 border-blue-700/30',
    sale: 'text-red-400 bg-red-900/20 border-red-700/30',
    adjustment: 'text-amber-400 bg-amber-900/20 border-amber-700/30',
}
const TYPE_LABEL: Record<string, string> = {
    batch: 'Ingreso lote',
    sale: 'Venta',
    adjustment: 'Ajuste',
}

export default function ProductMovementsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [product, setProduct] = useState<any>(null)
    const [movements, setMovements] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [fromDate, setFromDate] = useState(() => {
        const d = new Date()
        d.setMonth(d.getMonth() - 1)
        return d.toISOString().split('T')[0]
    })
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0])

    useEffect(() => {
        const supabase = createClient()
        supabase.from('products').select('id, name, brand, current_stock').eq('id', id).single()
            .then(({ data }) => { if (data) setProduct(data) })
    }, [id])

    useEffect(() => {
        load()
    }, [id, fromDate, toDate])

    async function load() {
        setLoading(true)
        const supabase = createClient()
        const { data, error } = await supabase.rpc('get_product_movements', {
            p_product_id: id,
            p_from: new Date(fromDate).toISOString(),
            p_to: new Date(toDate + 'T23:59:59').toISOString(),
        })
        if (data) {
            const arr = Array.isArray(data) ? data : []
            // Sort by moved_at descending
            arr.sort((a: any, b: any) => new Date(b.moved_at).getTime() - new Date(a.moved_at).getTime())
            setMovements(arr)
        }
        setLoading(false)
    }

    function exportCSV() {
        const headers = ['Fecha', 'Tipo', 'Cantidad', 'Detalle']
        const rows = movements.map((m: any) => [
            new Date(m.moved_at).toLocaleDateString('es-CO'),
            TYPE_LABEL[m.type] || m.type,
            m.qty,
            (m.detail || '').replace(/,/g, ';')
        ].join(','))
        const csv = [headers.join(','), ...rows].join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `kardex-${product?.name || id}-${fromDate}-${toDate}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const totalIn = movements.filter(m => m.qty > 0).reduce((a, m) => a + Number(m.qty), 0)
    const totalOut = movements.filter(m => m.qty < 0).reduce((a, m) => a + Number(m.qty), 0)

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/products"
                        className="p-2 rounded-lg border border-[#232327] text-[#A0A0A8] hover:text-[#F3F3F3] hover:border-[#2e2e35] transition-all">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                    <div>
                        <h1 className="serif-title text-4xl font-light text-[#F3F3F3]">
                            {product ? `${product.brand} – ${product.name}` : 'Cargando...'}
                        </h1>
                        {product && (
                            <p className="mt-1 text-[#A0A0A8]">
                                Kardex · Stock actual:{' '}
                                <span className="text-[#22C55E] font-semibold">{product.current_stock}</span>
                            </p>
                        )}
                    </div>
                </div>
                <button onClick={exportCSV} disabled={movements.length === 0}
                    className="flex items-center gap-2 border border-[#232327] text-[#A0A0A8] hover:text-[#F3F3F3] hover:border-[#2e2e35] px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all disabled:opacity-40">
                    <Download className="h-4 w-4" />
                    Exportar CSV
                </button>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Entradas', value: `+${totalIn}`, color: 'text-[#22C55E]' },
                    { label: 'Salidas', value: `${totalOut}`, color: 'text-red-400' },
                    { label: 'Total movimientos', value: movements.length.toString(), color: 'text-[#F3F3F3]' },
                ].map((k, i) => (
                    <div key={i} className="premium-card py-5">
                        <p className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">{k.label}</p>
                        <p className={cn("text-3xl font-light mt-2", k.color)}>{k.value}</p>
                    </div>
                ))}
            </div>

            {/* Date Filter */}
            <div className="flex items-center gap-4 p-4 bg-[#141418] border border-[#232327] rounded-xl">
                <Filter className="h-4 w-4 text-[#A0A0A8]" />
                <span className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">Período</span>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                    className="bg-transparent border-b border-[#232327] py-1 text-[#F3F3F3] focus:border-[#22C55E] focus:outline-none text-sm"
                    style={{ colorScheme: 'dark' }} />
                <span className="text-[#A0A0A8]">→</span>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                    className="bg-transparent border-b border-[#232327] py-1 text-[#F3F3F3] focus:border-[#22C55E] focus:outline-none text-sm"
                    style={{ colorScheme: 'dark' }} />
                <button onClick={load}
                    className="ml-auto text-xs font-bold text-[#22C55E] uppercase tracking-wide hover:underline">
                    Aplicar
                </button>
            </div>

            {/* Movements Table */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-[#22C55E]" /></div>
            ) : movements.length === 0 ? (
                <div className="premium-card text-center py-20">
                    <p className="text-[#A0A0A8] font-serif italic">Sin movimientos en este período.</p>
                </div>
            ) : (
                <div className="premium-card p-0 overflow-hidden divide-y divide-[#232327]">
                    <div className="grid grid-cols-5 px-6 py-3 bg-[#0E0E10] text-[10px] font-bold uppercase tracking-widest text-[#A0A0A8]">
                        <div>Fecha</div>
                        <div>Tipo</div>
                        <div className="text-center">Cantidad</div>
                        <div className="col-span-2">Detalle</div>
                    </div>
                    {movements.map((m: any, i: number) => (
                        <div key={m.id || i} className="grid grid-cols-5 items-center px-6 py-4 hover:bg-[#1a1a1e] transition-colors">
                            <div className="text-sm text-[#A0A0A8]">
                                {new Date(m.moved_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                            <div>
                                <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border",
                                    TYPE_STYLE[m.type] || 'text-[#A0A0A8] border-[#232327]'
                                )}>
                                    {TYPE_LABEL[m.type] || m.type}
                                </span>
                            </div>
                            <div className="text-center">
                                <span className={cn("text-sm font-bold", Number(m.qty) > 0 ? "text-[#22C55E]" : "text-red-400")}>
                                    {Number(m.qty) > 0 ? '+' : ''}{m.qty}
                                </span>
                            </div>
                            <div className="col-span-2 text-sm text-[#A0A0A8] truncate pr-4">
                                {m.detail || '—'}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
