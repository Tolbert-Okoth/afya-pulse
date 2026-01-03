import axios from 'axios';
import { auth } from '../firebaseConfig'; 

// ⚠️ CHANGE THIS: Remove the full URL. Just use the path.
// The Vite Proxy will automatically send this to http://localhost:5000/api
const API_BASE_URL = '/api'; 

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