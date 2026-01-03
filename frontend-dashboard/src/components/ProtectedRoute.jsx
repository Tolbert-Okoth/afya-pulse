import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

const ProtectedRoute = ({ children, requiredRole }) => {
  const { currentUser, loading } = useAuth();

  // 1. Loading State (Centered Spinner)
  if (loading) {
    return (
      <div style={{ 
        height: '100vh', 
        width: '100%', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        background: '#F9FAFB'
      }}>
        <Loader2 className="spinner" size={48} color="#2563EB" />
        <style>{`
          .spinner { animation: spin 1s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // 2. Not Logged In? -> Go to Login
  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  // 3. Logged in but Wrong Role? -> Go back to Triage
  // Example: If a 'nurse' tries to access a 'doctor' page
  if (requiredRole && currentUser.role !== requiredRole) {
    console.warn(`⛔ Security Block: ${currentUser.role} tried to access ${requiredRole} area.`);
    return <Navigate to="/triage" replace />;
  }

  // 4. Safe to Enter
  return children;
};

export default ProtectedRoute;