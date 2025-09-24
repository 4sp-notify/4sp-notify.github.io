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
 * - A dynamic, multi-line textarea at the bottom with a white glow effect.
 * - AI responses appear in a top-aligned, scrollable area with support for Markdown.
 * - AI response bubbles feature a Gemini-style animated gradient glow that respects borders.
 * - Communicates with the Google AI API (Gemini) to get answers.
 * - A 5-second cooldown between requests to prevent spamming.
 * - A character cap of 500 characters per user message.
 * - An 'X' button to easily exit the AI mode.
 * - All styles and HTML are injected dynamically, requiring no external files.
 */

(function() {
    // --- CONFIGURATION ---
    const API_KEY = 'AIzaSyDcoUA4Js1oOf1nz53RbLaxUzD0GxTmKXA';
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEY}`;
    const USER_CHAR_LIMIT = 500;

    // --- STATE MANAGEMENT ---
    let isAIActive = false;
    let isRequestPending = false;
    let lastRequestTime = 0;
    const COOLDOWN_PERIOD = 5000; // 5 seconds in milliseconds

    /**
     * Handles the keyboard shortcut for activating/deactivating the AI.
     */
    function handleKeyDown(e) {
        if (e.shiftKey && e.ctrlKey && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            toggleAIInterface();
        }
    }

    /**
     * Toggles the visibility of the AI interface.
     */
    function toggleAIInterface() {
        isAIActive ? deactivateAI() : activateAI();
    }

    /**
     * Creates and injects the AI interface into the page.
     */
    function activateAI() {
        if (document.getElementById('ai-container')) return;

        injectStyles();

        const container = document.createElement('div');
        container.id = 'ai-container';

        const closeButton = document.createElement('div');
        closeButton.id = 'ai-close-button';
        closeButton.innerHTML = '&times;';
        closeButton.onclick = deactivateAI;

        const responseContainer = document.createElement('div');
        responseContainer.id = 'ai-response-container';

        const inputWrapper = document.createElement('div');
        inputWrapper.id = 'ai-input-wrapper';
        
        const textarea = document.createElement('textarea');
        textarea.id = 'ai-input';
        textarea.placeholder = 'Ask a question... (Shift + Enter for new line)';
        textarea.autocomplete = 'off';
        textarea.onkeydown = handleInputSubmission;
        textarea.oninput = handleTextareaInput;
        textarea.maxLength = USER_CHAR_LIMIT;

        const charCounter = document.createElement('div');
        charCounter.id = 'ai-char-counter';
        charCounter.textContent = `0 / ${USER_CHAR_LIMIT}`;
        
        inputWrapper.appendChild(textarea);
        inputWrapper.appendChild(charCounter);
        container.appendChild(closeButton);
        container.appendChild(responseContainer);
        container.appendChild(inputWrapper);
        document.body.appendChild(container);

        setTimeout(() => {
            container.style.opacity = '1';
            inputWrapper.style.transform = 'translateY(0)';
            inputWrapper.style.opacity = '1';
        }, 10);

        textarea.focus();
        isAIActive = true;
    }

    /**
     * Removes the AI interface from the page.
     */
    function deactivateAI() {
        const container = document.getElementById('ai-container');
        if (container) {
            container.style.opacity = '0';
            setTimeout(() => {
                container.remove();
                const styles = document.getElementById('ai-dynamic-styles');
                if (styles) styles.remove();
            }, 300);
        }
        isAIActive = false;
    }

    /**
     * Adjusts textarea height dynamically and updates the character counter.
     */
    function handleTextareaInput(e) {
        const textarea = e.target;
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;

        const charCounter = document.getElementById('ai-char-counter');
        if (charCounter) {
            charCounter.textContent = `${textarea.value.length} / ${USER_CHAR_LIMIT}`;
        }
    }

    /**
     * Handles the submission of a question via the 'Enter' key.
     */
    function handleInputSubmission(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const textarea = e.target;
            const query = textarea.value.trim();

            if (!query || isRequestPending) return;

            const now = Date.now();
            if (now - lastRequestTime < COOLDOWN_PERIOD) {
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
            textarea.disabled = true;

            const responseContainer = document.getElementById('ai-response-container');
            
            // Add user's message to the chat
            const userBubble = document.createElement('div');
            userBubble.className = 'ai-message-bubble user-message';
            userBubble.textContent = query;
            responseContainer.appendChild(userBubble);

            // Create a new bubble for the AI response
            const responseBubble = document.createElement('div');
            responseBubble.className = 'ai-message-bubble gemini-response loading';
            responseBubble.innerHTML = '<div class="ai-loader"></div>';
            responseContainer.appendChild(responseBubble);
            
            responseContainer.scrollTop = responseContainer.scrollHeight;

            // Reset textarea
            textarea.value = '';
            textarea.style.height = 'auto';
            handleTextareaInput({ target: textarea });

            callGoogleAI(query, responseBubble);
        }
    }

    /**
     * Simple Markdown to HTML parser for Gemini responses.
     */
    function parseGeminiResponse(text) {
        let html = text
            // Escape HTML to prevent injection
            .replace(/</g, '&lt;').replace(/>/g, '&gt;')
            // Bold text: **text**
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Bold text: *text*
            .replace(/\*([^\n\*]+)\*/g, '<strong>$1</strong>')
            // Lists: * item
            .replace(/^\* (.*$)/gm, '<li>$1</li>');
        
        // Wrap consecutive list items in <ul>
        html = html.replace(/<li>(.*?)<\/li>/g, '<ul><li>$1</li></ul>')
                   .replace(/<\/ul>\n?<ul>/g, '');
        
        // Handle paragraphs
        return html.replace(/\n/g, '<br>');
    }

    /**
     * Calls the Google AI API and populates the response bubble.
     */
    async function callGoogleAI(query, responseBubble) {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: query }] }] })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error.message || 'Network response was not ok.');
            }

            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;
            const formattedText = parseGeminiResponse(text);

            responseBubble.innerHTML = `<div class="ai-response-content">${formattedText}</div>`;

        } catch (error) {
            console.error('AI API Error:', error);
            responseBubble.innerHTML = `<div class="ai-error">Sorry, an error occurred. Please check the API key and console.</div>`;
        } finally {
            responseBubble.classList.remove('loading');
            const textarea = document.getElementById('ai-input');
            textarea.disabled = false;
            textarea.placeholder = 'Ask a follow-up...';
            textarea.focus();
            isRequestPending = false;
            
            const responseContainer = document.getElementById('ai-response-container');
            responseContainer.scrollTop = responseContainer.scrollHeight;
        }
    }

    /**
     * Injects all necessary CSS into the document's <head>.
     */
    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;

        const style = document.createElement('style');
        style.id = 'ai-dynamic-styles';
        style.innerHTML = `
            :root {
                --ai-red: #ea4335;
                --ai-blue: #4285f4;
                --ai-green: #34a853;
                --ai-yellow: #fbbc05;
            }

            #ai-container {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background-color: rgba(0, 0, 0, 0.75);
                backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
                z-index: 2147483647; opacity: 0;
                transition: opacity 0.5s cubic-bezier(0.25, 1, 0.5, 1);
                font-family: 'secondaryfont', sans-serif;
                display: flex; flex-direction: column;
                padding-top: 70px;
                box-sizing: border-box;
            }

            #ai-close-button {
                position: absolute; top: 20px; right: 30px;
                color: rgba(255, 255, 255, 0.7); font-size: 40px; cursor: pointer;
                transition: color 0.2s ease, transform 0.3s ease;
            }
            #ai-close-button:hover { color: white; transform: scale(1.1); }

            #ai-response-container {
                flex: 1 1 auto;
                overflow-y: auto;
                width: 100%; max-width: 800px; margin: 0 auto;
                display: flex; flex-direction: column;
                gap: 15px; padding: 20px;
            }

            .ai-message-bubble {
                background: rgba(15, 15, 18, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 20px; padding: 15px 20px;
                color: #e0e0e0;
                backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
                animation: fadeIn 0.5s ease forwards; opacity: 0;
                max-width: 90%; line-height: 1.6;
                overflow-wrap: break-word;
            }
            .user-message { align-self: flex-end; background: rgba(40, 45, 50, 0.8); }
            .gemini-response { align-self: flex-start; }
            
            .gemini-response.loading {
                border: 1px solid transparent;
                animation: gemini-glow 4s linear infinite, fadeIn 0.5s ease forwards;
            }

            .ai-response-content ul { padding-left: 20px; margin: 10px 0; }
            .ai-response-content li { margin-bottom: 5px; }

            #ai-input-wrapper {
                flex-shrink: 0;
                position: relative;
                transform: translateY(150px);
                margin: 15px auto 30px;
                width: 90%; max-width: 800px;
                opacity: 0;
                transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.6s ease;
            }

            #ai-input {
                width: 100%; min-height: 50px; max-height: 200px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 25px;
                background: rgba(10, 10, 10, 0.7);
                backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
                color: white; font-size: 1.1em;
                padding: 12px 20px; box-sizing: border-box; resize: none;
                overflow-y: auto; outline: none;
                animation: glow 2.5s infinite;
            }
            
            #ai-char-counter {
                position: absolute; right: 20px; bottom: 10px;
                font-size: 0.8em; color: rgba(255, 255, 255, 0.4);
            }

            .ai-error, .ai-temp-message { text-align: center; color: rgba(255, 255, 255, 0.7); }
            .ai-error { color: #ff8a80; }

            .ai-loader {
                width: 25px; height: 25px;
                border: 3px solid rgba(255, 255, 255, 0.3); border-top-color: #fff;
                border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;
            }

            @keyframes glow {
                0% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.2), 0 0 10px rgba(255, 255, 255, 0.1); }
                50% { box-shadow: 0 0 15px rgba(255, 255, 255, 0.5), 0 0 25px rgba(255, 255, 255, 0.3); }
                100% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.2), 0 0 10px rgba(255, 255, 255, 0.1); }
            }
            @keyframes gemini-glow {
                0% { box-shadow: 0 0 8px 2px var(--ai-blue); }
                25% { box-shadow: 0 0 8px 2px var(--ai-green); }
                50% { box-shadow: 0 0 8px 2px var(--ai-yellow); }
                75% { box-shadow: 0 0 8px 2px var(--ai-red); }
                100% { box-shadow: 0 0 8px 2px var(--ai-blue); }
            }
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes fadeIn { to { opacity: 1; } }
        `;
        document.head.appendChild(style);
    }

    document.addEventListener('keydown', handleKeyDown);

})();

