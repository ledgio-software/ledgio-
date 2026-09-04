import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// When a lazy-loaded chunk URL is stale (new deploy replaced the hash),
// the fetch returns an HTML 404 page. Vite fires vite:preloadError in that
// case; a reload picks up the new HTML with correct chunk references.
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
