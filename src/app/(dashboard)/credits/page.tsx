'use client'

import { useState, useEffect } from 'react'
import { creditsService } from '@/lib/services/api'
import { Search, CreditCard, ChevronDown, ChevronUp, Plus, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase'

type Filter = 'all' | 'pending' | 'paid' | 'overdue'

export default function CreditsPage() {
    const [credits, setCredits] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<Filter>('all')
    const [search, setSearch] = useState('')
    const [expanded, setExpanded] = useState<string | null>(null)

    // Payment modal
    const [payModal, setPayModal] = useState<any | null>(null)
    const [payAmount, setPayAmount] = useState('')
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
    const [payNotes, setPayNotes] = useState('')
    const [payMethod, setPayMethod] = useState<'cash' | 'nequi' | 'bancolombia' | 'daviplata'>('cash')
    const [payLoading, setPayLoading] = useState(false)

    useEffect(() => {
        fetchCredits()
    }, [])

    async function fetchCredits() {
        setLoading(true)
        const { data, error } = await creditsService.getCredits()
        if (data) setCredits(data)
        setLoading(false)
    }

    async function handleAddPayment() {
        if (!payModal) return
        const amount = parseFloat(payAmount)
        if (!amount || amount <= 0) { alert('Ingresa un monto válido.'); return }
        if (amount > payModal.due_cop) { alert('El abono no puede superar la deuda actual.'); return }
        setPayLoading(true)
        const { error } = await creditsService.addPayment({
            creditId: payModal.id,
            amount,
            paidAt: payDate,
            notes: payNotes,
            paymentMethod: payMethod
        })
        if (!error) {
            setPayModal(null)
            setPayAmount('')
            setPayNotes('')
            fetchCredits()
        } else {
            alert('Error al registrar abono: ' + error.message)
        }
        setPayLoading(false)
    }

    function getStatus(credit: any): { label: string; badge: string } {
        if (credit.status === 'paid') return { label: 'Pagado', badge: 'badge-paid' }
        if (credit.due_date && new Date(credit.due_date) < new Date() && credit.due_cop > 0) {
            return { label: 'Vencido', badge: 'badge-overdue' }
        }
        return { label: 'Pendiente', badge: 'badge-pending' }
    }

    const filtered = credits.filter(c => {
        const s = getStatus(c)
        if (filter === 'pending' && s.label !== 'Pendiente') return false
        if (filter === 'paid' && s.label !== 'Pagado') return false
        if (filter === 'overdue' && s.label !== 'Vencido') return false
        if (search && !c.customer_name?.toLowerCase().includes(search.toLowerCase())) return false
        return true
    })

    const totalDeuda = credits.filter(c => c.status !== 'paid').reduce((acc, c) => acc + Number(c.due_cop), 0)

    const FILTERS: { key: Filter; label: string }[] = [
        { key: 'all', label: 'Todos' },
        { key: 'pending', label: 'Pendientes' },
        { key: 'paid', label: 'Pagados' },
        { key: 'overdue', label: 'Vencidos' },
    ]

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            <header className="flex items-end justify-between">
                <div>
                    <h1 className="serif-title text-5xl font-light text-[#F3F3F3]">Créditos</h1>
                    <p className="mt-3 text-[#A0A0A8]">Gestión de ventas a crédito y cartera de clientes.</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">Cartera Total Pendiente</p>
                    <p className="text-3xl font-light text-amber-400">${totalDeuda.toLocaleString()}</p>
                </div>
            </header>

            {/* Filters + Search */}
            <div className="flex items-center gap-4 flex-wrap">
                <div className="flex gap-1 bg-[#141418] border border-[#232327] rounded-xl p-1">
                    {FILTERS.map(f => (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={cn(
                                "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all",
                                filter === f.key
                                    ? "bg-white/10 text-[#F3F3F3]"
                                    : "text-[#A0A0A8] hover:text-[#F3F3F3]"
                            )}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A0A0A8]" />
                    <input
                        type="text"
                        placeholder="Buscar por cliente..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-[#141418] border border-[#232327] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#F3F3F3] placeholder:text-[#A0A0A8] focus:border-[#22C55E] focus:outline-none transition-colors"
                    />
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-[#22C55E]" /></div>
            ) : filtered.length === 0 ? (
                <div className="premium-card text-center py-20">
                    <CreditCard className="mx-auto h-12 w-12 text-[#232327] mb-4" />
                    <p className="text-[#A0A0A8] font-serif italic">No hay créditos en esta categoría.</p>
                    <p className="text-[#A0A0A8] text-sm mt-2">Registra ventas a crédito desde el Punto de Venta.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(credit => {
                        const s = getStatus(credit)
                        const isOpen = expanded === credit.id
                        const payments: any[] = credit.credit_payments || []
                        return (
                            <div key={credit.id} className="premium-card p-0 overflow-hidden">
                                <button
                                    onClick={() => setExpanded(isOpen ? null : credit.id)}
                                    className="w-full flex items-center gap-4 p-6 text-left hover:bg-[#1a1a1e] transition-colors"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-[#F3F3F3] truncate">{credit.customer_name}</p>
                                        {credit.customer_phone && (
                                            <p className="text-xs text-[#A0A0A8] mt-0.5">{credit.customer_phone}</p>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">Total</p>
                                        <p className="text-sm font-medium text-[#F3F3F3]">${Number(credit.total_cop).toLocaleString()}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">Abonado</p>
                                        <p className="text-sm font-medium text-[#22C55E]">${Number(credit.paid_cop).toLocaleString()}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">Deuda</p>
                                        <p className="text-sm font-bold text-amber-400">${Number(credit.due_cop).toLocaleString()}</p>
                                    </div>
                                    <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border shrink-0", s.badge)}>
                                        {s.label}
                                    </span>
                                    {credit.due_date && (
                                        <p className="text-[10px] text-[#A0A0A8] shrink-0">
                                            Vence: {new Date(credit.due_date).toLocaleDateString('es-CO')}
                                        </p>
                                    )}
                                    {isOpen ? <ChevronUp className="h-4 w-4 text-[#A0A0A8] shrink-0" /> : <ChevronDown className="h-4 w-4 text-[#A0A0A8] shrink-0" />}
                                </button>

                                {isOpen && (
                                    <div className="px-6 pb-6 border-t border-[#232327] animate-in slide-in-from-top-2 duration-200">
                                        <div className="pt-5 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs font-bold uppercase tracking-widest text-[#A0A0A8]">Historial de Abonos ({payments.length})</p>
                                                {credit.status !== 'paid' && (
                                                    <button
                                                        onClick={() => setPayModal(credit)}
                                                        className="flex items-center gap-2 bg-white/10 text-[#F3F3F3] border border-white/15 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide hover:bg-white/15 transition-all"
                                                    >
                                                        <Plus className="h-3.5 w-3.5" />
                                                        Registrar Abono
                                                    </button>
                                                )}
                                            </div>
                                            {payments.length === 0 ? (
                                                <p className="text-sm text-[#A0A0A8] italic">Sin abonos registrados.</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {payments.map((pay: any) => (
                                                        <div key={pay.id} className="flex items-center justify-between p-3 bg-[#0E0E10] rounded-xl border border-[#232327]">
                                                            <div>
                                                                <p className="text-sm font-medium text-[#22C55E]">+${Number(pay.amount_cop).toLocaleString()}</p>
                                                                {pay.notes && <p className="text-xs text-[#A0A0A8] mt-0.5">{pay.notes}</p>}
                                                            </div>
                                                            <p className="text-xs text-[#A0A0A8]">{new Date(pay.paid_at).toLocaleDateString('es-CO')}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Payment Modal */}
            {payModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[#141418] border border-[#232327] rounded-2xl p-8 w-full max-w-md animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-semibold text-[#F3F3F3]">Registrar Abono</h2>
                                <p className="text-sm text-[#A0A0A8] mt-1">{payModal.customer_name}</p>
                            </div>
                            <button onClick={() => setPayModal(null)} className="text-[#A0A0A8] hover:text-[#F3F3F3]">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs uppercase tracking-widest text-[#A0A0A8] mb-1">Deuda actual</p>
                                <p className="text-2xl font-light text-amber-400">${Number(payModal.due_cop).toLocaleString()}</p>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">Monto del abono (COP) *</label>
                                <input
                                    type="number"
                                    min="1"
                                    max={payModal.due_cop}
                                    value={payAmount}
                                    onChange={e => setPayAmount(e.target.value)}
                                    className="w-full bg-transparent border-b border-[#232327] py-2 mt-1 text-[#F3F3F3] focus:border-[#22C55E] focus:outline-none text-lg"
                                    placeholder="0"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">Fecha</label>
                                <input
                                    type="date"
                                    value={payDate}
                                    onChange={e => setPayDate(e.target.value)}
                                    className="w-full bg-transparent border-b border-[#232327] py-2 mt-1 text-[#F3F3F3] focus:border-[#22C55E] focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">Método de Pago *</label>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    {(['cash', 'nequi', 'bancolombia', 'daviplata'] as const).map(k => (
                                        <button key={k} type="button" onClick={() => setPayMethod(k)}
                                            className={`py-2 rounded-lg text-[10px] font-bold border transition-all ${payMethod === k
                                                    ? 'bg-white/10 text-[#F3F3F3] border-white/15'
                                                    : 'text-[#A0A0A8] border-[#232327] hover:border-[#2e2e35]'
                                                }`}>
                                            {k === 'cash' ? '💵 Efectivo' : k === 'nequi' ? '🟣 Nequi' : k === 'bancolombia' ? '🟡 Bancolombia' : '🔴 Daviplata'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">Notas (opcional)</label>
                                <input
                                    type="text"
                                    value={payNotes}
                                    onChange={e => setPayNotes(e.target.value)}
                                    className="w-full bg-transparent border-b border-[#232327] py-2 mt-1 text-[#F3F3F3] placeholder:text-[#A0A0A8] focus:border-[#22C55E] focus:outline-none"
                                    placeholder="Ej: Transferencia Bancolombia"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setPayModal(null)}
                                    className="flex-1 py-3 border border-[#232327] rounded-xl text-sm text-[#A0A0A8] hover:text-[#F3F3F3] hover:border-[#2e2e35] transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleAddPayment}
                                    disabled={payLoading || !payAmount}
                                    className="flex-1 py-3 bg-[#F3F3F3] text-[#0E0E10] rounded-xl text-sm font-bold uppercase tracking-wide hover:bg-[#16A34A] transition-all disabled:opacity-40"
                                >
                                    {payLoading ? <Loader2 className="animate-spin mx-auto h-4 w-4" /> : 'Registrar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
