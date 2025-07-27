/**
 * url-changer.js
 * This script manages the dynamic changing of the website's title and favicon
 * based on user-selected presets. The user's choice is saved to localStorage
 * to persist across sessions.
 *
 * To add more options, simply add a new object to the 'presets' array.
 * Each object needs:
 * - name: The display name in the settings dropdown.
 * - title: The text that will appear as the page title.
 * - favicon: The relative path to the favicon image (supports .png, .ico, .jpg, .jpeg).
 *
 * Final version as of: July 27, 2025
 */

const urlChanger = {
    // --- Configuration ---
    // Add your new tab presets here. The 'None' option is required and will revert to the page's original state.
    presets: [
        {
            name: 'None',
            title: 'Default Title', // This will be replaced by the original page title
            favicon: '../images/logo.png' // This will be replaced by the original favicon
        },
        {
            name: 'Home',
            title: 'Classes',
            favicon: '../favicons/google-classroom.png'
        },
        {
            name: 'Google Docs',
            title: 'Google Docs',
            favicon: '../favicons/google-docs.png'
        },
        {
            name: 'Google Slides',
            title: 'Google Slides',
            favicon: '../favicons/google-slides.png'
        },
        {
            name: 'Wikipedia',
            title: 'Wikipedia',
            favicon: '../favicons/wikipedia.png'
        },
        {
            name: 'Clever',
            title: 'Clever | Connect every student to a world of learning',
            favicon: '../favicons/clever.png'
        },
        {
            name: 'Google Drive',
            title: 'Home - Google Drive',
            favicon: '../favicons/google-drive.png'
        }
    ],

    // --- Internal Properties ---
    originalTitle: '',
    originalFavicon: '',

    /**
     * Initializes the script. It captures the original page title and favicon,
     * then applies any saved preset from localStorage.
     */
    init: function() {
        console.log("Debug: url-changer.js script has started.");

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

        // Find the existing favicon link element.
        let favicon = document.querySelector("link[rel*='icon']");

        // If no favicon link exists, create one and append it to the head.
        if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
        }

        // Update the href to the new favicon path.
        // If the path is empty (for the 'None' option with no original favicon), hide it.
        if (preset.favicon) {
            favicon.href = preset.favicon;
            favicon.style.display = '';
        } else {
            favicon.href = '';
            favicon.style.display = 'none';
        }
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
// This ensures that all HTML elements are available before the script tries to manipulate them.
document.addEventListener('DOMContentLoaded', () => {
    urlChanger.init();
});
