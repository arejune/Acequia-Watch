// GPS with accuracy shown, retry, and two fallbacks. Never a silent 0,0.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Crosshair, LocateFixed, Map as MapIcon, MapPin } from 'lucide-react'
import { captureFix, type Fix, type FixError } from '../lib/geo'
import { coord, meters } from '../lib/format'
import { MapView } from './MapView'
import type { LocationSource } from '../db/types'

export interface LocationValue { lat: number | null; lng: number | null; accuracy_m: number | null; location_source: LocationSource | null }

interface Props {
  value: LocationValue
  onChange: (v: LocationValue) => void
  /** recorded spot of the inventory structure, offered as a fallback */
  structureSpot?: { lat: number; lng: number } | null
  autoStart?: boolean
  error?: string
}

const ERRORS: Record<FixError, string> = {
  denied: 'Location permission is off for this site. Turn it on in your browser settings, or use another option below.',
  unavailable: 'The phone could not get a GPS fix here.',
  timeout: 'No GPS fix after 10 seconds. Step into the open and retry, or use another option below.',
  unsupported: 'This browser cannot read GPS.',
}

export function LocationField({ value, onChange, structureSpot, autoStart, error }: Props) {
  const [status, setStatus] = useState<'idle' | 'finding' | FixError>('idle')
  const [live, setLive] = useState<Fix | null>(null)
  const [picking, setPicking] = useState(false)
  const started = useRef(false)

  const find = useCallback(async () => {
    setStatus('finding')
    setLive(null)
    try {
      const f = await captureFix(10_000, 8, setLive)
      onChange({ lat: f.lat, lng: f.lng, accuracy_m: f.accuracy_m, location_source: 'gps' })
      setStatus('idle')
    } catch (e) {
      setStatus(e as FixError)
    }
  }, [onChange])

  useEffect(() => {
    if (autoStart && !started.current && value.lat == null) {
      started.current = true
      find()
    }
  }, [autoStart, find, value.lat])

  const pick = useCallback((p: { lat: number; lng: number }) => onChange({ ...p, accuracy_m: null, location_source: 'manual' }), [onChange])
  const center = value.lat != null ? { lat: value.lat, lng: value.lng! } : structureSpot ?? null

  return (
    <fieldset className={`field${error ? ' has-error' : ''}`}>
      <legend>Location</legend>
      <div className="card" style={{ padding: 12 }}>
        {status === 'finding' ? (
          <p className="row" style={{ margin: 0 }} aria-live="polite">
            <LocateFixed size={20} className="spin" aria-hidden />
            Finding you… {live ? `best so far ${meters(live.accuracy_m)}` : 'waiting for GPS'}
          </p>
        ) : value.lat != null ? (
          <div className="row">
            <MapPin size={20} aria-hidden />
            <div className="grow">
              <div className="mono">{coord(value.lat, value.lng)}</div>
              <div className="small muted">
                {value.location_source === 'gps' && `GPS, accuracy ${meters(value.accuracy_m)}`}
                {value.location_source === 'structure' && 'Using the structure’s recorded spot'}
                {value.location_source === 'manual' && 'Placed by hand on the map'}
              </div>
            </div>
          </div>
        ) : (
          <p style={{ margin: 0 }}>No location yet.</p>
        )}
        {typeof status === 'string' && status !== 'idle' && status !== 'finding' && (
          <p className="field-error">{ERRORS[status]}</p>
        )}
        {value.accuracy_m != null && value.accuracy_m > 30 && status === 'idle' && (
          <p className="small mt-8" style={{ marginBottom: 0 }}>Accuracy is rough. Retry in the open if you can.</p>
        )}
      </div>
      <div className="row wrap mt-8">
        <button type="button" className="btn" onClick={find} disabled={status === 'finding'}>
          <Crosshair size={18} aria-hidden /> {value.lat != null ? 'Retry GPS' : 'Use GPS'}
        </button>
        {structureSpot && (
          <button type="button" className="btn" onClick={() => onChange({ ...structureSpot, accuracy_m: null, location_source: 'structure' })}>
            <MapPin size={18} aria-hidden /> Structure’s spot
          </button>
        )}
        <button type="button" className="btn" aria-expanded={picking} onClick={() => setPicking((p) => !p)}>
          <MapIcon size={18} aria-hidden /> {picking ? 'Done' : 'Place on map'}
        </button>
      </div>
      {picking && (
        <div className="mt-8">
          <MapView
            label="Tap the map to place the location"
            height={260}
            markers={center ? [{ id: 'pin', kind: 'pin', lat: center.lat, lng: center.lng, label: 'Chosen location' }] : []}
            onPick={pick}
          />
          <p className="map-note">Tap where the damage is. Map tiles need signal; with none, use GPS or the structure’s spot.</p>
        </div>
      )}
      {error && <p className="field-error">{error}</p>}
    </fieldset>
  )
}
