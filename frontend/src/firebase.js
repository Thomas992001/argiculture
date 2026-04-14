import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

// This is the frontend-specific Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyARPjwp7S1kkmSlb9ajKyThG2GG3GvMmio",
  authDomain: "agritwin-mrv.firebaseapp.com",
  databaseURL: "https://agritwin-mrv-default-rtdb.firebaseio.com",
  projectId: "agritwin-mrv",
  storageBucket: "agritwin-mrv.firebasestorage.app",
  messagingSenderId: "839701125488",
  appId: "1:839701125488:web:4ee0cb9f43b3d25496d7b5",
  measurementId: "G-FCG0J3DS8E"
};

// Initialize Firebase safely
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Export services for frontend use
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);

export default app;
