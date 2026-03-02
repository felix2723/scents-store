import { Sidebar } from '@/components/ui/Sidebar'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex h-screen bg-[#0B0B0C]">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-10">
                <div className="mx-auto max-w-7xl">
                    {children}
                </div>
            </main>
        </div>
    )
}
