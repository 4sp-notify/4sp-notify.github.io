// firebase-config.js

const firebaseConfig = {
  apiKey: "AIzaSyCEMOXNV5CNK6ds4rXyzB2hX9EB36ZDpNQ",
  authDomain: "attentio-web.firebaseapp.com",
  projectId: "attentio-web",
  storageBucket: "attentio-web.firebasestorage.app",
  messagingSenderId: "965345902625",
  appId: "1:965345902625:web:b60bff09e35fc0e9c56360"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);

// Get a reference to the authentication service
const auth = firebase.auth();

// Get a reference to the Firestore service
const db = firebase.firestore();
