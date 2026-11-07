/** GPU-scalable rendering profiles: geometry stays interactive at every level. */
export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

export const GRAPHICS_QUALITY: Record<GraphicsQuality, {
  label: string;
  dpr: [number, number];
  shadowResolution: number;
  contactShadowResolution: number;
  contactOpacity: number;
  environment: boolean;
  environmentIntensity: number;
  lightIntensity: number;
  exposure: number;
}> = {
  low: {
    label: 'Low · Fast', dpr: [1, 1], shadowResolution: 0,
    contactShadowResolution: 0, contactOpacity: 0, environment: false,
    environmentIntensity: 0, lightIntensity: 1.35, exposure: 1.1,
  },
  medium: {
    label: 'Medium · Balanced', dpr: [1, 1.25], shadowResolution: 1024,
    contactShadowResolution: 128, contactOpacity: 0.26, environment: false,
    environmentIntensity: 0, lightIntensity: 1.55, exposure: 1.12,
  },
  high: {
    label: 'High · Studio', dpr: [1, 1.6], shadowResolution: 2048,
    contactShadowResolution: 256, contactOpacity: 0.34, environment: true,
    environmentIntensity: 0.55, lightIntensity: 1.65, exposure: 1.13,
  },
  ultra: {
    label: 'Ultra · Showcase', dpr: [1.2, 2], shadowResolution: 2048,
    contactShadowResolution: 512, contactOpacity: 0.42, environment: true,
    environmentIntensity: 0.75, lightIntensity: 1.7, exposure: 1.16,
  },
};

export function isGraphicsQuality(v: unknown): v is GraphicsQuality {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(GRAPHICS_QUALITY, v);
}
