import Link from 'next/link'
import { ArrowRight, GitCompareArrows, FileStack, HelpCircle, Users, FolderOpen, BrainCircuit, Clock3, ChevronRight } from 'lucide-react'
import { getDashboard } from '@/lib/queries'
import { EmptyState, StatusPill } from '@/components/case/status-pill'
import { CreateCaseDialog } from '@/components/create-case-dialog'
import { DatabaseUnavailable } from '@/components/database-unavailable'
import { requireSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
	await requireSession()
	const dashboard = await getDashboard().catch((error) => {
		console.error('[casemind] dashboard database query failed', error)
		return null
	})
	if (!dashboard) return <DatabaseUnavailable />
	const { cases, totals, recentUpdates } = dashboard

	const stats = [
		{ label: 'Active cases', value: totals.activeCases, icon: FolderOpen },
		{ label: 'Evidence items', value: totals.evidence, icon: FileStack },
		{ label: 'People connected', value: totals.people, icon: Users },
		{ label: 'Contradictions', value: totals.contradictions, icon: GitCompareArrows },
		{ label: 'Open questions', value: totals.unresolved, icon: HelpCircle },
	]

	return (
		<div className="mx-auto flex w-full max-w-[1440px] flex-col gap-7 p-4 md:gap-8 md:p-8">
			<header className="flex flex-wrap items-end justify-between gap-5 border-b pb-6">
				<div className="flex min-w-0 items-start gap-4">
					<span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm"><BrainCircuit className="size-6" aria-hidden="true" /></span>
					<div className="flex min-w-0 flex-col gap-1.5">
						<div className="flex flex-wrap items-center gap-2">
							<span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">CASEMIND</span>
							<span className="text-muted-foreground">/</span>
							<span className="text-xs text-muted-foreground">Investigation intelligence</span>
							<StatusPill tone="memory">Fictional demo</StatusPill>
						</div>
						<h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance md:text-3xl">Evidence continuity across every case</h1>
						<p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">Track how evidence reshapes timelines, relationships, and working conclusions. CASEMIND supports investigator review; it does not determine guilt.</p>
					</div>
				</div>
				<CreateCaseDialog />
			</header>

			<section aria-label="Investigation totals" className="grid grid-cols-2 divide-x divide-y rounded-lg border bg-card sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-5">
				{stats.map(({ label, value, icon: Icon }) => (
					<div key={label} className="flex min-h-20 items-center gap-3 px-4 py-3 sm:min-h-24 sm:px-5">
						<span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><Icon className="size-4" aria-hidden="true" /></span>
						<div className="flex min-w-0 flex-col gap-0.5">
							<span className="text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">{value}</span>
							<span className="text-[11px] leading-4 text-muted-foreground sm:text-xs">{label}</span>
						</div>
					</div>
				))}
			</section>

			<div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_360px]">
				<section className="flex min-w-0 flex-col gap-3" aria-labelledby="cases-heading">
					<div className="flex items-end justify-between gap-3 border-b pb-3">
						<div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Active investigations</p><h2 id="cases-heading" className="mt-1 text-lg font-semibold tracking-tight">Your cases</h2></div>
						<Link href="/cases" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">All cases<ChevronRight className="size-3.5" aria-hidden="true" /></Link>
					</div>
					<div className="grid gap-3 lg:grid-cols-2">
						{cases.map((c) => (
							<Link key={c.id} href={`/cases/${c.id}`} className="group flex min-h-52 flex-col rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="flex min-w-0 flex-col gap-1">
										<div className="flex flex-wrap items-center gap-2">{c.isDemo ? <StatusPill tone="memory">Synthetic data</StatusPill> : null}</div>
										<h3 className="mt-1 text-base font-semibold leading-snug text-foreground">{c.title}</h3>
									</div>
									<StatusPill tone={c.contradictionCount ? 'challenged' : c.evidenceCount ? 'supported' : 'unresolved'}>{c.statusLabel}</StatusPill>
								</div>
								<p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">{c.summary || c.description}</p>
								<div className="mt-auto grid grid-cols-3 gap-2 border-t pt-4"><CaseCount label="Evidence" value={c.evidenceCount + c.queuedCount} /><CaseCount label="People" value={c.peopleCount} /><CaseCount label="Conflicts" value={c.contradictionCount} /></div>
								<span className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary">Open investigation<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
							</Link>
						))}
					</div>
				</section>

				<section aria-labelledby="updates-heading" className="flex min-w-0 flex-col gap-3">
					<div className="border-b pb-3"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Continuity feed</p><h2 id="updates-heading" className="mt-1 text-lg font-semibold tracking-tight">Recent changes</h2></div>
					{recentUpdates.length ? (
						<ol className="divide-y rounded-lg border bg-card">{recentUpdates.map((u) => (
							<li key={u.id} className="relative px-4 py-3 pl-10 before:absolute before:bottom-0 before:left-[19px] before:top-0 before:w-px before:bg-border first:before:top-5 last:before:bottom-5">
								<span className="absolute left-[15px] top-[18px] size-2 rounded-full bg-primary ring-4 ring-card" aria-hidden="true" />
								<div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Clock3 className="size-3" />{u.caseTitle} · Day {u.investigationDay}</div>
								<Link href={`/cases/${u.caseId}#changed`} className="mt-1 block text-sm font-medium leading-5 text-foreground hover:text-primary">{u.headline}</Link>
								<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{u.whatChanged.change}</p>
							</li>
						))}</ol>
					) : <EmptyState title="No changes recorded" description="Open a case and process evidence to follow investigation state changes here." />}
				</section>
			</div>
		</div>
	)
}

function CaseCount({ label, value }: { label: string; value: number }) {
	return <div className="flex flex-col"><span className="text-base font-semibold tabular-nums">{value}</span><span className="text-[11px] text-muted-foreground">{label}</span></div>
}