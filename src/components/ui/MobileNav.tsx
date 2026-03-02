'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, ShoppingBag, Package, CreditCard, History } from 'lucide-react'
import { cn } from '@/lib/utils'

const bottomNav = [
    { name: 'Inicio', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Inventario', href: '/inventory', icon: History },
    { name: 'POS', href: '/sales', icon: ShoppingBag },
    { name: 'Productos', href: '/products', icon: Package },
    { name: 'Créditos', href: '/credits', icon: CreditCard },
]

export function MobileNav() {
    const pathname = usePathname()

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#0E0E10] border-t border-[#232327] flex">
            {bottomNav.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/sales' && pathname.startsWith(item.href + '/'))
                return (
                    <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                            "flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-[10px] font-bold uppercase tracking-wider transition-colors",
                            isActive
                                ? "text-[#F3F3F3]"
                                : "text-[#A0A0A8]"
                        )}
                    >
                        <item.icon className={cn("h-5 w-5", isActive ? "text-[#F3F3F3]" : "text-[#A0A0A8]")} />
                        {item.name}
                    </Link>
                )
            })}
        </nav>
    )
}
