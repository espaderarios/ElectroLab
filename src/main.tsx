import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import './styles.css'

// Use the same routing base as the assets. Dev and desktop stay at /;
// GitHub Pages lives under /ElectroLab/ and supports direct /editor/:id loads.
const basename = import.meta.env.BASE_URL.startsWith('/ElectroLab/')
  ? '/ElectroLab'
  : undefined

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
