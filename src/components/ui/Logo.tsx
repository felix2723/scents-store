'use client'

import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface LogoProps {
    variant?: 'compact' | 'full'
    className?: string
}

export function Logo({ variant = 'full', className = "" }: LogoProps) {
    // Path for the logo
    const logoPath = '/brand/logo.png'

    return (
        <Link href="/dashboard" className={`block ${className}`}>
            <div className={cn(
                "relative transition-transform duration-500 hover:scale-105 active:scale-95",
                variant === 'full' ? "h-20 w-48" : "h-12 w-12"
            )}>
                <Image
                    src={logoPath}
                    alt="Scents Perfumeria"
                    fill
                    className="object-contain"
                    priority
                />
            </div>
        </Link>
    )
}
