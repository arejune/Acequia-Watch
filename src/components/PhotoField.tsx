import { useEffect, useState } from 'react'
import { Camera, RotateCcw, X } from 'lucide-react'
import { db } from '../db/local'
import { backend } from '../db/backend'
import { compressPhoto } from '../lib/photo'
import { useBlobUrl, useLive } from '../lib/hooks'
import type { LocalPhoto } from '../db/types'

function Thumb({ photo, alt }: { photo: LocalPhoto; alt: string }) {
  const local = useBlobUrl(photo.thumb ?? photo.blob)
  const [remote, setRemote] = useState<string>()
  useEffect(() => {
    if (local || !navigator.onLine) return
    backend.photoUrl(photo.storage_path).then(setRemote).catch(() => {})
  }, [local, photo.storage_path])
  const src = local ?? remote
  return src ? <img src={src} alt={alt} /> : <span className="small center" style={{ display: 'grid', placeItems: 'center', height: '100%' }}>Photo on server</span>
}

interface Props {
  ids: string[]
  max?: number
  /** called with a compressed photo; the parent stores it and returns its id */
  onAdd: (c: Awaited<ReturnType<typeof compressPhoto>>) => Promise<string>
  onRemove: (id: string) => void
  label: string
  error?: string
}

export function PhotoField({ ids, max = 10, onAdd, onRemove, label, error }: Props) {
  const photos = useLive(() => db.photos.bulkGet(ids), [ids.join()]) ?? []
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function take(files: FileList | null, replace?: string) {
    const file = files?.[0]
    if (!file) return
    setBusy(true)
    setProblem(null)
    try {
      const c = await compressPhoto(file)
      await onAdd(c)
      if (replace) onRemove(replace)
    } catch {
      setProblem('That photo could not be read. Try taking it again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <fieldset className={`field${error ? ' has-error' : ''}`}>
      <legend>{label}</legend>
      <span className="hint" style={{ display: 'block', fontSize: '0.875rem', color: 'var(--ink-2)', marginBottom: 8 }}>
        Photograph structures, not people or private homes.
      </span>
      <div className="photos">
        {photos.map((p, i) =>
          p ? (
            <div key={p.id} className="photo-tile">
              <Thumb photo={p} alt={`Photo ${i + 1}`} />
              <button type="button" onClick={() => onRemove(p.id)} aria-label={`Remove photo ${i + 1}`}>
                <X size={18} aria-hidden />
              </button>
              <label className="btn photo-retake" style={{ position: 'absolute', left: 4, top: 4, minHeight: 36, padding: '0 8px', fontSize: '0.8rem', background: 'var(--surface)' }}>
                <RotateCcw size={14} aria-hidden /> Retake
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => take(e.target.files, p.id)} />
              </label>
            </div>
          ) : null,
        )}
        {ids.length < max && (
          <label className="photo-add">
            <Camera size={28} aria-hidden />
            {busy ? 'Shrinking…' : ids.length ? 'Add photo' : 'Take photo'}
            <input type="file" accept="image/*" capture="environment" onChange={(e) => take(e.target.files)} disabled={busy} aria-label="Take a photo" />
          </label>
        )}
      </div>
      {problem && <p className="field-error">{problem}</p>}
      {error && <p className="field-error">{error}</p>}
    </fieldset>
  )
}
