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
  "restricted@domain.com"
  // Add more emails as needed
];

// Protected pages that require authentication (add your protected HTML files here)
const protectedPages = [
  "dashboard.html",
  "proxies.html",
  "settings.html",
  "vernmax.html",
  "vernmini.html"
  // Add more protected page names as needed
];

// Pages to redirect to when access is denied
const redirectPages = {
  default: "index.html", // Default redirect page
  login: "login.html"    // Login page if it exists
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
// Get a reference to the authentication service
const auth = firebase.auth();
// Get a reference to the Firestore service
const db = firebase.firestore();

// Advanced restriction system
class AuthenticationGuard {
  constructor() {
    this.isInitialized = false;
    this.currentUser = null;
    this.authStateCallbacks = [];
    this.restrictionCheckInterval = null;
    this.init();
  }

  init() {
    this.setupAuthStateOverride();
    this.setupCurrentUserOverride();
    this.setupPageProtection();
    this.startPeriodicChecks();
    this.isInitialized = true;
  }

  // Check if user email is in restricted list
  isRestrictedEmail(email) {
    if (!email) return false;
    return restrictedEmails.includes(email.toLowerCase());
  }

  // Check if current page is protected
  isProtectedPage() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    return protectedPages.some(page => 
      currentPage.toLowerCase().includes(page.toLowerCase()) || 
      currentPage === page
    );
  }

  // Force logout for restricted users
  async forceLogoutRestrictedUser() {
    const realUser = firebase.auth().currentUser;
    if (realUser && this.isRestrictedEmail(realUser.email)) {
      try {
        // Clear any stored authentication data
        localStorage.clear();
        sessionStorage.clear();
        
        // Sign out the user
        await firebase.auth().signOut();
        
        // Additional cleanup
        this.currentUser = null;
        
        // Redirect if on protected page
        if (this.isProtectedPage()) {
          this.redirectToSafePage();
        }
        
        console.warn('Access denied: User email is restricted');
        return true;
      } catch (error) {
        console.error('Error during forced logout:', error);
      }
    }
    return false;
  }

  // Redirect to appropriate page
  redirectToSafePage() {
    const loginPage = redirectPages.login;
    const defaultPage = redirectPages.default;
    
    // Try to redirect to login page first, then default
    if (loginPage && this.pageExists(loginPage)) {
      window.location.replace(loginPage);
    } else {
      window.location.replace(defaultPage);
    }
  }

  // Check if page exists (basic check)
  pageExists(page) {
    // This is a basic implementation - you might want to enhance this
    return true; // Assume pages exist for now
  }

  // Setup auth state override
  setupAuthStateOverride() {
    const originalOnAuthStateChanged = auth.onAuthStateChanged;
    const self = this;
    
    auth.onAuthStateChanged = function(callback) {
      self.authStateCallbacks.push(callback);
      
      if (self.authStateCallbacks.length === 1) {
        originalOnAuthStateChanged.call(auth, async (user) => {
          if (user && self.isRestrictedEmail(user.email)) {
            // Force logout restricted user
            await self.forceLogoutRestrictedUser();
            self.currentUser = null;
          } else {
            self.currentUser = user;
          }
          
          // Call all registered callbacks
          self.authStateCallbacks.forEach(cb => cb(self.currentUser));
        });
      } else {
        callback(self.currentUser);
      }
      
      return function() {
        const index = self.authStateCallbacks.indexOf(callback);
        if (index > -1) {
          self.authStateCallbacks.splice(index, 1);
        }
      };
    };
  }

  // Setup currentUser override
  setupCurrentUserOverride() {
    const self = this;
    Object.defineProperty(auth, 'currentUser', {
      get: function() {
        const realCurrentUser = firebase.auth().currentUser;
        if (realCurrentUser && self.isRestrictedEmail(realCurrentUser.email)) {
          // Trigger forced logout asynchronously
          setTimeout(() => self.forceLogoutRestrictedUser(), 0);
          return null;
        }
        return realCurrentUser;
      },
      configurable: true
    });
  }

  // Setup page protection
  setupPageProtection() {
    const self = this;
    
    // Immediate page check
    this.checkPageAccess();
    
    // Monitor for navigation changes
    window.addEventListener('beforeunload', () => {
      self.checkPageAccess();
    });
    
    // Monitor for popstate (back/forward navigation)
    window.addEventListener('popstate', () => {
      setTimeout(() => self.checkPageAccess(), 100);
    });
    
    // Override history methods to catch programmatic navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function() {
      originalPushState.apply(history, arguments);
      setTimeout(() => self.checkPageAccess(), 100);
    };
    
    history.replaceState = function() {
      originalReplaceState.apply(history, arguments);
      setTimeout(() => self.checkPageAccess(), 100);
    };
  }

  // Check if user should have access to current page
  async checkPageAccess() {
    if (!this.isProtectedPage()) return;
    
    const realUser = firebase.auth().currentUser;
    
    // No user logged in on protected page
    if (!realUser) {
      this.redirectToSafePage();
      return;
    }
    
    // Restricted user on any page
    if (this.isRestrictedEmail(realUser.email)) {
      await this.forceLogoutRestrictedUser();
      return;
    }
  }

  // Start periodic checks for extra security
  startPeriodicChecks() {
    // Check every 5 seconds for restricted users
    this.restrictionCheckInterval = setInterval(() => {
      const realUser = firebase.auth().currentUser;
      if (realUser && this.isRestrictedEmail(realUser.email)) {
        this.forceLogoutRestrictedUser();
      }
    }, 5000);
  }

  // Stop periodic checks
  stopPeriodicChecks() {
    if (this.restrictionCheckInterval) {
      clearInterval(this.restrictionCheckInterval);
      this.restrictionCheckInterval = null;
    }
  }

  // Public method to check if user is effectively logged in
  isUserLoggedIn() {
    const user = auth.currentUser;
    return user !== null && !this.isRestrictedEmail(user.email);
  }

  // Public method to get effective current user
  getEffectiveCurrentUser() {
    return auth.currentUser;
  }

  // Public method to add restricted email
  addRestrictedEmail(email) {
    if (!restrictedEmails.includes(email.toLowerCase())) {
      restrictedEmails.push(email.toLowerCase());
      // Check current user immediately
      this.forceLogoutRestrictedUser();
    }
  }

  // Public method to remove restricted email
  removeRestrictedEmail(email) {
    const index = restrictedEmails.indexOf(email.toLowerCase());
    if (index > -1) {
      restrictedEmails.splice(index, 1);
    }
  }
}

// Initialize the authentication guard
const authGuard = new AuthenticationGuard();

// Global helper functions
function isUserLoggedIn() {
  return authGuard.isUserLoggedIn();
}

function getEffectiveCurrentUser() {
  return authGuard.getEffectiveCurrentUser();
}

function isRestrictedEmail(email) {
  return authGuard.isRestrictedEmail(email);
}

function addRestrictedEmail(email) {
  return authGuard.addRestrictedEmail(email);
}

function removeRestrictedEmail(email) {
  return authGuard.removeRestrictedEmail(email);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  authGuard.stopPeriodicChecks();
});

// You can optionally export these if you're using ES modules later,
// but for now, they are globally available after this script runs.
// export { auth, db, app, isUserLoggedIn, getEffectiveCurrentUser, isRestrictedEmail, addRestrictedEmail, removeRestrictedEmail };
