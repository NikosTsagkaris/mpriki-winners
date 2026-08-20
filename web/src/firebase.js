import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDJEP7bovVFreCtIIwq-txWash1tkfUulo",
  authDomain: "mpriki-winners.firebaseapp.com",
  projectId: "mpriki-winners",
  storageBucket: "mpriki-winners.firebasestorage.app",
  messagingSenderId: "500311215002",
  appId: "1:500311215002:web:0284329e0603b85d59c823",
  measurementId: "G-G8NP5W4CRC"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
