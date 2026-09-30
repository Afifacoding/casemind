export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex max-w-3xl flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{eyebrow}</span>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance md:text-3xl">{title}</h1>
        {description ? <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </header>
  )
}
