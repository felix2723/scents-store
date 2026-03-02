'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { TrendingUp, Package, AlertCircle, DollarSign, Users, Loader2, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'

type Range = 'today' | 'week' | 'month' | 'all'

function getRangeDates(range: Range): { from: Date; to: Date } {
    const now = new Date()
    const to = new Date(now)
    to.setHours(23, 59, 59, 999)

    if (range === 'today') {
        const from = new Date(now)
        from.setHours(0, 0, 0, 0)
        return { from, to }
    }
    if (range === 'week') {
        const from = new Date(now)
        from.setDate(from.getDate() - 6)
        from.setHours(0, 0, 0, 0)
        return { from, to }
    }
    if (range === 'month') {
        const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
        return { from, to }
    }
    // all
    return { from: new Date('2000-01-01'), to }
}

const RANGE_OPTIONS: { key: Range; label: string }[] = [
    { key: 'today', label: 'Hoy' },
    { key: 'week', label: '7 días' },
    { key: 'month', label: 'Mes actual' },
    { key: 'all', label: 'Total' },
]

function DashboardContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const [range, setRange] = useState<Range>((searchParams.get('range') as Range) || 'month')
    const [loading, setLoading] = useState(true)

    const [stats, setStats] = useState({
        sales: 0,
        grossProfit: 0,
        expenses: 0,
        netProfit: 0,
        profitPerPartner: 0,
    })
    const [lowStockItems, setLowStockItems] = useState<any[]>([])
    const [salesTrend, setSalesTrend] = useState<{ date: string; amount: number }[]>([])

    const fetchData = useCallback(async (r: Range) => {
        setLoading(true)
        const supabase = createClient()
        const { from, to } = getRangeDates(r)

        // Parallel fetches
        const [
            { data: salesData },
            { data: expensesData },
            { data: lowStockData }
        ] = await Promise.all([
            supabase.from('sales')
                .select('total_cop, total_profit_cop, sold_at')
                .eq('is_voided', false)
                .gte('sold_at', from.toISOString())
                .lte('sold_at', to.toISOString()),

            supabase.from('expenses')
                .select('amount_cop')
                .gte('spent_at', from.toISOString())
                .lte('spent_at', to.toISOString()),

            supabase.from('products')
                .select('name, brand, current_stock')
                .eq('is_active', true)
                .lte('current_stock', 3)
                .order('current_stock', { ascending: true })
                .limit(5)
        ])

        const totalSales = (salesData || []).reduce((a, s) => a + Number(s.total_cop), 0)
        const grossProfit = (salesData || []).reduce((a, s) => a + Number(s.total_profit_cop), 0)
        const totalExpenses = (expensesData || []).reduce((a, e) => a + Number(e.amount_cop), 0)
        // utilidad_neta = utilidad_bruta (del margen sobre costo) - gastos del período
        const netProfit = grossProfit - totalExpenses

        // Build trend chart
        // For today/week: show by hour or day; for month/all: show by day
        const trendMap: Record<string, number> = {}
            ; (salesData || []).forEach(s => {
                let key: string
                if (r === 'today') {
                    key = new Date(s.sold_at).getHours() + 'h'
                } else if (r === 'week') {
                    key = new Date(s.sold_at).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit' })
                } else {
                    key = new Date(s.sold_at).getDate().toString()
                }
                trendMap[key] = (trendMap[key] || 0) + Number(s.total_cop)
            })

        let trend: { date: string; amount: number }[] = []
        if (r === 'today') {
            trend = Array.from({ length: 24 }, (_, i) => ({
                date: i + 'h',
                amount: trendMap[i + 'h'] || 0
            }))
        } else if (r === 'week') {
            const days = []
            for (let i = 6; i >= 0; i--) {
                const d = new Date()
                d.setDate(d.getDate() - i)
                const key = d.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit' })
                days.push({ date: key, amount: trendMap[key] || 0 })
            }
            trend = days
        } else if (r === 'month') {
            const daysInMonth = new Date().getDate()
            trend = Array.from({ length: daysInMonth }, (_, i) => ({
                date: (i + 1).toString(),
                amount: trendMap[(i + 1).toString()] || 0
            }))
        } else {
            // all — group by day (show up to 60 points)
            const sortedKeys = Object.keys(trendMap).sort()
            trend = sortedKeys.map(k => ({ date: k, amount: trendMap[k] }))
            if (trend.length === 0) trend = [{ date: '-', amount: 0 }]
        }

        setStats({
            sales: totalSales,
            grossProfit,
            expenses: totalExpenses,
            netProfit,
            profitPerPartner: Math.round(netProfit * 0.5),
        })
        setLowStockItems(lowStockData || [])
        setSalesTrend(trend)
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchData(range)
        router.replace(`/dashboard?range=${range}`, { scroll: false })
    }, [range, fetchData])

    function handleRange(r: Range) {
        setRange(r)
    }

    const rangeLabel: Record<Range, string> = {
        today: 'Hoy',
        week: 'Últimos 7 días',
        month: 'Mes actual',
        all: 'Histórico total',
    }

    const kpis = [
        {
            label: 'Ingresos',
            value: `$${stats.sales.toLocaleString()}`,
            sub: rangeLabel[range],
            icon: DollarSign,
            accent: 'text-[#22C55E]',
            bg: 'bg-[#22C55E]/10'
        },
        {
            label: 'Gastos',
            value: `$${stats.expenses.toLocaleString()}`,
            sub: 'Egresos del período',
            icon: Receipt,
            accent: 'text-red-400',
            bg: 'bg-red-500/10'
        },
        {
            label: 'Utilidad Neta',
            value: `$${stats.netProfit.toLocaleString()}`,
            sub: 'Margen − gastos',
            icon: TrendingUp,
            accent: stats.netProfit >= 0 ? 'text-blue-400' : 'text-amber-400',
            bg: stats.netProfit >= 0 ? 'bg-blue-500/10' : 'bg-amber-500/10'
        },
        {
            label: 'Utilidad por Socio',
            value: `$${stats.profitPerPartner.toLocaleString()}`,
            sub: '50% de utilidad neta',
            icon: Users,
            accent: 'text-purple-400',
            bg: 'bg-purple-500/10'
        },
    ]

    const maxTrend = Math.max(...salesTrend.map(d => d.amount), 1)

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            <header className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="serif-title text-5xl font-light text-[#F3F3F3]">Resumen Ejecutivo</h1>
                    <p className="mt-3 text-lg text-[#A0A0A8]">Monitoreo en tiempo real de Scents Store.</p>
                </div>
                {/* Range Selector */}
                <div className="flex gap-1 bg-[#141418] border border-[#232327] rounded-xl p-1">
                    {RANGE_OPTIONS.map(o => (
                        <button key={o.key} onClick={() => handleRange(o.key)}
                            className={cn("px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all",
                                range === o.key
                                    ? "bg-white/10 text-[#F3F3F3]"
                                    : "text-[#A0A0A8] hover:text-[#F3F3F3]"
                            )}>
                            {o.label}
                        </button>
                    ))}
                </div>
            </header>

            {loading ? (
                <div className="h-[60vh] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-[#F3F3F3]" />
                </div>
            ) : (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
                        {kpis.map((kpi, i) => (
                            <div key={i} className="premium-card group">
                                <div className={cn("inline-flex rounded-xl p-3 mb-5", kpi.bg)}>
                                    <kpi.icon className={cn("h-5 w-5", kpi.accent)} />
                                </div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[#A0A0A8]">{kpi.label}</p>
                                <p className={cn("mt-2 text-3xl font-light", kpi.accent)}>{kpi.value}</p>
                                <p className="mt-1 text-[10px] text-[#A0A0A8]">{kpi.sub}</p>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                        {/* Sales Trend Chart */}
                        <div className="lg:col-span-2 premium-card">
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="serif-title text-2xl font-light text-[#F3F3F3]">Tendencia de Ventas</h2>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[#A0A0A8]">
                                    {rangeLabel[range]}
                                </span>
                            </div>

                            {salesTrend.every(d => d.amount === 0) ? (
                                <div className="h-48 flex items-center justify-center border-2 border-dashed border-[#232327] rounded-2xl">
                                    <p className="font-serif italic text-[#A0A0A8]">Sin ventas en el rango seleccionado</p>
                                </div>
                            ) : (
                                <div className="h-48 flex items-end gap-[2px]">
                                    {salesTrend.map((day, i) => {
                                        const height = (day.amount / maxTrend) * 100
                                        return (
                                            <div key={i} className="flex-1 flex flex-col items-center group/bar relative h-full justify-end">
                                                <div
                                                    className={cn(
                                                        "w-full rounded-t-sm transition-all duration-300",
                                                        day.amount > 0
                                                            ? "bg-[#22C55E]/40 group-hover/bar:bg-[#22C55E]"
                                                            : "bg-[#232327]"
                                                    )}
                                                    style={{ height: `${Math.max(height, day.amount > 0 ? 3 : 1)}%` }}
                                                />
                                                {day.amount > 0 && (
                                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#141418] border border-[#232327] text-[#F3F3F3] text-[9px] py-1 px-2 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                                                        ${day.amount.toLocaleString()}
                                                    </div>
                                                )}
                                                {(i === 0 || (i + 1) % 5 === 0) && (
                                                    <span className="text-[8px] mt-2 text-[#A0A0A8] truncate max-w-full px-0.5">{day.date}</span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Right Panel */}
                        <div className="space-y-6">
                            {/* Low Stock Alerts */}
                            <div className="premium-card">
                                <h3 className="serif-title text-lg font-light text-[#F3F3F3] mb-5">Alertas de Stock</h3>
                                <div className="space-y-3">
                                    {lowStockItems.length === 0 ? (
                                        <p className="text-sm italic text-[#A0A0A8] py-6 text-center">Sin alertas activas</p>
                                    ) : lowStockItems.map((item, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-[#0E0E10] rounded-xl border border-[#232327]">
                                            <div>
                                                <p className="text-sm font-medium text-[#F3F3F3]">{item.name}</p>
                                                <p className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">{item.brand}</p>
                                            </div>
                                            <span className="text-sm font-bold text-red-400">{item.current_stock} uds</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Insight */}
                            <div className="premium-card border-white/15">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="h-2 w-2 rounded-full bg-[#22C55E] animate-pulse" />
                                    <h3 className="text-sm font-semibold text-[#22C55E]">Resumen Financiero</h3>
                                </div>
                                <p className="text-sm text-[#A0A0A8] leading-relaxed">
                                    {stats.sales === 0
                                        ? "Sin ventas en el rango seleccionado. Registra ventas para activar el análisis."
                                        : `Ingresos: $${stats.sales.toLocaleString()} · Gastos: $${stats.expenses.toLocaleString()} · Neto: $${stats.netProfit.toLocaleString()} COP. Margen bruto: ${Math.round((stats.grossProfit / stats.sales) * 100)}%.`
                                    }
                                </p>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

export default function DashboardPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-[#F3F3F3]" /></div>}>
            <DashboardContent />
        </Suspense>
    )
}
