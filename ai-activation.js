/**
 * ai-activation.js
 *
 * Injects a fully-featured AI chat interface into the current page.
 *
 * Activation:
 * - Press Shift + Ctrl + A to toggle the AI interface.
 *
 * Features:
 * - A dark, blurred overlay for focus mode.
 * - A translucent, round input box at the top of the screen with a white pulsing effect.
 * - After a question is submitted, the input box smoothly glides to the bottom to display the response.
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

        // Create the main chat bubble
        const chatBubble = document.createElement('div');
        chatBubble.id = 'ai-chat-bubble';

        // Create the input field
        const input = document.createElement('input');
        input.id = 'ai-input';
        input.type = 'text';
        input.placeholder = 'Ask a question...';
        input.autocomplete = 'off';
        input.onkeydown = handleInputSubmission;

        // Create the response area (initially hidden)
        const responseArea = document.createElement('div');
        responseArea.id = 'ai-response-area';
        responseArea.innerHTML = '<div class="ai-placeholder">The AI response will appear here.</div>';


        chatBubble.appendChild(input);
        chatBubble.appendChild(responseArea);
        container.appendChild(closeButton);
        container.appendChild(chatBubble);
        document.body.appendChild(container);

        // Trigger fade-in animation
        setTimeout(() => {
            container.style.opacity = '1';
            chatBubble.style.transform = 'translateX(-50%) scale(1)';
            chatBubble.style.opacity = '1';
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
                showTemporaryMessage(`Please wait ${Math.ceil((COOLDOWN_PERIOD - (now - lastRequestTime)) / 1000)}s.`);
                return;
            }

            isRequestPending = true;
            lastRequestTime = now;
            input.disabled = true;

            const chatBubble = document.getElementById('ai-chat-bubble');
            const responseArea = document.getElementById('ai-response-area');
            
            // Animate bubble to the bottom
            chatBubble.classList.add('glided-down');
            
            // Show loading state
            responseArea.style.display = 'block';
            responseArea.innerHTML = '<div class="ai-loader"></div>';

            // Hide input, show response area
            input.style.display = 'none';

            callGoogleAI(query);
        }
    }
    
    /**
     * Displays a temporary message in the response area.
     * @param {string} message - The message to display.
     */
    function showTemporaryMessage(message) {
        const responseArea = document.getElementById('ai-response-area');
        if(!responseArea) return;

        const originalContent = responseArea.innerHTML;
        responseArea.innerHTML = `<div class="ai-temp-message">${message}</div>`;
        responseArea.style.display = 'block';

        const input = document.getElementById('ai-input');
        if (input) input.style.display = 'none';
        
        setTimeout(() => {
            responseArea.innerHTML = originalContent;
            if(!document.getElementById('ai-chat-bubble').classList.contains('glided-down')) {
                 responseArea.style.display = 'none';
                 if (input) input.style.display = 'block';
            }
        }, 2000);
    }

    /**
     * Calls the Google AI API with the user's query.
     * @param {string} query - The user's question.
     */
    async function callGoogleAI(query) {
        const responseArea = document.getElementById('ai-response-area');
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
            responseArea.innerHTML = `<div class="ai-response-content">${formattedText}</div>`;

        } catch (error) {
            console.error('AI API Error:', error);
            responseArea.innerHTML = `<div class="ai-error">Sorry, I couldn't get a response. Please check the API key and console for errors.</div>`;
        } finally {
            // After getting a response, show the input again at the bottom for follow-up questions.
            const input = document.getElementById('ai-input');
            input.style.display = 'block';
            input.disabled = false;
            input.value = '';
            input.placeholder = 'Ask a follow-up...';
            input.focus();
            isRequestPending = false;
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
                background-color: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                z-index: 2147483647;
                opacity: 0;
                transition: opacity 0.3s ease;
                font-family: 'secondaryfont', sans-serif;
            }

            #ai-close-button {
                position: absolute;
                top: 20px;
                right: 30px;
                color: rgba(255, 255, 255, 0.7);
                font-size: 40px;
                cursor: pointer;
                transition: color 0.2s ease;
            }

            #ai-close-button:hover {
                color: white;
            }

            #ai-chat-bubble {
                position: absolute;
                top: 20%;
                left: 50%;
                transform: translateX(-50%) scale(0.9);
                width: 90%;
                max-width: 600px;
                background: rgba(25, 25, 30, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 40px;
                padding: 10px;
                box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
                backdrop-filter: blur(15px);
                -webkit-backdrop-filter: blur(15px);
                animation: pulse 2s infinite;
                transition: top 0.8s cubic-bezier(0.68, -0.55, 0.27, 1.55), opacity 0.4s ease, transform 0.4s ease;
                opacity: 0;
            }
            
            #ai-chat-bubble.glided-down {
                top: 85%;
                transform: translateX(-50%) translateY(-100%);
                animation: none; /* Stop pulsing when it's showing a response */
            }

            #ai-input {
                width: 100%;
                height: 60px;
                border: none;
                outline: none;
                background: transparent;
                color: white;
                font-size: 1.2em;
                padding: 0 25px;
                box-sizing: border-box;
            }
            
            #ai-input::placeholder {
                color: rgba(255, 255, 255, 0.5);
            }

            #ai-response-area {
                display: none;
                padding: 20px 30px;
                color: #e0e0e0;
                max-height: 50vh;
                overflow-y: auto;
            }

            .ai-placeholder, .ai-error, .ai-temp-message {
                text-align: center;
                color: rgba(255, 255, 255, 0.6);
            }
            
            .ai-error {
                color: #ff8a80;
            }
            
            .ai-response-content {
                line-height: 1.6;
            }

            .ai-loader {
                width: 30px;
                height: 30px;
                border: 3px solid rgba(255, 255, 255, 0.3);
                border-top-color: #fff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 20px auto;
            }

            @keyframes pulse {
                0% {
                    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.4);
                }
                70% {
                    box-shadow: 0 0 0 15px rgba(255, 255, 255, 0);
                }
                100% {
                    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0);
                }
            }
            
            @keyframes spin {
                to {
                    transform: rotate(360deg);
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Attach the main listener to the window
    document.addEventListener('keydown', handleKeyDown);

})();
