// firebase-config.js
// Your web app's Firebase configuration
// Replace the placeholder values with your actual project's configuration
const firebaseConfig = {
  apiKey: "AIzaSyBeqn-t-e-hZhYV_6zh1UCvrk38HhYOZ7o",
  authDomain: "foursimpleproblems.firebaseapp.com",
  projectId: "foursimpleproblems",
  storageBucket: "foursimpleproblems.firebasestorage.app",
  messagingSenderId: "329009885873",
  appId: "1:329009885873:web:4b907162188effc788e890",
  measurementId: "G-9CQPE80MXD"
};

// List of emails to treat as logged out
const restrictedEmails = [
  "4simpleproblems@gmail.com",
  "test@example.com",
  "restricted@domain.com"
  // Add more emails as needed
];

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
// Get a reference to the authentication service
const auth = firebase.auth();
// Get a reference to the Firestore service
const db = firebase.firestore();

// Function to check if user email is in restricted list
function isRestrictedEmail(email) {
  return restrictedEmails.includes(email.toLowerCase());
}

// Custom authentication state observer
let currentUser = null;
let authStateCallbacks = [];

// Override the default onAuthStateChanged behavior
const originalOnAuthStateChanged = auth.onAuthStateChanged;
auth.onAuthStateChanged = function(callback) {
  authStateCallbacks.push(callback);
  
  // Set up the original listener only once
  if (authStateCallbacks.length === 1) {
    originalOnAuthStateChanged.call(auth, (user) => {
      // Check if user should be treated as logged out
      if (user && isRestrictedEmail(user.email)) {
        currentUser = null;
      } else {
        currentUser = user;
      }
      
      // Call all registered callbacks with the filtered user
      authStateCallbacks.forEach(cb => cb(currentUser));
    });
  } else {
    // For additional callbacks, call immediately with current state
    callback(currentUser);
  }
  
  // Return unsubscribe function
  return function() {
    const index = authStateCallbacks.indexOf(callback);
    if (index > -1) {
      authStateCallbacks.splice(index, 1);
    }
  };
};

// Override currentUser getter to return filtered user
Object.defineProperty(auth, 'currentUser', {
  get: function() {
    const realCurrentUser = firebase.auth().currentUser;
    if (realCurrentUser && isRestrictedEmail(realCurrentUser.email)) {
      return null;
    }
    return realCurrentUser;
  },
  configurable: true
});

// Helper function to check if current user is effectively logged in
function isUserLoggedIn() {
  const user = auth.currentUser;
  return user !== null && !isRestrictedEmail(user.email);
}

// Helper function to get effective current user (null if restricted)
function getEffectiveCurrentUser() {
  return auth.currentUser;
}

// You can optionally export these if you're using ES modules later,
// but for now, they are globally available after this script runs.
// Additional exports for the new functionality
// export { auth, db, app, isUserLoggedIn, getEffectiveCurrentUser, isRestrictedEmail };
