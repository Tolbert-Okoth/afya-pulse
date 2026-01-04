import { createContext, useContext, useEffect, useState } from "react";
import { auth, googleProvider } from "../firebaseConfig";
// 🔄 Import onIdTokenChanged for automatic refresh handling
import { onIdTokenChanged, signInWithPopup, signOut } from "firebase/auth";
import axios from "axios"; 

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  const RAW_URL = import.meta.env.VITE_API_URL || "https://afya-pulse.onrender.com";
  const BASE_URL = RAW_URL.replace(/\/+$/, ""); 
  const BACKEND_URL = `${BASE_URL}/api`;

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      
      const response = await axios.post(`${BACKEND_URL}/users/sync`, {}, {
        headers: { Authorization: `Bearer ${idToken}` }
      });

      return response.data.user; 
    } catch (error) {
      console.error("Login sync failed:", error.response?.data || error.message);
      throw error;
    }
  };

  const logout = () => signOut(auth);

  useEffect(() => {
    // 🛡️ CHANGED: Use onIdTokenChanged to keep the token fresh
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Force a background refresh to ensure we have the latest claims
          const idToken = await firebaseUser.getIdToken();
          setToken(idToken);
          
          // Store token in localStorage for persistence across refreshes
          localStorage.setItem("token", idToken);

          // Trigger Sync to Backend
          const response = await axios.post(`${BACKEND_URL}/users/sync`, {}, {
            headers: { Authorization: `Bearer ${idToken}` }
          });

          const dbUser = response.data.user; 
          
          setCurrentUser({
            ...firebaseUser,
            role: dbUser.role,
            dbId: dbUser.id    
          });

          console.log(`✅ Pulse Sync: ${firebaseUser.email} verified as [${dbUser.role}]`);
        } catch (error) {
          console.error("Token/Sync Error:", error.response?.data || error.message);
          setCurrentUser(firebaseUser);
        }
      } else {
        setCurrentUser(null);
        setToken(null);
        localStorage.removeItem("token");
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [BACKEND_URL]);

  const value = { currentUser, token, loginWithGoogle, logout, BACKEND_URL };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};