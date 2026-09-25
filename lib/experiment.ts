/**
 * Experiment build switch. `NEXT_PUBLIC_*` is inlined at build time, so in the
 * public GitHub Pages build this is constant false and tracking code is inert.
 */
export function isExperiment(): boolean {
  return process.env.NEXT_PUBLIC_EXPERIMENT === '1'
}
