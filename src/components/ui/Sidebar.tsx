'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
    LayoutDashboard, Package, History, ShoppingBag, BarChart3,
    Settings, LogOut, CreditCard, Wallet, Receipt, SlidersHorizontal, LineChart, ClipboardList, X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase'
import Image from 'next/image'

const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Inventario', href: '/inventory', icon: History },
    { name: 'Productos', href: '/products', icon: Package },
    { name: 'Ventas (POS)', href: '/sales', icon: ShoppingBag },
    { name: 'Historial Ventas', href: '/sales/history', icon: ClipboardList },
    { name: 'Reportes', href: '/reports', icon: BarChart3 },
    { name: 'Créditos', href: '/credits', icon: CreditCard },
    { name: 'Cartera', href: '/wallet', icon: Wallet },
    { name: 'Gastos', href: '/expenses', icon: Receipt },
    { name: 'Finanzas', href: '/finance', icon: LineChart },
    { name: 'Ajustes', href: '/adjustments', icon: SlidersHorizontal },
    { name: 'Configuración', href: '/settings', icon: Settings },
]

interface SidebarProps {
    mobileOpen?: boolean
    onMobileClose?: () => void
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()

    async function handleLogout() {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const SidebarContent = () => (
        <div className="flex h-full w-64 flex-col bg-[#0E0E10] border-r border-[#232327]">
            {/* Logo */}
            <div className="flex h-20 items-center px-5 border-b border-[#232327] gap-3">
                <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0 border border-[#232327]">
                    <Image src="/logo.png" alt="Scents Store Logo" width={40} height={40} className="object-cover" />
                </div>
                <div className="leading-tight">
                    <p className="font-serif text-sm font-light text-[#F3F3F3] tracking-widest uppercase">Scents</p>
                    <p className="text-[10px] text-[#A0A0A8] tracking-[0.3em] uppercase">Store Manager</p>
                </div>
                {/* Close button — only on mobile drawer */}
                {onMobileClose && (
                    <button onClick={onMobileClose} className="ml-auto text-[#A0A0A8] hover:text-[#F3F3F3] transition-colors md:hidden">
                        <X className="h-5 w-5" />
                    </button>
                )}
            </div>

            <nav className="flex-1 space-y-0.5 px-3 py-4 overflow-y-auto">
                {navigation.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/sales' && pathname.startsWith(item.href + '/'))
                    return (
                        <Link key={item.name} href={item.href}
                            onClick={onMobileClose}
                            className={cn(
                                "group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                isActive
                                    ? "bg-white/10 text-[#F3F3F3] border border-white/15"
                                    : "text-[#A0A0A8] hover:bg-[#1a1a1e] hover:text-[#F3F3F3] border border-transparent"
                            )}>
                            <item.icon className={cn("mr-3 h-4 w-4 shrink-0",
                                isActive ? "text-[#F3F3F3]" : "text-[#A0A0A8] group-hover:text-[#F3F3F3]"
                            )} />
                            {item.name}
                        </Link>
                    )
                })}
            </nav>

            <div className="border-t border-[#232327] p-4">
                <button onClick={handleLogout}
                    className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-[#EF4444] hover:bg-red-900/20 transition-colors">
                    <LogOut className="mr-3 h-4 w-4" />
                    Cerrar sesión
                </button>
            </div>
        </div>
    )

    return (
        <>
            {/* Desktop sidebar — always visible on md+ */}
            <div className="hidden md:flex h-full">
                <SidebarContent />
            </div>

            {/* Mobile drawer overlay */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 md:hidden">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onMobileClose}
                    />
                    {/* Drawer panel */}
                    <div className="absolute left-0 top-0 h-full animate-in slide-in-from-left duration-300">
                        <SidebarContent />
                    </div>
                </div>
            )}
        </>
    )
}
