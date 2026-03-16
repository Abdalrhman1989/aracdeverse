'use client'
import { useEffect } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setSession, setLoading } = useAuthStore()

  useEffect(() => {
    const sb = getSupabaseBrowserClient()
    void sb.auth.getSession().then((res: Awaited<ReturnType<typeof sb.auth.getSession>>) => {
      setSession(res.data.session)
      setLoading(false)
    })
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [setSession, setLoading])

  return <>{children}</>
}
