/**
 * url-changer.js
 * This script manages the dynamic changing of the website's title and favicon
 * based on user-selected presets, including live and custom options.
 * The user's choice is saved to localStorage to persist across sessions.
 */

const urlChanger = {
    // --- Configuration ---
    // Presets are organized with unique IDs and categories for the custom dropdown.
    presets: [
        // Note: The 'None' preset is handled dynamically in the init() function.
        { id: 'hac', name: 'HAC', title: 'Login', favicon: '../favicons/hac.png', category: 'websites' },
        { id: 'gmm', name: 'GMM', title: 'Get More Math!', favicon: '../favicons/gmm.png', category: 'websites' },
        { id: 'kahoot', name: 'Kahoot', title: 'Kahoot! | Learning games | Make learning awesome!', favicon: '../favicons/kahoot.png', category: 'websites' },
        { id: 'g_classroom', name: 'Google Classroom', title: 'Home', favicon: '../favicons/google-classroom.png', category: 'websites' },
        { id: 'g_docs', name: 'Google Docs', title: 'Google Docs', favicon: '../favicons/google-docs.png', category: 'websites' },
        { id: 'g_slides', name: 'Google Slides', title: 'Google Slides', favicon: '../favicons/google-slides.png', category: 'websites' },
        { id: 'g_drive', name: 'Google Drive', title: 'Home - Google Drive', favicon: '../favicons/google-drive.png', category: 'websites' },
        { id: 'wikipedia', name: 'Wikipedia', title: 'Wikipedia', favicon: '../favicons/wikipedia.png', category: 'websites' },
        { id: 'clever', name: 'Clever', title: 'Clever | Connect every student to a world of learning', favicon: '../favicons/clever.png', category: 'websites' },
        { id: '_LIVE_CURRENT_TIME', name: 'Current Time', title: 'Live Time', favicon: '', category: 'live', live: true }
    ],

    // --- Internal Properties ---
    originalTitle: '',
    originalFavicon: '',
    liveInterval: null,

    /**
     * Initializes the script. Captures original page state and applies any saved preset.
     */
    init: function() {
        this.originalTitle = document.title;
        const faviconElement = document.querySelector("link[rel*='icon']");
        this.originalFavicon = faviconElement ? faviconElement.href : '';

        const savedSettingsJSON = localStorage.getItem('selectedUrlPreset');
        if (savedSettingsJSON) {
            try {
                const savedSettings = JSON.parse(savedSettingsJSON);
                this.applyPreset(savedSettings);
            } catch (e) {
                console.error("Failed to parse saved tab settings, reverting to default.", e);
                this.applyPreset({ type: 'none' });
            }
        }
    },

    /**
     * Updates the page title with the current time.
     * @private
     */
    _updateLiveTime: function() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        document.title = timeString;
    },

    /**
     * Applies a given preset by changing the document title and favicon.
     * @param {object} settings - The settings object to apply.
     */
    applyPreset: function(settings) {
        if (this.liveInterval) {
            clearInterval(this.liveInterval);
            this.liveInterval = null;
        }

        let title = this.originalTitle;
        let iconUrl = this.originalFavicon;

        switch (settings.type) {
            case 'preset':
                const preset = this.presets.find(p => p.id === settings.id);
                if (preset) {
                    title = preset.title;
                    iconUrl = preset.live ? this.originalFavicon : preset.favicon;
                    if (preset.live) {
                        this._updateLiveTime();
                        this.liveInterval = setInterval(() => this._updateLiveTime(), 1000);
                    }
                }
                break;
            case 'custom':
                title = settings.title || this.originalTitle;
                iconUrl = settings.favicon || this.originalFavicon;
                break;
            case 'none':
            default:
                // Revert to original, title and iconUrl are already set
                break;
        }

        document.title = title;
        this.applyCustomFavicon(iconUrl);
    },

    /**
     * Sets just the favicon, drawing it to a canvas to handle scaling and CORS.
     * @param {string} iconUrl - The URL of the icon to apply.
     */
    applyCustomFavicon: function(iconUrl) {
        const targetIconUrl = iconUrl || this.originalFavicon;
        if (!targetIconUrl) return;

        let favicon = document.querySelector("link[rel*='icon']");
        if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
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
            
            ctx.clearRect(0, 0, size, size);
            ctx.drawImage(img, 0, 0, size, size);

            favicon.href = canvas.toDataURL('image/png');
        };

        img.onerror = () => {
            console.error(`URL Changer: Failed to load favicon from "${targetIconUrl}".`);
            favicon.href = this.originalFavicon; // Fallback
        };

        img.src = targetIconUrl;
    },

    /**
     * Saves the user's settings to localStorage and applies them.
     * @param {object} settings - The settings object to save.
     */
    savePreset: function(settings) {
        localStorage.setItem('selectedUrlPreset', JSON.stringify(settings));
        this.applyPreset(settings);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    urlChanger.init();
});

