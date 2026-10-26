import { hooks } from '../db/backend'
import { liveQuery } from 'dexie'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { db, getMeta } from '../db/local'
import { onSyncRunning } from '../db/sync'

/** Re-renders whenever the IndexedDB rows behind `query` change. */
export function useLive<T>(query: () => Promise<T>, deps: unknown[] = []): T | undefined {
  const [value, setValue] = useState<T>()
  useEffect(() => {
    const sub = liveQuery(query).subscribe({ next: setValue, error: (e) => console.error(e) })
    return () => sub.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return value
}

export const useMeta = <T,>(key: string, fallback: T) => useLive(() => getMeta(key, fallback), [key]) ?? fallback

export function useOnline() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb)
      window.addEventListener('offline', cb)
      return () => {
        window.removeEventListener('online', cb)
        window.removeEventListener('offline', cb)
      }
    },
    () => navigator.onLine && !hooks.simulateOffline,
  )
}

export function useSyncRunning() {
  const [running, setRunning] = useState(false)
  useEffect(() => onSyncRunning(setRunning), [])
  return running
}

/** Pending work for the sync pill and the tab badge. */
export function useOutboxSummary() {
  return useLive(async () => {
    const items = await db.outbox.toArray()
    return {
      waiting: items.filter((i) => i.state === 'queued' || i.state === 'paused').length,
      attention: items.filter((i) => i.state === 'error' || i.state === 'conflict').length,
      paused: items.some((i) => i.state === 'paused'),
    }
  }) ?? { waiting: 0, attention: 0, paused: false }
}

/** Object URL for a Blob that is revoked when the component unmounts. */
export function useBlobUrl(blob: Blob | null | undefined) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) return setUrl(undefined)
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}
