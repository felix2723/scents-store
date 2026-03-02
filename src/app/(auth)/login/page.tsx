'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Logo } from '@/components/ui/Logo'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()
    const supabase = createClient()

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setError('Credenciales inválidas. Por favor intenta de nuevo.')
            setLoading(false)
        } else {
            router.push('/dashboard')
        }
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
            <div className="w-full max-w-sm">
                <div className="mb-12 flex flex-col items-center">
                    <Logo className="mb-8" />
                    <p className="text-sm text-[#555555] font-medium uppercase tracking-[0.2em]">
                        Acceso Administrativo
                    </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    {error && (
                        <div className="rounded-md bg-red-50 p-3 text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-wider text-[#555555]">
                            Email
                        </label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="block w-full border-b border-gray-300 py-2 text-black focus:border-black focus:outline-none transition-colors sm:text-sm"
                            placeholder="admin@scents.com"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold uppercase tracking-wider text-[#555555]">
                            Contraseña
                        </label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="block w-full border-b border-gray-300 py-2 text-black focus:border-black focus:outline-none transition-colors sm:text-sm"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="flex w-full items-center justify-center bg-black px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-gray-900 focus:outline-none disabled:opacity-50 transition-all duration-200"
                    >
                        {loading ? 'Iniciando sesión...' : 'ENTRAR AL SISTEMA'}
                    </button>
                </form>

                <p className="mt-8 text-center text-xs text-[#555555]">
                    &copy; {new Date().getFullYear()} Scents Perfumería. Uso Privado.
                </p>
            </div>
        </div>
    )
}
