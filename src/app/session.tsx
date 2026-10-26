import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { backend } from '../db/backend'
import { db, getMeta, setMeta } from '../db/local'
import { pull } from '../db/sync'
import { resetAgencyData } from './agency/data'
import { useLive, useMeta } from '../lib/hooks'
import type { Profile } from '../db/types'

interface Session {
  profile: Profile | null
  /** false while we check what is stored on the phone */
  ready: boolean
  /** a profile is cached on the phone but the server login is gone */
  expired: boolean
  signIn: (email: string, password: string) => Promise<Profile>
  /** Creates an account; returns the profile, or null when the email must be confirmed first. */
  signUp: (email: string, password: string, name: string) => Promise<Profile | null>
  /** Re-reads your profile and access from the server (after an admin approves you). */
  refresh: () => Promise<void>
  signOut: (force?: boolean) => Promise<{ pending: number } | void>
}

const Ctx = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const loaded = useLive(() => getMeta<Profile | null>('profile', null))
  const profile = loaded ?? null
  const authExpired = useMeta('authExpired', false)
  const [hasServerSession, setHasServerSession] = useState<boolean | null>(null)

  useEffect(() => {
    backend.currentUserId().then((id) => setHasServerSession(!!id))
  }, [profile?.id])

  // arrived from a magic link: there is a server session but nothing cached yet
  useEffect(() => {
    if (loaded === null && hasServerSession) pull().catch(() => {})
  }, [loaded, hasServerSession])

  const value: Session = {
    profile,
    ready: loaded !== undefined && hasServerSession !== null,
    expired: !!profile && (hasServerSession === false || authExpired),
    async signIn(email, password) {
      await backend.signInWithPassword(email, password)
      const uid = await backend.currentUserId()
      // a different person on this phone: start from a clean local store
      if (profile && profile.id !== uid) await clearLocal()
      await pull()
      await db.outbox.where('state').equals('paused').modify({ state: 'queued', next_try_at: 0 })
      setHasServerSession(true)
      return (await db.meta.get('profile'))!.value as Profile
    },
    async signUp(email, password, name) {
      const { signedIn } = await backend.signUp(email, password, name)
      if (!signedIn) return null
      if (profile) await clearLocal()
      await pull()
      setHasServerSession(true)
      return (await db.meta.get('profile'))!.value as Profile
    },
    async refresh() {
      await pull()
    },
    async signOut(force = false) {
      const pending = await db.outbox.count()
      if (pending && !force) return { pending }
      await backend.signOut()
      await clearLocal()
      setHasServerSession(false)
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

async function clearLocal() {
  resetAgencyData()
  await Promise.all(db.tables.map((t) => t.clear()))
  await setMeta('profile', null)
}

export function useSession() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useSession outside SessionProvider')
  return s
}
