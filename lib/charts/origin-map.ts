import { geoEqualEarth, type GeoProjection } from 'd3-geo'
import type { MultiPoint } from 'geojson'
import type { OriginPin } from '@/types/chapter-02'

export const MAP_W = 800
export const MAP_H = 420

export function makeProjection(): GeoProjection {
  return geoEqualEarth().scale(140).translate([MAP_W / 2, MAP_H / 2])
}

export interface PlacedPin extends OriginPin {
  cx: number
  cy: number
}

export function placePins(pins: OriginPin[], projection: GeoProjection): PlacedPin[] {
  return pins
    .map(p => {
      const xy = projection([p.lng, p.lat])
      return xy ? { ...p, cx: xy[0], cy: xy[1] } : null
    })
    .filter((p): p is PlacedPin => p !== null)
}

/** [[west lng, south lat], [east lng, north lat]] */
export type LngLatBox = [[number, number], [number, number]]
export type InsetId = 'europe-mideast' | 'east-asia' | 'south-asia' | 'mexico'

/** Regions where pins overlap at the default zoom; the static page shows each
 *  as a separate zoomed map (the interactive map reaches them by zooming). */
export const MAP_INSETS: { id: InsetId; box: LngLatBox }[] = [
  { id: 'europe-mideast', box: [[-6, 22], [48, 60]] },
  { id: 'east-asia', box: [[100, 15], [145, 45]] },
  { id: 'south-asia', box: [[68, 8], [92, 32]] },
  { id: 'mexico', box: [[-106, 14], [-86, 24]] },
]

export function pinsInBox(pins: OriginPin[], box: LngLatBox): OriginPin[] {
  const [[w, s], [e, n]] = box
  return pins.filter(p => p.lng >= w && p.lng <= e && p.lat >= s && p.lat <= n)
}

export function insetProjection(box: LngLatBox, w: number, h: number, pad = 20): GeoProjection {
  const [[west, south], [east, north]] = box
  const corners: MultiPoint = {
    type: 'MultiPoint',
    coordinates: [[west, south], [east, north], [west, north], [east, south]],
  }
  return geoEqualEarth().fitExtent([[pad, pad], [w - pad, h - pad]], corners)
}
