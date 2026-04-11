import { useState, useRef } from 'react'
import { Leaf, Mail, Lock, UserPlus, UserCheck, ArrowLeft, Eye, EyeOff, User } from 'lucide-react'
import { auth, db } from '../firebase/config'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import '../styles/login.css'

const GlassTextField = ({ icon: Icon, hint, type = "text", value, onChange, error, autoFocus }) => {
  const [isFocused, setIsFocused] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === "password"
  const inputType = isPassword ? (showPassword ? "text" : "password") : type

  return (
    <div style={{ marginBottom: error ? '8px' : '0' }}>
      <div className={`input-group ${isFocused ? 'focused' : ''}`}>
        <Icon className={`icon ${isFocused ? 'focused-icon' : ''}`} />
        <input 
          type={inputType} 
          placeholder={hint} 
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          required
          autoFocus={autoFocus}
        />
        {isPassword && (
          <button 
            type="button" 
            className="password-toggle"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>
      {error && <div className="error-text">{error}</div>}
    </div>
  )
}

const OtpInputField = ({ value, onChange }) => {
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const inputRef = useRef(null)

  const handleChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    onChange(val)
  }

  const handleContainerClick = () => {
    inputRef.current?.focus()
  }

  return (
    <div className="otp-container" onClick={handleContainerClick}>
      <input
        ref={inputRef}
        type="text"
        className="hidden-otp-input"
        value={value}
        onChange={handleChange}
        onFocus={() => setFocusedIndex(Math.min(value.length, 5))}
        onBlur={() => setFocusedIndex(-1)}
      />
      <div className="otp-boxes">
        {[0, 1, 2, 3, 4, 5].map((index) => {
          const char = value[index] || ''
          const isFocused = (focusedIndex === index && value.length === index) || (value.length === 6 && index === 5 && focusedIndex !== -1);
          
          return (
            <div key={index} className={`otp-box ${isFocused ? 'focused' : ''}`}>
              {char}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function LoginPage() {
  const [currentView, setCurrentView] = useState('login') // login, forgotEmail, resetPassword, signup
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  // Signup fields
  const [username, setUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleSignIn = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      console.error(err)
      setError(err.message.includes('auth/invalid-credential') ? 'Invalid email or password' : err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    setError('')
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, newPassword)
      const user = userCredential.user

      // Save user info to Firestore
      await setDoc(doc(db, "users", user.uid), {
        username: username,
        email: email,
        uid: user.uid,
        createdAt: new Date().toISOString()
      })
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSendResetEmail = async (e) => {
    e.preventDefault()
    if (!email) {
      setError('Please enter your email')
      return
    }
    setError('')
    setLoading(true)
    try {
      await sendPasswordResetEmail(auth, email)
      setCurrentView('resetPassword')
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setError('')
    setCurrentView('login')
  }

  const renderView = () => {
    switch (currentView) {
      case 'login':
        return (
          <>
            <form className="login-form" onSubmit={handleSignIn}>
              <GlassTextField 
                icon={Mail} 
                hint="Email Address" 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <GlassTextField 
                icon={Lock} 
                hint="Password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              
              <div className="forgot-password">
                <a href="#" onClick={(e) => {
                  e.preventDefault()
                  setError('')
                  setCurrentView('forgotEmail')
                }}>Forgot Password?</a>
              </div>
              
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
            
            {error && <div className="error-text" style={{ textAlign: 'center', marginTop: '1rem' }}>{error}</div>}

            <div className="divider">
              <span>OR</span>
            </div>
            
            <button className="btn-secondary" type="button" onClick={() => { setError(''); setCurrentView('signup'); }}>
              <UserPlus size={20} style={{ marginRight: '8px' }} />
              Create New Account
            </button>
          </>
        )
      case 'forgotEmail':
        return (
          <form className="login-form" onSubmit={handleSendResetEmail}>
            <GlassTextField 
              icon={Mail} 
              hint="Email Address" 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            
            {error && <div className="error-text" style={{ textAlign: 'center' }}>{error}</div>}
            
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )
      case 'resetPassword':
        return (
          <div className="login-form">
            <div style={{ textAlign: 'center', margin: '2rem 0', color: 'var(--text-muted)' }}>
              <Mail size={48} style={{ display: 'block', margin: '0 auto 1rem', color: 'var(--primary)' }} />
              <p>We've sent a password reset link to <strong>{email}</strong>.</p>
            </div>
            <button className="btn-primary" onClick={() => setCurrentView('login')}>Back to Sign In</button>
          </div>
        )
      case 'signup':
        return (
          <form className="login-form" onSubmit={handleSignUp}>
            <GlassTextField 
              icon={User} 
              hint="Username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
            <GlassTextField 
              icon={Mail} 
              hint="Email Address" 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <GlassTextField 
              icon={Lock} 
              hint="Password" 
              type="password" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <GlassTextField 
              icon={Lock} 
              hint="Confirm Password" 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            
            {error && <div className="error-text" style={{ textAlign: 'center' }}>{error}</div>}
            
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        )
      default:
        return null
    }
  }

  const getHeaderContent = () => {
    switch (currentView) {
      case 'signup':
        return { title: 'Create Account', sub: 'Join our smart monitoring system' }
      case 'forgotEmail':
      case 'resetPassword':
        return { title: 'Reset Password', sub: 'Enter your email to receive a reset link' }
      default:
        return { title: 'AgriTwin-MRV', sub: 'Smart Crop Monitoring System' }
    }
  }

  const { title, sub } = getHeaderContent()

  return (
    <div className="login-page-root">
      <img src="/bg.png" className="background-img" alt="" />
      <div className="background-overlay"></div>
      
      <div className="login-container">
        {currentView !== 'login' && (
          <button className="back-button" onClick={() => { setError(''); setCurrentView('login'); }} type="button">
            <ArrowLeft size={24} />
          </button>
        )}
        <div className="brand-section">
          <Leaf className="brand-logo" />
          <h1>{title}</h1>
          <p>{sub}</p>
        </div>
        
        <div className="form-container">
          {renderView()}
        </div>
      </div>
    </div>
  )
}
