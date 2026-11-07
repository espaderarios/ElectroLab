# Arduino / LCD / OLED Wiring Cleanup

## Fixed
- Removed the hardcoded decorative jumper wires from the Arduino Uno 3D model.
- Removed automatic Arduino↔LCD auto-wiring when parts are placed.
- Removed automatic Arduino↔OLED auto-wiring when parts are placed.
- Removed automatic hidden power wiring for MCU, LCD, and OLED in the store logic.

## Result
- New Arduino, LCD, and OLED parts now start clean.
- Any visible wires are only actual circuit wires placed in the project state.
- Users must wire Arduino/LCD/OLED connections intentionally, which is more realistic.
- The Arduino 3D model now looks cleaner and no longer shows baked-in LCD jumper leads.

## Notes
- Existing saved projects that already contain auto-created wires will keep those wires until edited or recreated.
- The bench PSU rail-bridging behavior remains unchanged.
