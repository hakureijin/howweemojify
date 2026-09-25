'use client'
import type { GeoPath } from 'd3-geo'
import type { FeatureCollection, Geometry } from 'geojson'

/** Country outlines, shared by the interactive and static origin maps. */
export function CountryPaths({
  features,
  path,
  strokeWidth,
}: {
  features: FeatureCollection<Geometry>
  path: GeoPath
  strokeWidth: number
}) {
  return (
    <g>
      {features.features.map((f, i) => (
        <path key={i} d={path(f) || ''} fill="#e8e8ed" stroke="#d2d2d7" strokeWidth={strokeWidth} />
      ))}
    </g>
  )
}
