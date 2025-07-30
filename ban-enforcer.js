/**
 * ban-enforcer.js
 * * This script is the primary enforcement mechanism for website bans.
 * It immediately injects a transparent "shield" to block interaction, then checks
 * if the user's ID exists in the 'bans' collection in Firestore.
 * If banned, the shield becomes a visible overlay with the ban reason.
 * If not banned, the shield is removed, allowing normal interaction.
 *
 * * IMPORTANT:
 * 1. This script must be placed AFTER the Firebase SDK scripts in your HTML.
 * 2. It should be included on EVERY page you want to protect.
 */

console.log("Debug: ban-enforcer.js script has started.");

// --- 1. Immediately create and inject the pre-ban shield ---
// This IIFE (Immediately Invoked Function Expression) runs as soon as the script is parsed by the browser.
(function() {
    // Check if the shield already exists to prevent duplication.
    if (document.getElementById('ban-enforcer-shield')) return;

    const shield = document.createElement('div');
    shield.id = 'ban-enforcer-shield';
    // Style the shield to be a full-screen, transparent overlay that blocks clicks.
    shield.style.position = 'fixed';
    shield.style.top = '0';
    shield.style.left = '0';
    shield.style.width = '100vw';
    shield.style.height = '100vh';
    shield.style.zIndex = '2147483647'; // Max z-index to cover everything.
    shield.style.backgroundColor = 'transparent'; // It's invisible by default.
    // Append to the root <html> element to ensure it loads before the body content is interactive.
    document.documentElement.appendChild(shield);
    console.log("Debug: Pre-ban shield has been deployed.");
})();


document.addEventListener('DOMContentLoaded', () => {
    console.log("Debug: DOMContentLoaded event fired. Ban enforcer is running.");

    // Check for the Firebase library, which is a critical dependency.
    if (typeof firebase === 'undefined' || typeof firebase.auth === 'undefined' || typeof firebase.firestore === 'undefined') {
        console.error("FATAL ERROR: Firebase is not loaded correctly. Check the script order. Ban enforcement is disabled.");
        const shield = document.getElementById('ban-enforcer-shield');
        if (shield) shield.remove(); // Remove shield if Firebase fails to load.
        return;
    }

    // firebase.auth().onAuthStateChanged is the entry point.
    firebase.auth().onAuthStateChanged(user => {
        const shield = document.getElementById('ban-enforcer-shield');

        if (user) {
            // A user is logged in. We now need to check if they are banned.
            console.log("Debug: User is logged in. Checking ban status for UID:", user.uid);
            
            const db = firebase.firestore();
            const banDocRef = db.collection('bans').doc(user.uid);

            banDocRef.get().then(doc => {
                if (doc.exists) {
                    // --- USER IS BANNED ---
                    const banData = doc.data();
                    console.warn(`User ${user.uid} is BANNED. Reason: ${banData.reason}. Locking page.`);
                    // Call the function to make the shield visible and display the ban message.
                    showBanScreen(shield, banData);
                } else {
                    // --- USER IS NOT BANNED ---
                    console.log("Debug: User is not banned. Removing shield.");
                    if (shield) shield.remove();
                }
            }).catch(error => {
                console.error("Debug: An error occurred while checking ban status. Removing shield to prevent lockout.", error);
                if (shield) shield.remove(); // Failsafe: remove shield on error.
            });

        } else {
            // --- NO USER LOGGED IN ---
            console.log("Debug: No user is logged in. Removing shield.");
            if (shield) shield.remove();
        }
    });
});

/**
 * Makes the shield visible and injects the sleek, bottom-right message.
 * @param {HTMLElement} shield - The shield element that is already on the page.
 * @param {object} banData - The data from the user's document in the 'bans' collection.
 */
function showBanScreen(shield, banData) {
    // --- 1. Make the existing shield visible ---
    if (shield) {
        shield.style.backgroundColor = 'rgba(10, 10, 10, 0.85)';
        shield.style.backdropFilter = 'blur(12px)'; // Increased blur
        shield.style.webkitBackdropFilter = 'blur(12px)'; // Increased blur for Safari support
    }

    // --- 2. Inject the custom font ---
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

    // --- 3. Sanitize data to prevent potential HTML injection ---
    const reason = banData.reason ? String(banData.reason).replace(/</g, "&lt;").replace(/>/g, "&gt;") : 'No reason provided.';
    // **MODIFICATION**: The `bannedBy` information is no longer prepared for display to the user.
    const banDate = banData.bannedAt && banData.bannedAt.toDate ? `on ${banData.bannedAt.toDate().toLocaleDateString()}`: '';

    // --- 4. Create the sleek message box for the bottom right ---
    const messageBox = document.createElement('div');
    messageBox.style.position = 'fixed';
    messageBox.style.bottom = '40px';
    messageBox.style.right = '40px';
    messageBox.style.maxWidth = '600px';
    messageBox.style.textAlign = 'right';
    messageBox.style.color = '#ffffff';
    messageBox.style.fontFamily = "'PrimaryFont', Arial, sans-serif";
    messageBox.style.zIndex = '2147483647'; // Ensure it's on top of the shield.
    messageBox.style.textShadow = '0 2px 8px rgba(0,0,0,0.7)';
    
    // **MODIFICATION**: The message no longer includes the ${bannedBy} variable.
    messageBox.innerHTML = `
        <h1 style="font-size: 2.2em; color: #ff1744; margin: 0 0 10px 0; font-weight: bold;">Access Denied</h1>
        <p style="font-size: 1.1em; margin: 0 0 15px 0; line-height: 1.4; color: #e0e0e0;">Your account has been suspended from this service.</p>
        <p style="font-size: 1em; margin: 0 0 20px 0; color: #bdbdbd;"><strong>Reason:</strong> ${reason}</p>
        <p style="font-size: 0.8em; color: #9e9e9e;">This action was taken ${banDate}. If you believe this is an error, please contact 4simpleproblems+support@gmail.com</p>
    `;

    // --- 5. Append message to the body and lock the page scroll ---
    document.body.appendChild(messageBox);
    document.body.style.overflow = 'hidden';
}
