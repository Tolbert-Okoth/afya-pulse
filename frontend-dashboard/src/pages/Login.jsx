import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Activity, AlertCircle, CheckCircle, Shield, Users, FileText } from 'lucide-react'; 
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
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
      await signInWithEmailAndPassword(auth, email, password);
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
              <Activity size={24} color="#0d6efd" />
              <span className="logo-text">Afya-Pulse</span>
            </div>

            {/* 👇 DIRECT DOWNLOAD LINK */}
            <a href="/manual-v1.2.pdf" download className="manual-link-compact" title="Download User Manual">
              <FileText size={16} />
              <span>User Guide</span>
            </a>
          </div>

          <div className="login-header-simple">
            <h3>Welcome Back</h3>
            <p>Please sign in to your account</p>
          </div>

          {/* ⚠️ Error Alert */}
          {error && (
            <div className="alert alert-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* 🟢 Success Alert */}
          {resetSent && showForgot && (
            <div className="alert alert-success">
              <CheckCircle size={16} />
              <span>Link sent to <strong>{email}</strong>. Check inbox.</span>
            </div>
          )}

          {/* 📝 FORM LOGIC */}
          {!showForgot ? (
            <>
              <form onSubmit={handleEmailLogin}>
                <div className="form-group">
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="name@moh.go.ke"
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
                  {loading ? 'Signing In...' : 'Sign In'}
                </button>
              </form>

              <div className="divider">
                <span className="divider-text">OR</span>
              </div>

              <button onClick={handleGoogleLogin} className="google-btn">
                <img 
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                  alt="Google" 
                  width="20" 
                />
                <span>Sign in with Google</span>
              </button>
            </>
          ) : (
            
            /* 🔄 FORGOT PASSWORD FORM */
            <form onSubmit={handleResetPassword}>
              <div className="form-group">
                <p className="forgot-instruction">
                  Enter your email address and we will send you a link to reset your password.
                </p>
                <label>Email Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="name@moh.go.ke"
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
            <small>&copy; 2025 Afya-Pulse Triage System</small>
          </div>
        </div>
      </div>

      {/* 👉 RIGHT SIDE: PATIENT FOCUS FEATURES */}
      <div className="info-section">
        <div className="info-content">
          <div className="badge-pill">Patient-First Care</div>
          <h1>Afya-Pulse Triage</h1>
          <p className="info-subtitle">Ensuring every patient gets the right care at the right time.</p>

          <div className="feature-list">
            <div className="feature-item">
              <Users className="feature-icon" size={24} />
              <div>
                <h4>Rapid Patient Intake</h4>
                <p>Quickly register walk-ins and verify existing patient records.</p>
              </div>
            </div>
            <div className="feature-item">
              <Activity className="feature-icon" size={24} />
              <div>
                <h4>Smart Vital Triage</h4>
                <p>Automated categorization of patients by urgency (Emergency, Priority, Routine).</p>
              </div>
            </div>
            <div className="feature-item">
              <Shield className="feature-icon" size={24} />
              <div>
                <h4>Data Privacy & Security</h4>
                <p>Compliant with MoH standards for protecting sensitive medical history.</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Background Patterns */}
        <div className="bg-pattern-circle"></div>
        <div className="bg-pattern-circle-2"></div>
      </div>

    </div>
  );
};

export default Login;