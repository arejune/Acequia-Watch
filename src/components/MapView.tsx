// Leaflet with OpenStreetMap tiles (attribution kept) plus the saved OSE
// snapshot. With no signal the tiles drop away and an offline basemap shows
// ditch lines and markers on plain paper, so the map still works.
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Outcome } from '../db/types'

export interface MarkerSpec {
  id: string
  lat: number
  lng: number
  kind: Outcome | 'gap' | 'structure' | 'pin'
  severity?: number | null
  label: string // accessible name and tooltip
  unlisted?: boolean
}

interface Line { id: string; coords: { lat: number; lng: number }[]; label: string }
export interface Me { lat: number; lng: number; accuracy_m: number }

interface Props {
  markers?: MarkerSpec[]
  lines?: Line[]
  ose?: boolean
  fitTo?: 'markers' | 'state'
  height?: number | string
  onMarkerClick?: (id: string) => void
  /** location picking: tap the map to move the pin */
  onPick?: (p: { lat: number; lng: number }) => void
  me?: Me | null
  /** bump to fly to `me` */
  recenter?: number
  label: string
  className?: string
}

const NM_BOUNDS = L.latLngBounds([31.3, -109.05], [37.0, -103.0])
const OSE_CREDIT = 'Acequia lines and headgates: Office of the State Engineer, EDAC (as-is, incomplete)'

let oseCache: Promise<[GeoJSON.FeatureCollection, GeoJSON.FeatureCollection]> | null = null
const loadOse = () =>
  (oseCache ??= Promise.all([
    fetch('/data/ose-acequias.geojson').then((r) => r.json()),
    fetch('/data/ose-headgates.geojson').then((r) => r.json()),
  ]))

function icon(m: MarkerSpec) {
  const size = m.kind === 'gap' ? 20 : m.kind === 'structure' ? 16 : 26
  if (m.kind === 'pin') {
    return L.divIcon({
      className: '',
      html: `<svg width="34" height="44" viewBox="0 0 34 44" aria-hidden="true"><path d="M17 43C17 43 3 26 3 16a14 14 0 0 1 28 0c0 10-14 27-14 27z" fill="#1d4e89" stroke="#fffdf8" stroke-width="2.5"/><circle cx="17" cy="16" r="5" fill="#fffdf8"/></svg>`,
      iconSize: [34, 44],
      iconAnchor: [17, 43],
    })
  }
  const sev = m.kind === 'damaged' && m.severity ? ` sev-${m.severity}` : ''
  const bg = m.kind === 'damaged' ? `background:var(--sev-${m.severity ?? 3});` : m.kind === 'structure' ? 'background:var(--ink-3);border-radius:50%;' : ''
  const text = m.kind === 'damaged' ? String(m.severity ?? '') : m.kind === 'no_damage' ? '✓' : m.kind === 'not_accessible' ? '?' : ''
  return L.divIcon({
    className: '',
    html: `<div class="aw-marker ${m.kind}${sev}${m.unlisted ? ' unlisted' : ''}" style="width:${size}px;height:${size}px;${bg}">${text}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export function MapView({ markers = [], lines = [], ose = false, fitTo = 'markers', height = 320, onMarkerClick, onPick, me, recenter, label, className }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const meLayer = useRef<L.LayerGroup | null>(null)
  const fitted = useRef(false)
  const [tilesDown, setTilesDown] = useState(!navigator.onLine)

  useEffect(() => {
    const m = L.map(el.current!, { zoomControl: true, attributionControl: true, maxBounds: NM_BOUNDS.pad(0.5) })
    let errors = 0
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    })
      .on('tileerror', () => { if (++errors >= 3) setTilesDown(true) })
      .on('tileload', () => { errors = 0; setTilesDown(false) })
      .addTo(m)
    m.fitBounds(NM_BOUNDS)
    fitted.current = false
    map.current = m
    layer.current = L.layerGroup().addTo(m)
    meLayer.current = L.layerGroup().addTo(m)
    // the container can change size (tabs, sheets); keep tiles aligned
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(el.current!)
    const off = () => setTilesDown(true)
    window.addEventListener('offline', off)
    return () => {
      ro.disconnect()
      window.removeEventListener('offline', off)
      m.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const m = map.current
    if (!m || !ose) return
    let gone = false
    const group = L.layerGroup()
    loadOse().then(([ditches, heads]) => {
      if (gone) return
      L.geoJSON(ditches, { style: { color: '#1d4e89', weight: 3, opacity: 0.9 }, interactive: false }).addTo(group)
      L.geoJSON(heads, {
        pointToLayer: (_f, ll) => L.circleMarker(ll, { radius: 3, color: '#17140f', weight: 1, fillColor: '#fffdf8', fillOpacity: 1 }),
        interactive: false,
      }).addTo(group)
      group.addTo(m)
      m.attributionControl.addAttribution(OSE_CREDIT)
    }).catch(() => {})
    return () => {
      gone = true
      group.remove()
      m.attributionControl.removeAttribution(OSE_CREDIT)
    }
  }, [ose])

  useEffect(() => {
    const m = map.current
    const g = layer.current
    if (!m || !g) return
    g.clearLayers()
    for (const ln of lines) {
      L.polyline(ln.coords, { color: '#1d4e89', weight: 5, opacity: 0.9 }).bindTooltip(ln.label).addTo(g)
    }
    for (const mk of markers) {
      const marker = L.marker([mk.lat, mk.lng], { icon: icon(mk), title: mk.label, alt: mk.label, keyboard: !!onMarkerClick, zIndexOffset: mk.kind === 'gap' || mk.kind === 'structure' ? 0 : 500 })
      if (onMarkerClick) marker.on('click', () => onMarkerClick(mk.id))
      marker.bindTooltip(mk.label, { direction: 'top', offset: [0, -10] }).addTo(g)
    }
    if (!fitted.current && fitTo === 'markers') {
      const pts = [...markers.map((x) => L.latLng(x.lat, x.lng)), ...lines.flatMap((l) => l.coords.map((c) => L.latLng(c.lat, c.lng)))]
      if (pts.length) {
        m.fitBounds(L.latLngBounds(pts).pad(0.04), { maxZoom: 16 })
        fitted.current = true
      }
    }
  }, [markers, lines, fitTo, onMarkerClick])

  // you-are-here: accuracy ring + dot
  useEffect(() => {
    const g = meLayer.current
    if (!g) return
    g.clearLayers()
    if (!me) return
    L.circle([me.lat, me.lng], { radius: me.accuracy_m, color: '#1d4e89', weight: 1, fillColor: '#1d4e89', fillOpacity: 0.12, interactive: false }).addTo(g)
    L.circleMarker([me.lat, me.lng], { radius: 8, color: '#fffdf8', weight: 3, fillColor: '#1d4e89', fillOpacity: 1, interactive: false }).addTo(g)
  }, [me])

  useEffect(() => {
    if (recenter && me && map.current) map.current.flyTo([me.lat, me.lng], Math.max(map.current.getZoom(), 16), { duration: 0.6 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenter])

  useEffect(() => {
    const m = map.current
    if (!m || !onPick) return
    const h = (e: L.LeafletMouseEvent) => onPick({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) })
    m.on('click', h)
    return () => void m.off('click', h)
  }, [onPick])

  return (
    <div className={`map-wrap ${className ?? ''}`} style={{ height }}>
      <div ref={el} className={`map${tilesDown ? ' tiles-down' : ''}`} role="region" aria-label={label} />
      {tilesDown && <p className="map-offline">Offline map: ditches and markers only</p>}
    </div>
  )
}
