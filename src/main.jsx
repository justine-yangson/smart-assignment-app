import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google' // ADDED: Google OAuth
import './index.css'
import App from './App.jsx'

// ADDED: Your Google Client ID
const GOOGLE_CLIENT_ID = "529536561113-9ve98ltm8hgd0hhea2iv9klruqdklf3.apps.googleusercontent.com"

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* ADDED: Wrap app with Google OAuth provider */}
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)