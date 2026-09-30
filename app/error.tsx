'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[casemind] application route failed', error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-start justify-center gap-4 p-8">
      <span className="flex size-10 items-center justify-center rounded-full bg-challenged/15 text-challenged-foreground"><AlertTriangle className="size-5" aria-hidden="true" /></span>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">This investigation view could not be loaded</h1>
        <p className="text-sm leading-6 text-muted-foreground">CASEMIND could not read the structured investigation state. Check that PostgreSQL is available, DATABASE_URL is configured, and the schema in lib/db/schema.sql has been applied. No investigation data has been changed by this screen.</p>
      </div>
      <Button variant="outline" onClick={reset}><RotateCcw />Retry</Button>
    </main>
  )
}
