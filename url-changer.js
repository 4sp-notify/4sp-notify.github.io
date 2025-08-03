/**
 * url-changer.js
 * This script manages the dynamic changing of the website's title and favicon
 * based on user-selected presets. The user's choice is saved to localStorage
 * to persist across sessions. It uses absolute paths for icons to ensure they
 * work from any page depth (root or subdirectory).
 *
 * To add more options, simply add a new object to the 'presets' array.
 * Each object needs:
 * - name: The display name in the settings dropdown.
 * - title: The text that will appear as the page title.
 * - favicon: The ABSOLUTE path to the icon (starts with '/').
 *
 * Final version as of: August 2, 2025
 */

const urlChanger = {
    // --- Configuration ---
    // ✅ All favicon paths are now absolute (start with '/').
    presets: [
        {
            name: 'None',
            title: 'Default Title',
            favicon: '/favicon.ico' // Default favicon at the root
        },
        {
            name: 'HAC',
            title: 'Login',
            favicon: '/images/hac.png'
        },
        {
            name: 'Kahoot',
            title: 'Kahoot! | Learning games | Make learning awesome!',
            favicon: '/images/kahoot.png'
        },
        {
            name: 'Google Classroom',
            title: 'Home',
            favicon: '/images/google-classroom.png'
        },
        {
            name: 'Google Docs',
            title: 'Google Docs',
            favicon: '/images/google-docs.png'
        },
        {
            name: 'Google Slides',
            title: 'Google Slides',
            favicon: '/images/google-slides.png'
        },
        {
            name: 'Google Drive',
            title: 'Home - Google Drive',
            favicon: '/images/google-drive.png'
        },
        {
            name: 'Wikipedia',
            title: 'Wikipedia',
            favicon: '/images/wikipedia.png'
        },
        {
            name: 'Clever',
            title: 'Clever | Connect every student to a world of learning',
            favicon: '/images/clever.png'
        }
    ],

    // --- Internal Properties ---
    originalTitle: '',
    originalFavicon: '',
    // REMOVED: pathPrefix is no longer needed.

    /**
     * Initializes the script.
     */
    init: function() {
        console.log("Debug: url-changer.js script has started.");

        // REMOVED: Dynamic path detection is no longer necessary with absolute paths.

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
            ctx.imageSmoothingEnabled = false;
            
            const scale = Math.min(size / img.width, size / img.height);
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            const x = (size - scaledWidth) / 2;
            const y = (size - scaledHeight) / 2;
            
            ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
            favicon.href = canvas.toDataURL('image/png');
        };

        img.onerror = () => {
            console.error(`URL Changer: Failed to load image at "${preset.favicon}".`);
            if (this.originalFavicon) {
                favicon.href = this.originalFavicon;
            }
        };

        // ✅ This now uses the simple, absolute path directly. No prefix needed.
        img.src = preset.favicon;
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
