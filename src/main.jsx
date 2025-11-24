import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './OrdemParanormal.jsx'
import OrdemParanormalRPG from './OrdemParanormal.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <OrdemParanormalRPG />
  </StrictMode>,
)
