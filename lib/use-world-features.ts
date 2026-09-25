'use client'
import { useEffect, useState } from 'react'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry } from 'geojson'
import type { Topology, GeometryCollection } from 'topojson-specification'
import { withBasePath } from '@/lib/base-path'

/** Country outlines from public/world-atlas. Must go through withBasePath:
 *  without it the fetch 404s on GitHub Pages and the map silently renders blank. */
export function useWorldFeatures(): FeatureCollection<Geometry> | null {
  const [features, setFeatures] = useState<FeatureCollection<Geometry> | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch(withBasePath('/world-atlas/countries-110m.json'))
      .then(r => {
        if (!r.ok) throw new Error(`world-atlas: HTTP ${r.status}`)
        return r.json()
      })
      .then((topo: Topology) => {
        if (cancelled) return
        setFeatures(feature(topo, topo.objects.countries as GeometryCollection) as unknown as FeatureCollection<Geometry>)
      })
      .catch(err => {
        console.error('failed to load world atlas', err)
      })
    return () => { cancelled = true }
  }, [])
  return features
}
