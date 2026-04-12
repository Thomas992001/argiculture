import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyARPjwp7S1kkmSlb9ajKyThG2GG3GvMmio",
  authDomain: "agritwin-mrv.firebaseapp.com",
  projectId: "agritwin-mrv",
  storageBucket: "agritwin-mrv.firebasestorage.app",
  messagingSenderId: "839701125488",
  appId: "1:839701125488:web:4ee0cb9f43b3d25496d7b5",
  measurementId: "G-FCG0J3DS8E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
