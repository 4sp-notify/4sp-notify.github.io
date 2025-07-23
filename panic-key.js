/**
 * panic-key.js
 * * This script provides a user-configurable panic key functionality for a website using Firebase.
 * When activated, it redirects the user to a pre-configured URL.
 * The key press must be a single key without any modifiers (Shift, Ctrl, Alt, etc.).
 *
 * Final version as of: July 23, 2025
 */

// This message helps confirm that the script file itself is being loaded by the browser.
console.log("Debug: panic-key.js script has started.");

// We wrap the main logic in a 'DOMContentLoaded' listener to ensure the HTML page
// is fully loaded before the script tries to interact with it.
document.addEventListener('DOMContentLoaded', () => {
    console.log("Debug: DOMContentLoaded event fired. The page is ready.");
    
    // First, we check if the Firebase library has been loaded. This is a critical dependency.
    // If it's missing, we log a fatal error and stop execution.
    if (typeof firebase === 'undefined') {
        console.error("FATAL ERROR: Firebase is not loaded. Check the script order in your HTML file. 'firebase-app-compat.js' and other SDKs must come before 'panic-key.js'.");
        return;
    }

    // firebase.auth().onAuthStateChanged() is the entry point. It automatically
    // determines if a user is logged in or not.
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            // If a user object exists, they are logged in.
            console.log("Debug: User is logged in. UID:", user.uid);
            
            const db = firebase.firestore();
            const userRef = db.collection('users').doc(user.uid);

            // We attempt to get the user's specific document from the 'users' collection.
            userRef.get().then(doc => {
                console.log("Debug: Attempting to get user settings from Firestore.");
                if (doc.exists) {
                    const userData = doc.data();
                    console.log("Debug: Firestore document found.", userData);
                    
                    // We check if the 'panicKeySettings' object exists within the user's document.
                    if (userData.panicKeySettings) {
                        const panicSettings = userData.panicKeySettings;
                        console.log("Debug: Panic key settings FOUND.", panicSettings);
                        // If settings exist, we call the function to activate the key listener.
                        addPanicKeyListener(panicSettings);
                    } else {
                        console.warn("Debug: User has a document, but no 'panicKeySettings' object was found inside it. The user needs to save their settings first.");
                    }
                } else {
                    console.warn("Debug: User is logged in, but no document was found for them in Firestore.");
                }
            }).catch(error => {
                console.error("Debug: An error occurred while fetching the user document from Firestore:", error);
            });
        } else {
            // If the user object is null, no one is logged in.
            console.log("Debug: No user is logged in. The panic key will not be active on this page.");
        }
    });
});

/**
 * Attaches the 'keydown' event listener to the document with the user's specific settings.
 * @param {object} settings - The user's panic key settings object { key, url }.
 */
function addPanicKeyListener(settings) {
    // A safeguard to ensure we don't attach a listener with incomplete settings.
    if (!settings || !settings.key || !settings.url) {
        console.error("Debug: addPanicKeyListener was called, but settings are incomplete.", settings);
        return;
    }

    console.log("Debug: Attaching keydown listener to the document with these settings:", settings);

    document.addEventListener('keydown', (event) => {
        // This check prevents the panic key from firing while a user is typing in a form.
        const activeElement = document.activeElement.tagName.toLowerCase();
        if (['input', 'select', 'textarea'].includes(activeElement)) {
            return;
        }

        // --- MODIFIED LOGIC ---
        // The new logic is simpler: check for the correct key and ensure NO modifiers are pressed.
        const keyIsCorrect = event.key.toLowerCase() === settings.key;
        const noModifiersPressed = !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;

        // If all conditions are met, we execute the panic action.
        if (keyIsCorrect && noModifiersPressed) {
            console.log("SUCCESS: Panic key detected! Redirecting...");
            
            // This prevents the browser from performing the default action for the key press.
            event.preventDefault();
            
            // Navigate to the user's personally chosen panic URL.
            window.location.href = settings.url;
        }
    });
}
