import { cn } from '@/lib/utils'

const styles: Record<string, string> = {
  supported: 'bg-supported/12 text-supported-foreground ring-supported/30',
  challenged: 'bg-challenged/15 text-challenged-foreground ring-challenged/40',
  unresolved: 'bg-muted text-muted-foreground ring-border',
  contradiction: 'bg-challenged/15 text-challenged-foreground ring-challenged/40',
  memory: 'bg-memory/10 text-memory-foreground ring-memory/30',
  neutral: 'bg-secondary text-secondary-foreground ring-border',
}

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: keyof typeof styles | string
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
        styles[tone] ?? styles.neutral,
        className,
      )}
    >
      {children}
    </span>
  )
}

export function EvidenceRef({ id }: { id: number }) {
  return <span className="font-mono text-xs text-muted-foreground">E{id}</span>
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground text-pretty">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground text-pretty">{description}</p>
    </div>
  )
}
