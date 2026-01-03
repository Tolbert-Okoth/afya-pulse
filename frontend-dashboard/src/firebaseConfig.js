import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCmDhf_sTVwR8Pe73wMRuAhVxfjcckS2Ww",
  authDomain: "afya-pulse-8f4c9.firebaseapp.com",
  projectId: "afya-pulse-8f4c9",
  storageBucket: "afya-pulse-8f4c9.firebasestorage.app",
  messagingSenderId: "865494446586",
  appId: "1:865494446586:web:6976a11eee7a755849b443",
  measurementId: "G-D8BK9GH5H5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services & Export them
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const analytics = getAnalytics(app); // Exporting this fixes the "unused var" error