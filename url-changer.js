/**
 * url-changer.js
 * This script manages the dynamic changing of the website's title and favicon
 * based on user-selected presets. The user's choice is saved to localStorage
 * to persist across sessions. It properly scales favicons and disables image
 * smoothing to ensure low-resolution icons remain sharp and not blurry.
 *
 * It automatically detects if the loading HTML page is in a root directory or a
 * subdirectory (e.g., 'logged-in') and adjusts the image paths accordingly.
 *
 * To add more options, simply add a new object to the 'presets' array.
 * Each object needs:
 * - name: The display name in the settings dropdown.
 * - title: The text that will appear as the page title.
 * - favicon: The path to the icon from the root 'images' folder (e.g., 'images/icon.png').
 *
 * Final version as of: August 2, 2025
 */

const urlChanger = {
    // --- Configuration ---
    // Presets now point to the 'images' folder as requested.
    presets: [
        {
            name: 'None',
            title: 'Default Title', // Will be replaced by the original page title
            favicon: 'favicon.ico'    // Will be replaced by the original favicon
        },
        {
            name: 'HAC',
            title: 'Login',
            favicon: 'images/hac.png' // ✅ CORRECTED PATH
        },
        {
            name: 'Kahoot',
            title: 'Kahoot! | Learning games | Make learning awesome!',
            favicon: 'images/kahoot.png' // ✅ CORRECTED PATH
        },
        {
            name: 'Google Classroom',
            title: 'Home',
            favicon: 'images/google-classroom.png' // ✅ CORRECTED PATH
        },
        {
            name: 'Google Docs',
            title: 'Google Docs',
            favicon: 'images/google-docs.png' // ✅ CORRECTED PATH
        },
        {
            name: 'Google Slides',
            title: 'Google Slides',
            favicon: 'images/google-slides.png' // ✅ CORRECTED PATH
        },
        {
            name: 'Google Drive',
            title: 'Home - Google Drive',
            favicon: 'images/google-drive.png' // ✅ CORRECTED PATH
        },
        {
            name: 'Wikipedia',
            title: 'Wikipedia',
            favicon: 'images/wikipedia.png' // ✅ CORRECTED PATH
        },
        {
            name: 'Clever',
            title: 'Clever | Connect every student to a world of learning',
            favicon: 'images/clever.png' // ✅ CORRECTED PATH
        }
    ],

    // --- Internal Properties ---
    originalTitle: '',
    originalFavicon: '',
    pathPrefix: '', // This will hold the path prefix, e.g., '' or '../'

    /**
     * Initializes the script.
     */
    init: function() {
        console.log("Debug: url-changer.js script has started.");

        // This logic determines if the page is in the root or a subdirectory.
        // It correctly creates the '../' prefix for pages in folders like '/logged-in/'.
        const pathDepth = window.location.pathname.split('/').length - 1;
        this.pathPrefix = pathDepth > 1 ? '../' : '';
        console.log(`Debug: Page is in a ${this.pathPrefix ? 'subdirectory' : 'root directory'}. Path prefix set to: "${this.pathPrefix}"`);

        // Capture the original page state.
        this.originalTitle = document.title;
        const faviconElement = document.querySelector("link[rel*='icon']");
        this.originalFavicon = faviconElement ? faviconElement.href : '';

        // Update the 'None' preset with the actual original values.
        const nonePreset = this.presets.find(p => p.name === 'None');
        if (nonePreset) {
            nonePreset.title = this.originalTitle;
            nonePreset.favicon = this.originalFavicon;
        }

        // Apply any saved preset.
        const savedPresetName = localStorage.getItem('selectedUrlPreset');
        if (savedPresetName) {
            this.applyPreset(savedPresetName);
        }
    },

    /**
     * Applies a given preset by name.
     * @param {string} presetName - The name of the preset to apply.
     */
    applyPreset: function(presetName) {
        const preset = this.presets.find(p => p.name === presetName);
        if (!preset) {
            console.warn(`URL Changer: Preset "${presetName}" not found. Reverting to default.`);
            this.applyPreset('None');
            return;
        }

        document.title = preset.title;

        let favicon = document.querySelector("link[rel*='icon']");
        if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
        }

        // Revert to original for the 'None' preset.
        if (preset.name === 'None') {
            favicon.href = preset.favicon || '';
            return;
        }

        const img = new Image();
        img.crossOrigin = "Anonymous";

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = 32;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');

            ctx.imageSmoothingEnabled = false; // For sharp, pixelated icons
            
            const scale = Math.min(size / img.width, size / img.height);
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            const x = (size - scaledWidth) / 2;
            const y = (size - scaledHeight) / 2;
            
            ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
            favicon.href = canvas.toDataURL('image/png');
        };

        img.onerror = () => {
            const fullPath = this.pathPrefix + preset.favicon;
            console.error(`URL Changer: Failed to load image at "${fullPath}". Reverting to original.`);
            if (this.originalFavicon) {
                favicon.href = this.originalFavicon;
            }
        };

        // This combines the prefix ('../') and the icon path ('images/icon.png')
        // to create the correct full relative path.
        img.src = this.pathPrefix + preset.favicon;
    },

    /**
     * Saves the user's choice to localStorage.
     * @param {string} presetName - The name of the preset to save and apply.
     */
    savePreset: function(presetName) {
        localStorage.setItem('selectedUrlPreset', presetName);
        this.applyPreset(presetName);
        console.log(`Debug: Saved preset "${presetName}" to localStorage.`);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    urlChanger.init();
});
