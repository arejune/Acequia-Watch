const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export const usd = (n: number | null | undefined) => (n == null ? '—' : usd0.format(n))

/** $1.2M / $48k style, for tight spaces. */
export function usdShort(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`
  if (n >= 1e4) return `$${Math.round(n / 1e3)}k`
  return usd0.format(n)
}

export const pct = (x: number) => `${Math.round(x * 100)}%`

export const meters = (m: number | null | undefined) => (m == null ? 'unknown' : `±${Math.round(m)} m`)

export const coord = (lat: number | null, lng: number | null) =>
  lat == null || lng == null ? 'no location' : `${lat.toFixed(5)}, ${lng.toFixed(5)}`

export const date = (iso: string) =>
  new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export function ago(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return date(iso)
}

export const bytes = (b: number) =>
  b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`

export const uuid = () => crypto.randomUUID()
