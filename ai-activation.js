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
 * - A dynamic, multi-line textarea with a "math mode" and touchpad.
 * - AI responses render Markdown, LaTeX-style math ($...$), and code blocks.
 * - AI response bubbles feature a Gemini-style animated gradient glow.
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
    let isMathModeActive = false;
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

        const mathModeToggle = document.createElement('button');
        mathModeToggle.id = 'ai-math-toggle';
        mathModeToggle.innerHTML = '&#8942;'; // Vertical ellipsis
        mathModeToggle.onclick = toggleMathMode;
        
        inputWrapper.appendChild(textarea);
        inputWrapper.appendChild(charCounter);
        inputWrapper.appendChild(mathModeToggle);
        
        container.appendChild(closeButton);
        container.appendChild(responseContainer);
        container.appendChild(inputWrapper);
        container.appendChild(createMathPad()); // Create and add the math pad

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
        isMathModeActive = false;
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
                // ... (cooldown logic remains the same)
                return;
            }

            isRequestPending = true;
            lastRequestTime = now;
            textarea.disabled = true;

            const responseContainer = document.getElementById('ai-response-container');
            const userBubble = document.createElement('div');
            userBubble.className = 'ai-message-bubble user-message';
            userBubble.textContent = query;
            responseContainer.appendChild(userBubble);

            const responseBubble = document.createElement('div');
            responseBubble.className = 'ai-message-bubble gemini-response loading';
            responseBubble.innerHTML = '<div class="ai-loader"></div>';
            responseContainer.appendChild(responseBubble);
            
            responseContainer.scrollTop = responseContainer.scrollHeight;

            textarea.value = '';
            textarea.style.height = 'auto';
            handleTextareaInput({ target: textarea });

            callGoogleAI(query, responseBubble);
        }
    }

    /**
     * Parses Gemini's response, handling Markdown, math, and code blocks.
     */
    function parseGeminiResponse(text) {
        // Escape basic HTML to prevent injection
        let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Process code blocks first (```...```)
        html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
            return `<pre><code>${code.trim()}</code></pre>`;
        });

        // Process math blocks ($...$)
        html = html.replace(/\$([^\$]+)\$/g, (match, math) => {
            const processedMath = math
                .replace(/\\times/g, '&times;')
                .replace(/\\pi/g, '&pi;')
                .replace(/(\w+)\^(\w+)/g, '$1<sup>$2</sup>')
                .replace(/\\sqrt\{(.+?)\}/g, '&radic;($1)')
                .replace(/\\frac\{(.+?)\}\{(.+?)\}/g, '<sup>$1</sup>&frasl;<sub>$2</sub>');
            return `<span class="ai-math-inline">${processedMath}</span>`;
        });
        
        // Process standard Markdown
        html = html
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^\n\*]+)\*/g, '<strong>$1</strong>')
            .replace(/^\* (.*$)/gm, '<li>$1</li>');
        
        html = html.replace(/<li>(.*?)<\/li>/g, '<ul><li>$1</li></ul>').replace(/<\/ul>\n?<ul>/g, '');
        return html.replace(/\n/g, '<br>');
    }

    /**
     * Calls the Google AI API and populates the response bubble.
     */
    async function callGoogleAI(query, responseBubble) {
        try {
            // ... (fetch logic remains the same)
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: query }] }] })
            });

            if (!response.ok) throw new Error('Network response was not ok.');
            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;
            responseBubble.innerHTML = `<div class="ai-response-content">${parseGeminiResponse(text)}</div>`;
        } catch (error) {
            console.error('AI API Error:', error);
            responseBubble.innerHTML = `<div class="ai-error">Sorry, an error occurred.</div>`;
        } finally {
            responseBubble.classList.remove('loading');
            const textarea = document.getElementById('ai-input');
            if(textarea) {
                textarea.disabled = false;
                textarea.placeholder = 'Ask a follow-up...';
                textarea.focus();
            }
            isRequestPending = false;
            const responseContainer = document.getElementById('ai-response-container');
            if(responseContainer) responseContainer.scrollTop = responseContainer.scrollHeight;
        }
    }
    
    /**
     * Toggles the visibility of the math touchpad.
     */
    function toggleMathMode() {
        isMathModeActive = !isMathModeActive;
        const mathPad = document.getElementById('ai-math-pad');
        const toggleBtn = document.getElementById('ai-math-toggle');
        if (isMathModeActive) {
            mathPad.style.display = 'grid';
            toggleBtn.classList.add('active');
            setTimeout(() => mathPad.style.opacity = '1', 10);
        } else {
            mathPad.style.opacity = '0';
            toggleBtn.classList.remove('active');
            setTimeout(() => mathPad.style.display = 'none', 300);
        }
    }
    
    /**
     * Inserts text at the current cursor position in the textarea.
     */
    function insertAtCursor(text) {
        const textarea = document.getElementById('ai-input');
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const val = textarea.value;
        textarea.value = val.substring(0, start) + text + val.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + text.length;
        textarea.focus();
        handleTextareaInput({target: textarea});
    }

    /**
     * Creates the math touchpad element.
     */
    function createMathPad() {
        const pad = document.createElement('div');
        pad.id = 'ai-math-pad';
        const buttons = [
            { t: '+', v: '+' }, { t: '-', v: '-' }, { t: '&times;', v: '*' }, { t: '&divide;', v: '/' },
            { t: 'x/y', v: '()/()' }, { t: '&radic;', v: 'sqrt()' }, { t: '∛', v: 'cbrt()' }, { t: 'x²', v: '^2' },
            { t: '&pi;', v: 'pi' }, { t: '(', v: '(' }, { t: ')', v: ')' }, { t: '=', v: '=' },
        ];
        buttons.forEach(btn => {
            const buttonEl = document.createElement('button');
            buttonEl.innerHTML = btn.t;
            buttonEl.onclick = () => insertAtCursor(btn.v);
            pad.appendChild(buttonEl);
        });
        return pad;
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
                --ai-red: #ea4335; --ai-blue: #4285f4; --ai-green: #34a853; --ai-yellow: #fbbc05;
            }
            #ai-container {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background-color: rgba(0, 0, 0, 0.75);
                backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
                z-index: 2147483647; opacity: 0;
                transition: opacity 0.5s cubic-bezier(0.25, 1, 0.5, 1);
                font-family: 'secondaryfont', sans-serif;
                display: flex; flex-direction: column; padding-top: 70px; box-sizing: border-box;
            }
            #ai-close-button {
                position: absolute; top: 20px; right: 30px; color: rgba(255, 255, 255, 0.7);
                font-size: 40px; cursor: pointer; transition: color 0.2s ease, transform 0.3s ease;
            }
            #ai-close-button:hover { color: white; transform: scale(1.1); }
            #ai-response-container {
                flex: 1 1 auto; overflow-y: auto; width: 100%; max-width: 800px; margin: 0 auto;
                display: flex; flex-direction: column; gap: 15px; padding: 20px;
            }
            .ai-message-bubble {
                background: rgba(15, 15, 18, 0.8); border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 20px; padding: 15px 20px; color: #e0e0e0;
                backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
                animation: fadeIn 0.5s ease forwards; opacity: 0;
                max-width: 90%; line-height: 1.6; overflow-wrap: break-word;
            }
            .user-message { align-self: flex-end; background: rgba(40, 45, 50, 0.8); }
            .gemini-response { align-self: flex-start; }
            .gemini-response.loading { border: 1px solid transparent; animation: gemini-glow 4s linear infinite, fadeIn 0.5s ease forwards; }
            .ai-response-content pre { background: #0c0d10; border: 1px solid #222; border-radius: 8px; padding: 12px; margin: 8px 0; overflow-x: auto; font-family: monospace; }
            .ai-response-content code { font-family: monospace; }
            .ai-math-inline { color: #a5d6ff; font-family: monospace; font-size: 1.1em; }
            #ai-input-wrapper {
                flex-shrink: 0; position: relative; transform: translateY(150px);
                margin: 15px auto 30px; width: 90%; max-width: 800px; opacity: 0;
                transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.6s ease;
            }
            #ai-input {
                width: 100%; min-height: 50px; max-height: 200px;
                border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 25px;
                background: rgba(10, 10, 10, 0.7); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
                color: white; font-size: 1.1em; padding: 12px 50px 12px 20px; 
                box-sizing: border-box; resize: none; overflow-y: auto; outline: none; animation: glow 2.5s infinite;
            }
            #ai-math-toggle {
                position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
                background: none; border: none; color: rgba(255,255,255,0.5); font-size: 24px;
                cursor: pointer; padding: 5px; line-height: 1; transition: color 0.2s;
            }
            #ai-math-toggle:hover, #ai-math-toggle.active { color: white; }
            #ai-math-pad {
                position: absolute; bottom: 100px; right: 20px;
                display: none; opacity: 0; transition: opacity 0.3s ease;
                grid-template-columns: repeat(4, 1fr); gap: 5px;
                background: rgba(25, 25, 28, 0.9); backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px;
            }
            #ai-math-pad button {
                background: rgba(255,255,255,0.1); border: none; border-radius: 5px;
                color: white; font-size: 1.2em; cursor: pointer; padding: 8px 12px;
                transition: background 0.2s;
            }
            #ai-math-pad button:hover { background: rgba(255,255,255,0.2); }
            #ai-char-counter {
                position: absolute; right: 55px; bottom: 10px; font-size: 0.8em; color: rgba(255, 255, 255, 0.4);
            }
            .ai-error, .ai-temp-message { text-align: center; color: rgba(255, 255, 255, 0.7); }
            .ai-loader {
                width: 25px; height: 25px; border: 3px solid rgba(255, 255, 255, 0.3);
                border-top-color: #fff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;
            }
            @keyframes glow {
                0%, 100% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.2), 0 0 10px rgba(255, 255, 255, 0.1); }
                50% { box-shadow: 0 0 15px rgba(255, 255, 255, 0.5), 0 0 25px rgba(255, 255, 255, 0.3); }
            }
            @keyframes gemini-glow {
                0%, 100% { box-shadow: 0 0 8px 2px var(--ai-blue); }
                25% { box-shadow: 0 0 8px 2px var(--ai-green); }
                50% { box-shadow: 0 0 8px 2px var(--ai-yellow); }
                75% { box-shadow: 0 0 8px 2px var(--ai-red); }
            }
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes fadeIn { to { opacity: 1; } }
        `;
        document.head.appendChild(style);
    }

    document.addEventListener('keydown', handleKeyDown);

})();

