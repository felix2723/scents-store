'use client'

import { useState } from 'react'
import { User, Bell, Shield, Database, Trash2, AlertTriangle, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'

const RESET_TABLES = [
    { key: 'credit_payments', label: 'Abonos de crédito' },
    { key: 'credits', label: 'Créditos de clientes' },
    { key: 'sales', label: 'Ventas e historial POS' },
    { key: 'inventory_batches', label: 'Lotes de inventario' },
    { key: 'products', label: 'Catálogo de productos' },
]

export default function SettingsPage() {
    const supabase = createClient()
    const [showResetModal, setShowResetModal] = useState(false)
    const [confirmText, setConfirmText] = useState('')
    const [loading, setLoading] = useState(false)
    const [resetResult, setResetResult] = useState<any | null>(null)

    const canConfirm = confirmText === 'BORRAR'

    async function handleReset() {
        if (!canConfirm) return
        setLoading(true)
        const { data, error } = await supabase.rpc('reset_all_data')
        if (!error) {
            setResetResult(data)
        } else {
            alert('Error al resetear: ' + error.message)
            setLoading(false)
            return
        }
        setLoading(false)
    }

    return (
        <div className="space-y-12 animate-in fade-in duration-700">
            <header>
                <h1 className="serif-title text-5xl font-light text-[#F3F3F3]">Configuración</h1>
                <p className="mt-3 text-lg text-[#A0A0A8]">Gestiona tu cuenta y los parámetros del sistema.</p>
            </header>

            <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
                {/* Nav */}
                <div className="space-y-2">
                    {[
                        { name: 'Perfil', icon: User, active: true },
                        { name: 'Notificaciones', icon: Bell },
                        { name: 'Seguridad', icon: Shield },
                        { name: 'Base de Datos', icon: Database },
                    ].map((item) => (
                        <button
                            key={item.name}
                            className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-sm font-medium transition-all ${item.active
                                ? 'bg-white/10 text-[#F3F3F3] border border-white/15'
                                : 'text-[#A0A0A8] hover:bg-[#1a1a1e] hover:text-[#F3F3F3] border border-transparent'
                                }`}
                        >
                            <item.icon className="h-5 w-5" />
                            {item.name}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="md:col-span-2 space-y-8">
                    {/* Negocio */}
                    <section className="premium-card">
                        <h3 className="serif-title text-2xl font-light text-[#F3F3F3] mb-8">Información del Negocio</h3>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-[#A0A0A8]">Nombre de la Tienda</label>
                                <input
                                    className="w-full bg-transparent border-b border-[#232327] py-2 text-[#F3F3F3] focus:border-[#22C55E] focus:outline-none transition-colors"
                                    defaultValue="Scents Perfumería"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-[#A0A0A8]">Moneda Principal</label>
                                <input
                                    className="w-full bg-transparent border-b border-[#232327] py-2 text-[#A0A0A8] cursor-not-allowed"
                                    defaultValue="COP (Pesos Colombianos)"
                                    disabled
                                />
                            </div>
                        </div>
                    </section>

                    {/* Zona de peligro */}
                    <section className="premium-card border-red-500/20 bg-red-900/5">
                        <div className="flex items-center gap-3 mb-6">
                            <AlertTriangle className="h-5 w-5 text-red-400" />
                            <h3 className="serif-title text-2xl font-light text-red-400">Zona de Peligro</h3>
                        </div>
                        <div className="flex items-center justify-between p-5 bg-red-900/10 rounded-xl border border-red-500/20">
                            <div className="space-y-1">
                                <p className="font-semibold text-[#F3F3F3]">Resetear Sistema</p>
                                <p className="text-sm text-[#A0A0A8]">Elimina todos los datos del negocio. Irreversible.</p>
                            </div>
                            <button
                                onClick={() => { setShowResetModal(true); setResetResult(null); setConfirmText('') }}
                                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                            >
                                <Trash2 className="h-4 w-4" />
                                Borrar Datos
                            </button>
                        </div>
                    </section>
                </div>
            </div>

            {/* Reset Modal */}
            {showResetModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-[#141418] border border-[#232327] rounded-2xl p-8 w-full max-w-lg animate-in zoom-in-95 duration-200">
                        {resetResult ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <span className="h-3 w-3 bg-[#22C55E] rounded-full" />
                                    <h2 className="text-xl font-semibold text-[#22C55E]">Reset Completado</h2>
                                </div>
                                <p className="text-sm text-[#A0A0A8]">El sistema ha sido reiniciado. Resumen de registros eliminados:</p>
                                <div className="space-y-2 border border-[#232327] rounded-xl p-4">
                                    {Object.entries(resetResult).map(([table, count]: any) => (
                                        <div key={table} className="flex justify-between text-sm">
                                            <span className="text-[#A0A0A8]">{table}</span>
                                            <span className="text-[#F3F3F3] font-medium">{count} registros</span>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => { setShowResetModal(false); window.location.reload() }}
                                    className="w-full py-3 bg-[#F3F3F3] text-[#0E0E10] rounded-xl text-sm font-bold uppercase tracking-wide hover:bg-[#16A34A] transition-all"
                                >
                                    Cerrar y Recargar
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <AlertTriangle className="h-5 w-5 text-red-400" />
                                        <h2 className="text-xl font-semibold text-red-400">Borrar Todos los Datos</h2>
                                    </div>
                                    <button onClick={() => setShowResetModal(false)} className="text-[#A0A0A8] hover:text-[#F3F3F3]">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="bg-red-900/10 border border-red-500/20 rounded-xl p-4">
                                    <p className="text-sm text-red-300 font-medium">⚠ Esto eliminará datos del negocio. Acción irreversible.</p>
                                </div>

                                <div>
                                    <p className="text-xs font-bold uppercase tracking-widest text-[#A0A0A8] mb-3">Se borrarán los siguientes datos:</p>
                                    <div className="space-y-2">
                                        {RESET_TABLES.map(t => (
                                            <div key={t.key} className="flex items-center gap-3">
                                                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                                                <span className="text-sm text-[#F3F3F3]">{t.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#A0A0A8]">
                                        Escribe <span className="text-red-400">BORRAR</span> para confirmar
                                    </label>
                                    <input
                                        type="text"
                                        value={confirmText}
                                        onChange={e => setConfirmText(e.target.value)}
                                        className="w-full bg-transparent border-b border-[#232327] py-2 mt-2 text-[#F3F3F3] focus:border-red-400 focus:outline-none transition-colors"
                                        placeholder="BORRAR"
                                        autoFocus
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowResetModal(false)}
                                        className="flex-1 py-3 border border-[#232327] rounded-xl text-sm text-[#A0A0A8] hover:text-[#F3F3F3] transition-all"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleReset}
                                        disabled={!canConfirm || loading}
                                        className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold uppercase tracking-wide transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        {loading ? <Loader2 className="animate-spin mx-auto h-4 w-4" /> : 'Confirmar Reset'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
