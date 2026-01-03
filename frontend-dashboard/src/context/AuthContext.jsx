import { createContext, useContext, useEffect, useState } from "react";
import { auth, googleProvider } from "../firebaseConfig";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import axios from "axios"; 

const AuthContext = createContext();

// ✅ FIX: ESLint ignore comment placed correctly to allow hook export alongside component
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  // 🛡️ FIX: Sanitized Backend URL (removes trailing slash to prevent "//api" 404s)
  const BASE_URL = import.meta.env.VITE_API_URL || "https://afya-pulse.onrender.com";
  const BACKEND_URL = `${BASE_URL.replace(/\/$/, "")}/api`;

  // --- LOGIN FUNCTION ---
  const loginWithGoogle = async () => {
    try {
      // 1. Firebase Popup Login
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;

      // 2. Get ID Token
      const idToken = await firebaseUser.getIdToken();
      
      // 3. Sync with Backend
      const response = await axios.post(`${BACKEND_URL}/users/sync`, {}, {
        headers: { Authorization: `Bearer ${idToken}` }
      });

      // 4. Return the nested user object from backend { message, user: { ... } }
      return response.data.user; 

    } catch (error) {
      console.error("Login failed:", error.response?.data || error.message);
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
          const idToken = await firebaseUser.getIdToken(true); // Force refresh to ensure validity
          setToken(idToken);

          // Sync with Backend to get Role and DB ID
          const response = await axios.post(`${BACKEND_URL}/users/sync`, {}, {
            headers: { Authorization: `Bearer ${idToken}` }
          });

          // ✅ FIX: Access nested .user from backend response
          const dbUser = response.data.user; 
          
          setCurrentUser({
            ...firebaseUser,
            role: dbUser.role, // 'doctor', 'nurse', etc.
            dbId: dbUser.id    // Postgres Primary Key
          });

          console.log(`✅ Auth Synced: ${firebaseUser.email} [Role: ${dbUser.role}]`);

        } catch (error) {
          console.error("Auto-Sync failed:", error.response?.data || error.message);
          // Fallback: Set firebase user without role to prevent app crash
          setCurrentUser(firebaseUser);
        }
      } else {
        setCurrentUser(null);
        setToken(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [BACKEND_URL]);

  const value = {
    currentUser,
    token,
    loginWithGoogle,
    logout,
    BACKEND_URL
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};