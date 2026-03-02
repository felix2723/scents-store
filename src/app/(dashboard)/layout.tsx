'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/ui/Sidebar'
import { MobileNav } from '@/components/ui/MobileNav'
import { Menu } from 'lucide-react'
import Image from 'next/image'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [mobileOpen, setMobileOpen] = useState(false)

    return (
        <div className="flex h-screen bg-[#0B0B0C]">
            <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

            <div className="flex flex-col flex-1 min-w-0">
                {/* Mobile top header — hidden on desktop */}
                <header className="flex md:hidden h-16 items-center justify-between px-4 bg-[#0E0E10] border-b border-[#232327] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg overflow-hidden border border-[#232327]">
                            <Image src="/logo.png" alt="Scents Store" width={32} height={32} className="object-cover" />
                        </div>
                        <div className="leading-tight">
                            <p className="font-serif text-xs font-light text-[#F3F3F3] tracking-widest uppercase">Scents</p>
                            <p className="text-[9px] text-[#A0A0A8] tracking-[0.2em] uppercase">Store Manager</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setMobileOpen(true)}
                        className="p-2 rounded-lg text-[#A0A0A8] hover:text-[#F3F3F3] hover:bg-white/5 transition-colors"
                        aria-label="Abrir menú"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 pb-24 md:pb-10">
                    <div className="mx-auto max-w-7xl">
                        {children}
                    </div>
                </main>
            </div>

            {/* Mobile bottom navigation */}
            <MobileNav />
        </div>
    )
}
