// Saves a GeoJSON snapshot of two OSE acequia layers into public/data so the
// maps work when the services are down or the phone is offline.
// Run: node scripts/fetch-ose.mjs
import { writeFile } from 'node:fs/promises'

const SERVICE = 'https://services2.arcgis.com/qXZbWTdPDbTjl7Dy/ArcGIS/rest/services/Acequia_ProjectCP/FeatureServer'
const LAYERS = [
  { id: 0, out: 'public/data/ose-acequias.geojson', fields: 'cnvy_name' },
  { id: 1, out: 'public/data/ose-headgates.geojson', fields: 'ditch_name,county' },
]
const PAGE = 1000 // services cap at 1,000-2,000 features per request

for (const layer of LAYERS) {
  const features = []
  for (let offset = 0; ; offset += PAGE) {
    const q = new URLSearchParams({
      where: '1=1',
      outFields: layer.fields,
      outSR: '4326', // source is UTM 13N (EPSG:26913); Leaflet needs WGS84
      f: 'geojson',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
      orderByFields: 'OBJECTID',
      geometryPrecision: '5', // ~1 m
      maxAllowableOffset: '0.0002', // ~20 m line simplification
    })
    const res = await fetch(`${SERVICE}/${layer.id}/query?${q}`)
    if (!res.ok) throw new Error(`layer ${layer.id}: HTTP ${res.status}`)
    const page = await res.json()
    features.push(...page.features)
    if (page.features.length < PAGE) break
  }
  const fc = {
    type: 'FeatureCollection',
    metadata: {
      source: `${SERVICE}/${layer.id}`,
      fetched: new Date().toISOString().slice(0, 10),
      credit: 'Office of the State Engineer, EDAC. Provided as-is; incomplete.',
    },
    features,
  }
  await writeFile(layer.out, JSON.stringify(fc))
  console.log(`${layer.out}: ${features.length} features`)
}
