import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/main.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode><main><h1>SPHEREx Explorer</h1><p>Proyecto inicial para explorar observaciones astronómicas.</p></main></StrictMode>,
)
