/**
 * ban-enforcer.js
 * * This script is the primary enforcement mechanism for website bans.
 * It checks if the currently logged-in user's ID exists in the 'bans' collection in Firestore.
 * If a ban is found, it completely blocks the UI by injecting a full-screen overlay
 * that displays the ban reason and prevents any interaction with the page.
 *
 * * IMPORTANT:
 * 1. This script must be placed AFTER the Firebase SDK scripts in your HTML.
 * (e.g., after firebase-app-compat.js, firebase-auth-compat.js, etc.)
 * 2. It should be included on EVERY page you want to protect to ensure a consistent user lockout.
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
 * Injects a full-screen overlay and a sleek, bottom-right message to block content.
 * @param {object} banData - The data from the user's document in the 'bans' collection.
 */
function showBanScreen(banData) {
    // --- 1. Inject the custom font ---
    const fontStyle = document.createElement('style');
    fontStyle.textContent = `
        @font-face {
            font-family: 'PrimaryFont';
            src: url('../fonts/primary.woff') format('woff');
            font-weight: normal;
            font-style: normal;
        }
    `;
    document.head.appendChild(fontStyle);

    // --- 2. Sanitize data to prevent potential HTML injection ---
    const reason = banData.reason ? String(banData.reason).replace(/</g, "&lt;").replace(/>/g, "&gt;") : 'No reason provided.';
    const bannedBy = banData.bannedBy ? `by ${String(banData.bannedBy).replace(/</g, "&lt;").replace(/>/g, "&gt;")}` : '';
    const banDate = banData.bannedAt && banData.bannedAt.toDate ? `on ${banData.bannedAt.toDate().toLocaleDateString()}`: '';

    // --- 3. Create the background overlay ---
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(10, 10, 10, 0.85)';
    overlay.style.zIndex = '2147483646'; // High z-index
    overlay.style.backdropFilter = 'blur(8px)';
    overlay.style.webkitBackdropFilter = 'blur(8px)'; // For Safari support

    // --- 4. Create the sleek message box for the bottom right ---
    const messageBox = document.createElement('div');
    messageBox.style.position = 'fixed';
    messageBox.style.bottom = '40px';
    messageBox.style.right = '40px';
    messageBox.style.maxWidth = '450px';
    messageBox.style.textAlign = 'right';
    messageBox.style.color = '#ffffff';
    messageBox.style.fontFamily = "'PrimaryFont', Arial, sans-serif";
    messageBox.style.zIndex = '2147483647'; // Max z-index to be on top
    messageBox.style.textShadow = '0 2px 8px rgba(0,0,0,0.7)';
    
    messageBox.innerHTML = `
        <h1 style="font-size: 2.2em; color: #ef5350; margin: 0 0 10px 0; font-weight: bold;">Access Denied</h1>
        <p style="font-size: 1.1em; margin: 0 0 15px 0; line-height: 1.4; color: #e0e0e0;">Your account has been banned from this service.</p>
        <p style="font-size: 1em; margin: 0 0 20px 0; color: #bdbdbd;"><strong>Reason:</strong> ${reason}</p>
        <p style="font-size: 0.8em; color: #9e9e9e;">Ban issued ${bannedBy} ${banDate}.</p>
    `;

    // --- 5. Append elements to the body and lock the page ---
    document.body.appendChild(overlay);
    document.body.appendChild(messageBox);
    document.body.style.overflow = 'hidden';
}
