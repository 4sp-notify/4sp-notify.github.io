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
    originalFavicon: '../favicon.ico',
    liveInterval: null,
    customFavicons: [],
    CUSTOM_FAVICONS_KEY: 'tabDisguiseCustomFavicons',


    /**
     * Initializes the script. Captures original page state and applies any saved preset.
     */
    init: function() {
        this.originalTitle = document.title;
        const faviconElement = document.querySelector("link[rel*='icon']");
        this.originalFavicon = faviconElement ? faviconElement.href : '';
        
        this.loadCustomFavicons();

        const savedSettingsJSON = localStorage.getItem('selectedUrlPreset');
        let savedSettings = { type: 'none' }; // Default to 'none'
        if (savedSettingsJSON) {
            try {
                savedSettings = JSON.parse(savedSettingsJSON);
            } catch (e) {
                console.error("Failed to parse saved tab settings, reverting to default.", e);
                // savedSettings is already { type: 'none' }
            }
        }
        this.applyPreset(savedSettings);
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

        let titleToSet = this.originalTitle;
        let iconToSet = this.originalFavicon;

        if (settings && settings.type) {
            switch (settings.type) {
                case 'preset':
                    const preset = this.presets.find(p => p.id === settings.id);
                    if (preset) {
                        titleToSet = preset.title;
                        iconToSet = preset.live ? this.originalFavicon : preset.favicon;
                        if (preset.live) {
                            this._updateLiveTime();
                            this.liveInterval = setInterval(() => this._updateLiveTime(), 1000);
                        }
                    }
                    break;
                case 'custom':
                    // Explicitly handle custom settings, falling back to originals if not provided
                    titleToSet = settings.title || this.originalTitle;
                    iconToSet = settings.favicon || this.originalFavicon;
                    break;
                case 'none':
                default:
                    // Title and icon are already set to defaults, so no action is needed.
                    break;
            }
        }

        document.title = titleToSet;
        this.applyCustomFavicon(iconToSet);
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
        
        let finalUrlToLoad = targetIconUrl;
        if (finalUrlToLoad.startsWith('https://')) { // Add cache-busting only to external URLs
            finalUrlToLoad += (finalUrlToLoad.includes('?') ? '&' : '?') + '_=' + new Date().getTime();
        }
        img.src = finalUrlToLoad;
    },
    
    // --- NEW: Robust Favicon Fetching ---
    _faviconServices: [
        hostname => `https://www.google.com/s2/favicons?sz=64&domain_url=${hostname}`,
        hostname => `https://icons.duckduckgo.com/ip3/${hostname}.ico`,
    ],

    _checkImage: function(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(url);
            img.onerror = () => reject(new Error(`Image failed to load: ${url}`));
            img.src = url + (url.includes('?') ? '&' : '?') + '_=' + new Date().getTime(); // Cache bust
        });
    },

    fetchFavicon: async function(domain) {
        let hostname;
        try {
            hostname = new URL(domain).hostname;
        } catch (e) {
            return Promise.reject(new Error("Invalid URL provided."));
        }

        const urlsToTry = this._faviconServices.map(service => service(hostname));
        for (const url of urlsToTry) {
            try {
                const workingUrl = await this._checkImage(url);
                return workingUrl; // Return the first URL that loads successfully
            } catch (error) {
                console.warn(error.message); // Log failure and try next service
            }
        }
        return Promise.reject(new Error(`Could not find a favicon for ${hostname}.`));
    },
    
    // --- Settings Persistence ---
    savePreset: function(settings) {
        localStorage.setItem('selectedUrlPreset', JSON.stringify(settings));
        this.applyPreset(settings);
    },
    
    loadCustomFavicons: function() {
        const stored = localStorage.getItem(this.CUSTOM_FAVICONS_KEY);
        if (stored) {
            try { this.customFavicons = JSON.parse(stored); } catch (e) { this.customFavicons = []; }
        }
    },
    
    _saveCustomFavicons: function() {
        localStorage.setItem(this.CUSTOM_FAVICONS_KEY, JSON.stringify(this.customFavicons));
    },

    addCustomFavicon: function(url) {
        if (url && !this.customFavicons.includes(url)) {
            this.customFavicons.push(url);
            this._saveCustomFavicons();
        }
    },

    removeCustomFavicon: function(url) {
        this.customFavicons = this.customFavicons.filter(iconUrl => iconUrl !== url);
        this._saveCustomFavicons();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    urlChanger.init();
});
