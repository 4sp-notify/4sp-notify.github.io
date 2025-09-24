/**
 * ai-activation.js
 *
 * Injects a fully-featured AI chat interface into the current page.
 *
 * Activation:
 * - Press Shift + Ctrl + A to toggle the AI interface.
 *
 * Features:
 * - A dark, heavily blurred overlay for focus mode with enhanced animations.
 * - Fading effect on the top and bottom of the scrollable chat view.
 * - An introductory welcome message that fades out.
 * - Animated "4SP - AI MODE" branding in the top-left corner.
 * - Chat history for contextual conversations within a session.
 * - A dynamic, WYSIWYG contenteditable input for visual math editing.
 * - A "math mode" touchpad for easy input of formatted symbols and functions.
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
    let chatHistory = [];

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
        
        chatHistory = [];
        injectStyles();

        const container = document.createElement('div');
        container.id = 'ai-container';

        const brandTitle = document.createElement('div');
        brandTitle.id = 'ai-brand-title';
        const brandText = "4SP - AI MODE";
        brandText.split('').forEach(char => {
            const span = document.createElement('span');
            span.textContent = char;
            span.style.animationDelay = `${Math.random() * 2}s`;
            brandTitle.appendChild(span);
        });
        
        const welcomeMessage = document.createElement('div');
        welcomeMessage.id = 'ai-welcome-message';
        welcomeMessage.innerHTML = `
            <h2>4SP AI MODE</h2>
            <p>This is a beta feature. You may be subject to message limits.</p>
        `;

        const closeButton = document.createElement('div');
        closeButton.id = 'ai-close-button';
        closeButton.innerHTML = '&times;';
        closeButton.onclick = deactivateAI;

        const responseContainer = document.createElement('div');
        responseContainer.id = 'ai-response-container';

        const inputWrapper = document.createElement('div');
        inputWrapper.id = 'ai-input-wrapper';
        
        const visualInput = document.createElement('div');
        visualInput.id = 'ai-input';
        visualInput.contentEditable = true;
        visualInput.onkeydown = handleInputSubmission;
        visualInput.oninput = handleContentEditableInput;

        const placeholder = document.createElement('div');
        placeholder.id = 'ai-input-placeholder';
        placeholder.textContent = 'Ask a question...';

        const charCounter = document.createElement('div');
        charCounter.id = 'ai-char-counter';
        charCounter.textContent = `0 / ${USER_CHAR_LIMIT}`;

        const mathModeToggle = document.createElement('button');
        mathModeToggle.id = 'ai-math-toggle';
        mathModeToggle.innerHTML = '&#8942;';
        mathModeToggle.onclick = (e) => { e.stopPropagation(); toggleMathMode(); };
        
        inputWrapper.appendChild(visualInput);
        inputWrapper.appendChild(placeholder);
        inputWrapper.appendChild(charCounter);
        inputWrapper.appendChild(mathModeToggle);
        inputWrapper.appendChild(createMathPad());
        
        container.appendChild(brandTitle);
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
     * Removes the AI interface from the page.
     */
    function deactivateAI() {
        const container = document.getElementById('ai-container');
        if (container) {
            container.classList.remove('active');
            setTimeout(() => {
                container.remove();
                const styles = document.getElementById('ai-dynamic-styles');
                if (styles) styles.remove();
            }, 500);
        }
        isAIActive = false;
        isMathModeActive = false;
        chatHistory = [];
    }

    function fadeOutWelcomeMessage() {
        const welcomeMessage = document.getElementById('ai-welcome-message');
        if (welcomeMessage && !welcomeMessage.classList.contains('faded')) {
            welcomeMessage.classList.add('faded');
        }
    }

    /**
     * Handles input on the contenteditable div, updating placeholder and counter.
     */
    function handleContentEditableInput(e) {
        fadeOutWelcomeMessage();
        const editor = e.target;
        const charCounter = document.getElementById('ai-char-counter');
        const placeholder = document.getElementById('ai-input-placeholder');
        const rawText = editor.innerText;

        if (charCounter) charCounter.textContent = `${rawText.length} / ${USER_CHAR_LIMIT}`;
        if (placeholder) placeholder.style.display = rawText.length > 0 || editor.innerHTML.includes('<img') || editor.innerHTML.includes('<sup>') ? 'none' : 'block';
    }

    /**
     * Parses the visually formatted HTML from the input into plain text for the API.
     */
    function parseInputForAPI(innerHTML) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = innerHTML;
        tempDiv.querySelectorAll('.ai-frac').forEach(frac => {
            const n = frac.querySelector('sup')?.innerText.trim() || '';
            const d = frac.querySelector('sub')?.innerText.trim() || '';
            frac.replaceWith(`(${n})/(${d})`);
        });
        tempDiv.querySelectorAll('sup').forEach(sup => sup.replaceWith(`^${sup.innerText}`));
        let text = tempDiv.innerText;
        text = text.replace(/√\((.*?)\)/g, 'sqrt($1)').replace(/∛\((.*?)\)/g, 'cbrt($1)')
                   .replace(/×/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi');
        return text;
    }

    /**
     * Handles the submission of a question via the 'Enter' key.
     */
    function handleInputSubmission(e) {
        e.stopPropagation();
        const editor = e.target;
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            fadeOutWelcomeMessage();
            const query = parseInputForAPI(editor.innerHTML);
            if (!query || isRequestPending) return;
            const now = Date.now();
            if (now - lastRequestTime < COOLDOWN_PERIOD) return;

            isRequestPending = true;
            lastRequestTime = now;
            editor.contentEditable = false;
            chatHistory.push({ role: "user", parts: [{ text: query }] });

            const responseContainer = document.getElementById('ai-response-container');
            const userBubble = document.createElement('div');
            userBubble.className = 'ai-message-bubble user-message';
            userBubble.innerHTML = editor.innerHTML;
            responseContainer.appendChild(userBubble);

            const responseBubble = document.createElement('div');
            responseBubble.className = 'ai-message-bubble gemini-response loading';
            responseBubble.innerHTML = '<div class="ai-loader"></div>';
            responseContainer.appendChild(responseBubble);
            responseContainer.scrollTop = responseContainer.scrollHeight;

            editor.innerHTML = '';
            handleContentEditableInput({ target: editor });
            callGoogleAI(query, responseBubble);
        }
    }

    /**
     * Parses Gemini's response, handling Markdown, math, and code blocks.
     */
    function parseGeminiResponse(text) {
        let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html = html.replace(/```([\s\S]*?)```/g, (match, code) => `<pre><code>${code.trim()}</code></pre>`);
        html = html.replace(/\$([^\$]+)\$/g, (match, math) => {
            const processedMath = math
                .replace(/\\times/g, '&times;').replace(/\\pi/g, '&pi;')
                .replace(/(\w+)\^(\w+)/g, '$1<sup>$2</sup>').replace(/\\sqrt\{(.+?)\}/g, '&radic;($1)')
                .replace(/\\frac\{(.+?)\}\{(.+?)\}/g, '<span class="ai-frac"><sup>$1</sup><span>&frasl;</span><sub>$2</sub></span>');
            return `<span class="ai-math-inline">${processedMath}</span>`;
        });
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*([^\n\*]+)\*/g, '<strong>$1</strong>')
                   .replace(/^\* (.*$)/gm, '<li>$1</li>');
        html = html.replace(/<li>(.*?)<\/li>/g, '<ul><li>$1</li></ul>').replace(/<\/ul>\n?<ul>/g, '');
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
                body: JSON.stringify({ contents: chatHistory })
            });
            if (!response.ok) throw new Error('Network response was not ok.');
            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;
            chatHistory.push({ role: "model", parts: [{ text: text }] });
            responseBubble.innerHTML = `<div class="ai-response-content">${parseGeminiResponse(text)}</div>`;
        } catch (error) {
            console.error('AI API Error:', error);
            responseBubble.innerHTML = `<div class="ai-error">Sorry, an error occurred.</div>`;
        } finally {
            responseBubble.classList.remove('loading');
            const editor = document.getElementById('ai-input');
            if(editor) {
                editor.contentEditable = true;
                editor.focus();
            }
            isRequestPending = false;
            const responseContainer = document.getElementById('ai-response-container');
            if(responseContainer) responseContainer.scrollTop = responseContainer.scrollHeight;
        }
    }
    
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
    
    function insertAtCursor(html) {
        const editor = document.getElementById('ai-input');
        if (!editor) return;
        editor.focus();
        document.execCommand('insertHTML', false, html);
        handleContentEditableInput({target: editor});
    }

    function createMathPad() {
        const pad = document.createElement('div');
        pad.id = 'ai-math-pad';
        const buttons = [
            { t: '+', v: '+' }, { t: '-', v: '-' }, { t: '&times;', v: '&times;' }, { t: '&divide;', v: '&divide;' },
            { t: 'x/y', v: '<span class="ai-frac" contenteditable="false"><sup>&nbsp;</sup><span>&frasl;</span><sub>&nbsp;</sub></span>' }, 
            { t: '&radic;', v: '&radic;()' }, { t: '∛', v: '∛()' }, { t: 'x²', v: '<sup>2</sup>' },
            { t: '&pi;', v: '&pi;' }, { t: '(', v: '(' }, { t: ')', v: ')' }, { t: '=', v: '=' },
        ];
        buttons.forEach(btn => {
            const buttonEl = document.createElement('button');
            buttonEl.innerHTML = btn.t;
            buttonEl.onclick = (e) => { e.stopPropagation(); insertAtCursor(btn.v); };
            pad.appendChild(buttonEl);
        });
        return pad;
    }

    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;
        if (!document.querySelector('style[data-font="primary"]')) {
            const fontStyle = document.createElement('style');
            fontStyle.setAttribute('data-font', 'primary');
            fontStyle.textContent = `@font-face { font-family: 'PrimaryFont'; src: url('../fonts/primary.woff') format('woff'); font-weight: normal; font-style: normal; }`;
            document.head.appendChild(fontStyle);
        }
        const style = document.createElement('style');
        style.id = 'ai-dynamic-styles';
        style.innerHTML = `
            :root { --ai-red: #ea4335; --ai-blue: #4285f4; --ai-green: #34a853; --ai-yellow: #fbbc05; }
            #ai-container {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background-color: rgba(0, 0, 0, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
                z-index: 2147483647; opacity: 0; transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                font-family: 'secondaryfont', sans-serif; display: flex; flex-direction: column; padding-top: 70px; box-sizing: border-box;
            }
            #ai-container.active { opacity: 1; }
            #ai-brand-title {
                position: absolute; top: 25px; left: 30px; font-family: 'PrimaryFont', sans-serif;
                font-size: 24px; font-weight: bold;
                background: linear-gradient(to right, var(--ai-red), var(--ai-yellow), var(--ai-green), var(--ai-blue));
                -webkit-background-clip: text; background-clip: text; color: transparent;
                animation: brand-slide 10s linear infinite; background-size: 400% 100%;
                opacity: 0; transform: translateY(-20px); transition: opacity 0.5s 0.2s, transform 0.5s 0.2s;
            }
            #ai-container.active #ai-brand-title { opacity: 1; transform: translateY(0); }
            #ai-brand-title span { animation: brand-pulse 2s ease-in-out infinite; display: inline-block; }
            #ai-welcome-message {
                position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                text-align: center; color: rgba(255,255,255,0.5);
                opacity: 0; animation: welcome-fade 6s forwards; transition: opacity 0.5s;
            }
            #ai-welcome-message.faded { opacity: 0 !important; }
            #ai-welcome-message h2 { font-size: 2.5em; margin: 0; color: #fff; }
            #ai-welcome-message p { font-size: 1.1em; margin-top: 10px; }
            #ai-close-button { position: absolute; top: 20px; right: 30px; color: rgba(255, 255, 255, 0.7); font-size: 40px; cursor: pointer; transition: color 0.2s ease, transform 0.3s ease; }
            #ai-close-button:hover { color: white; transform: scale(1.1); }
            #ai-response-container {
                flex: 1 1 auto; overflow-y: auto; width: 100%; max-width: 800px; margin: 0 auto;
                display: flex; flex-direction: column; gap: 15px; padding: 20px;
                -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%);
                mask-image: linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%);
            }
            .ai-message-bubble { background: rgba(15, 15, 18, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 15px 20px; color: #e0e0e0; backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px); animation: message-pop-in 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards; max-width: 90%; line-height: 1.6; overflow-wrap: break-word; }
            .user-message { align-self: flex-end; background: rgba(40, 45, 50, 0.8); }
            .gemini-response { align-self: flex-start; }
            .gemini-response.loading { border: 1px solid transparent; animation: gemini-glow 4s linear infinite, message-pop-in 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
            .ai-response-content pre { background: #0c0d10; border: 1px solid #222; border-radius: 8px; padding: 12px; margin: 8px 0; overflow-x: auto; font-family: monospace; }
            .ai-math-inline, .user-message { color: #a5d6ff; font-family: monospace; font-size: 1.1em; }
            .ai-frac { display: inline-flex; flex-direction: column; text-align: center; vertical-align: middle; background: rgba(0,0,0,0.2); padding: 0 5px; border-radius: 3px; }
            .ai-frac > sup, .ai-frac > sub { display: block; }
            .ai-frac > sup { border-bottom: 1px solid currentColor; }
            #ai-input sup, #ai-input sub { font-family: 'secondaryfont', sans-serif; }
            #ai-input-wrapper { flex-shrink: 0; position: relative; opacity: 0; transform: translateY(100px); transition: opacity 0.6s 0.3s, transform 0.6s 0.3s cubic-bezier(0.4, 0, 0.2, 1); margin: 15px auto 30px; width: 90%; max-width: 800px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 25px; background: rgba(10, 10, 10, 0.7); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); animation: glow 2.5s infinite; cursor: text; }
            #ai-container.active #ai-input-wrapper { opacity: 1; transform: translateY(0); }
            #ai-input { width: 100%; min-height: 50px; max-height: 200px; color: white; font-size: 1.1em; padding: 12px 50px 12px 20px; box-sizing: border-box; overflow-y: auto; word-wrap: break-word; outline: none; }
            #ai-input-placeholder { position: absolute; top: 14px; left: 20px; color: rgba(255,255,255,0.4); pointer-events: none; font-size: 1.1em; }
            #ai-math-toggle { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: rgba(255,255,255,0.5); font-size: 24px; cursor: pointer; padding: 5px; line-height: 1; transition: color 0.2s; z-index: 2; }
            #ai-math-toggle:hover, #ai-math-toggle.active { color: white; }
            #ai-math-pad { position: absolute; bottom: 100%; right: 0; margin-bottom: 10px; display: none; opacity: 0; transition: opacity 0.3s ease; grid-template-columns: repeat(4, 1fr); gap: 5px; background: rgba(25, 25, 28, 0.9); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 15px; padding: 10px; }
            #ai-math-pad button { background: rgba(255,255,255,0.1); border: none; border-radius: 8px; color: white; font-size: 1.2em; cursor: pointer; padding: 8px 12px; transition: background 0.2s; }
            #ai-math-pad button:hover { background: rgba(255,255,255,0.2); }
            #ai-char-counter { position: absolute; right: 55px; bottom: 10px; font-size: 0.8em; color: rgba(255, 255, 255, 0.4); z-index: 2;}
            .ai-error, .ai-temp-message { text-align: center; color: rgba(255, 255, 255, 0.7); }
            .ai-loader { width: 25px; height: 25px; border: 3px solid rgba(255, 255, 255, 0.3); border-top-color: #fff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto; }
            @keyframes glow { 0%, 100% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.2), 0 0 10px rgba(255, 255, 255, 0.1); } 50% { box-shadow: 0 0 15px rgba(255, 255, 255, 0.5), 0 0 25px rgba(255, 255, 255, 0.3); } }
            @keyframes gemini-glow { 0%, 100% { box-shadow: 0 0 8px 2px var(--ai-blue); } 25% { box-shadow: 0 0 8px 2px var(--ai-green); } 50% { box-shadow: 0 0 8px 2px var(--ai-yellow); } 75% { box-shadow: 0 0 8px 2px var(--ai-red); } }
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes message-pop-in { 0% { opacity: 0; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
            @keyframes brand-slide { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
            @keyframes brand-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
            @keyframes welcome-fade { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.95); } 15% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 85% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.95); } }
        `;
        document.head.appendChild(style);
    }

    document.addEventListener('keydown', handleKeyDown);

})();

