import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { AppShell } from '@/components/app-shell'
import { isHindsightConfigured } from '@/lib/memory/hindsight'
import { getModelId, isModelConfigured } from '@/lib/agent/analyze'
import { readSession } from '@/lib/auth/session'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' })

export const metadata: Metadata = {
  title: 'CASEMIND — Investigation Memory Agent',
  description:
    'An evidence continuity agent with optional case-isolated Hindsight memory for investigation support.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f7f8fb',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await readSession()
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="antialiased">
        <AppShell memoryOn={isHindsightConfigured()} modelLabel={isModelConfigured() ? getModelId() : 'Demo fallback'} sessionMode={session?.mode ?? null}>{children}</AppShell>
        <Toaster richColors position="bottom-right" />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
