import type { PlacedPart, ToolId } from './types';
import { expansionById } from './expansion-catalog';

/**
 * Named catalog choices share the established and tested electrical models.
 * Their values are stored on the individual placed part, not in a global
 * palette state, so saving, undoing, dragging and reopening retain the model.
 */
export const COMPONENT_VARIANTS: Partial<Record<ToolId, Partial<PlacedPart['props']>>> = {
  'capacitor-electrolytic': {
    capacitorType: 'electrolytic', capacitance: 100e-6, voltageRating: 25,
    label: '100µF 25V electrolytic',
  },
  'capacitor-film': {
    capacitorType: 'film', capacitance: 100e-9, voltageRating: 63,
    label: '100nF film',
  },
  'capacitor-tantalum': {
    capacitorType: 'tantalum', capacitance: 10e-6, voltageRating: 16,
    label: '10µF tantalum',
  },
  'diode-schottky': {
    diodeType: 'schottky', forwardVoltage: 0.3, maxCurrent: 1,
    label: '1N5819 Schottky',
  },
  'switch-reed': {
    componentVariant: 'reed-switch', switchType: 'spst', closed: false,
    label: 'Magnetic reed switch',
  },
  'switch-slide': {
    componentVariant: 'slide-spdt', switchType: 'spdt', switchPosition: 'no', closed: true,
    label: 'SPDT slide switch',
  },
  'fuse-glass': {
    componentVariant: 'glass-fuse', fuseCurrent: 0.5, resistance: 0.05,
    label: 'Glass fuse 500mA',
  },
  'button-blue': {
    switchStyle: 'tactile-blue', label: 'Blue tactile button',
  },
  'button-white': {
    switchStyle: 'tactile-white', label: 'White tactile button',
  },
};

export function componentVariantProps(tool: ToolId): Partial<PlacedPart['props']> {
  const extended = expansionById(tool);
  if (extended) return {moduleId: extended.id as PlacedPart["props"]["moduleId"], label:extended.name};
  return COMPONENT_VARIANTS[tool] ?? {};
}
