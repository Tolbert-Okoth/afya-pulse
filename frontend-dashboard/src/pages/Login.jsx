import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Activity, AlertCircle, CheckCircle, Shield, Users, FileText } from 'lucide-react'; 
import { signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, signOut } from 'firebase/auth';
import './Login.css';
import { auth } from '../firebaseConfig'; 

const Login = () => {
  const { loginWithGoogle, currentUser } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // 1. AUTO-REDIRECT
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'doctor') {
        navigate('/doctor-dashboard');
      } else {
        navigate('/triage');
      }
    }
  }, [currentUser, navigate]);

  // 2. HANDLE GOOGLE LOGIN
  const handleGoogleLogin = async () => {
    setError('');
    try {
      const user = await loginWithGoogle();
      if (user && user.role === 'doctor') {
        navigate('/doctor-dashboard');
      } else if (user) {
        navigate('/triage');
      }
    } catch (error) {
      console.error("Failed to log in", error);
      setError("Google Sign-In failed. Please try again.");
    }
  };

  // 3. HANDLE EMAIL LOGIN
  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // The server only accepts verified emails, so prompt verification instead of failing silently
      if (!cred.user.emailVerified) {
        await sendEmailVerification(cred.user);
        await signOut(auth);
        setError('Please verify your email first. We have sent you a verification link; open it, then sign in again.');
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError('Invalid email or password. Please check your credentials.');
      setLoading(false);
    }
  };

  // 4. HANDLE PASSWORD RESET
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address to reset your password.');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Could not send reset email. Verify the email is correct.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="split-screen-container">
      
      {/* 👈 LEFT SIDE: LOGIN FORM & UTILITIES */}
      <div className="login-section">
        <div className="login-card-minimal">
          
          {/* 🆕 HEADER BAR: Logo + User Manual Download */}
          <div className="card-top-bar">
            <div className="logo-compact">
              <span className="tag-mark" aria-hidden="true"><i /><i /><i /></span>
              <span className="logo-text">Afya-Pulse</span>
            </div>

            {/* 👇 UPDATED DIRECT DOWNLOAD LINK */}
            <a 
              href="/manual-v1.3.pdf" 
              download="Afya-Pulse_User_Manual_v1.3.pdf" 
              className="manual-link-compact" 
              title="Download User Manual"
            >
              <FileText size={16} />
              <span>User Guide</span>
            </a>
          </div>

          <div className="login-header-simple">
            <h3>Sign in to triage</h3>
            <p>For nurses, clinical officers and doctors on the Afya-Pulse network.</p>
          </div>

          {error && (
            <div className="alert alert-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {resetSent && showForgot && (
            <div className="alert alert-success">
              <CheckCircle size={16} />
              <span>Link sent to <strong>{email}</strong>. Check inbox.</span>
            </div>
          )}

          {!showForgot ? (
            <>
              <form onSubmit={handleEmailLogin}>
                <div className="form-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="name@clinic.co.ke"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                  />
                </div>

                <div className="form-group">
                  <div className="label-row">
                    <label>Password</label>
                    <span 
                      onClick={() => { setShowForgot(true); setError(''); }} 
                      className="forgot-link"
                    >
                      Forgot?
                    </span>
                  </div>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                </div>

                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <div className="divider">
                <span className="divider-text">OR</span>
              </div>

              <button onClick={handleGoogleLogin} className="google-btn">
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.8 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.5 5.8c4.4-4 6.8-10 6.8-17.3z"/>
                  <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.8-6.1z"/>
                  <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.8 6.1C6.6 42.6 14.6 48 24 48z"/>
                </svg>
                <span>Sign in with Google</span>
              </button>
            </>
          ) : (
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <p className="forgot-instruction">
                  Enter your email address and we will send you a link to reset your password.
                </p>
                <label>Email Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="name@clinic.co.ke"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>

              <button type="submit" className="btn-primary" disabled={loading || resetSent}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <button 
                type="button" 
                className="btn-text"
                onClick={() => { setShowForgot(false); setError(''); setResetSent(false); }}
              >
                Back to Login
              </button>
            </form>
          )}
          
          <div className="login-footer">
            <small>&copy; 2026 Afya-Pulse Triage System</small>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: the triage tag */}
      <div className="info-section">
        <div className="info-content">
          <p className="info-eyebrow">Afya-Pulse · triage network</p>
          <h1>Every patient gets a tag.<br />Every tag gets seen.</h1>

          <div className="hero-tag" aria-hidden="true">
            <div className="hero-tag-body">
              <span className="hero-tag-eyelet" />
              <div className="hero-tag-row"><span>Patient</span><b>#00418</b></div>
              <div className="hero-tag-row"><span>County</span><b>Kisumu</b></div>
              <div className="hero-tag-row"><span>Waiting</span><b>+04m</b></div>
              <p>Chest pressure since morning, short of breath on walking.</p>
            </div>
            <div className="hero-tag-strip red"><span>RED</span><small>see now</small></div>
            <div className="hero-tag-strip yellow"><span>YELLOW</span><small>see soon</small></div>
            <div className="hero-tag-strip green"><span>GREEN</span><small>self-care</small></div>
          </div>

          <ul className="feature-list">
            <li><Users size={18} /> Intake by kiosk, voice or USSD on any phone</li>
            <li><Activity size={18} /> AI suggests a tag; a clinician confirms it</li>
            <li><Shield size={18} /> Patient details are visible to doctors only</li>
          </ul>
        </div>
        <div className="bg-pattern-circle"></div>
        <div className="bg-pattern-circle-2"></div>
      </div>

    </div>
  );
};

export default Login;