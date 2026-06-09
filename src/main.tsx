import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DesignEditor } from './components/DesignEditor.tsx'

// ?design でデザインエディタを起動（通常ユーザーには出さない開発用画面）
const isDesign = new URLSearchParams(window.location.search).has('design')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isDesign ? <DesignEditor /> : <App />}
  </StrictMode>,
)
