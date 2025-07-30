/**
 * ban-enforcer.js (v2 - Enhanced Persistence)
 *
 * This script is the primary enforcement mechanism for website bans. It has been updated
 * for more aggressive and persistent enforcement.
 *
 * It immediately injects a transparent "shield" and disables page scrolling to block all interaction.
 * It then checks if the user's ID exists in the 'bans' collection in Firestore.
 * - If BANNED, the shield becomes a visible, persistent overlay with the ban reason.
 * A new interval guard prevents tampering via developer tools.
 * - If NOT BANNED, the shield is removed and scrolling is re-enabled, allowing normal interaction.
 *
 * IMPORTANT:
 * 1. This script must be placed AFTER the Firebase SDK scripts in your HTML.
 * 2. It should be included on EVERY page you want to protect.
 */

console.log("Debug: ban-enforcer.js script has started.");

// --- 1. Immediately create shield and lock scrolling ---
// This IIFE (Immediately Invoked Function Expression) runs as soon as the script is parsed.
(function() {
    // Check if the shield already exists to prevent duplication.
    if (document.getElementById('ban-enforcer-shield')) return;

    // Create the shield element
    const shield = document.createElement('div');
    shield.id = 'ban-enforcer-shield';
    // Style the shield to be a full-screen, transparent overlay that blocks clicks.
    shield.style.position = 'fixed';
    shield.style.top = '0';
    shield.style.left = '0';
    shield.style.width = '100vw';
    shield.style.height = '100vh';
    shield.style.zIndex = '2147483647'; // Max z-index to cover everything.
    shield.style.backgroundColor = 'transparent'; // Invisible by default.

    // Append to the root <html> element to ensure it loads before the body is interactive.
    document.documentElement.appendChild(shield);

    // **MODIFICATION**: Immediately disable scrolling on the entire page to prevent any interaction
    // during the ban check.
    document.documentElement.style.overflow = 'hidden';

    console.log("Debug: Pre-ban shield deployed and page scrolling locked.");
})();


/**
 * Helper function to remove the shield and restore scrolling.
 * This is called when the user is verified as not banned.
 */
function removeShieldAndUnlockScroll() {
    const shield = document.getElementById('ban-enforcer-shield');
    if (shield) {
        shield.remove();
    }
    // **MODIFICATION**: Restore scrolling.
    document.documentElement.style.overflow = '';
    console.log("Debug: Shield removed and page scrolling unlocked.");
}


document.addEventListener('DOMContentLoaded', () => {
    console.log("Debug: DOMContentLoaded event fired. Ban enforcer is running.");

    // Check for the Firebase library, which is a critical dependency.
    if (typeof firebase === 'undefined' || typeof firebase.auth === 'undefined' || typeof firebase.firestore === 'undefined') {
        console.error("FATAL ERROR: Firebase is not loaded correctly. Check the script order. Ban enforcement is disabled.");
        removeShieldAndUnlockScroll(); // Failsafe
        return;
    }

    // firebase.auth().onAuthStateChanged is the entry point.
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            // A user is logged in. We now need to check if they are banned.
            console.log("Debug: User is logged in. Checking ban status for UID:", user.uid);

            const db = firebase.firestore();
            const banDocRef = db.collection('bans').doc(user.uid);

            banDocRef.get().then(doc => {
                if (doc.exists) {
                    // --- USER IS BANNED ---
                    const banData = doc.data();
                    console.warn(`User ${user.uid} is BANNED. Reason: ${banData.reason}. Locking page permanently.`);
                    // Call the function to make the shield visible and display the ban message.
                    showBanScreen(banData);
                } else {
                    // --- USER IS NOT BANNED ---
                    console.log("Debug: User is not banned.");
                    removeShieldAndUnlockScroll();
                }
            }).catch(error => {
                console.error("Debug: An error occurred while checking ban status. Removing shield to prevent lockout.", error);
                removeShieldAndUnlockScroll(); // Failsafe
            });

        } else {
            // --- NO USER LOGGED IN ---
            console.log("Debug: No user is logged in.");
            removeShieldAndUnlockScroll();
        }
    });
});

/**
 * Makes the ban screen visible and starts the persistence guard to prevent tampering.
 * @param {object} banData - The data from the user's document in the 'bans' collection.
 */
function showBanScreen(banData) {
    const shieldId = 'ban-enforcer-shield';
    const messageId = 'ban-enforcer-message';

    // This function contains the logic to create/update all visual ban elements.
    // It is called once and then used by the interval guard.
    const enforceBanVisuals = () => {
        // --- 1. Find or create the main shield ---
        let shield = document.getElementById(shieldId);
        if (!shield) {
            console.warn("Debug [Guard]: Ban shield was removed by user. Re-deploying...");
            shield = document.createElement('div');
            shield.id = shieldId;
            shield.style.position = 'fixed';
            shield.style.top = '0';
            shield.style.left = '0';
            shield.style.width = '100vw';
            shield.style.height = '100vh';
            shield.style.zIndex = '2147483647';
            document.documentElement.appendChild(shield);
        }

        // --- 2. Apply visible styles to the shield ---
        shield.style.backgroundColor = 'rgba(10, 10, 10, 0.85)';
        shield.style.backdropFilter = 'blur(12px)';
        shield.style.webkitBackdropFilter = 'blur(12px)';

        // --- 3. Find or create the message box ---
        let messageBox = document.getElementById(messageId);
        if (!messageBox) {
            console.warn("Debug [Guard]: Ban message was removed by user. Re-displaying...");
            messageBox = document.createElement('div');
            messageBox.id = messageId;

            // --- Sanitize data to prevent potential HTML injection ---
            const reason = banData.reason ? String(banData.reason).replace(/</g, "&lt;").replace(/>/g, "&gt;") : 'No reason provided.';
            const banDate = banData.bannedAt && banData.bannedAt.toDate ? `on ${banData.bannedAt.toDate().toLocaleDateString()}`: '';

            // **MODIFICATION**: The "Access Denied" color is now straight red (#ff0000).
            messageBox.innerHTML = `
                <h1 style="font-size: 2.2em; color: #ff0000; margin: 0 0 10px 0; font-weight: bold;">Access Denied</h1>
                <p style="font-size: 1.1em; margin: 0 0 15px 0; line-height: 1.4; color: #e0e0e0;">Your account has been suspended from this service.</p>
                <p style="font-size: 1em; margin: 0 0 20px 0; color: #bdbdbd;"><strong>Reason:</strong> ${reason}</p>
                <p style="font-size: 0.8em; color: #9e9e9e;">This action was taken ${banDate}. If you believe this is an error, please contact 4simpleproblems+support@gmail.com</p>
            `;
            document.body.appendChild(messageBox);
        }

        // --- 4. Apply styles to the message box ---
        messageBox.style.position = 'fixed';
        messageBox.style.bottom = '40px';
        messageBox.style.right = '40px';
        messageBox.style.maxWidth = '600px';
        messageBox.style.textAlign = 'right';
        messageBox.style.color = '#ffffff';
        messageBox.style.fontFamily = "'PrimaryFont', Arial, sans-serif"; // Assumes font is loaded elsewhere or is a fallback
        messageBox.style.zIndex = '2147483647';
        messageBox.style.textShadow = '0 2px 8px rgba(0,0,0,0.7)';

        // --- 5. Ensure scrolling remains locked ---
        if (document.documentElement.style.overflow !== 'hidden') {
            document.documentElement.style.overflow = 'hidden';
            console.warn("Debug [Guard]: User tried to re-enable scrolling. Re-locking.");
        }
        if (document.body.style.overflow !== 'hidden') {
             document.body.style.overflow = 'hidden';
        }
    };

    // Inject the custom font (if not already loaded globally)
    // This is safe to run multiple times if the guard needs to reconstruct the page.
    if (!document.querySelector('style[data-font="primary"]')) {
        const fontStyle = document.createElement('style');
        fontStyle.setAttribute('data-font', 'primary'); // Mark the style tag
        fontStyle.textContent = `
            @font-face {
                font-family: 'PrimaryFont';
                src: url('../fonts/primary.woff') format('woff');
                font-weight: normal;
                font-style: normal;
            }
        `;
        document.head.appendChild(fontStyle);
    }

    // Run the enforcement function for the first time.
    enforceBanVisuals();

    // **MODIFICATION**: Start the persistence guard interval.
    // This will continuously check and re-apply the ban if the user tampers with the elements.
    setInterval(enforceBanVisuals, 200);
}
