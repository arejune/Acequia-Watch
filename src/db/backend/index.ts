import { createLocalBackend } from './local'
import { createSupabaseBackend } from './supabase'
import { BackendError, type Backend } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const real: Backend = url && key ? createSupabaseBackend(url, key) : createLocalBackend()

// ---- test hooks: hidden switches for the test plan and the demo video ----

const SIM_KEY = 'aw-simulate-offline'
const readSim = () => { try { return localStorage.getItem(SIM_KEY) === '1' } catch { return false } }
export const hooks = { simulateOffline: readSim(), dropMidSync: false }

/** "Simulate offline" stays on until it's turned off, across screens and reloads. */
export function setSimulateOffline(on: boolean) {
  hooks.simulateOffline = on
  try { if (on) localStorage.setItem(SIM_KEY, '1'); else localStorage.removeItem(SIM_KEY) } catch { /* private mode */ }
  window.dispatchEvent(new Event(on ? 'offline' : 'online'))
}

/** Every server call (except the local session check) fails while simulated offline. */
export const backend: Backend = new Proxy(real, {
  get(target, prop, receiver) {
    const v = Reflect.get(target, prop, receiver)
    if (typeof v !== 'function' || prop === 'currentUserId') return v
    return (...args: unknown[]) => {
      if (hooks.simulateOffline) return Promise.reject(new BackendError('network', 'No connection to the server (simulated).'))
      return (v as (...a: unknown[]) => unknown).apply(target, args)
    }
  },
})

/** Throws the same error a dead connection would. */
export function assertOnline() {
  if (hooks.simulateOffline || !navigator.onLine) throw new BackendError('network', 'No connection to the server.')
}

/**
 * "Drop the connection mid-sync": after `okBefore` successful writes in a sync
 * run, the next write reaches the server but its acknowledgment is lost, and
 * every later call fails before sending. The switch then turns itself off.
 */
export function midSyncDropper(okBefore = 2) {
  let done = 0
  let dropped = false
  return async <T>(write: () => Promise<T>): Promise<T> => {
    if (dropped) throw new BackendError('network', 'Connection dropped (test switch).')
    if (!hooks.dropMidSync) return write()
    if (done < okBefore) {
      done++
      return write()
    }
    await write() // the server commits...
    dropped = true
    hooks.dropMidSync = false // the connection "comes back" for the next run
    throw new BackendError('network', 'Connection dropped before the server replied (test switch).') // ...but we never hear back
  }
}

export { BackendError }
