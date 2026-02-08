import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// StrictMode removed: LIFF SDK is a global singleton that is not compatible
// with StrictMode's double-execution of effects (causes duplicate init calls)
createRoot(document.getElementById('root')!).render(
  <App />,
)
