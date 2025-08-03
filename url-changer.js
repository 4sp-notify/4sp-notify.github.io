/**
 * url-changer.js
 * This script manages the dynamic changing of the website's title and favicon
 * based on user-selected presets. The user's choice is saved to localStorage
 * to persist across sessions. It properly scales favicons and disables image
 * smoothing to ensure low-resolution icons remain sharp and not blurry.
 *
 * It automatically detects if the loading HTML page is in a root directory or a
 * subdirectory and adjusts the favicon paths accordingly for scalability.
 *
 * To add more options, simply add a new object to the 'presets' array.
 * Each object needs:
 * - name: The display name in the settings dropdown.
 * - title: The text that will appear as the page title.
 * - favicon: The path to the favicon image, relative from the root (e.g., 'favicons/icon.png').
 *
 * Final version as of: August 2, 2025
 */

const urlChanger = {
    // --- Configuration ---
    // Add your new tab presets here. Favicon paths should be relative to the root directory.
    // The script will automatically add '../' if the page is in a subdirectory.
    presets: [
        {
            name: 'None',
            title: 'Default Title', // This will be replaced by the original page title
            favicon: 'favicon.ico'    // This will be replaced by the original favicon
        },
        {
            name: 'HAC',
            title: 'Login',
            favicon: 'favicons/hac.png' // Path from root
        },
        {
            name: 'Kahoot',
            title: 'Kahoot! | Learning games | Make learning awesome!',
            favicon: 'favicons/kahoot.png' // Path from root
        },
        {
            name: 'Google Classroom',
            title: 'Home',
            favicon: 'favicons/google-classroom.png' // Path from root
        },
        {
            name: 'Google Docs',
            title: 'Google Docs',
            favicon: 'favicons/google-docs.png' // Path from root
        },
        {
            name: 'Google Slides',
            title: 'Google Slides',
            favicon: 'favicons/google-slides.png' // Path from root
        },
        {
            name: 'Google Drive',
            title: 'Home - Google Drive',
            favicon: 'favicons/google-drive.png' // Path from root
        },
        {
            name: 'Wikipedia',
            title: 'Wikipedia',
            favicon: 'favicons/wikipedia.png' // Path from root
        },
        {
            name: 'Clever',
            title: 'Clever | Connect every student to a world of learning',
            favicon: 'favicons/clever.png' // Path from root
        }
    ],

    // --- Internal Properties ---
    originalTitle: '',
    originalFavicon: '',
    pathPrefix: '', // ✨ NEW: Will hold the path prefix, e.g., '' or '../'

    /**
     * Initializes the script. It captures the original page title and favicon,
     * determines the correct pathing, and applies any saved preset from localStorage.
     */
    init: function() {
        console.log("Debug: url-changer.js script has started.");

        // --- ✨ NEW CODE START ✨ ---
        // Determine the correct path prefix based on the current page's location.
        // A path like '/index.html' has a depth of 1. A path like '/pages/game.html' has a depth of 2.
        // If depth is greater than 1, we are in a subdirectory and need to go up one level.
        const pathDepth = window.location.pathname.split('/').length - 1;
        this.pathPrefix = pathDepth > 1 ? '../' : '';
        console.log(`Debug: Detected path depth of ${pathDepth}. Setting prefix to: "${this.pathPrefix}"`);
        // --- ✨ NEW CODE END ✨ ---

        // Capture the original page state before making any changes.
        this.originalTitle = document.title;
        const faviconElement = document.querySelector("link[rel*='icon']");
        this.originalFavicon = faviconElement ? faviconElement.href : '';

        // Update the 'None' preset to use the captured original values.
        const nonePreset = this.presets.find(p => p.name === 'None');
        if (nonePreset) {
            nonePreset.title = this.originalTitle;
            nonePreset.favicon = this.originalFavicon;
        }

        // Apply the saved preset, if one exists.
        const savedPresetName = localStorage.getItem('selectedUrlPreset');
        if (savedPresetName) {
            this.applyPreset(savedPresetName);
        }
    },

    /**
     * Applies a given preset by changing the document title and favicon.
     * For custom presets, it scales the favicon image to fit correctly using a canvas.
     * @param {string} presetName - The name of the preset to apply.
     */
    applyPreset: function(presetName) {
        const preset = this.presets.find(p => p.name === presetName);
        if (!preset) {
            console.warn(`URL Changer: Preset "${presetName}" not found. Reverting to default.`);
            this.applyPreset('None');
            return;
        }

        // Change the document title.
        document.title = preset.title;

        // Find the existing favicon link element, or create it if it doesn't exist.
        let favicon = document.querySelector("link[rel*='icon']");
        if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
        }

        // Handle the 'None' preset to revert to the original state directly.
        // This case does not need the path prefix because it uses the full original href.
        if (preset.name === 'None') {
            if (preset.favicon) {
                favicon.href = preset.favicon;
                favicon.style.display = '';
            } else {
                favicon.href = '';
                favicon.style.display = 'none';
            }
            return; // End execution for the 'None' case.
        }

        // For all other presets, load the image and draw it on a canvas to ensure proper scaling.
        const img = new Image();
        img.crossOrigin = "Anonymous";

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = 32;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Disable image smoothing to prevent blurriness on scaled-down favicons.
            ctx.imageSmoothingEnabled = false;
            ctx.mozImageSmoothingEnabled = false;
            ctx.webkitImageSmoothingEnabled = false;
            ctx.msImageSmoothingEnabled = false;
            
            // Calculate dimensions to fit the image within the canvas while maintaining aspect ratio.
            const scale = Math.min(size / img.width, size / img.height);
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;

            // Calculate coordinates to center the scaled image on the canvas.
            const x = (size - scaledWidth) / 2;
            const y = (size - scaledHeight) / 2;
            
            // Draw the scaled image onto the canvas.
            ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

            // Update the favicon link's href with the canvas data URL.
            favicon.href = canvas.toDataURL('image/png');
            favicon.style.display = '';
        };

        img.onerror = () => {
            // ✨ MODIFIED: Use the constructed path in the error message for clarity.
            const fullPath = this.pathPrefix + preset.favicon;
            console.error(`URL Changer: Failed to load favicon image at "${fullPath}". Reverting to original.`);
            if (this.originalFavicon) {
                favicon.href = this.originalFavicon;
            } else {
                favicon.href = '';
                favicon.style.display = 'none';
            }
        };

        // ✨ MODIFIED: Prepend the dynamic path prefix to the favicon source.
        img.src = this.pathPrefix + preset.favicon;
    },

    /**
     * Saves the user's preset choice to localStorage and applies it.
     * @param {string} presetName - The name of the preset to save.
     */
    savePreset: function(presetName) {
        localStorage.setItem('selectedUrlPreset', presetName);
        this.applyPreset(presetName);
        console.log(`Debug: Saved preset "${presetName}" to localStorage.`);
    }
};

// Add an event listener to run the init function once the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', () => {
    urlChanger.init();
});
