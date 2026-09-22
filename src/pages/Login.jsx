import { useState } from 'react'
import { Lock, Mail, Loader2, Eye, EyeOff } from 'lucide-react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth, isFirebaseConfigured, missingFirebaseEnvVars } from '../firebase'

const logo = "/kamyas.jpg";

function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!auth || !isFirebaseConfigured) {
      const missing = missingFirebaseEnvVars.join(', ')
      setError(
        missing
          ? `Firebase is not configured. Fill in these empty values in .env: ${missing}. Then restart npm run dev.`
          : 'Firebase is not configured. Add VITE_FIREBASE_* variables to .env, then restart the dev server.'
      )
      return
    }
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      onLogin()
    } catch (err) {
      setError(friendlyError(err.code))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>
      
      <div className="login-card">
        <div className="login-header">
          <div className="logo-container">
            <div className="logo-icon">
              <img src={logo} alt="K-Smart Dryer Logo" className="logo-image" />
            </div>
          </div>
          <h1 className="login-title">K-Smart Dryer</h1>
          <p className="login-subtitle">Kamyas Smart Machine</p>
          <p className="login-description">IoT-Based Intelligent Drying System</p>
        </div>

        {!isFirebaseConfigured && (
          <p style={{
            color: '#92400e',
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '14px',
            margin: '0 0 20px',
          }}>
            Firebase is not configured. Fill in these empty values in <code>.env</code>:
            {' '}
            <strong>{missingFirebaseEnvVars.join(', ')}</strong>
            . Get them from Firebase Console → Project settings → Your apps → Web app config.
            Then restart <code>npm run dev</code>.
          </p>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              <Mail size={18} />
              Email Address
            </label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              <Lock size={18} />
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="form-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingRight: "44px" }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#6b7280",
                  display: "flex",
                  alignItems: "center",
                  padding: 0,
                }}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <p style={{
              color: '#dc2626',
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '14px',
              margin: 0,
            }}>
              {error}
            </p>
          )}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={20} className="spinner" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>Admin access only.</p>
        </div>
      </div>
    </div>
  )
}

function friendlyError(code) {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.'
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.'
    case 'auth/user-disabled':
      return 'This account has been disabled.'
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is disabled. Enable it in Firebase Console → Authentication → Sign-in method.'
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized. Add it in Firebase Console → Authentication → Settings → Authorized domains.'
    case 'auth/configuration-not-found':
      return 'Firebase Auth is not configured. Check your VITE_FIREBASE_* environment variables.'
    default:
      return 'Sign in failed. Please try again.'
  }
}

export default Login
