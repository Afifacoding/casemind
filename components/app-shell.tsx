'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BrainCircuit } from 'lucide-react'
import { SidebarNav } from './sidebar-nav'
import { LogoutButton } from './logout-button'

export function AppShell({ children, memoryOn, modelLabel, sessionMode }: { children: React.ReactNode; memoryOn: boolean; modelLabel: string; sessionMode: 'investigator' | 'demo' | null }) {
  const pathname = usePathname()
  if (pathname === '/login' || pathname === '/') return <>{children}</>
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 bg-sidebar p-4 text-sidebar-foreground md:sticky md:top-0 md:h-dvh md:w-60">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-2 pt-1">
          <span className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <BrainCircuit className="size-4.5" aria-hidden="true" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-wide text-sidebar-primary">CASEMIND</span>
            <span className="text-xs text-sidebar-foreground/70">Investigation memory</span>
          </span>
        </Link>
        <SidebarNav />
        {sessionMode ? <div className="mt-auto flex flex-col gap-2 rounded-md border border-sidebar-border p-3 text-xs">
          <div className="flex items-center gap-2 font-medium text-sidebar-primary"><span className={`size-1.5 rounded-full ${sessionMode === 'investigator' ? 'bg-supported' : 'bg-challenged'}`} aria-hidden="true" />{sessionMode === 'investigator' ? 'INVESTIGATOR SESSION ACTIVE' : 'DEMO ENVIRONMENT · LOCAL SESSION'}</div>
          <LogoutButton />
        </div> : null}
        <div className={`${sessionMode ? 'mt-3' : 'mt-auto'} hidden flex-col gap-3 rounded-md border border-sidebar-border p-3 text-xs md:flex`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sidebar-foreground/70">Hindsight memory</span>
            <span className="flex items-center gap-1.5 font-medium text-sidebar-primary">
              <span
                className={`size-1.5 rounded-full ${memoryOn ? 'bg-supported' : 'bg-challenged'}`}
                aria-hidden="true"
              />
              {memoryOn ? 'Configured' : 'Not configured'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sidebar-foreground/70">AI analysis</span>
            <span className="truncate font-mono text-sidebar-primary">{modelLabel}</span>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
