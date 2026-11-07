/**
 * Single digit 0.56 inch 5161AS (common cathode) / 5161BS (common anode).
 * Viewed from above, pins 1..5 go left-to-right on the near row and pins
 * 6..10 return right-to-left on the far row. Two COM pins are internally tied.
 * Manufacturer pin-to-segment map (pin 1 = E, pin 10 = G).
 */
export const SEVEN_SEGMENT_PINS = [
  'e', 'd', 'com1', 'c', 'dp', 'b', 'a', 'com2', 'f', 'g',
] as const;

export const SEVEN_SEGMENT_PIN_NUMBERS: Record<string, number> = {
  e: 1, d: 2, com1: 3, c: 4, dp: 5,
  b: 6, a: 7, com2: 8, f: 9, g: 10,
};

export const SEVEN_SEGMENT_LED_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'] as const;

/** Old saved projects used one COM pin with a nine-pin straight layout. */
export function commonPin(partPins: Record<string, string>): string | undefined {
  return partPins.com1 ?? partPins.com ?? partPins.com2;
}
