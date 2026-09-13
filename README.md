# ElectroLab

Modern web application for Electronics Engineering students and engineers.  
Matches the high-fidelity UI/UX concept board you provided and integrates the circuit simulator from `circuit-simulator.zip`.

## Features

| Screen | Description |
|--------|-------------|
| **Dashboard** | Stats, recent projects, simulation summary chart, activity feed, quick actions |
| **Component Library** | Search, category filters, component cards, pagination |
| **Circuit Editor** | Full 3D breadboard + simulation lab (from the zip) with top bar matching the mockup |
| **Simulation Results** | Pass/fail banner, waveforms, measurements, warnings |

## Quick Start

```bash
cd electrolab
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

> **Note:** The first `npm install` pulls React, Three.js, @react-three/fiber, @react-three/drei, Zustand, React Router, Tailwind, etc. This may take a minute.

## Project Structure

```
electrolab/
├── index.html
├── package.json
├── vite.config.ts          # path alias @ → src
├── tailwind.config.js
├── src/
│   ├── main.tsx
│   ├── App.tsx             # routes + layout
│   ├── index.css
│   ├── styles.css          # original simulator styles
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   └── ui/button.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── ComponentLibrary.tsx
│   │   ├── CircuitEditorPage.tsx   ← hosts the real CircuitLab
│   │   └── SimulationResults.tsx
│   ├── circuit/            ← simulation engine (from zip)
│   ├── circuit-lab/        ← 3D lab UI (from zip)
│   ├── store/lab.ts        ← Zustand store (from zip)
│   └── lib/utils.ts
```

## How the simulator is bound

- The original `CircuitLab` component from the zip is imported (lazy) inside `CircuitEditorPage.tsx`.
- Path aliases (`@/…`) are configured in `vite.config.ts` and `tsconfig.json` so all the original imports work.
- The top bar (back button, project name, Run Simulation, Share) matches the concept board and sits above the 3D lab.
- “Run Simulation” navigates to the Results view (you can later wire it to call `simulate()` from `circuit/simulate.ts` and pass real data).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

## Tech Stack

- Vite + React 18 + TypeScript
- Tailwind CSS
- React Router
- Zustand (lab state)
- Three.js + React Three Fiber + Drei (3D circuit lab)
- Lucide icons

Enjoy building circuits.
