/**
 * ai-activation.js
 *
 * Injects a fully-featured AI chat interface into the current page.
 *
 * Activation:
 * - Ctrl + C (only when no text is selected)
 *
 * Deactivation:
 * - 'X' button or Ctrl + C when the input box is empty.
 *
 * Features:
 * - A dark, heavily blurred overlay with a clean, single-column layout.
 * - Chat history is saved for the session (clears on page refresh).
 * - Input box glow smoothly transitions between a white typing pulse and a colored waiting pulse.
 * - An introductory welcome message that fades out.
 * - Automatically sends user's general location and current time with each message.
 * - A dynamic, WYSIWYG contenteditable input with real-time LaTeX-to-symbol conversion.
 * - A horizontal, scrollable math options bar with symbols and inequalities.
 * - AI responses render Markdown, LaTeX-style math, and code blocks.
 * - Communicates with the Google AI API (Gemini) to get answers.
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
    const COOLDOWN_PERIOD = 5000;
    let chatHistory = []; // Stays in memory for the session
    const latexSymbolMap = {
        '\\pi': 'π', '\\theta': 'θ', '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ',
        '\\delta': 'δ', '\\epsilon': 'ε', '\\infty': '∞', '\\pm': '±',
        '\\times': '×', '\\div': '÷', '\\cdot': '·', '\\degree': '°',
        '\\le': '≤', '\\ge': '≥', '\\ne': '≠',
        '\\approx': '≈', '\\equiv': '≡',
        '\\therefore': '∴', '\\because': '∵',
    };

    function getLocationOnLoad() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                    if (!response.ok) return;
                    const data = await response.json();
                    if (data && data.address) {
                        let locationString = data.address.country_code === 'us' ? data.address.state : data.address.country;
                        localStorage.setItem('ai-user-location', locationString);
                    }
                } catch (error) {
                    console.error("AI location feature: Reverse geocoding failed.", error);
                }
            }, () => {
                console.warn("AI location feature: User denied geolocation permission.");
            });
        }
    }
    getLocationOnLoad();

    function handleKeyDown(e) {
        if (e.ctrlKey && e.key.toLowerCase() === 'c') {
            const selection = window.getSelection().toString();
            if (isAIActive) {
                const editor = document.getElementById('ai-input');
                if (editor && editor.innerText.trim().length === 0 && selection.length === 0) {
                    e.preventDefault();
                    deactivateAI();
                }
            } else if (selection.length === 0) {
                e.preventDefault();
                activateAI();
            }
        }
    }

    function activateAI() {
        if (document.getElementById('ai-container')) return;
        
        injectStyles();

        const container = document.createElement('div');
        container.id = 'ai-container';
        
        container.innerHTML = `
            <div id="ai-welcome-message">
                 <div id="ai-brand-title"></div>
                 <p>This is a beta feature. Your general location will be shared with your first message. You may be subject to message limits.</p>
            </div>
            <div id="ai-response-container"></div>
            <div id="ai-input-wrapper">
                <div id="ai-input" contenteditable="true"></div>
                <div id="ai-input-placeholder">Ask a question...</div>
                <button id="ai-math-toggle">&#8942;</button>
            </div>
            <div id="ai-char-counter">0 / ${USER_CHAR_LIMIT}</div>
            <div id="ai-close-button">&times;</div>
        `;

        document.body.appendChild(container);
        
        const brandTitle = document.getElementById('ai-brand-title');
        const brandText = "4SP - AI MODE";
        brandText.split('').forEach(char => {
            const span = document.createElement('span');
            span.textContent = char;
            span.style.animationDelay = `${Math.random() * 2}s`;
            brandTitle.appendChild(span);
        });

        document.getElementById('ai-close-button').onclick = deactivateAI;
        const visualInput = document.getElementById('ai-input');
        visualInput.onkeydown = handleInputSubmission;
        visualInput.oninput = handleContentEditableInput;
        visualInput.onkeyup = updateFractionFocus;
        visualInput.onclick = updateFractionFocus;
        document.getElementById('ai-math-toggle').onclick = (e) => { e.stopPropagation(); toggleMathMode(); };
        document.getElementById('ai-input-wrapper').appendChild(createOptionsBar());
        
        // Load session history
        try {
            chatHistory = JSON.parse(sessionStorage.getItem('ai-chat-history')) || [];
            document.getElementById('ai-response-container').innerHTML = sessionStorage.getItem('ai-chat-html') || '';
            if (chatHistory.length > 0) {
                fadeOutWelcomeMessage();
            }
        } catch (e) {
            chatHistory = [];
        }
        
        setTimeout(() => container.classList.add('active'), 10);
        visualInput.focus();
        isAIActive = true;
    }

    function deactivateAI() {
        const container = document.getElementById('ai-container');
        if (container) {
            sessionStorage.setItem('ai-chat-history', JSON.stringify(chatHistory));
            sessionStorage.setItem('ai-chat-html', document.getElementById('ai-response-container').innerHTML);

            container.classList.remove('active');
            setTimeout(() => {
                container.remove();
                document.getElementById('ai-dynamic-styles')?.remove();
            }, 500);
        }
        isAIActive = false;
        isMathModeActive = false;
    }

    function fadeOutWelcomeMessage() {
        const welcomeMessage = document.getElementById('ai-welcome-message');
        if (welcomeMessage && !welcomeMessage.classList.contains('faded')) {
            welcomeMessage.classList.add('faded');
        }
    }
    
    function updateFractionFocus() {
        const editor = document.getElementById('ai-input');
        if (!editor) return;
        editor.querySelectorAll('.ai-frac').forEach(f => f.classList.remove('focused'));
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && selection.isCollapsed) {
            const range = selection.getRangeAt(0);
            if (range.startOffset === 0 && range.startContainer === editor) return;
            let nodeBefore = range.startContainer.childNodes[range.startOffset - 1];
             if (range.startOffset === 0) nodeBefore = range.startContainer.previousSibling;
            if (nodeBefore && nodeBefore.nodeType === 3 && nodeBefore.textContent === '\u00A0') nodeBefore = nodeBefore.previousSibling;
            if (nodeBefore && nodeBefore.nodeType === 1 && nodeBefore.classList.contains('ai-frac')) {
                nodeBefore.classList.add('focused');
            }
        }
    }

    function handleContentEditableInput() {
        fadeOutWelcomeMessage();
        const editor = document.getElementById('ai-input');
        
        editor.querySelectorAll('div:not(:last-child)').forEach(div => {
            if (div.innerHTML.trim() === '' || div.innerHTML === '<br>') div.remove();
        });

        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const node = range.startContainer;
            if (node.nodeType === 3) {
                const textContent = node.textContent;
                const textBeforeCursor = textContent.slice(0, range.startOffset);
                const match = textBeforeCursor.match(/(\\[a-zA-Z]+)\s$/);
                if (match) {
                    const command = match[1];
                    const symbol = latexSymbolMap[command];
                    if (symbol) {
                        const commandStartIndex = textBeforeCursor.lastIndexOf(command);
                        node.textContent = textContent.slice(0, commandStartIndex) + symbol + textContent.slice(range.startOffset);
                        range.setStart(node, commandStartIndex + 1);
                        range.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    }
                }
            }
        }
        
        const charCounter = document.getElementById('ai-char-counter');
        const placeholder = document.getElementById('ai-input-placeholder');
        const rawText = editor.innerText;
        if (charCounter) charCounter.textContent = `${rawText.length} / ${USER_CHAR_LIMIT}`;
        if (placeholder) placeholder.style.display = (rawText.length > 0 || editor.querySelector('.ai-frac')) ? 'none' : 'block';
    }

    function parseInputForAPI(innerHTML) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = innerHTML.replace(/<div><br><\/div>/g, '\n').replace(/<br>/g, '\n');
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

    function handleInputSubmission(e) {
        e.stopPropagation();
        const editor = e.target;
        
        if (e.key === 'Backspace') {
            const selection = window.getSelection();
            if (selection.rangeCount > 0 && selection.isCollapsed) {
                const range = selection.getRangeAt(0);
                if (range.startOffset === 0 && range.startContainer === editor) return;
                
                let nodeBefore = range.startContainer.childNodes[range.startOffset - 1];
                if(range.startOffset === 0) nodeBefore = range.startContainer.previousSibling;
                if (nodeBefore && nodeBefore.nodeType === 3 && nodeBefore.textContent === '\u00A0') nodeBefore = nodeBefore.previousSibling;
                if (nodeBefore && nodeBefore.nodeType === 1 && nodeBefore.classList.contains('ai-frac')) {
                    e.preventDefault();
                    nodeBefore.remove();
                    handleContentEditableInput({target: editor});
                    return;
                }
            }
        }
        
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            fadeOutWelcomeMessage();
            let query = parseInputForAPI(editor.innerHTML);
            if (!query || isRequestPending) return;
            const now = Date.now();
            if (now - lastRequestTime < COOLDOWN_PERIOD) return;

            const dateTimeString = new Date().toLocaleString();
            let contextualQuery = `(User's local time: ${dateTimeString}) ${query}`;
            if (chatHistory.length === 0) {
                const location = localStorage.getItem('ai-user-location');
                if (location) contextualQuery = `(User is located in ${location}) ${contextualQuery}`;
            }

            isRequestPending = true;
            lastRequestTime = now;
            editor.contentEditable = false;
            document.getElementById('ai-input-wrapper').classList.add('waiting');
            
            chatHistory.push({ role: "user", parts: [{ text: contextualQuery }] });

            const responseContainer = document.getElementById('ai-response-container');
            const userBubble = document.createElement('div');
            userBubble.className = 'ai-message-bubble user-message';
            userBubble.innerHTML = editor.innerHTML;
            responseContainer.appendChild(userBubble);

            const responseBubble = document.createElement('div');
            responseBubble.className = 'ai-message-bubble gemini-response loading';
            responseBubble.innerHTML = `<div class="ai-typing-indicator"><span></span><span></span><span></span></div>`;
            responseContainer.appendChild(responseBubble);
            responseContainer.scrollTop = responseContainer.scrollHeight;

            editor.innerHTML = '';
            handleContentEditableInput();
            callGoogleAI(contextualQuery, responseBubble);
        }
    }

    function parseGeminiResponse(text) {
        let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html = html.replace(/```([\s\S]*?)```/g, (match, code) => `<pre><code>${code.trim()}</code></pre>`);
        html = html.replace(/\$([^\$]+)\$/g, (match, math) => {
            let processedMath = math;
            Object.keys(latexSymbolMap).forEach(key => {
                processedMath = processedMath.replace(new RegExp(key.replace(/\\/g, '\\\\'), 'g'), latexSymbolMap[key]);
            });
            processedMath = processedMath
                .replace(/(\w+)\^(\w+)/g, '$1<sup>$2</sup>').replace(/\\sqrt\{(.+?)\}/g, '&radic;($1)')
                .replace(/\\frac\{(.+?)\}\{(.+?)\}/g, '<span class="ai-frac"><sup>$1</sup><sub>$2</sub></span>');
            return `<span class="ai-math-inline">${processedMath}</span>`;
        });
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*([^\n\*]+)\*/g, '<strong>$1</strong>')
                   .replace(/^\* (.*$)/gm, '<li>$1</li>');
        html = html.replace(/<li>(.*?)<\/li>/g, '<ul><li>$1</li></ul>').replace(/<\/ul>\n?<ul>/g, '');
        return html.replace(/\n/g, '<br>');
    }

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
            document.getElementById('ai-input-wrapper').classList.remove('waiting');
            const editor = document.getElementById('ai-input');
            if(editor) {
                editor.contentEditable = true;
                editor.focus();
            }
            isRequestPending = false;
            document.getElementById('ai-response-container').scrollTop = document.getElementById('ai-response-container').scrollHeight;
        }
    }
    
    function toggleMathMode() {
        isMathModeActive = !isMathModeActive;
        const inputWrapper = document.getElementById('ai-input-wrapper');
        inputWrapper.classList.toggle('options-active', isMathModeActive);
        document.getElementById('ai-math-toggle').classList.toggle('active', isMathModeActive);
    }
    
    function insertAtCursor(html) {
        document.getElementById('ai-input').focus();
        document.execCommand('insertHTML', false, html);
        handleContentEditableInput();
    }

    function createOptionsBar() {
        const bar = document.createElement('div');
        bar.id = 'ai-options-bar';
        const buttons = [
            { t: '+', v: '+' }, { t: '-', v: '-' }, { t: '×', v: '×' }, { t: '÷', v: '÷' },
            { t: 'x/y', v: '<span class="ai-frac" contenteditable="false"><sup contenteditable="true"></sup><sub contenteditable="true"></sub></span>&nbsp;' }, 
            { t: '√', v: '√()' }, { t: '∛', v: '∛()' }, { t: 'x²', v: '<sup>2</sup>' },
            { t: 'π', v: 'π' }, { t: 'θ', v: 'θ' }, { t: '∞', v: '∞' }, { t: '°', v: '°' },
            { t: '<', v: '<' }, { t: '>', v: '>' }, { t: '≤', v: '≤' }, { t: '≥', v: '≥' }, { t: '≠', v: '≠' }
        ];
        buttons.forEach(btn => {
            const buttonEl = document.createElement('button');
            buttonEl.innerHTML = btn.t;
            buttonEl.onclick = (e) => { e.stopPropagation(); insertAtCursor(btn.v); };
            bar.appendChild(buttonEl);
        });
        return bar;
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
                font-family: 'secondaryfont', sans-serif; display: flex; flex-direction: column; box-sizing: border-box;
            }
            #ai-container.active { opacity: 1; }
            #ai-welcome-message {
                position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                text-align: center; color: rgba(255,255,255,0.5);
                opacity: 1; transition: opacity 0.5s;
                width: 100%;
            }
            .faded { opacity: 0 !important; pointer-events: none; }
            #ai-brand-title {
                font-family: 'PrimaryFont', sans-serif; font-size: 2.5em; margin: 0; color: #fff;
                 background: linear-gradient(to right, var(--ai-red), var(--ai-yellow), var(--ai-green), var(--ai-blue));
                -webkit-background-clip: text; background-clip: text; color: transparent;
                animation: brand-slide 10s linear infinite; background-size: 400% 100%;
                margin-bottom: 10px;
            }
             #ai-brand-title span { animation: brand-pulse 2s ease-in-out infinite; display: inline-block; }
            #ai-welcome-message p { font-size: 0.9em; margin-top: 10px; max-width: 400px; margin-left: auto; margin-right: auto; line-height: 1.5; }
            #ai-close-button { position: absolute; top: 20px; right: 30px; color: rgba(255, 255, 255, 0.7); font-size: 40px; cursor: pointer; transition: color 0.2s, right 0.5s; z-index: 10; }
            #ai-close-button:hover { color: white; }
            #ai-response-container {
                flex: 1 1 auto; overflow-y: auto; width: 100%; max-width: 800px; margin: 0 auto;
                display: flex; flex-direction: column; gap: 15px; padding: 20px;
                -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%);
            }
            .ai-message-bubble { background: rgba(15, 15, 18, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 15px 20px; color: #e0e0e0; backdrop-filter: blur(15px); animation: message-pop-in 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards; max-width: 90%; line-height: 1.6; overflow-wrap: break-word; }
            .user-message { align-self: flex-end; background: rgba(40, 45, 50, 0.8); }
            .gemini-response { align-self: flex-start; }
            .gemini-response.loading { border: 1px solid transparent; animation: gemini-glow 4s linear infinite, message-pop-in 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards; display: flex; align-items: center; }
            .ai-math-inline, .user-message { color: #a5d6ff; }
            .ai-frac { display: inline-flex; flex-direction: column; text-align: center; vertical-align: middle; background: rgba(0,0,0,0.2); padding: 0.1em 0.4em; border-radius: 5px; transition: box-shadow 0.2s, transform 0.2s; }
            .ai-frac.focused { box-shadow: 0 0 0 2px var(--ai-blue); transform: scale(1.1); }
            .ai-frac > sup { border-bottom: 1px solid currentColor; }
            #ai-input sup, #ai-input sub { outline: none; }
            #ai-input-wrapper {
                flex-shrink: 0; position: relative; opacity: 0; transform: translateY(100px);
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.5s ease-in-out;
                margin: 15px auto 30px; width: 90%; max-width: 800px;
                border-radius: 25px; background: rgba(10, 10, 10, 0.7); backdrop-filter: blur(20px);
                animation: glow 2.5s infinite; cursor: text;
                border: 1px solid rgba(255, 255, 255, 0.2);
                display: flex; flex-direction: column; overflow: hidden;
            }
            #ai-input-wrapper.waiting { animation: gemini-glow 4s linear infinite !important; }
            #ai-container.active #ai-input-wrapper { opacity: 1; transform: translateY(0); }
            #ai-input { min-height: 50px; color: white; font-size: 1.1em; padding: 12px 50px 12px 20px; box-sizing: border-box; outline: none; }
            #ai-input-placeholder { position: absolute; top: 14px; left: 20px; color: rgba(255,255,255,0.4); pointer-events: none; font-size: 1.1em; z-index: 1; }
            #ai-math-toggle { position: absolute; right: 10px; top: 25px; transform: translateY(-50%); background: none; border: none; color: rgba(255,255,255,0.5); font-size: 24px; cursor: pointer; padding: 5px; line-height: 1; transition: color 0.2s, transform 0.3s; z-index: 2; }
            #ai-math-toggle.active { transform: translateY(-50%) rotate(180deg); }
            #ai-options-bar {
                display: flex; overflow-x: auto; background: rgba(0,0,0,0.3);
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                border-top: 1px solid transparent; max-height: 0; opacity: 0; visibility: hidden;
            }
            #ai-input-wrapper.options-active #ai-options-bar {
                max-height: 50px; opacity: 1; visibility: visible;
                padding: 8px 15px; border-top: 1px solid rgba(255,255,255,0.1);
            }
            #ai-options-bar button { background: rgba(255,255,255,0.1); border: none; border-radius: 8px; color: white; font-size: 1.1em; cursor: pointer; padding: 5px 10px; transition: background 0.2s; flex-shrink: 0; margin-right: 8px; }
            #ai-char-counter { position: absolute; bottom: 10px; right: 30px; font-size: 0.8em; color: rgba(255, 255, 255, 0.4); z-index: 2;}
            .ai-typing-indicator span { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: rgba(255, 255, 255, 0.5); margin: 0 2px; animation: typing-pulse 1.4s infinite ease-in-out both; }
            .ai-typing-indicator span:nth-child(1) { animation-delay: 0s; }
            .ai-typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
            .ai-typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
            @keyframes typing-pulse { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1.0); } }
            @keyframes glow { 0%, 100% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.2), 0 0 10px rgba(255, 255, 255, 0.1); } 50% { box-shadow: 0 0 15px rgba(255, 255, 255, 0.5), 0 0 25px rgba(255, 255, 255, 0.3); } }
            @keyframes gemini-glow { 0%, 100% { box-shadow: 0 0 8px 2px var(--ai-blue); } 25% { box-shadow: 0 0 8px 2px var(--ai-green); } 50% { box-shadow: 0 0 8px 2px var(--ai-yellow); } 75% { box-shadow: 0 0 8px 2px var(--ai-red); } }
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes message-pop-in { 0% { opacity: 0; transform: translateY(10px) scale(0.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes brand-slide { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
            @keyframes brand-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
            @keyframes welcome-fade { 0% { opacity: 1; } 100% { opacity: 0; } }
        `;
        document.head.appendChild(style);
    }

    document.addEventListener('keydown', handleKeyDown);

})();

