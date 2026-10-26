const EARTH_RADIUS_M = 6_371_000

export interface LatLng { lat: number; lng: number }

/** Great-circle distance in meters. */
export function haversine(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export interface Fix extends LatLng { accuracy_m: number }

export type FixError = 'denied' | 'unavailable' | 'timeout' | 'unsupported'

/**
 * Watch GPS for up to `ms` and keep the most accurate reading, stopping early
 * once accuracy is good enough. Rejects with a FixError; never resolves 0,0.
 */
export function captureFix(ms = 10_000, goodEnoughM = 8, onProgress?: (f: Fix) => void): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject('unsupported' satisfies FixError)
    let best: Fix | null = null
    const finish = () => {
      navigator.geolocation.clearWatch(watch)
      clearTimeout(timer)
      if (best) resolve(best)
      else reject('timeout' satisfies FixError)
    }
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        const f = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy_m: Math.round(p.coords.accuracy) }
        if (f.lat === 0 && f.lng === 0) return
        if (!best || f.accuracy_m < best.accuracy_m) {
          best = f
          onProgress?.(f)
        }
        if (f.accuracy_m <= goodEnoughM) finish()
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          navigator.geolocation.clearWatch(watch)
          clearTimeout(timer)
          reject('denied' satisfies FixError)
        } else if (err.code === err.POSITION_UNAVAILABLE && !best) {
          // keep watching until the timer; a fix may still arrive
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: ms },
    )
    const timer = setTimeout(finish, ms)
  })
}
