// firebase-config.js

const firebaseConfig = {
  apiKey: "AIzaSyCbaYBA-Ab3noI-p2ZC57sR7OnLcc7ojL8",
  authDomain: "foursimpleproblems-v4.firebaseapp.com",
  projectId: "foursimpleproblems-v4",
  storageBucket: "foursimpleproblems-v4.firebasestorage.app",
  messagingSenderId: "251178815270",
  appId: "1:251178815270:web:cc7fdb5ed05f8d8d203be7"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);

// Get a reference to the authentication service
const auth = firebase.auth();

// Get a reference to the Firestore service
const db = firebase.firestore();
