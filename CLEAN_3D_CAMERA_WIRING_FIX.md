# ElectroLab — cleaner 3D wiring and camera framing

This patch addresses the view shown in the Arduino Uno + 16×2 LCD screenshot.

## Corrected

- **Opening camera view:** focuses on the actual placed parts on a populated board, rather than leaving a large, mostly empty board filling the view.
- **Focus components** (`G`): centers and fits the active circuit.
- **Fit board** (`F`): restores the whole breadboard to view.
- **Stable zoom:** opening/closing the bottom power/monitor dock or the component sidebar no longer resets the camera distance or orbit.
- **Wire layout:** replaces globally increasing wire-height lanes with compact **local overpasses**. A crossing raises only the required segment; each wire returns to its low-profile base lane.
- **Wire physical clearance:** existing route obstacle checks around IC and component bodies remain in place. Electrical wire endpoints are unchanged.
- **Rendering:** interpolated wire paths avoid tall square loops while still keeping solid wires lower than jumpers and preserving selection and animated flow.

## Validation

- All ten existing tests plus new `npm run test:clean-3d` pass.
- Arduino LCD circuit remains 17 wires, all routable, with a maximum calculated cable height of approximately 0.83 board units (previously about 1.55).
- Full production Vite/WebGL build and visual frame-rate measurements were **not** verified in this environment because dependencies were not installed here.

## Run

```powershell
cd D:\GitHub\ElectroLab
npm install
npm run test:clean-3d
npm run build
npm run dev
```

Do not delete browser storage to apply the changes. Existing saved projects keep their parts and connections; the new renderer recomputes the wire shapes.
