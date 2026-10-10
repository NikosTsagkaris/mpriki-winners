import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mpriki-winners.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mpriki-winners",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mpriki-winners.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "500311215002",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:500311215002:web:0284329e0603b85d59c823",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-G8NP5W4CRC"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

/**
 * Calculates next 14-day draw timestamp starting from Oct 11, 2026 until Dec 25, 2026
 */
export const getNextDrawTime = (now = Date.now()) => {
  const startDate = new Date(2026, 9, 25, 12, 0, 0, 0).getTime();
  const finalDate = new Date(2026, 11, 25, 20, 0, 0, 0).getTime();
  const interval = 14 * 24 * 60 * 60 * 1000;
  let current = startDate;
  while (current <= now && current < finalDate) {
    const next = current + interval;
    if (next >= finalDate) {
      current = finalDate;
      break;
    } else {
      current = next;
    }
  }
  return now >= finalDate ? finalDate : current;
};
