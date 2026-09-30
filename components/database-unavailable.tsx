import Link from 'next/link'
import { AlertTriangle, Database } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function DatabaseUnavailable({ backHref = '/' }: { backHref?: string }) {
  return (
    <div className="p-4 md:p-8">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="size-4" />Investigation data is unavailable</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-challenged-foreground" />CASEMIND could not read its PostgreSQL state. No evidence processing was performed.</p>
          <p className="text-sm text-muted-foreground">Set DATABASE_URL in .env.local, apply lib/db/schema.sql to that database, and reload this page. The demo cases and investigation state are stored in PostgreSQL; they are not silently replaced with volatile mock data.</p>
          {backHref !== '/' ? <Link href="/dashboard" className="text-sm font-medium text-primary hover:underline">Return to dashboard</Link> : null}
        </CardContent>
      </Card>
    </div>
  )
}
