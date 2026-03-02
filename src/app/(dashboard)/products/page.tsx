'use client'

import { useState, useEffect } from 'react'
import { Search, Plus, MoreHorizontal, Trash2, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NewProductModal } from '@/components/ui/NewProductModal'
import { productsService } from '@/lib/services/api'
import Link from 'next/link'

interface Product {
    id: string; name: string; brand: string; sku: string
    concentration: string; size_ml: number; current_stock: number; is_active: boolean
}

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    useEffect(() => { fetchProducts() }, [])

    async function fetchProducts() {
        const { data } = await productsService.getProducts()
        if (data) setProducts(data)
        setLoading(false)
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) return
        setDeletingId(id)
        const { error } = await productsService.deleteProduct(id)
        if (error) alert('Error: ' + error.message)
        else setProducts(products.filter(p => p.id !== id))
        setDeletingId(null)
    }

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.brand.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="space-y-10 animate-in fade-in duration-700">
            <div className="flex items-end justify-between">
                <header>
                    <h1 className="serif-title text-5xl font-light text-[#F3F3F3]">Catálogo</h1>
                    <p className="mt-3 text-lg text-[#A0A0A8]">Administra la colección de fragancias.</p>
                </header>
                <button onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-[#22C55E] hover:bg-[#16A34A] px-6 py-3 text-xs font-bold uppercase tracking-widest text-black transition-all rounded-xl">
                    <Plus className="h-4 w-4" />
                    Nuevo Producto
                </button>
            </div>

            <NewProductModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchProducts} />

            {/* Search */}
            <div className="flex items-center gap-6 border-b border-[#232327] pb-2">
                <div className="relative flex-1">
                    <Search className="absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 text-[#555555]" />
                    <input
                        type="text"
                        placeholder="Buscar por aroma, marca o SKU..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-transparent py-4 pl-10 text-[#F3F3F3] placeholder:text-[#555555] focus:outline-none text-base"
                    />
                </div>
            </div>

            {/* Table */}
            <div>
                <div className="flex bg-[#0E0E10] py-4 px-8 text-[10px] font-bold uppercase tracking-widest text-[#A0A0A8] rounded-t-xl border border-[#232327] border-b-0">
                    <div className="flex-1">Fragancia</div>
                    <div className="w-48 text-center">Ext / Tamaño</div>
                    <div className="w-32 text-center">Stock</div>
                    <div className="w-32 text-center">Estado</div>
                    <div className="w-24" />
                </div>
                <div className="premium-card p-0 rounded-t-none divide-y divide-[#232327]">
                    {loading ? (
                        <div className="p-20 text-center text-[#A0A0A8]">Consultando inventario...</div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="p-20 text-center text-[#A0A0A8] font-serif italic text-xl">Sin resultados en la colección actual.</div>
                    ) : filteredProducts.map((p) => (
                        <div key={p.id} className="flex items-center py-5 px-8 hover:bg-[#1a1a1e] transition-colors group">
                            <div className="flex-1">
                                <p className="font-serif text-xl font-light text-[#F3F3F3] group-hover:translate-x-1 transition-transform">{p.name}</p>
                                <p className="text-[10px] uppercase tracking-widest text-[#A0A0A8] mt-1">{p.brand} — {p.sku || 'REF-TBD'}</p>
                            </div>
                            <div className="w-48 text-center text-sm text-[#A0A0A8]">
                                {p.concentration} · {p.size_ml}ml
                            </div>
                            <div className="w-32 flex justify-center">
                                <span className={cn(
                                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter border",
                                    p.current_stock <= 3
                                        ? "bg-red-900/30 text-red-400 border-red-700/30"
                                        : "bg-green-900/30 text-green-400 border-green-700/30"
                                )}>
                                    {p.current_stock} en stock
                                </span>
                            </div>
                            <div className="w-32 flex justify-center">
                                <div className={cn("h-2 w-2 rounded-full", p.is_active ? "bg-[#22C55E]" : "bg-[#555555]")} />
                            </div>
                            <div className="w-24 flex justify-end gap-3">
                                <Link href={`/products/${p.id}/movements`}
                                    className="text-[#555555] hover:text-blue-400 transition-colors" title="Ver Kardex">
                                    <BarChart2 className="h-5 w-5" />
                                </Link>
                                <button onClick={() => handleDelete(p.id)} disabled={deletingId === p.id}
                                    className="text-[#555555] hover:text-red-400 transition-colors disabled:opacity-40" title="Eliminar">
                                    <Trash2 className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
