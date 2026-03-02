'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { salesService } from '@/lib/services/api'
import { Search, Plus, Minus, Loader2, ShoppingBag, X, CreditCard, Banknote } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SalesPage() {
    const [products, setProducts] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [cart, setCart] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [notes, setNotes] = useState('')
    const [userId, setUserId] = useState<string | null>(null)

    // Discount
    const [discount, setDiscount] = useState(0)
    const [discountInput, setDiscountInput] = useState('')

    // Sale type
    const [saleType, setSaleType] = useState<'contado' | 'credito'>('contado')
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'nequi' | 'bancolombia' | 'daviplata'>('cash')

    // Credit fields
    const [creditCustomer, setCreditCustomer] = useState('')
    const [creditPhone, setCreditPhone] = useState('')
    const [creditDeposit, setCreditDeposit] = useState('')
    const [creditDueDate, setCreditDueDate] = useState('')

    const supabase = createClient()

    useEffect(() => {
        supabase
            .from('products')
            .select(`*, inventory_batches(sell_price_unit_cop, purchased_at)`)
            .eq('is_active', true)
            .then(({ data }) => {
                if (data) {
                    const productsWithPrice = data.map((p: any) => {
                        const batches = p.inventory_batches || []
                        const latestBatch = batches.sort((a: any, b: any) =>
                            new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime()
                        )[0]
                        return { ...p, sell_price: latestBatch?.sell_price_unit_cop ?? 0 }
                    })
                    setProducts(productsWithPrice)
                }
            })

        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                setUserId(user.id)
                supabase.from('users').select('id').eq('id', user.id).single().then(({ data: existingUser }) => {
                    if (!existingUser) {
                        supabase.from('users').insert({
                            id: user.id,
                            role: 'owner',
                            display_name: user.email?.split('@')[0] || 'Admin'
                        })
                    }
                })
            }
        })
    }, [])

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.brand.toLowerCase().includes(search.toLowerCase())
    )

    const addToCart = (product: any) => {
        if (product.current_stock <= 0) return
        const existing = cart.find(item => item.id === product.id)
        if (existing) {
            if (existing.qty < product.current_stock) {
                setCart(cart.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item))
            }
        } else {
            setCart([...cart, { ...product, qty: 1, sell_price: product.sell_price || 0 }])
        }
    }

    const updateQty = (id: string, delta: number) => {
        setCart(cart.map(item => {
            if (item.id === id) {
                const p = products.find(prod => prod.id === id)
                const newQty = Math.max(1, Math.min(p.current_stock, item.qty + delta))
                return { ...item, qty: newQty }
            }
            return item
        }))
    }

    const subtotal = cart.reduce((acc, item) => acc + (item.qty * item.sell_price), 0)
    const validDiscount = Math.min(discount, subtotal)
    const total = Math.max(subtotal - validDiscount, 0)

    function handleDiscountChange(val: string) {
        setDiscountInput(val)
        const num = parseFloat(val) || 0
        setDiscount(Math.max(0, num))
    }

    async function handleCompleteSale() {
        if (cart.length === 0) return
        if (!userId) {
            alert('No se pudo identificar al usuario. Por favor reingresa al sistema.')
            return
        }

        if (saleType === 'credito') {
            if (!creditCustomer.trim()) {
                alert('El nombre del cliente es obligatorio para ventas a crédito.')
                return
            }
            const depositAmount = parseFloat(creditDeposit) || 0
            if (depositAmount > total) {
                alert('El abono inicial no puede ser mayor al total de la venta.')
                return
            }
        }

        setLoading(true)
        const { error } = await salesService.createSale({
            items: cart.map(i => ({ product_id: i.id, qty: i.qty, sell_price: i.sell_price })),
            soldAt: new Date().toISOString(),
            notes,
            createdBy: userId,
            discountCop: validDiscount,
            saleType,
            paymentMethod,
            creditData: saleType === 'credito' ? {
                customerName: creditCustomer,
                customerPhone: creditPhone,
                depositAmount: parseFloat(creditDeposit) || 0,
                dueDate: creditDueDate || null
            } : undefined
        })

        if (!error) {
            setCart([])
            setNotes('')
            setDiscount(0)
            setDiscountInput('')
            setSaleType('contado')
            setPaymentMethod('cash')
            setCreditCustomer('')
            setCreditPhone('')
            setCreditDeposit('')
            setCreditDueDate('')
            alert(saleType === 'credito' ? 'Crédito registrado con éxito.' : 'Venta confirmada con éxito.')
            const { data } = await supabase.from('products').select(`*, inventory_batches(sell_price_unit_cop, purchased_at)`).eq('is_active', true)
            if (data) {
                setProducts(data.map((p: any) => {
                    const lb = (p.inventory_batches || []).sort((a: any, b: any) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime())[0]
                    return { ...p, sell_price: lb?.sell_price_unit_cop ?? 0 }
                }))
            }
        } else {
            console.error('Sale Error:', error)
            alert(`Error: ${error.message || 'Error desconocido'}\n${error.details || ''}`)
        }
        setLoading(false)
    }

    return (
        <div className="flex h-[calc(100vh-160px)] gap-8 animate-in fade-in duration-700">
            {/* Products Grid */}
            <div className="flex-1 flex flex-col space-y-6">
                <header>
                    <h1 className="serif-title text-4xl font-light text-[#F3F3F3]">Punto de Venta</h1>
                    <div className="mt-5 relative">
                        <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-5 text-[#A0A0A8]" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o marca..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-transparent border-b border-[#232327] py-4 pl-10 text-[#F3F3F3] placeholder:text-[#A0A0A8] focus:border-[#22C55E] focus:outline-none transition-colors text-base"
                        />
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredProducts.map(p => (
                        <button
                            key={p.id}
                            onClick={() => addToCart(p)}
                            disabled={p.current_stock <= 0}
                            className={cn(
                                "premium-card text-left group transition-all",
                                p.current_stock <= 0 ? "opacity-40 grayscale cursor-not-allowed" : "hover:border-[#22C55E]/40 cursor-pointer"
                            )}
                        >
                            <p className="text-[10px] uppercase tracking-[0.2em] text-[#A0A0A8] mb-1">{p.brand}</p>
                            <h3 className="font-serif text-lg font-light text-[#F3F3F3] leading-tight">{p.name}</h3>
                            <div className="mt-6 flex items-center justify-between border-t border-[#232327] pt-4">
                                <div>
                                    <span className="text-xs font-bold text-[#22C55E]">
                                        ${Number(p.sell_price).toLocaleString()}
                                    </span>
                                    <p className="text-[10px] text-[#A0A0A8] mt-0.5">{p.current_stock} disponibles</p>
                                </div>
                                <Plus className="h-4 w-4 text-[#A0A0A8] group-hover:text-[#22C55E] transition-colors" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Cart Sidebar */}
            <div className="w-[380px] flex flex-col bg-[#141418] border border-[#232327] rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-[#232327] flex items-center justify-between">
                    <h2 className="serif-title text-xl font-light text-[#F3F3F3]">Bolsa de Venta</h2>
                    <ShoppingBag className="h-5 w-5 text-[#A0A0A8]" />
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                            <ShoppingBag className="h-12 w-12 mb-3" />
                            <p className="font-serif italic text-sm text-[#A0A0A8]">Tu selección aparecerá aquí</p>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.id} className="animate-in slide-in-from-right-4 duration-300">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">{item.brand}</p>
                                        <h4 className="font-medium text-[#F3F3F3] mt-0.5">{item.name}</h4>
                                        <p className="text-xs font-bold text-[#22C55E] mt-0.5">${Number(item.sell_price).toLocaleString()}</p>
                                    </div>
                                    <button onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="text-[#A0A0A8] hover:text-red-400 transition-colors">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="mt-3 flex items-center justify-between">
                                    <div className="flex items-center gap-3 bg-[#0E0E10] rounded-full px-3 py-1 border border-[#232327]">
                                        <button onClick={() => updateQty(item.id, -1)} className="text-[#A0A0A8] hover:text-[#F3F3F3] transition-colors"><Minus className="h-3 w-3" /></button>
                                        <span className="text-xs font-bold text-[#F3F3F3] w-4 text-center">{item.qty}</span>
                                        <button onClick={() => updateQty(item.id, 1)} className="text-[#A0A0A8] hover:text-[#F3F3F3] transition-colors"><Plus className="h-3 w-3" /></button>
                                    </div>
                                    <span className="text-xs font-bold text-[#F3F3F3]">${(item.qty * Number(item.sell_price)).toLocaleString()}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-6 border-t border-[#232327] space-y-4">
                    {/* Notes */}
                    <textarea
                        placeholder="Notas de la venta..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full bg-transparent border-none p-0 text-sm text-[#A0A0A8] placeholder:text-[#232327] focus:ring-0 resize-none"
                        rows={1}
                    />

                    {/* Discount */}
                    <div className="flex items-center gap-3">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#A0A0A8] shrink-0">Descuento</label>
                        <div className="flex items-center gap-1 flex-1">
                            <span className="text-[#A0A0A8] text-sm">$</span>
                            <input
                                type="number"
                                min="0"
                                value={discountInput}
                                onChange={(e) => handleDiscountChange(e.target.value)}
                                className="flex-1 bg-transparent text-sm text-[#F3F3F3] focus:outline-none text-right"
                                placeholder="0"
                            />
                        </div>
                    </div>

                    {/* Totals */}
                    <div className="space-y-1 border-t border-[#232327] pt-3">
                        <div className="flex justify-between text-xs text-[#A0A0A8]">
                            <span>Subtotal</span>
                            <span>${subtotal.toLocaleString()}</span>
                        </div>
                        {validDiscount > 0 && (
                            <div className="flex justify-between text-xs text-red-400">
                                <span>Descuento</span>
                                <span>-${validDiscount.toLocaleString()}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-[#F3F3F3] pt-1">
                            <span className="text-[10px] uppercase tracking-widest text-[#A0A0A8]">Total</span>
                            <span className="text-2xl font-light text-[#22C55E]">${total.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[#A0A0A8]">Método de Pago</label>
                        <div className="grid grid-cols-2 gap-1.5">
                            {[
                                { key: 'cash', label: '💵 Efectivo' },
                                { key: 'nequi', label: '🟣 Nequi' },
                                { key: 'bancolombia', label: '🟡 Bancolombia' },
                                { key: 'daviplata', label: '🔴 Daviplata' },
                            ].map(m => (
                                <button key={m.key} type="button"
                                    onClick={() => setPaymentMethod(m.key as any)}
                                    className={cn("py-2 px-2 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-all",
                                        paymentMethod === m.key
                                            ? "bg-white/10 text-[#F3F3F3] border-white/15"
                                            : "text-[#A0A0A8] border-[#232327] hover:border-[#2e2e35]"
                                    )}>
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sale Type */}
                    <div className="flex rounded-xl overflow-hidden border border-[#232327]">
                        <button
                            onClick={() => setSaleType('contado')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold uppercase tracking-widest transition-all",
                                saleType === 'contado'
                                    ? "bg-white/10 text-[#F3F3F3] border-r border-white/15"
                                    : "text-[#A0A0A8] hover:text-[#F3F3F3] border-r border-[#232327]"
                            )}
                        >
                            <Banknote className="h-3.5 w-3.5" />
                            Contado
                        </button>
                        <button
                            onClick={() => setSaleType('credito')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold uppercase tracking-widest transition-all",
                                saleType === 'credito'
                                    ? "bg-purple-500/10 text-purple-400"
                                    : "text-[#A0A0A8] hover:text-[#F3F3F3]"
                            )}
                        >
                            <CreditCard className="h-3.5 w-3.5" />
                            Crédito
                        </button>
                    </div>

                    {/* Credit fields */}
                    {saleType === 'credito' && (
                        <div className="space-y-3 border border-purple-500/20 rounded-xl p-4 bg-purple-500/5 animate-in slide-in-from-bottom-2 duration-200">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Datos del Crédito</p>
                            <input
                                type="text"
                                placeholder="Nombre del cliente *"
                                value={creditCustomer}
                                onChange={e => setCreditCustomer(e.target.value)}
                                className="w-full bg-transparent border-b border-[#232327] py-1.5 text-sm text-[#F3F3F3] placeholder:text-[#A0A0A8] focus:border-purple-400 focus:outline-none transition-colors"
                                required
                            />
                            <input
                                type="tel"
                                placeholder="Teléfono (opcional)"
                                value={creditPhone}
                                onChange={e => setCreditPhone(e.target.value)}
                                className="w-full bg-transparent border-b border-[#232327] py-1.5 text-sm text-[#F3F3F3] placeholder:text-[#A0A0A8] focus:border-purple-400 focus:outline-none transition-colors"
                            />
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="text-[9px] uppercase tracking-widest text-[#A0A0A8]">Abono inicial ($)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max={total}
                                        placeholder="0"
                                        value={creditDeposit}
                                        onChange={e => setCreditDeposit(e.target.value)}
                                        className="w-full bg-transparent border-b border-[#232327] py-1.5 text-sm text-[#F3F3F3] focus:border-purple-400 focus:outline-none"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[9px] uppercase tracking-widest text-[#A0A0A8]">Fecha vencimiento</label>
                                    <input
                                        type="date"
                                        value={creditDueDate}
                                        onChange={e => setCreditDueDate(e.target.value)}
                                        className="w-full bg-transparent border-b border-[#232327] py-1.5 text-sm text-[#F3F3F3] focus:border-purple-400 focus:outline-none"
                                    />
                                </div>
                            </div>
                            {total > 0 && (
                                <p className="text-[10px] text-purple-300">
                                    Deuda inicial: ${(total - (parseFloat(creditDeposit) || 0)).toLocaleString()} COP
                                </p>
                            )}
                        </div>
                    )}

                    {/* Confirm Button */}
                    <button
                        onClick={handleCompleteSale}
                        disabled={cart.length === 0 || loading}
                        className={cn(
                            "w-full py-4 rounded-xl text-[10px] font-bold uppercase tracking-[0.3em] transition-all disabled:opacity-30 disabled:cursor-not-allowed",
                            saleType === 'credito'
                                ? "bg-purple-600 hover:bg-purple-500 text-white"
                                : "bg-[#22C55E] hover:bg-[#16A34A] text-black"
                        )}
                    >
                        {loading ? <Loader2 className="animate-spin mx-auto h-4 w-4" /> :
                            saleType === 'credito' ? 'Registrar Crédito' : 'Confirmar Venta'}
                    </button>
                </div>
            </div>
        </div>
    )
}
