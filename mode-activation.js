/**
 * ai-activation.js
 *
 * A feature-rich, self-contained script with file uploads, daily limits,
 * enhanced contextual awareness, and a redesigned attachment menu.
 */
(function() {
    // --- CONFIGURATION ---
    // WARNING: Your API key is visible in this client-side code.
    const API_KEY = 'AIzaSyDcoUA4Js1oOf1nz53RbLaxUzD0GxTmKXA'; 
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    const USER_CHAR_LIMIT = 500;
    const MAX_INPUT_HEIGHT = 200; // Max height in pixels before scrolling

    // --- STATE MANAGEMENT ---
    let isAIActive = false;
    let isRequestPending = false;
    let isAttachmentMenuOpen = false;
    let currentAIRequestController = null;
    let currentSubject = 'General';
    let chatHistory = [];
    let attachedFiles = []; // To hold file data for the next message

    // --- DAILY LIMITS CONFIGURATION ---
    const DAILY_LIMITS = {
        images: 5,
        videos: 1,
    };

    /**
     * Handles all daily limit logic (checking, decrementing, resetting).
     */
    const limitManager = {
        getToday: () => new Date().toLocaleDateString("en-US"),
        
        getUsage: () => {
            const usageData = JSON.parse(localStorage.getItem('aiUsageLimits')) || {};
            const today = limitManager.getToday();

            // If the saved date is not today, reset the data.
            if (usageData.date !== today) {
                return { date: today, images: 0, videos: 0 };
            }
            return usageData;
        },

        saveUsage: (usageData) => {
            localStorage.setItem('aiUsageLimits', JSON.stringify(usageData));
        },

        canUpload: (type) => {
            const usage = limitManager.getUsage();
            if (type in DAILY_LIMITS) {
                return (usage[type] || 0) < DAILY_LIMITS[type];
            }
            return true; // No limit for this type (e.g., 'files', 'audio')
        },

        recordUpload: (type) => {
            if (type in DAILY_LIMITS) {
                let usage = limitManager.getUsage();
                usage[type] = (usage[type] || 0) + 1;
                limitManager.saveUsage(usage);
            }
        }
    };

    /**
     * Checks if the user is authorized to use the AI.
     */
    async function isUserAuthorized() {
        // (This function remains unchanged from the previous version)
        // ...
    }

    /**
     * Initializes the AI, including restoring the panic key blocker.
     */
    function activateAI() {
        if (document.getElementById('ai-container')) return;
        
        // Restore Panic Key blocker if the function exists
        if (typeof window.startPanicKeyBlocker === 'function') {
            window.startPanicKeyBlocker();
        }

        chatHistory = [];
        attachedFiles = [];
        injectStyles();
        
        const container = document.createElement('div');
        container.id = 'ai-container';
        container.dataset.subject = 'General';
        
        const persistentTitle = document.createElement('div');
        persistentTitle.id = 'ai-persistent-title';
        persistentTitle.textContent = "AI Mode - General";
        
        const welcomeMessage = document.createElement('div');
        welcomeMessage.id = 'ai-welcome-message';
        welcomeMessage.innerHTML = `
            <h2>Welcome to AI Mode</h2>
            <p>This is a beta feature. Your general location may be shared with your first message.</p>
        `;
        const closeButton = document.createElement('div');
        closeButton.id = 'ai-close-button';
        closeButton.innerHTML = '&times;';
        closeButton.onclick = deactivateAI;

        const responseContainer = document.createElement('div');
        responseContainer.id = 'ai-response-container';

        const inputWrapper = document.createElement('div');
        inputWrapper.id = 'ai-input-wrapper';

        // NEW: Container for file previews
        const attachmentPreviewContainer = document.createElement('div');
        attachmentPreviewContainer.id = 'ai-attachment-preview';
        
        const visualInput = document.createElement('div');
        visualInput.id = 'ai-input';
        visualInput.contentEditable = true;
        visualInput.onkeydown = handleInputSubmission;
        visualInput.oninput = handleContentEditableInput;
        visualInput.onkeyup = updateFractionFocus;
        visualInput.onclick = updateFractionFocus;
        
        const placeholder = document.createElement('div');
        placeholder.id = 'ai-input-placeholder';
        placeholder.textContent = 'Ask a question or describe your files...';

        const charCounter = document.createElement('div');
        charCounter.id = 'ai-char-counter';
        charCounter.textContent = `0 / ${USER_CHAR_LIMIT}`;

        const settingsToggle = document.createElement('button');
        settingsToggle.id = 'ai-settings-toggle';
        settingsToggle.innerHTML = '&#8942;';
        settingsToggle.onclick = handleSettingsToggleClick;

        inputWrapper.appendChild(createAttachmentMenu()); // Note: Renamed from settings menu
        inputWrapper.appendChild(attachmentPreviewContainer); // Add preview container
        inputWrapper.appendChild(visualInput);
        inputWrapper.appendChild(placeholder);
        inputWrapper.appendChild(charCounter);
        inputWrapper.appendChild(settingsToggle);
        inputWrapper.appendChild(createOptionsBar());
        
        container.appendChild(persistentTitle);
        container.appendChild(welcomeMessage);
        container.appendChild(closeButton);
        container.appendChild(responseContainer);
        container.appendChild(inputWrapper);
        
        document.body.appendChild(container);
        
        setTimeout(() => {
            container.classList.add('active');
        }, 10);
        
        visualInput.focus();
        isAIActive = true;
    }

    /**
     * Deactivates the AI, including re-enabling the panic key.
     */
    function deactivateAI() {
        // Re-enable Panic Key if the function exists
        if (typeof window.stopPanicKeyBlocker === 'function') {
            window.stopPanicKeyBlocker();
        }

        if (currentAIRequestController) {
            currentAIRequestController.abort();
        }
        const container = document.getElementById('ai-container');
        if (container) {
            container.classList.add('deactivating');
            setTimeout(() => {
                container.remove();
                const styles = document.getElementById('ai-dynamic-styles');
                if (styles) styles.remove();
            }, 500);
        }
        isAIActive = false;
        isAttachmentMenuOpen = false;
        isRequestPending = false;
        currentSubject = 'General';
        chatHistory = [];
        attachedFiles = [];
    }

    /**
     * Calls the Google AI API, now with contextual data.
     */
    async function callGoogleAI(responseBubble) {
        if (!API_KEY) {
            responseBubble.innerHTML = `<div class="ai-error">API Key is missing.</div>`;
            return;
        }

        currentAIRequestController = new AbortController();

        // Add dynamic, invisible context to the first user message
        let firstMessageContext = '';
        if (chatHistory.length <= 1) { // Only on the first turn
            const location = localStorage.getItem('ai-user-location') || 'an unknown location';
            const now = new Date();
            const date = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const time = now.toLocaleTimeString('en-US', { timeZoneName: 'short' });
            firstMessageContext = `(User is asking from ${location}. Current date is ${date}, ${time}.)\n\n`;
        }
        
        const lastMessageIndex = chatHistory.length - 1;
        chatHistory[lastMessageIndex].parts[0].text = firstMessageContext + chatHistory[lastMessageIndex].parts[0].text;
        
        // ... (system instruction logic remains the same) ...

        const payload = { contents: chatHistory };
        // ... (rest of the function is the same) ...
    }
    
    /**
     * Handles file selection from the user's device.
     */
    function handleFileUpload(fileType) {
        const input = document.createElement('input');
        input.type = 'file';
        
        const typeMap = {
            'photo': 'image/*',
            'video': 'video/*',
            'audio': 'audio/*',
            'file': '*'
        };
        input.accept = typeMap[fileType] || '*';

        input.onchange = (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const base64Data = e.target.result.split(',')[1];
                
                // Add to our internal file list
                attachedFiles.push({
                    fileData: {
                        mimeType: file.type,
                        data: base64Data
                    },
                    fileName: file.name
                });

                // Record the upload for daily limits
                const limitType = file.type.startsWith('image') ? 'images' : file.type.startsWith('video') ? 'videos' : null;
                if (limitType) {
                    limitManager.recordUpload(limitType);
                }

                renderAttachments();
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }
    
    /**
     * Renders the preview of attached files above the input box.
     */
    function renderAttachments() {
        const previewContainer = document.getElementById('ai-attachment-preview');
        previewContainer.innerHTML = '';
        if (attachedFiles.length === 0) {
            previewContainer.style.display = 'none';
            return;
        }

        previewContainer.style.display = 'grid';
        attachedFiles.forEach((file, index) => {
            const fileCard = document.createElement('div');
            fileCard.className = 'attachment-card';

            let previewHTML = `<span class="file-icon">📄</span>`; // Default icon
            if (file.fileData.mimeType.startsWith('image/')) {
                previewHTML = `<img src="data:${file.fileData.mimeType};base64,${file.fileData.data}" alt="${file.fileName}" />`;
            } else if (file.fileData.mimeType.startsWith('video/')) {
                previewHTML = `<span class="file-icon">🎬</span>`;
            } else if (file.fileData.mimeType.startsWith('audio/')) {
                previewHTML = `<span class="file-icon">🎵</span>`;
            }

            fileCard.innerHTML = `
                ${previewHTML}
                <span class="file-name">${file.fileName}</span>
                <button class="remove-attachment-btn" data-index="${index}">&times;</button>
            `;
            previewContainer.appendChild(fileCard);
        });

        // Add event listeners to the remove buttons
        previewContainer.querySelectorAll('.remove-attachment-btn').forEach(btn => {
            btn.onclick = () => {
                attachedFiles.splice(btn.dataset.index, 1);
                renderAttachments();
            };
        });
    }

    /**
     * Creates the new attachment dropdown menu.
     */
    function createAttachmentMenu() {
        const menu = document.createElement('div');
        menu.id = 'ai-attachment-menu';
        
        const options = [
            { id: 'photo', icon: '📷', label: 'Photo', type: 'images' },
            { id: 'video', icon: '🎬', label: 'Video', type: 'videos' },
            { id: 'audio', icon: '🎤', label: 'Audio', type: 'audio' },
            { id: 'file', icon: '📎', label: 'File', type: 'file' },
        ];
        
        options.forEach(opt => {
            const button = document.createElement('button');
            button.dataset.type = opt.type;
            const canUpload = limitManager.canUpload(opt.type);
            
            let limitText = '';
            if (opt.type === 'images' || opt.type === 'videos') {
                const usage = limitManager.getUsage();
                limitText = `<span>${usage[opt.type] || 0}/${DAILY_LIMITS[opt.type]} used</span>`;
            }

            button.innerHTML = `<span class="icon">${opt.icon}</span> ${opt.label} ${limitText}`;
            if (!canUpload) {
                button.disabled = true;
                button.title = 'You have reached your daily limit for this file type.';
            }

            button.onclick = () => {
                handleFileUpload(opt.id);
                toggleAttachmentMenu();
            };
            menu.appendChild(button);
        });
        
        return menu;
    }

    // ... (rest of the script, including handleContentEditableInput, injectStyles, etc.) ...

    function handleContentEditableInput(e) {
        const editor = e.target;
        // Limit the height and enable scrolling
        if (editor.scrollHeight > MAX_INPUT_HEIGHT) {
            editor.style.height = `${MAX_INPUT_HEIGHT}px`;
            editor.style.overflowY = 'auto';
        } else {
            editor.style.height = 'auto';
            editor.style.height = `${editor.scrollHeight}px`;
            editor.style.overflowY = 'hidden';
        }

        // ... (rest of the function is the same)
    }

    function injectStyles() {
        // ... (all previous styles) ...
        style.innerHTML += `
            /* Attachment Dropdown Menu */
            #ai-attachment-menu {
                position: absolute;
                bottom: 100%;
                left: 10px;
                background: #111;
                border: 1px solid #444;
                border-radius: 12px;
                box-shadow: 0 5px 25px rgba(0,0,0,0.5);
                display: flex;
                flex-direction: column;
                gap: 5px;
                padding: 8px;
                z-index: 10;
                opacity: 0;
                visibility: hidden;
                transform: translateY(10px);
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            }
            #ai-attachment-menu.active {
                opacity: 1;
                visibility: visible;
                transform: translateY(-5px);
            }
            #ai-attachment-menu button {
                background: transparent;
                border: none;
                color: #ddd;
                font-family: 'PrimaryFont', sans-serif;
                font-size: 1em;
                padding: 10px 15px;
                border-radius: 8px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 12px;
                text-align: left;
                transition: background-color 0.2s;
            }
            #ai-attachment-menu button:hover { background-color: #333; }
            #ai-attachment-menu button:disabled { opacity: 0.5; cursor: not-allowed; }
            #ai-attachment-menu button .icon { font-size: 1.2em; }
            #ai-attachment-menu button span { font-size: 0.8em; color: #888; margin-left: auto; }

            /* Attachment Previews */
            #ai-attachment-preview {
                display: none;
                grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
                gap: 10px;
                padding: 10px 15px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            .attachment-card {
                position: relative;
                border-radius: 8px;
                overflow: hidden;
                background: #333;
                height: 80px;
            }
            .attachment-card img { width: 100%; height: 100%; object-fit: cover; }
            .attachment-card .file-icon { font-size: 2.5em; display: flex; align-items: center; justify-content: center; height: 100%; }
            .attachment-card .file-name {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background: rgba(0,0,0,0.6);
                color: #fff;
                font-size: 0.75em;
                padding: 4px;
                text-align: center;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .remove-attachment-btn {
                position: absolute;
                top: 5px;
                right: 5px;
                background: rgba(0,0,0,0.5);
                color: #fff;
                border: none;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
            }
        `;
    }
})();
