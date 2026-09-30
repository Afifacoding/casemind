'use client'

import { logout } from '@/app/auth-actions'

export function LogoutButton() {
  return <form action={logout}><button type="submit" className="text-left text-[11px] text-sidebar-foreground/70 underline-offset-4 hover:text-sidebar-primary hover:underline">End session</button></form>
}
