// firebase-config.js

// !!! IMPORTANT: Replace with your actual Firebase project configuration !!!
// You can find this information in your Firebase project settings
// (Project settings -> General -> Your apps -> Firebase SDK snippet -> Config)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
    // measurementId: "YOUR_MEASUREMENT_ID" // Optional, if you use Google Analytics
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);

// Get a reference to the authentication service
const auth = firebase.auth();

// Get a reference to the Firestore database
const db = firebase.firestore();
