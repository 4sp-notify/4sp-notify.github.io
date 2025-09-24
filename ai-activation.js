/**
 * ai-activation.js
 *
 * Injects a fully-featured AI chat interface into the current page.
 *
 * Activation:
 * - Press Shift + Ctrl + A to toggle the AI interface.
 *
 * Features:
 * - A dark, heavily blurred overlay for focus mode.
 * - A translucent, static black input box at the bottom of the screen with a white glow effect.
 * - AI responses appear in a scrollable area above the input box.
 * - Communicates with the Google AI API (Gemini) to get answers.
 * - A 5-second cooldown between requests to prevent spamming.
 * - An 'X' button to easily exit the AI mode.
 * - All styles and HTML are injected dynamically, requiring no external files.
 */

(function() {
    // --- CONFIGURATION ---
    // IMPORTANT: Replace this with your actual Google AI Studio API key.
    const API_KEY = 'AIzaSyDcoUA4Js1oOf1nz53RbLaxUzD0GxTmKXA';
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEY}`;

    // --- STATE MANAGEMENT ---
    let isAIActive = false;
    let isRequestPending = false;
    let lastRequestTime = 0;
    const COOLDOWN_PERIOD = 5000; // 5 seconds in milliseconds

    /**
     * Handles the keyboard shortcut for activating/deactivating the AI.
     * @param {KeyboardEvent} e - The keyboard event.
     */
    function handleKeyDown(e) {
        // Activate with Shift + Ctrl + A
        if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            toggleAIInterface();
        }
    }

    /**
     * Toggles the visibility of the AI interface.
     */
    function toggleAIInterface() {
        if (isAIActive) {
            deactivateAI();
        } else {
            activateAI();
        }
    }

    /**
     * Creates and injects the AI interface and its styles into the page.
     */
    function activateAI() {
        if (document.getElementById('ai-container')) return; // Already active

        // Inject styles
        injectStyles();

        // Create main container
        const container = document.createElement('div');
        container.id = 'ai-container';

        // Create close button
        const closeButton = document.createElement('div');
        closeButton.id = 'ai-close-button';
        closeButton.innerHTML = '&times;';
        closeButton.onclick = deactivateAI;

        // Create the response container
        const responseContainer = document.createElement('div');
        responseContainer.id = 'ai-response-container';

        // Create the input container (the static box at the bottom)
        const inputContainer = document.createElement('div');
        inputContainer.id = 'ai-input-container';

        // Create the input field
        const input = document.createElement('input');
        input.id = 'ai-input';
        input.type = 'text';
        input.placeholder = 'Ask a question...';
        input.autocomplete = 'off';
        input.onkeydown = handleInputSubmission;

        inputContainer.appendChild(input);
        container.appendChild(closeButton);
        container.appendChild(responseContainer);
        container.appendChild(inputContainer);
        document.body.appendChild(container);

        // Trigger fade-in animation
        setTimeout(() => {
            container.style.opacity = '1';
            inputContainer.style.transform = 'translate(-50%, 0)';
            inputContainer.style.opacity = '1';
        }, 10);

        input.focus();
        isAIActive = true;
    }

    /**
     * Removes the AI interface from the page.
     */
    function deactivateAI() {
        const container = document.getElementById('ai-container');
        if (container) {
            container.style.opacity = '0';
            // Wait for the fade-out animation to complete before removing the element
            setTimeout(() => {
                container.remove();
                const styles = document.getElementById('ai-dynamic-styles');
                if (styles) styles.remove();
            }, 300);
        }
        isAIActive = false;
    }

    /**
     * Handles the submission of a question via the 'Enter' key.
     * @param {KeyboardEvent} e - The keyboard event from the input field.
     */
    function handleInputSubmission(e) {
        if (e.key === 'Enter') {
            const input = e.target;
            const query = input.value.trim();

            if (!query || isRequestPending) return;

            const now = Date.now();
            if (now - lastRequestTime < COOLDOWN_PERIOD) {
                // This is a temporary visual cue for cooldown, shown in the response area
                const responseContainer = document.getElementById('ai-response-container');
                const coolDownMsg = document.createElement('div');
                coolDownMsg.className = 'ai-message-bubble ai-temp-message';
                coolDownMsg.textContent = `Please wait ${Math.ceil((COOLDOWN_PERIOD - (now - lastRequestTime)) / 1000)}s.`;
                responseContainer.appendChild(coolDownMsg);
                responseContainer.scrollTop = responseContainer.scrollHeight;
                setTimeout(() => coolDownMsg.remove(), 2000);
                return;
            }

            isRequestPending = true;
            lastRequestTime = now;
            input.disabled = true;

            const responseContainer = document.getElementById('ai-response-container');
            
            // Create a new bubble for the response
            const responseBubble = document.createElement('div');
            responseBubble.className = 'ai-message-bubble';
            responseBubble.innerHTML = '<div class="ai-loader"></div>';
            responseContainer.appendChild(responseBubble);

            // Auto-scroll to the bottom
            responseContainer.scrollTop = responseContainer.scrollHeight;

            callGoogleAI(query, responseBubble);
        }
    }

    /**
     * Calls the Google AI API with the user's query.
     * @param {string} query - The user's question.
     * @param {HTMLElement} responseBubble - The element to populate with the response.
     */
    async function callGoogleAI(query, responseBubble) {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: query
                        }]
                    }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error.message || 'Network response was not ok.');
            }

            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;
            // A simple way to format the response text
            const formattedText = text.replace(/\n/g, '<br>');
            responseBubble.innerHTML = `<div class="ai-response-content">${formattedText}</div>`;

        } catch (error) {
            console.error('AI API Error:', error);
            responseBubble.innerHTML = `<div class="ai-error">Sorry, I couldn't get a response. Please check the API key and console for errors.</div>`;
        } finally {
            const input = document.getElementById('ai-input');
            input.disabled = false;
            input.value = '';
            input.placeholder = 'Ask a follow-up...';
            input.focus();
            isRequestPending = false;
            
            const responseContainer = document.getElementById('ai-response-container');
            responseContainer.scrollTop = responseContainer.scrollHeight;
        }
    }

    /**
     * Injects all necessary CSS into a <style> tag in the document's <head>.
     */
    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;

        const style = document.createElement('style');
        style.id = 'ai-dynamic-styles';
        style.innerHTML = `
            @font-face {
                font-family: 'secondaryfont';
                src: url('../fonts/secondary.woff') format('woff');
                font-weight: normal;
                font-style: normal;
            }

            #ai-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background-color: rgba(0, 0, 0, 0.75);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                z-index: 2147483647;
                opacity: 0;
                transition: opacity 0.5s cubic-bezier(0.25, 1, 0.5, 1);
                font-family: 'secondaryfont', sans-serif;
            }

            #ai-close-button {
                position: absolute;
                top: 20px;
                right: 30px;
                color: rgba(255, 255, 255, 0.7);
                font-size: 40px;
                cursor: pointer;
                transition: color 0.2s ease, transform 0.3s ease;
            }

            #ai-close-button:hover {
                color: white;
                transform: scale(1.1);
            }

            #ai-input-container {
                position: fixed;
                bottom: 30px;
                left: 50%;
                transform: translate(-50%, 100px); /* Initial position for slide-in */
                width: 90%;
                max-width: 800px;
                background: rgba(10, 10, 10, 0.7);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 30px;
                padding: 5px;
                box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                animation: glow 2.5s infinite;
                transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.6s ease;
                opacity: 0;
            }
            
            #ai-input {
                width: 100%;
                height: 50px;
                border: none;
                outline: none;
                background: transparent;
                color: white;
                font-size: 1.1em;
                padding: 0 20px;
                box-sizing: border-box;
            }
            
            #ai-input::placeholder {
                color: rgba(255, 255, 255, 0.5);
            }
            
            #ai-response-container {
                position: absolute;
                bottom: 110px;
                left: 50%;
                transform: translateX(-50%);
                width: 90%;
                max-width: 800px;
                max-height: calc(100vh - 150px);
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 15px;
            }

            .ai-message-bubble {
                background: rgba(25, 25, 30, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 20px;
                padding: 15px 20px;
                color: #e0e0e0;
                backdrop-filter: blur(15px);
                -webkit-backdrop-filter: blur(15px);
                animation: fadeIn 0.5s ease forwards;
                opacity: 0;
            }

            .ai-error, .ai-temp-message {
                text-align: center;
                color: rgba(255, 255, 255, 0.7);
            }
            
            .ai-error {
                color: #ff8a80;
            }
            
            .ai-response-content {
                line-height: 1.6;
            }

            .ai-loader {
                width: 25px;
                height: 25px;
                border: 3px solid rgba(255, 255, 255, 0.3);
                border-top-color: #fff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto;
            }

            @keyframes glow {
                0% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.2), 0 0 10px rgba(255, 255, 255, 0.1); }
                50% { box-shadow: 0 0 15px rgba(255, 255, 255, 0.5), 0 0 25px rgba(255, 255, 255, 0.3); }
                100% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.2), 0 0 10px rgba(255, 255, 255, 0.1); }
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }

            @keyframes fadeIn {
                to { opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    // Attach the main listener to the window
    document.addEventListener('keydown', handleKeyDown);

})();

