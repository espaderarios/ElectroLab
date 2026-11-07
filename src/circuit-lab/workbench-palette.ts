/**
 * Neutral graphite surroundings for the 3D workbench.
 *
 * Keep the backdrop and fog identical so the horizon does not show a seam.
 * Only the 3D environment is recolored: electronics, controls, and wire
 * insulation retain their meaningful colors.
 */
export const WORKBENCH_PALETTE = {
  background: '#282f39',
  floor: '#303843',
  gridCell: '#46515f',
  gridSection: '#5a6877',
} as const;
