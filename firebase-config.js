// firebase-config.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Replace with your real config from Firebase Console
const firebaseConfig = { apiKey: "AIzaSyBeqn-t-e-hZhYV_6zh1UCvrk38HhYOZ7o", authDomain: "foursimpleproblems.firebaseapp.com", projectId: "foursimpleproblems", storageBucket: "foursimpleproblems.firebasestorage.app", messagingSenderId: "329009885873", appId: "1:329009885873:web:4b907162188effc788e890", measurementId: "G-9CQPE80MXD" };

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
export const db = getFirestore(app);
