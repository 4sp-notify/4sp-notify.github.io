/**
 * ban-enforcer.js
 * * This script checks if the currently logged-in user has been banned.
 * It reads from a central 'bans' collection in Firestore.
 * If the user's ID is found in the collection, it displays a full-screen
 * overlay, effectively locking them out of the page content.
 * * IMPORTANT:
 * 1. This script must be placed AFTER the Firebase SDK scripts in your HTML.
 * (e.g., after firebase-app-compat.js, firebase-auth-compat.js, and firebase-firestore-compat.js)
 * 2. It should be included on every page you want to protect.
 */

console.log("Debug: ban-enforcer.js script has started.");

document.addEventListener('DOMContentLoaded', () => {
    console.log("Debug: DOMContentLoaded event fired. Ban enforcer is running.");

    // Check for the Firebase library, which is a critical dependency.
    if (typeof firebase === 'undefined' || typeof firebase.auth === 'undefined' || typeof firebase.firestore === 'undefined') {
        console.error("FATAL ERROR: Firebase is not loaded correctly. Check the script order in your HTML file. Ban enforcement is disabled.");
        return;
    }

    // firebase.auth().onAuthStateChanged is the entry point. It automatically
    // determines if a user is logged in.
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            // A user is logged in. We now need to check if they are banned.
            console.log("Debug: User is logged in. Checking ban status for UID:", user.uid);
            
            const db = firebase.firestore();
            // We look for a document with the user's ID in the 'bans' collection.
            const banDocRef = db.collection('bans').doc(user.uid);

            banDocRef.get().then(doc => {
                if (doc.exists) {
                    // --- USER IS BANNED ---
                    const banData = doc.data();
                    console.warn(`User ${user.uid} is BANNED. Reason: ${banData.reason}. Locking page.`);
                    // Call the function to display the ban overlay.
                    showBanScreen(banData);
                } else {
                    // User is not in the ban list, so we do nothing.
                    console.log("Debug: User is not banned. Access granted.");
                }
            }).catch(error => {
                console.error("Debug: An error occurred while checking the ban status:", error);
            });

        } else {
            // No user is logged in. The script does nothing.
            console.log("Debug: No user is logged in. Ban enforcer is idle.");
        }
    });
});

/**
 * Injects a full-screen overlay into the page to block content.
 * @param {object} banData - The data from the user's document in the 'bans' collection.
 */
function showBanScreen(banData) {
    // Sanitize data to prevent HTML injection
    const reason = banData.reason ? String(banData.reason).replace(/</g, "&lt;").replace(/>/g, "&gt;") : 'No reason provided.';
    const bannedBy = banData.bannedBy ? `by ${String(banData.bannedBy).replace(/</g, "&lt;").replace(/>/g, "&gt;")}` : '';
    const banDate = banData.bannedAt ? `on ${banData.bannedAt.toDate().toLocaleDateString()}`: '';

    // Create the overlay elements
    const overlay = document.createElement('div');
    const messageBox = document.createElement('div');

    // Style the overlay using inline styles to ensure they are applied
    // without relying on external stylesheets.
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(10, 10, 10, 0.95)';
    overlay.style.zIndex = '999999999'; // Extremely high z-index
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.color = '#fff';
    overlay.style.fontFamily = 'Arial, sans-serif';
    overlay.style.backdropFilter = 'blur(8px)';

    messageBox.style.maxWidth = '600px';
    messageBox.style.textAlign = 'center';
    messageBox.style.padding = '40px';
    messageBox.style.border = '1px solid #555';
    messageBox.style.borderRadius = '10px';
    messageBox.style.background = 'rgba(30, 30, 30, 0.8)';

    messageBox.innerHTML = `
        <h1 style="font-size: 2.5em; color: #ef5350; margin-bottom: 20px;">Access Denied</h1>
        <p style="font-size: 1.2em; margin-bottom: 15px;">Your account has been banned from this service.</p>
        <p style="font-size: 1em; color: #ccc; margin-bottom: 30px;"><strong>Reason:</strong> ${reason}</p>
        <p style="font-size: 0.8em; color: #888;">This ban was issued ${bannedBy} ${banDate}. If you believe this is a mistake, please contact support.</p>
    `;

    // Append the message box to the overlay, and the overlay to the body
    overlay.appendChild(messageBox);
    document.body.appendChild(overlay);

    // For good measure, stop the page from scrolling
    document.body.style.overflow = 'hidden';
}
