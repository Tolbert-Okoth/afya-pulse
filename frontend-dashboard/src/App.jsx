import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Activity, ShieldCheck, LogOut } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import NurseKiosk from './pages/NurseKiosk';
import DoctorDashboard from './pages/DoctorDashboard'; // The new Command Center
import ProtectedRoute from './components/ProtectedRoute'; // Logic below
import './App.css';

// ----------------------------------------------------------------------
// 1. INNER LAYOUT (Handles Navigation & Routing)
// ----------------------------------------------------------------------
const AppLayout = () => {
  const { currentUser, logout, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <span className="tag-mark" aria-hidden="true"><i /><i /><i /></span>
        <p>Connecting to the triage network…</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="dashboard-container">
        
        {/* --- GLOBAL NAVBAR (Only show if User is Logged In) --- */}
        {currentUser && (
          <header className="navbar">
            <div className="logo">
              <span className="tag-mark" aria-hidden="true"><i /><i /><i /></span>
              <h1>Afya-Pulse</h1>
              <span className="logo-sub">Triage network</span>
            </div>
            
            <nav className="nav-links">
              {/* EVERYONE sees Nurse Kiosk */}
              <NavLink to="/triage" className="nav-link">
                Intake
              </NavLink>
              
              {/* 🔒 DOCTORS ONLY see Command Center */}
              {['doctor', 'admin'].includes(currentUser.role) && (
                <NavLink to="/doctor-dashboard" className="nav-link doctor-link">
                  Command center
                </NavLink>
              )}
            </nav>

            {/* User Profile / Logout */}
            <button type="button" className="status-badge" onClick={logout} title="Sign out">
              <ShieldCheck size={16} />
              <span className="user-email">{currentUser.email?.split('@')[0]}</span>
              <LogOut size={16} className="logout-icon" />
            </button>
          </header>
        )}

        {/* --- ROUTING LOGIC --- */}
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />
          
          {/* 🔒 Protected: Nurse Kiosk (Accessible by Nurses & Doctors) */}
          <Route 
            path="/triage" 
            element={
              <ProtectedRoute>
                <NurseKiosk />
              </ProtectedRoute>
            } 
          />
          
          {/* 🔒🔒 SUPER Protected: Doctor Dashboard (Doctors Only) */}
          <Route 
            path="/doctor-dashboard" 
            element={
              <ProtectedRoute requiredRole="doctor">
                <DoctorDashboard />
              </ProtectedRoute>
            } 
          />

          {/* Smart Redirect on Root Load */}
          <Route 
            path="/" 
            element={
              currentUser ? (
                // If Doctor -> Command Center. If Nurse -> Kiosk.
                currentUser.role === 'doctor' 
                  ? <Navigate to="/doctor-dashboard" replace /> 
                  : <Navigate to="/triage" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          
          {/* Catch 404s */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

      </div>
    </Router>
  );
};

// ----------------------------------------------------------------------
// 2. MAIN APP WRAPPER (Provides Auth Context)
// ----------------------------------------------------------------------
function App() {
  return (
    <AuthProvider>
      <AppLayout />
    </AuthProvider>
  );
}

export default App;