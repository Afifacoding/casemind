'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { establishInvestigatorSession, enterDemoEnvironment } from '@/app/auth-actions'
import { Activity, ArrowRight, BrainCircuit, Check, Fingerprint, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react'

const activity = [
  { time: '07:42:18', title: 'Evidence relationship updated' },
  { time: '07:42:23', title: 'Timeline consistency check completed' },
  { time: '07:42:31', title: 'Investigation memory synchronized' },
]

export function InvestigationEntry({ memoryStatus, memoryDetail }: { memoryStatus: 'CONNECTED' | 'LOCAL DEMO' | 'CONNECTION ERROR'; memoryDetail: string }) {
  const [loginState, loginAction, loginPending] = useActionState(establishInvestigatorSession, null)

  return (
    <main className="fixed inset-0 z-50 overflow-x-hidden overflow-y-auto bg-[#07111d] text-slate-100 selection:bg-cyan-300/25 selection:text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(126,160,193,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(126,160,193,0.055)_1px,transparent_1px)] bg-[size:44px_44px] opacity-45 [mask-image:linear-gradient(to_bottom,black,transparent_88%)]" />
      <div className="pointer-events-none absolute -left-36 -top-48 size-[34rem] rounded-full bg-cyan-500/[0.07] blur-[120px]" />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[1440px] flex-col px-5 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <Link href="/login" aria-label="CASEMIND entry" className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-200"><BrainCircuit className="size-5" aria-hidden="true" /></span>
            <span className="flex flex-col leading-tight"><span className="text-sm font-semibold tracking-[0.2em] text-white">CASEMIND</span><span className="mt-1 text-[10px] tracking-[0.14em] text-slate-400">EVIDENCE CONTINUITY AGENT</span></span>
          </Link>
          <div className="hidden items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400 sm:flex"><span className="size-1.5 rounded-full bg-cyan-300" />Investigation environment</div>
        </header>

        <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-20 lg:py-16">
          <section className="flex flex-col justify-center">
            <div className="mb-8 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-cyan-200/80"><span className="h-px w-8 bg-cyan-300/60" />Secure investigation terminal</div>
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">Enter the <span className="text-cyan-200">investigation</span> system.</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">Enter the investigation environment to continue reviewing evidence, timelines and case memory.</p>

            <div className="mt-12 grid max-w-2xl gap-3 sm:grid-cols-3">
              <Feature icon={Fingerprint} title="Evidence intelligence" detail="Sources, claims and connections" />
              <Feature icon={Activity} title="Case continuity" detail="State changes across time" />
              <Feature icon={BrainCircuit} title="Investigation memory" detail="Context kept case-specific" />
            </div>
            <div className="mt-10 flex items-center gap-3 text-xs text-slate-500"><ShieldCheck className="size-4 text-cyan-200/70" aria-hidden="true" /><span>Investigator-led review · Evidence association is not a determination of guilt</span></div>
          </section>

          <aside className="flex flex-col gap-4">
            <section className="rounded-xl border border-white/10 bg-[#0c1927]/90 p-5 shadow-[0_24px_80px_-36px_rgba(0,0,0,0.9)] backdrop-blur sm:p-6" aria-labelledby="access-title">
              <div className="mb-6 flex items-start justify-between gap-3">
                <div><p className="text-[10px] font-semibold uppercase tracking-[0.19em] text-cyan-200/80">CASEMIND / ACCESS</p><h2 id="access-title" className="mt-2 text-lg font-semibold tracking-tight text-white">Investigation access</h2></div>
                <span className="flex size-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] text-slate-300"><LockKeyhole className="size-4" aria-hidden="true" /></span>
              </div>
              <form action={loginAction} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2"><label htmlFor="investigator-id" className="text-xs font-medium text-slate-300">Identifier / investigator ID</label><div className="relative"><Fingerprint className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" /><input id="investigator-id" name="identifier" autoComplete="username" required placeholder="Enter investigator ID" className="h-11 w-full rounded-md border border-white/10 bg-[#07111d] pl-10 pr-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10" /></div></div>
                <div className="flex flex-col gap-2"><label htmlFor="access-key" className="text-xs font-medium text-slate-300">Access key</label><div className="relative"><KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" /><input id="access-key" name="accessKey" type="password" autoComplete="current-password" required placeholder="Enter access key" className="h-11 w-full rounded-md border border-white/10 bg-[#07111d] pl-10 pr-3 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10" /></div></div>
                <div className="flex flex-col gap-2"><label htmlFor="investigator-code" className="text-xs font-medium text-slate-300">Investigator Code</label><input id="investigator-code" name="investigatorCode" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} minLength={6} required placeholder="6-digit code" className="h-11 w-full rounded-md border border-white/10 bg-[#07111d] px-3 font-mono text-sm tracking-[0.22em] text-white outline-none transition-colors placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10" /></div>
                <button type="submit" disabled={loginPending} className="mt-1 flex h-11 items-center justify-center gap-2 rounded-md border border-cyan-200/20 bg-cyan-300/[0.12] px-4 text-xs font-semibold tracking-[0.1em] text-cyan-100 transition-colors hover:bg-cyan-300/[0.18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:cursor-wait disabled:opacity-60">{loginPending ? 'VERIFYING SESSION…' : 'ESTABLISH SECURE SESSION'}<ArrowRight className="size-4" aria-hidden="true" /></button>
                {loginState?.error ? <p role="alert" className="rounded-md border border-rose-300/20 bg-rose-300/[0.06] p-3 text-xs leading-5 text-rose-100">{loginState.error}</p> : null}
              </form>
              <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.14em] text-slate-600"><span className="h-px flex-1 bg-white/10" />or continue with demo<span className="h-px flex-1 bg-white/10" /></div>
              <form action={enterDemoEnvironment}><button type="submit" className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.035] px-4 text-xs font-medium tracking-[0.08em] text-slate-200 transition-colors hover:border-cyan-200/25 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">ENTER DEMO ENVIRONMENT<ArrowRight className="size-4 text-cyan-200" aria-hidden="true" /></button></form>
              <p className="mt-3 text-center text-[10px] leading-4 text-slate-500">Fictional case data · Demo changes are local to this server process</p>
            </section>

            <section className="rounded-xl border border-white/10 bg-[#0c1927]/75 p-5" aria-labelledby="system-status-title">
              <div className="mb-4 flex items-center justify-between"><h2 id="system-status-title" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">CASEMIND system status</h2><span className="text-[9px] uppercase tracking-[0.12em] text-slate-600">Server check</span></div>
              <ul className="flex flex-col gap-3">
                <StatusRow label="Evidence Engine" value="READY" connected />
                <StatusRow label="Investigation Memory" value={memoryStatus} connected={memoryStatus === 'CONNECTED'} />
                <StatusRow label="Continuity Monitor" value="ACTIVE" connected />
              </ul>
              {memoryStatus === 'CONNECTION ERROR' ? <p className="mt-3 border-t border-white/10 pt-3 text-[11px] leading-5 text-amber-100/80">{memoryDetail}</p> : null}
            </section>

            <section className="rounded-xl border border-white/10 bg-[#0c1927]/55 p-5" aria-labelledby="activity-title">
              <div className="mb-4 flex items-center justify-between gap-2"><h2 id="activity-title" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300">Recent system activity</h2><span className="text-[9px] text-slate-600">ILLUSTRATIVE DEMO</span></div>
              <ol className="flex flex-col gap-3">
                {activity.map((item) => <li key={item.time} className="flex items-start gap-3 border-l border-white/10 pl-3"><time className="shrink-0 font-mono text-[10px] tabular-nums text-cyan-100/65">[{item.time}]</time><span className="text-xs leading-4 text-slate-300">{item.title}</span></li>)}
              </ol>
              <p className="mt-3 text-[10px] text-slate-600">Sample activity only — not a live audit log.</p>
            </section>
          </aside>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 text-[10px] text-slate-600"><span>CASEMIND · Evidence Continuity Agent</span><span>Investigation support system · Human review required</span></footer>
      </div>
    </main>
  )
}

function Feature({ icon: Icon, title, detail }: { icon: typeof Fingerprint; title: string; detail: string }) {
  return <div className="border-l border-cyan-200/20 py-1 pl-3"><Icon className="mb-3 size-4 text-cyan-200/75" aria-hidden="true" /><p className="text-xs font-medium text-slate-200">{title}</p><p className="mt-1 text-[10px] leading-4 text-slate-500">{detail}</p></div>
}

function StatusRow({ label, value, connected }: { label: string; value: string; connected: boolean }) {
  return <li className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-xs text-slate-300"><span className={`size-1.5 rounded-full ${connected ? 'bg-emerald-300' : 'bg-slate-500'}`} aria-hidden="true" />{label}</span><span className={`flex items-center gap-1 text-[10px] font-semibold tracking-[0.12em] ${connected ? 'text-emerald-200' : 'text-slate-400'}`}>{connected ? <Check className="size-3" aria-hidden="true" /> : null}{value}</span></li>
}
