'use client'

import { useState, useEffect } from 'react'
import { walletService } from '@/lib/services/api'
import { createClient } from '@/lib/supabase'
import { ArrowRight, Loader2, X, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

type Method = 'cash' | 'nequi' | 'bancolombia' | 'daviplata'

const METHODS: { key: Method; label: string; icon: string; color: string; bg: string }[] = [
    { key: 'cash', label: 'Efectivo', icon: '💵', color: 'text-green-400', bg: 'bg-green-900/20 border-green-700/30' },
    { key: 'nequi', label: 'Nequi', icon: '🟣', color: 'text-purple-400', bg: 'bg-purple-900/20 border-purple-700/30' },
    { key: 'bancolombia', label: 'Bancolombia', icon: '🟡', color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-700/30' },
    { key: 'daviplata', label: 'Daviplata', icon: '🔴', color: 'text-red-400', bg: 'bg-red-900/20 border-red-700/30' },
]

export default function WalletPage() {
    const [summary, setSummary] = useState<Record<Method, number>>({ cash: 0, nequi: 0, bancolombia: 0, daviplata: 0 })
    const [movements, setMovements] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showTransfer, setShowTransfer] = useState(false)
    const [transferLoading, setTransferLoading] = useState(false)

    const [fromMethod, setFromMethod] = useState<Method>('cash')
    const [toMethod, setToMethod] = useState<Method>('nequi')
    const [transferAmount, setTransferAmount] = useState('')
    const [transferNotes, setTransferNotes] = useState('')
    const [userId, setUserId] = useState<string | null>(null)

    useEffect(() => {
        const supabase = createClient()
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) setUserId(user.id)
        })
        load()
    }, [])

    async function load() {
        setLoading(true)
        const [{ data: sum }, { data: movs }] = await Promise.all([
            walletService.getSummary(),
            walletService.getMovements()
        ])
        if (sum) setSummary(sum as any)
        if (movs) setMovements(movs)
        setLoading(false)
    }

    async function handleTransfer() {
        if (!userId) return
        if (fromMethod === toMethod) { alert('El origen y destino no pueden ser iguales.'); return }
        const amount = parseFloat(transferAmount)
        if (!amount || amount <= 0) { alert('Ingresa un monto válido.'); return }

        setTransferLoading(true)
        const { error } = await walletService.transfer({
            fromMethod, toMethod, amount,
            notes: transferNotes || undefined,
            createdBy: userId
        })
        if (!error) {
            setShowTransfer(false)
            setTransferAmount('')
            setTransferNotes('')
            load()
        } else {
            alert('Error al transferir: ' + error.message)
        }
        setTransferLoading(false)
    }

    const totalWallet = Object.values(summary).reduce((a, b) => a + b, 0)

    const reasonLabel: Record<string, string> = {
        transfer_in: '→ Entrada transferencia',
        transfer_out: '← Salida transferencia',
        sale: '+ Venta',
        credit_payment: '+ Abono crédito',
        expense: '− Gasto',
        adjustment: '± Ajuste',
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="serif-title text-5xl font-light text-[#F3F3F3]">Cartera</h1>
                    <p className="mt-3 text-[#A0A0A8]">Saldos por canal de pago del negocio.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">Total en Caja</p>
                        <p className="text-3xl font-light text-[#22C55E]">${totalWallet.toLocaleString()}</p>
                    </div>
                    <button onClick={() => setShowTransfer(true)}
                        className="flex items-center gap-2 bg-white/10 text-[#F3F3F3] border border-white/15 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-white/15 transition-all">
                        <RefreshCw className="h-4 w-4" />
                        Transferir
                    </button>
                </div>
            </div>

            {/* Wallet Cards */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-[#22C55E]" /></div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                    {METHODS.map(m => (
                        <div key={m.key} className={cn("premium-card border", m.bg)}>
                            <div className="text-3xl mb-4">{m.icon}</div>
                            <p className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">{m.label}</p>
                            <p className={cn("text-3xl font-light mt-2", m.color)}>
                                ${(summary[m.key] || 0).toLocaleString()}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {/* Movements */}
            <div>
                <h2 className="font-serif text-2xl font-light text-[#F3F3F3] mb-5">Historial de Movimientos</h2>
                {movements.length === 0 ? (
                    <div className="premium-card text-center py-16">
                        <p className="text-[#A0A0A8] font-serif italic">Sin movimientos registrados aún.</p>
                    </div>
                ) : (
                    <div className="premium-card p-0 divide-y divide-[#232327] overflow-hidden">
                        {movements.map((m: any) => {
                            const method = METHODS.find(x => x.key === (m.to_method || m.from_method))
                            return (
                                <div key={m.id} className="flex items-center justify-between px-6 py-4 hover:bg-[#1a1a1e] transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">{method?.icon || '•'}</span>
                                        <div>
                                            <p className="text-sm font-medium text-[#F3F3F3]">
                                                {reasonLabel[m.reason] || m.reason}
                                                {m.from_method && m.to_method && (
                                                    <span className="text-[#A0A0A8]">
                                                        {' '}{METHODS.find(x => x.key === m.from_method)?.label}
                                                        <ArrowRight className="inline h-3 w-3 mx-1" />
                                                        {METHODS.find(x => x.key === m.to_method)?.label}
                                                    </span>
                                                )}
                                            </p>
                                            {m.notes && <p className="text-xs text-[#A0A0A8]">{m.notes}</p>}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={cn("text-sm font-bold", m.to_method ? "text-[#22C55E]" : "text-red-400")}>
                                            {m.to_method ? '+' : '-'}${Number(m.amount_cop).toLocaleString()}
                                        </p>
                                        <p className="text-[10px] text-[#A0A0A8]">
                                            {new Date(m.created_at).toLocaleDateString('es-CO')}
                                        </p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Transfer Modal */}
            {showTransfer && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[#141418] border border-[#232327] rounded-2xl p-8 w-full max-w-md animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold text-[#F3F3F3]">Transferir Fondos</h2>
                            <button onClick={() => setShowTransfer(false)} className="text-[#A0A0A8] hover:text-[#F3F3F3]">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">Desde</label>
                                    <select value={fromMethod} onChange={e => setFromMethod(e.target.value as Method)}
                                        className="mt-1 w-full bg-[#0E0E10] border border-[#232327] rounded-lg px-3 py-2 text-[#F3F3F3] text-sm focus:border-[#22C55E] focus:outline-none"
                                        style={{ colorScheme: 'dark' }}>
                                        {METHODS.map(m => <option key={m.key} value={m.key} className="bg-[#0E0E10]">{m.icon} {m.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">Hacia</label>
                                    <select value={toMethod} onChange={e => setToMethod(e.target.value as Method)}
                                        className="mt-1 w-full bg-[#0E0E10] border border-[#232327] rounded-lg px-3 py-2 text-[#F3F3F3] text-sm focus:border-[#22C55E] focus:outline-none"
                                        style={{ colorScheme: 'dark' }}>
                                        {METHODS.map(m => <option key={m.key} value={m.key} className="bg-[#0E0E10]">{m.icon} {m.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">Monto (COP) *</label>
                                <input type="number" min="1" value={transferAmount}
                                    onChange={e => setTransferAmount(e.target.value)}
                                    className="w-full bg-transparent border-b border-[#232327] py-2 mt-1 text-[#F3F3F3] focus:border-[#22C55E] focus:outline-none text-lg"
                                    placeholder="0" autoFocus />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">Notas (opcional)</label>
                                <input type="text" value={transferNotes}
                                    onChange={e => setTransferNotes(e.target.value)}
                                    className="w-full bg-transparent border-b border-[#232327] py-2 mt-1 text-[#F3F3F3] placeholder:text-[#A0A0A8] focus:border-[#22C55E] focus:outline-none"
                                    placeholder="Ej: Consignación Bancolombia" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowTransfer(false)}
                                    className="flex-1 py-3 border border-[#232327] rounded-xl text-sm text-[#A0A0A8] hover:text-[#F3F3F3] transition-all">
                                    Cancelar
                                </button>
                                <button onClick={handleTransfer} disabled={transferLoading || !transferAmount}
                                    className="flex-1 py-3 bg-[#F3F3F3] text-[#0E0E10] rounded-xl text-sm font-bold uppercase tracking-wide hover:bg-[#16A34A] transition-all disabled:opacity-40">
                                    {transferLoading ? <Loader2 className="animate-spin mx-auto h-4 w-4" /> : 'Transferir'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
