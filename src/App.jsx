import './App.css'
import { useEffect } from 'react'
import ProductivityScheduler from './ProductivityScheduler'

function App() {
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '162785689255-un38b6kp1k90jjpe36j2ssaad66vemho.apps.googleusercontent.com'

  useEffect(() => {
    // Load Google API script
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    document.head.appendChild(script)
  }, [])

  return (
    <div style={{ padding: '2rem' }}>
      <ProductivityScheduler clientId={GOOGLE_CLIENT_ID} />
    </div>
  )
}

export default App
