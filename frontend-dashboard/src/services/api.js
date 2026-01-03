import axios from 'axios';
import { auth } from '../firebaseConfig'; 

// 🛡️ FIX: Dynamic URL Handling
// If VITE_API_URL is set (in .env), use it. 
// Otherwise, fallback to your deployed Render Backend.
const BASE_URL = import.meta.env.VITE_API_URL || "https://afya-pulse-backend.onrender.com";

// Append /api because your backend routes start with it
const API_BASE_URL = `${BASE_URL}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true 
});

api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  
  if (user) {
    try {
        // 🔒 FIX: Robust Token Retrieval
        // 1. Try getting the token normally (auto-refreshes if close to expiry)
        // 2. catch() handles edge cases by forcing a network refresh (true)
        const token = await user.getIdToken(false).catch(async () => {
             console.log("⚠️ Token issue detected, forcing refresh...");
             return await user.getIdToken(true);
        });
        
        config.headers.Authorization = `Bearer ${token}`;
    } catch (error) {
        console.error("Auth Token Error:", error);
    }
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default api;