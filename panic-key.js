/**
 * panic-key.js
 * This script provides a user-configurable panic key functionality for a website using IndexedDB.
 * When activated, it redirects the user to a pre-configured URL stored locally in the browser.
 * The key press must be a single key without any modifiers (Shift, Ctrl, Alt, etc.).
 *
 * This version uses IndexedDB for local storage, ensuring privacy and instantaneous redirection.
 */

// This message helps confirm that the script file itself is being loaded by the browser.
console.log("Debug: panic-key.js script has started.");

// --- IndexedDB Configuration ---
const DB_NAME = 'userLocalSettingsDB';
const STORE_NAME = 'panicKeyStore';
const SETTINGS_ID = 'currentPanicSettings'; // A fixed ID for our settings object

/**
 * Opens the IndexedDB and creates the object store if needed.
 * @returns {Promise<IDBDatabase>} A promise that resolves with the database object.
 */
function openDB() {
    return new Promise((resolve, reject) => {
        // **FIXED**: Removed the hardcoded version '1'. This will now open the latest version of the database.
        const request = indexedDB.open(DB_NAME);

        // This event handles the creation and updating of the database schema.
        // It will only run if a new, higher version number is ever provided in the future,
        // or if the database doesn't exist at all.
        request.onupgradeneeded = event => {
            const db = event.target.result;
            // Create the 'panicKeyStore' object store if it doesn't already exist.
            // We use 'id' as the keyPath, which will store our settings object.
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                console.log("Debug: IndexedDB object store 'panicKeyStore' created.");
            }
        };

        // These events handle the outcome of the connection request.
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Fetches the panic key settings from the IndexedDB.
 * @param {IDBDatabase} db - The database instance.
 * @returns {Promise<object|null>} A promise that resolves with the settings object or null if not found.
 */
function getSettings(db) {
    return new Promise((resolve, reject) => {
        // Create a read-only transaction to get data.
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        // Request the settings object using its fixed ID.
        const request = store.get(SETTINGS_ID);

        // Resolve the promise with the result on success.
        request.onsuccess = () => resolve(request.result || null);
        // Reject the promise on error.
        request.onerror = () => reject(request.error);
    });
}

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
        // This check prevents the panic key from firing while a user is typing in a form field.
        const activeElement = document.activeElement.tagName.toLowerCase();
        if (['input', 'select', 'textarea'].includes(activeElement)) {
            return;
        }

        // Check if the pressed key matches the setting and that no modifier keys are active.
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

// --- Main Execution Logic ---
// We wrap the main logic in a 'DOMContentLoaded' listener to ensure the HTML page
// is fully loaded before the script tries to interact with it.
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Debug: DOMContentLoaded event fired. The page is ready.");
    try {
        // Open the database and then get the settings.
        const db = await openDB();
        const settings = await getSettings(db);

        // If settings are found, activate the panic key listener.
        if (settings) {
            console.log("Debug: Panic key settings FOUND in IndexedDB.", settings);
            addPanicKeyListener(settings);
        } else {
            console.log("Debug: No panic key settings found in IndexedDB.");
        }
        // It's good practice to close the database connection when done.
        db.close();
    } catch (error) {
        console.error("FATAL ERROR: Could not initialize panic key from IndexedDB:", error);
    }
});
