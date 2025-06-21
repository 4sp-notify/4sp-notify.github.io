// This script activates the panic key listener on any page it's included on.

document.addEventListener('DOMContentLoaded', () => {
    // Wait for Firebase to confirm the user's authentication state.
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            // User is logged in, so let's get their settings.
            const db = firebase.firestore();
            const userRef = db.collection('users').doc(user.uid);

            userRef.get().then(doc => {
                if (doc.exists) {
                    const userData = doc.data();
                    // Check if the user has panic key settings saved.
                    if (userData.panicKeySettings) {
                        const panicSettings = userData.panicKeySettings;
                        // Attach the actual key press listener to the page.
                        addPanicKeyListener(panicSettings);
                    }
                }
            }).catch(error => {
                console.error("Error fetching user settings for panic key:", error);
            });
        }
        // If no user is logged in, the script does nothing.
    });
});

/**
 * Attaches a 'keydown' event listener to the document.
 * @param {object} settings - The user's panic key settings { modifier, key, url }.
 */
function addPanicKeyListener(settings) {
    if (!settings || !settings.key || !settings.url) {
        return; // Do nothing if settings are incomplete.
    }

    document.addEventListener('keydown', (event) => {
        // To prevent the panic key from activating while the user is typing
        // in a form, we check if the active element is an input, select, or textarea.
        const activeElement = document.activeElement.tagName.toLowerCase();
        if (['input', 'select', 'textarea'].includes(activeElement)) {
            return;
        }

        const modifier = settings.modifier; // e.g., 'shiftKey', 'ctrlKey', or ''
        const requiredModifierState = modifier ? event[modifier] : true;
        const keyIsCorrect = event.key.toLowerCase() === settings.key;

        // This ensures no OTHER modifier keys are pressed. For example, if the panic
        // key is "Shift + A", this prevents it from firing if "Ctrl + Shift + A" is pressed.
        const noOtherModifiers = !['shiftKey', 'ctrlKey', 'altKey'].some(mod => {
            return mod !== modifier && event[mod];
        });

        if (requiredModifierState && keyIsCorrect && noOtherModifiers) {
            // Stop the browser's default action for this key press.
            event.preventDefault();
            
            // =================================================================
            // UPDATED REDIRECTION LOGIC
            // =================================================================
            
            // OLD LINE (to be removed):
            // window.location.replace(settings.url);

            // NEW LINES:
            // Step 1: Replace the current page in history with google.com.
            // This happens silently in the background.
            history.replaceState(null, "", "https://google.com");

            // Step 2: Navigate to the user's chosen panic URL. This adds a new
            // entry to the history, making Google the "previous" page.
            window.location.href = settings.url;
            
            // =================================================================
        }
    });
}
