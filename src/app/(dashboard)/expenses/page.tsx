'use client'

import { useState, useEffect } from 'react'
import { expensesService } from '@/lib/services/api'
import { createClient } from '@/lib/supabase'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Method = 'cash' | 'nequi' | 'bancolombia' | 'daviplata'

const METHOD_LABELS: Record<Method, string> = {
    cash: '💵 Efectivo',
    nequi: '🟣 Nequi',
    bancolombia: '🟡 Bancolombia',
    daviplata: '🔴 Daviplata',
}

const INPUT = "w-full bg-transparent border-b border-[#232327] py-2 text-[#F3F3F3] placeholder:text-[#555555] focus:border-[#22C55E] focus:outline-none transition-colors text-sm"

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [formLoading, setFormLoading] = useState(false)
    const [userId, setUserId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const [concept, setConcept] = useState('')
    const [description, setDescription] = useState('')
    const [amount, setAmount] = useState('')
    const [method, setMethod] = useState<Method>('cash')
    const [spentAt, setSpentAt] = useState(new Date().toISOString().split('T')[0])

    useEffect(() => {
        const supabase = createClient()
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) setUserId(user.id)
        })
        load()
    }, [])

    async function load() {
        setLoading(true)
        const { data } = await expensesService.getAll()
        if (data) setExpenses(data)
        setLoading(false)
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault()
        if (!userId) return
        const amountNum = parseFloat(amount)
        if (!amountNum || amountNum <= 0) { alert('Monto inválido.'); return }
        setFormLoading(true)
        const { error } = await expensesService.create({
            concept, description: description || undefined,
            amountCop: amountNum, paymentMethod: method,
            spentAt, createdBy: userId
        })
        if (!error) {
            setConcept(''); setDescription(''); setAmount(''); setSpentAt(new Date().toISOString().split('T')[0])
            load()
        } else {
            alert('Error: ' + error.message)
        }
        setFormLoading(false)
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Anular este gasto? El monto se revertirá en la cartera.')) return
        setDeletingId(id)
        const { error } = await expensesService.delete(id)
        if (!error) load()
        else alert('Error: ' + error.message)
        setDeletingId(null)
    }

    const totalExpenses = expenses.reduce((a, e) => a + Number(e.amount_cop), 0)

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="serif-title text-5xl font-light text-[#F3F3F3]">Gastos</h1>
                    <p className="mt-3 text-[#A0A0A8]">Registra los egresos del negocio.</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">Total Gastos</p>
                    <p className="text-3xl font-light text-red-400">${totalExpenses.toLocaleString()}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form */}
                <div className="premium-card">
                    <h2 className="serif-title text-xl font-light text-[#F3F3F3] mb-6">Nuevo Gasto</h2>
                    <form onSubmit={handleCreate} className="space-y-5">
                        <div>
                            <label className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">Concepto *</label>
                            <input type="text" required value={concept} onChange={e => setConcept(e.target.value)}
                                className={INPUT} placeholder="Ej: Publicidad, Arriendo..." />
                        </div>
                        <div>
                            <label className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">Descripción</label>
                            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                                className={INPUT} placeholder="Detalles opcionales..." />
                        </div>
                        <div>
                            <label className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">Monto (COP) *</label>
                            <input type="number" required min="1" value={amount} onChange={e => setAmount(e.target.value)}
                                className={INPUT} placeholder="0" />
                        </div>
                        <div>
                            <label className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">Método de Pago *</label>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                {(Object.entries(METHOD_LABELS) as [Method, string][]).map(([k, v]) => (
                                    <button key={k} type="button" onClick={() => setMethod(k)}
                                        className={cn("py-2 rounded-lg text-[10px] font-bold border transition-all",
                                            method === k
                                                ? "bg-white/10 text-[#F3F3F3] border-white/15"
                                                : "text-[#A0A0A8] border-[#232327] hover:border-[#2e2e35]"
                                        )}>
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">Fecha</label>
                            <input type="date" value={spentAt} onChange={e => setSpentAt(e.target.value)}
                                className={INPUT} style={{ colorScheme: 'dark' }} />
                        </div>
                        <button type="submit" disabled={formLoading}
                            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                            {formLoading ? <Loader2 className="animate-spin h-4 w-4" /> : <><Plus className="h-4 w-4" />Registrar Gasto</>}
                        </button>
                    </form>
                </div>

                {/* Expenses Table */}
                <div className="lg:col-span-2">
                    <h2 className="font-serif text-2xl font-light text-[#F3F3F3] mb-5">Historial</h2>
                    {loading ? (
                        <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-[#22C55E]" /></div>
                    ) : expenses.length === 0 ? (
                        <div className="premium-card text-center py-16">
                            <p className="text-[#A0A0A8] font-serif italic">Sin gastos registrados aún.</p>
                        </div>
                    ) : (
                        <div className="premium-card p-0 divide-y divide-[#232327] overflow-hidden">
                            <div className="grid grid-cols-5 px-6 py-3 bg-[#0E0E10] text-[10px] font-bold uppercase tracking-widest text-[#A0A0A8]">
                                <div className="col-span-2">Concepto</div>
                                <div className="text-center">Método</div>
                                <div className="text-right">Monto</div>
                                <div className="text-right">Fecha</div>
                            </div>
                            {expenses.map((exp: any) => (
                                <div key={exp.id} className="grid grid-cols-5 items-center px-6 py-4 hover:bg-[#1a1a1e] transition-colors group">
                                    <div className="col-span-2">
                                        <p className="text-sm font-medium text-[#F3F3F3]">{exp.concept}</p>
                                        {exp.description && <p className="text-xs text-[#A0A0A8] mt-0.5">{exp.description}</p>}
                                    </div>
                                    <div className="text-center text-xs text-[#A0A0A8]">
                                        {METHOD_LABELS[exp.payment_method as Method] || exp.payment_method}
                                    </div>
                                    <div className="text-right text-sm font-bold text-red-400">
                                        -${Number(exp.amount_cop).toLocaleString()}
                                    </div>
                                    <div className="text-right flex items-center justify-end gap-2">
                                        <span className="text-xs text-[#A0A0A8]">
                                            {new Date(exp.spent_at).toLocaleDateString('es-CO')}
                                        </span>
                                        <button
                                            onClick={() => handleDelete(exp.id)}
                                            disabled={deletingId === exp.id}
                                            className="text-[#555555] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-40"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
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
