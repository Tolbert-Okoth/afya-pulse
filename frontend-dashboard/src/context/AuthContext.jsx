import { createContext, useContext, useEffect, useState } from "react";
import { auth, googleProvider } from "../firebaseConfig";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import axios from "axios"; 

const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  // 🛡️ FIX: Dynamic Backend URL (No more localhost hardcoding)
  const BASE_URL = import.meta.env.VITE_API_URL || "https://afya-pulse-backend.onrender.com";
  const BACKEND_URL = `${BASE_URL.replace(/\/$/, "")}/api`;

  // --- LOGIN FUNCTION ---
  const loginWithGoogle = async () => {
    try {
      // 1. Firebase Popup Login
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;

      // 2. Get Token
      const idToken = await firebaseUser.getIdToken();
      
      // 3. Sync with Backend
      const response = await axios.post(`${BACKEND_URL}/users/sync`, {}, {
        headers: { Authorization: `Bearer ${idToken}` }
      });

      // 4. Return the DB User (contains .role)
      return response.data; 

    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  // --- LOGOUT FUNCTION ---
  const logout = () => signOut(auth);

  // --- AUTH STATE LISTENER ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          setToken(idToken);

          // Sync with Backend
          const response = await axios.post(`${BACKEND_URL}/users/sync`, {}, {
            headers: { Authorization: `Bearer ${idToken}` }
          });

          const dbUser = response.data; 
          
          setCurrentUser({
            ...firebaseUser,
            role: dbUser.role, // 'doctor' or 'patient'
            dbId: dbUser.id    
          });

        } catch (error) {
          console.error("Auto-Sync failed:", error);
          // Fallback: Log in without role if backend fails (prevents total lockout)
          setCurrentUser(firebaseUser);
        }
      } else {
        setCurrentUser(null);
        setToken(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    token,
    loginWithGoogle,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};