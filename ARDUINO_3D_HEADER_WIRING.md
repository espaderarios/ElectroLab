# ElectroLab — Arduino Uno 3D Header Socket Wiring

## Using the feature
1. Open any circuit containing Arduino Uno, or place Arduino Uno from the component library.
2. Choose **Wire (W)** in the 3D toolbar.
3. Hover over an Arduino socket. The socket glows cyan and its exact label appears.
4. Click the socket (D0–D13, A0–A5, 5V, 3.3V, GND, GND2, IOREF, RESET, or VIN).
5. Click a breadboard hole or a second Arduino header socket to finish the connection.
6. To edit a connection, choose **Select**, click the wire and delete it; draw a new wire. Undo/Redo is supported.
7. Alternatively, select the Arduino and use **Connect** next to a pin in its Inspector.

## Electrical and physical design
- Arduino headers use independent terminal IDs `mcu:<partId>:<pin>` instead of virtual F/J breadboard holes.
- Each terminal has a 3D coordinate attached to the visible socket, and its wire plug terminates at that height.
- Breadboard strips remain independent; the Uno no longer reserves/shorts unrelated breadboard holes.
- GND and the second GND socket are internally connected; IOREF is tied to the educational 5V logic reference.
- The simulator's VIN / 3.3V model is simplified: for actual hardware, follow the specific Arduino board's electrical ratings.
- Older Arduino+LCD, Arduino+OLED and Arduino+7-segment premade projects are upgraded on load. The old endpoint assignments are translated to Arduino sockets while project wiring is re-tidied. Their existing circuit code and other components are preserved.
- Saved projects retain terminal IDs; no hidden auto-wires are created.

## Tests
`npm run test:arduino-headers` verifies legacy migration, real off-board coordinates, old example electrical outputs, individual D13 wiring, Undo/Redo, moving the Arduino, saving/reloading, deleting attached wires, and syntax checks.

## Compatibility notes
- The visual PCB can be moved; its socket coordinates follow it, without changing electrical terminal identities.
- Arduino pin locations themselves are fixed on the board, as on a physical Uno. What the user edits is the **wire connection**, not the manufactured header location.
- Physical browser WebGL pointer testing and full Vite build require the project's npm dependencies and remain unverified here.
