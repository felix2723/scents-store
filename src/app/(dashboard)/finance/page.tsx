'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Loader2, TrendingUp, TrendingDown, DollarSign, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type Period = '7d' | '30d' | 'month'

const METHOD_META: Record<string, { icon: string; label: string; color: string }> = {
    cash: { icon: '💵', label: 'Efectivo', color: 'text-green-400' },
    nequi: { icon: '🟣', label: 'Nequi', color: 'text-purple-400' },
    bancolombia: { icon: '🟡', label: 'Bancolombia', color: 'text-yellow-400' },
    daviplata: { icon: '🔴', label: 'Daviplata', color: 'text-red-400' },
}

const TYPE_LABEL: Record<string, string> = {
    sale: 'Venta',
    credit_payment: 'Abono crédito',
    expense: 'Gasto',
    transfer: 'Transferencia',
}

export default function FinancePage() {
    const [period, setPeriod] = useState<Period>('30d')
    const [data, setData] = useState<any | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => { load() }, [period])

    function getPeriodRange(): { from: string; to: string } {
        const now = new Date()
        const to = now.toISOString()
        if (period === '7d') {
            const from = new Date(now)
            from.setDate(from.getDate() - 7)
            return { from: from.toISOString(), to }
        }
        if (period === '30d') {
            const from = new Date(now)
            from.setDate(from.getDate() - 30)
            return { from: from.toISOString(), to }
        }
        // month = current calendar month
        const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        return { from, to }
    }

    async function load() {
        setLoading(true)
        const supabase = createClient()
        const { from, to } = getPeriodRange()
        const { data: res } = await supabase.rpc('get_finance_summary', {
            p_from: from,
            p_to: to,
        })
        setData(res)
        setLoading(false)
    }

    const PERIODS: { key: Period; label: string }[] = [
        { key: '7d', label: 'Últimos 7 días' },
        { key: '30d', label: 'Últimos 30 días' },
        { key: 'month', label: 'Este mes' },
    ]

    return (
        <div className="space-y-10 animate-in fade-in duration-700 pb-16">
            {/* Header */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="serif-title text-5xl font-light text-[#F3F3F3]">Finanzas</h1>
                    <p className="mt-3 text-[#A0A0A8]">Flujo de caja: ingresos, egresos y transferencias.</p>
                </div>
                {/* Period selector */}
                <div className="flex gap-1 bg-[#141418] border border-[#232327] rounded-xl p-1">
                    {PERIODS.map(p => (
                        <button key={p.key} onClick={() => setPeriod(p.key)}
                            className={cn("px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all",
                                period === p.key
                                    ? "bg-white/10 text-[#F3F3F3]"
                                    : "text-[#A0A0A8] hover:text-[#F3F3F3]"
                            )}>
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-[#22C55E]" /></div>
            ) : !data ? (
                <div className="premium-card text-center py-20">
                    <p className="text-[#A0A0A8] font-serif italic">Sin datos para este período.</p>
                </div>
            ) : (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        <div className="premium-card border-l-4 border-[#22C55E]">
                            <div className="flex items-center gap-3 mb-3">
                                <TrendingUp className="h-5 w-5 text-[#22C55E]" />
                                <p className="text-xs uppercase tracking-widest text-[#A0A0A8]">Ingresos Totales</p>
                            </div>
                            <p className="text-4xl font-light text-[#22C55E]">${Number(data.total_income).toLocaleString()}</p>
                        </div>
                        <div className="premium-card border-l-4 border-red-500">
                            <div className="flex items-center gap-3 mb-3">
                                <TrendingDown className="h-5 w-5 text-red-400" />
                                <p className="text-xs uppercase tracking-widest text-[#A0A0A8]">Egresos Totales</p>
                            </div>
                            <p className="text-4xl font-light text-red-400">${Number(data.total_expenses).toLocaleString()}</p>
                        </div>
                        <div className={cn("premium-card border-l-4", Number(data.net) >= 0 ? "border-blue-400" : "border-amber-400")}>
                            <div className="flex items-center gap-3 mb-3">
                                <DollarSign className={cn("h-5 w-5", Number(data.net) >= 0 ? "text-blue-400" : "text-amber-400")} />
                                <p className="text-xs uppercase tracking-widest text-[#A0A0A8]">Neto del Período</p>
                            </div>
                            <p className={cn("text-4xl font-light", Number(data.net) >= 0 ? "text-blue-400" : "text-amber-400")}>
                                {Number(data.net) >= 0 ? '+' : ''}${Number(data.net).toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* By Method Table */}
                    <div>
                        <h2 className="font-serif text-2xl font-light text-[#F3F3F3] mb-5">Por Método de Pago</h2>
                        <div className="premium-card p-0 overflow-hidden divide-y divide-[#232327]">
                            <div className="grid grid-cols-4 px-6 py-3 bg-[#0E0E10] text-[10px] font-bold uppercase tracking-widest text-[#A0A0A8]">
                                <div>Método</div>
                                <div className="text-right text-[#22C55E]">Ingresos</div>
                                <div className="text-right text-red-400">Egresos</div>
                                <div className="text-right">Neto</div>
                            </div>
                            {(data.by_method || []).map((row: any) => {
                                const meta = METHOD_META[row.method] || { icon: '•', label: row.method, color: 'text-[#F3F3F3]' }
                                const net = Number(row.net)
                                return (
                                    <div key={row.method} className="grid grid-cols-4 items-center px-6 py-5 hover:bg-[#1a1a1e] transition-colors">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl">{meta.icon}</span>
                                            <span className="text-sm font-medium text-[#F3F3F3]">{meta.label}</span>
                                        </div>
                                        <div className="text-right text-sm font-medium text-[#22C55E]">
                                            {Number(row.income) > 0 ? `$${Number(row.income).toLocaleString()}` : '—'}
                                        </div>
                                        <div className="text-right text-sm font-medium text-red-400">
                                            {Number(row.expenses) > 0 ? `-$${Number(row.expenses).toLocaleString()}` : '—'}
                                        </div>
                                        <div className={cn("text-right text-sm font-bold", net > 0 ? "text-[#22C55E]" : net < 0 ? "text-red-400" : "text-[#A0A0A8]")}>
                                            {net > 0 ? '+' : ''}{net !== 0 ? `$${net.toLocaleString()}` : '$0'}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Transactions Feed */}
                    <div>
                        <h2 className="font-serif text-2xl font-light text-[#F3F3F3] mb-5">Últimos Movimientos</h2>
                        {!data.movements || data.movements.length === 0 ? (
                            <div className="premium-card text-center py-10">
                                <p className="text-[#A0A0A8] font-serif italic">Sin movimientos en este período.</p>
                            </div>
                        ) : (
                            <div className="premium-card p-0 divide-y divide-[#232327] overflow-hidden">
                                {data.movements.slice(0, 30).map((m: any, i: number) => {
                                    const meta = METHOD_META[m.method] || { icon: '•', label: m.method, color: 'text-[#F3F3F3]' }
                                    return (
                                        <div key={i} className="flex items-center gap-4 px-6 py-4 hover:bg-[#1a1a1e] transition-colors">
                                            <span className="text-xl shrink-0">{meta.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-[#F3F3F3] truncate">
                                                    {TYPE_LABEL[m.type] || m.type}: {m.label}
                                                </p>
                                                <p className="text-xs text-[#A0A0A8]">
                                                    {new Date(m.moved_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                                                    {' · '}{meta.label}
                                                </p>
                                            </div>
                                            <span className={cn("text-sm font-bold shrink-0",
                                                m.positive ? "text-[#22C55E]" : "text-red-400"
                                            )}>
                                                {m.positive ? '+' : '-'}${Number(m.amount).toLocaleString()}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
