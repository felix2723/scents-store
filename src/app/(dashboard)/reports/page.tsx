'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { reportsService } from '@/lib/services/api'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ReportsPage() {
    const [report, setReport] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            const { data: reportData } = await reportsService.getProfitabilityReport()
            const supabase = createClient()
            const { data: products } = await supabase.from('products').select('*')
            if (reportData && products) {
                const enriched = products.map(p => {
                    const stats = reportData[p.id] || { qty: 0, revenue: 0, cost: 0, profit: 0 }
                    return {
                        ...p, ...stats,
                        utility_per_unit: stats.qty > 0 ? stats.profit / stats.qty : 0,
                        margin: stats.revenue > 0 ? (stats.profit / stats.revenue) * 100 : 0
                    }
                })
                setReport(enriched)
            }
            setLoading(false)
        }
        load()
    }, [])

    const topSold = [...report].sort((a, b) => b.qty - a.qty).slice(0, 5)
    const bottomSold = [...report].sort((a, b) => a.qty - b.qty).slice(0, 5)

    if (loading) return <div className="p-10 text-center text-[#A0A0A8]">Analizando datos...</div>

    return (
        <div className="space-y-12 pb-20 animate-in fade-in duration-700">
            <div>
                <h1 className="font-serif text-4xl font-light tracking-tight text-[#F3F3F3]">
                    Reportes de Rentabilidad
                </h1>
                <p className="mt-2 text-[#A0A0A8]">Análisis de desempeño y márgenes</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {[
                    { label: 'Total Utilidad Bruta', value: `$${report.reduce((a, c) => a + c.profit, 0).toLocaleString()}`, accent: 'border-[#22C55E]' },
                    { label: 'Margen Promedio', value: `${(report.reduce((a, c) => a + c.margin, 0) / (report.filter(r => r.qty > 0).length || 1)).toFixed(1)}%`, accent: 'border-blue-400' },
                    { label: 'Unidades Vendidas', value: `${report.reduce((a, c) => a + c.qty, 0)} uds`, accent: 'border-[#232327]' },
                ].map((c, i) => (
                    <div key={i} className={cn("premium-card border-l-4", c.accent)}>
                        <p className="text-xs font-semibold uppercase tracking-widest text-[#A0A0A8]">{c.label}</p>
                        <p className="mt-4 text-4xl font-light text-[#F3F3F3]">{c.value}</p>
                    </div>
                ))}
            </div>

            {/* Main Table */}
            <div className="premium-card p-0 overflow-hidden">
                <div className="px-8 py-6 border-b border-[#232327]">
                    <h2 className="font-serif text-xl font-light text-[#F3F3F3]">Rentabilidad por Producto</h2>
                </div>
                <table className="w-full text-left">
                    <thead className="bg-[#0E0E10] text-[10px] font-bold uppercase tracking-wider text-[#A0A0A8]">
                        <tr>
                            <th className="px-8 py-4">Producto</th>
                            <th className="px-8 py-4">Uds</th>
                            <th className="px-8 py-4">Ingresos</th>
                            <th className="px-8 py-4 text-right">Utilidad</th>
                            <th className="px-8 py-4 text-right">Margen</th>
                            <th className="px-8 py-4 text-right">Utilidad/Uds</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#232327]">
                        {report.map((item) => (
                            <tr key={item.id} className="hover:bg-[#1a1a1e] transition-colors">
                                <td className="px-8 py-5">
                                    <div className="font-serif text-base text-[#F3F3F3]">{item.name}</div>
                                    <div className="text-xs text-[#A0A0A8]">{item.brand}</div>
                                </td>
                                <td className="px-8 py-5 text-sm text-[#F3F3F3]">{item.qty}</td>
                                <td className="px-8 py-5 text-sm text-[#F3F3F3]">$ {item.revenue.toLocaleString()}</td>
                                <td className="px-8 py-5 text-sm text-right font-medium text-[#22C55E]">$ {item.profit.toLocaleString()}</td>
                                <td className="px-8 py-5 text-right">
                                    <span className={cn(
                                        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
                                        item.margin > 30 ? "text-green-400 bg-green-900/30 border-green-700/30" : "text-amber-400 bg-amber-900/30 border-amber-700/30"
                                    )}>
                                        {item.margin.toFixed(1)}%
                                    </span>
                                </td>
                                <td className="px-8 py-5 text-sm text-right text-[#A0A0A8]">$ {item.utility_per_unit.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Rankings */}
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
                <section className="space-y-4">
                    <div className="flex items-center gap-3">
                        <TrendingUp className="text-[#22C55E] h-5 w-5" />
                        <h2 className="font-serif text-2xl font-light text-[#F3F3F3]">Top 5 Vendidos</h2>
                    </div>
                    <div className="space-y-2">
                        {topSold.map((item, i) => (
                            <div key={item.id} className="flex items-center justify-between p-4 bg-[#141418] border border-[#232327] rounded-xl hover:border-[#2e2e35] transition-colors">
                                <span className="text-sm font-medium text-[#555555]">0{i + 1}</span>
                                <span className="flex-1 ml-4 text-sm font-medium text-[#F3F3F3]">{item.brand} {item.name}</span>
                                <span className="text-sm font-bold text-[#22C55E]">{item.qty} uds</span>
                            </div>
                        ))}
                    </div>
                </section>
                <section className="space-y-4">
                    <div className="flex items-center gap-3">
                        <TrendingDown className="text-red-400 h-5 w-5" />
                        <h2 className="font-serif text-2xl font-light text-[#F3F3F3]">Bottom 5 (Menor Rotación)</h2>
                    </div>
                    <div className="space-y-2">
                        {bottomSold.map((item, i) => (
                            <div key={item.id} className="flex items-center justify-between p-4 bg-[#141418] border border-[#232327] rounded-xl hover:border-[#2e2e35] transition-colors">
                                <span className="text-sm font-medium text-[#555555]">-{i + 1}</span>
                                <span className="flex-1 ml-4 text-sm font-medium text-[#F3F3F3]">{item.brand} {item.name}</span>
                                <span className="text-sm font-bold text-red-400">{item.qty} uds</span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    )
}
