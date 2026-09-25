import { describe, it, expect } from 'vitest'
import { MAP_INSETS, pinsInBox, insetProjection, placePins, makeProjection, MAP_W, MAP_H } from '@/lib/charts/origin-map'
import ch02 from '@/data/chapter-02.json'
import type { OriginPin } from '@/types/chapter-02'

const pins = ch02.origins as OriginPin[]

describe('origin map helpers', () => {
  it('places all 41 pins inside the main map', () => {
    const placed = placePins(pins, makeProjection())
    expect(placed).toHaveLength(41)
    for (const p of placed) {
      expect(p.cx).toBeGreaterThan(0); expect(p.cx).toBeLessThan(MAP_W)
      expect(p.cy).toBeGreaterThan(0); expect(p.cy).toBeLessThan(MAP_H)
    }
  })

  it('insets cover the dense regions', () => {
    const counts = Object.fromEntries(MAP_INSETS.map(i => [i.id, pinsInBox(pins, i.box).length]))
    expect(counts).toEqual({ 'europe-mideast': 15, 'east-asia': 8, 'south-asia': 4, 'mexico': 4 })
  })

  it('inset projections keep their pins inside the inset frame', () => {
    for (const inset of MAP_INSETS) {
      const placed = placePins(pinsInBox(pins, inset.box), insetProjection(inset.box, 400, 260))
      for (const p of placed) {
        expect(p.cx).toBeGreaterThanOrEqual(0); expect(p.cx).toBeLessThanOrEqual(400)
        expect(p.cy).toBeGreaterThanOrEqual(0); expect(p.cy).toBeLessThanOrEqual(260)
      }
    }
  })
})
