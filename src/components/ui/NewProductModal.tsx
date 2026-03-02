'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { X, Loader2 } from 'lucide-react'

const INPUT = "w-full border-b border-[#232327] bg-transparent py-2 text-[#F3F3F3] placeholder:text-[#555555] focus:border-[#22C55E] focus:outline-none transition-colors text-sm"
const LABEL = "text-[10px] font-bold uppercase tracking-widest text-[#A0A0A8]"
const SELECT = "w-full border-b border-[#232327] bg-[#141418] py-2 text-[#F3F3F3] focus:border-[#22C55E] focus:outline-none transition-colors text-sm"

interface NewProductModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export function NewProductModal({ isOpen, onClose, onSuccess }: NewProductModalProps) {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        brand: '',
        sku: '',
        concentration: 'EDP',
        size_ml: '100',
    })

    if (!isOpen) return null

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        const supabase = createClient()
        const { error } = await supabase.from('products').insert([{
            ...formData,
            size_ml: parseInt(formData.size_ml),
            is_active: true,
            current_stock: 0
        }])
        if (!error) {
            onSuccess()
            onClose()
            setFormData({ name: '', brand: '', sku: '', concentration: 'EDP', size_ml: '100' })
        } else {
            alert('Error: ' + error.message)
        }
        setLoading(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-300 px-4">
            <div className="w-full max-w-lg bg-[#141418] border border-[#232327] rounded-3xl p-8 lg:p-12 shadow-2xl relative">
                <button onClick={onClose} className="absolute right-8 top-8 text-[#A0A0A8] hover:text-[#F3F3F3] transition-colors">
                    <X className="h-6 w-6" />
                </button>

                <header className="mb-10">
                    <h2 className="serif-title text-3xl font-light text-[#F3F3F3]">Nueva Fragancia</h2>
                    <p className="text-sm text-[#A0A0A8] mt-2 uppercase tracking-widest">Añadir al catálogo maestro</p>
                </header>

                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className={LABEL}>Nombre</label>
                            <input required value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className={INPUT} placeholder="Ej. Sauvage" />
                        </div>
                        <div className="space-y-2">
                            <label className={LABEL}>Marca</label>
                            <input required value={formData.brand}
                                onChange={e => setFormData({ ...formData, brand: e.target.value })}
                                className={INPUT} placeholder="Ej. Dior" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                        <div className="space-y-2">
                            <label className={LABEL}>Concentración</label>
                            <select value={formData.concentration}
                                onChange={e => setFormData({ ...formData, concentration: e.target.value })}
                                className={SELECT} style={{ colorScheme: 'dark' }}>
                                <option className="bg-[#141418]">EDP</option>
                                <option className="bg-[#141418]">EDT</option>
                                <option className="bg-[#141418]">Parfum</option>
                                <option className="bg-[#141418]">Elixir</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className={LABEL}>ML</label>
                            <input type="number" required value={formData.size_ml}
                                onChange={e => setFormData({ ...formData, size_ml: e.target.value })}
                                className={INPUT} />
                        </div>
                        <div className="space-y-2">
                            <label className={LABEL}>SKU</label>
                            <input value={formData.sku}
                                onChange={e => setFormData({ ...formData, sku: e.target.value })}
                                className={INPUT} placeholder="DIR-SAU-100" />
                        </div>
                    </div>

                    <button type="submit" disabled={loading}
                        className="w-full bg-[#22C55E] hover:bg-[#16A34A] py-4 rounded-2xl text-black text-[10px] font-bold uppercase tracking-[0.3em] transition-all disabled:opacity-50">
                        {loading ? <Loader2 className="animate-spin mx-auto h-4 w-4" /> : 'CREAR PRODUCTO'}
                    </button>
                </form>
            </div>
        </div>
    )
}
