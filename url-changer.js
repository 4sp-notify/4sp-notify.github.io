/**
 * url-changer.js
 * Manages dynamic changing of the website's title and favicon.
 * Supports presets, live data (like a clock), and custom user input.
 * Settings are saved to localStorage to persist across sessions.
 */

const urlChanger = {
    // --- Configuration: Add new presets here ---
    presets: [
        { name: 'HAC', title: 'Login', favicon: '../favicons/hac.png', category: 'websites', id: 'hac' },
        { name: 'GMM', title: 'Get More Math!', favicon: '../favicons/gmm.png', category: 'websites', id: 'gmm' },
        { name: 'Kahoot', title: 'Kahoot! | Learning games | Make learning awesome!', favicon: '../favicons/kahoot.png', category: 'websites', id: 'kahoot' },
        { name: 'Google Classroom', title: 'Home', favicon: '../favicons/google-classroom.png', category: 'websites', id: 'g_classroom'},
        { name: 'Google Docs', title: 'Google Docs', favicon: '../favicons/google-docs.png', category: 'websites', id: 'g_docs'},
        { name: 'Google Slides', title: 'Google Slides', favicon: '../favicons/google-slides.png', category: 'websites', id: 'g_slides'},
        { name: 'Google Drive', title: 'Home - Google Drive', favicon: '../favicons/google-drive.png', category: 'websites', id: 'g_drive'},
        { name: 'Wikipedia', title: 'Wikipedia', favicon: '../favicons/wikipedia.png', category: 'websites', id: 'wikipedia'},
        { name: 'Clever', title: 'Clever | Connect every student to a world of learning', favicon: '../favicons/clever.png', category: 'websites', id: 'clever'},
        
        // New 'Live' Category
        // Favicon is intentionally blank; it will be dynamically set to the original favicon.
        { name: 'Current Time', title: '00:00:00 AM', favicon: '', category: 'live', id: '_LIVE_CURRENT_TIME' }
    ],

    // --- Internal Properties ---
    originalTitle: '',
    originalFavicon: '',
    liveUpdateInterval: null, // To hold the interval for the clock

    /**
     * Initializes the script, captures original page state, and applies saved settings.
     */
    init: function() {
        console.log("Debug: url-changer.js script has started.");

        this.originalTitle = document.title;
        const faviconElement = document.querySelector("link[rel*='icon']");
        this.originalFavicon = faviconElement ? faviconElement.href : '../favicon.ico';

        // Set the favicon for the live preset dynamically
        const livePreset = this.presets.find(p => p.id === '_LIVE_CURRENT_TIME');
        if (livePreset) {
            livePreset.favicon = this.originalFavicon;
        }

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
     * Clears any ongoing live updates, like the clock interval.
     */
    clearLiveUpdates: function() {
        if (this.liveUpdateInterval) {
            clearInterval(this.liveUpdateInterval);
            this.liveUpdateInterval = null;
        }
    },

    /**
     * Applies a given preset configuration by changing the title and favicon.
     * @param {object} settings - The settings object ({type, name, id, title, favicon}).
     */
    applyPreset: function(settings) {
        this.clearLiveUpdates(); // Stop any previous live updates first.

        let presetToApply = {};

        switch(settings.type) {
            case 'preset':
                const foundPreset = this.presets.find(p => p.id === settings.id);
                if (!foundPreset) {
                    console.warn(`URL Changer: Preset with ID "${settings.id}" not found.`);
                    return this.applyPreset({ type: 'none' });
                }
                presetToApply = { ...foundPreset };
                break;
            
            case 'custom':
                if (!settings.title && !settings.favicon) {
                     return this.applyPreset({ type: 'none' });
                }
                presetToApply = {
                    title: settings.title || this.originalTitle,
                    favicon: settings.favicon || this.originalFavicon
                };
                break;

            case 'none':
            default:
                presetToApply = {
                    title: this.originalTitle,
                    favicon: this.originalFavicon
                };
                break;
        }

        // Handle special "Live" presets like the clock
        if (presetToApply.id === '_LIVE_CURRENT_TIME') {
            const updateClock = () => {
                const now = new Date();
                const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                document.title = timeString;
            };
            updateClock(); // Initial call to set time immediately
            this.liveUpdateInterval = setInterval(updateClock, 1000);
        } else {
            document.title = presetToApply.title;
        }

        // Set the favicon
        let faviconEl = document.querySelector("link[rel*='icon']");
        if (!faviconEl) {
            faviconEl = document.createElement('link');
            faviconEl.rel = 'icon';
            document.head.appendChild(faviconEl);
        }

        if (!presetToApply.favicon) {
            faviconEl.href = this.originalFavicon;
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
            
            ctx.imageSmoothingEnabled = false; // Keep low-res icons sharp

            const scale = Math.min(size / img.width, size / img.height);
            const scaledWidth = img.width * scale;
            const scaledHeight = img.height * scale;
            const x = (size - scaledWidth) / 2;
            const y = (size - scaledHeight) / 2;
            
            ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
            faviconEl.href = canvas.toDataURL('image/png');
        };

        img.onerror = () => {
            console.error(`URL Changer: Failed to load favicon image at "${presetToApply.favicon}". Reverting to original.`);
            faviconEl.href = this.originalFavicon;
        };

        img.src = presetToApply.favicon;
    },

    /**
     * Saves the user's settings to localStorage and applies them.
     * @param {object} settings - The settings object to save.
     */
    savePreset: function(settings) {
        localStorage.setItem('selectedUrlPreset', JSON.stringify(settings));
        this.applyPreset(settings);
        console.log(`Debug: Saved settings to localStorage:`, settings);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    urlChanger.init();
});

