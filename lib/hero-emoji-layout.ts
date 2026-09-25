import type { HeroEmoji } from '@/lib/hero-emoji-timeline'
export type { HeroEmoji }

export type LayoutProfile = 'desktop' | 'mobile' | 'short'

export type Positioned = {
  char: string
  era: number
  x: number       // px from container left edge (cell centre after jitter)
  y: number       // px from container top edge
  opacity: number // 0.35 - 0.85
  size: number    // px font-size
}

type Profile = {
  cols: number
  rows: number
  rx: number      // safe ellipse radius x
  ry: number      // safe ellipse radius y
  baseSize: number
  sizeJitter: number
}

const PROFILES: Record<LayoutProfile, Profile> = {
  desktop: { cols: 22, rows: 14, rx: 260, ry: 150, baseSize: 22, sizeJitter: 8 },
  mobile:  { cols: 12, rows: 16, rx: 170, ry: 120, baseSize: 18, sizeJitter: 6 },
  short:   { cols: 16, rows: 8,  rx: 220, ry: 90,  baseSize: 18, sizeJitter: 6 },
}

export function pickProfile(vw: number, vh: number): LayoutProfile {
  if (vh < 480) return 'short'
  if (vw < 768) return 'mobile'
  return 'desktop'
}

// Deterministic PRNG so SSR and CSR produce identical positions.
function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function computeLayout(
  emojis: HeroEmoji[],
  vw: number,
  vh: number,
  profile: LayoutProfile,
): Positioned[] {
  const cfg = PROFILES[profile]
  const cellW = vw / cfg.cols
  const cellH = vh / cfg.rows
  const cx = vw / 2
  const cy = vh / 2

  const surviving: Array<{ r: number; c: number; x: number; y: number; t: number }> = []

  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      const seed = r * cfg.cols + c + 1
      const rand = mulberry32(seed)
      const jitterX = (rand() - 0.5) * 0.6 * cellW
      const jitterY = (rand() - 0.5) * 0.6 * cellH
      const x = (c + 0.5) * cellW + jitterX
      const y = (r + 0.5) * cellH + jitterY

      const dx = (x - cx) / cfg.rx
      const dy = (y - cy) / cfg.ry
      const t = dx * dx + dy * dy
      if (t < 1) continue  // inside safe ellipse - drop

      surviving.push({ r, c, x, y, t })
    }
  }

  // Reading order: top-to-bottom, left-to-right
  surviving.sort((a, b) => (a.r - b.r) || (a.c - b.c))

  // Sort emojis by era ascending so the chronological reading flows visually
  const ordered = [...emojis].sort((a, b) => a.era - b.era)
  if (ordered.length === 0) return []

  // Fill every surviving cell — when there are more cells than unique emojis,
  // wrap modulo so the wallpaper stays dense (mild duplicates are acceptable
  // in a 200+ tile field and preserve chronological flow).
  return surviving.map((cell, i) => {
    const e = ordered[i % ordered.length]
    const sizeRand = mulberry32(cell.r * cfg.cols + cell.c + 999)()
    const size = cfg.baseSize + sizeRand * cfg.sizeJitter
    // Opacity ramps from 0.35 at the edge of the safe ellipse to 0.85 farther out
    const opacity = Math.min(0.85, Math.max(0.35, 0.35 + (cell.t - 1) * 0.5))
    return {
      char: e.char,
      era: e.era,
      x: cell.x,
      y: cell.y,
      opacity,
      size,
    }
  })
}
