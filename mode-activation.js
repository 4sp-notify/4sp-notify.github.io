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
 * - A dark, heavily blurred overlay for focus mode with enhanced animations.
 * - Dynamic input box glow that pulses based on typing speed.
 * - A glassy settings menu to select AI specialization (General, Math, Science, ELA, History).
 * - A conditional, arrow-key-navigable math symbols bar for Math and Science modes.
 * - A "Mathematical Translation" mode for converting equations.
 * - Fading effect on the top and bottom of the scrollable chat view.
 * - An introductory welcome message that fades out.
 * - A persistent, glowing "AI Mode" title appears after interaction begins.
 * - Chat history for contextual conversations within a session.
 * - Automatically sends user's general location (state/country) with the first message.
 * - A dynamic, auto-expanding WYSIWYG contenteditable input with real-time LaTeX-to-symbol conversion.
 * - AI responses render Markdown, LaTeX-style math, and code blocks.
 * - Communicates with the Google AI API (Gemini) to get answers.
 */

(function() {
    // --- CONFIGURATION ---
    const API_KEY = 'AIzaSyDcoUA4Js1oOf1nz53RbLaxUzD0GxTmKXA'; // Note: This appears to be a sample key.
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;
    const USER_CHAR_LIMIT = 500;
    const FIRST_LINE_CHAR_LIMIT = 60;

    // --- STATE MANAGEMENT ---
    let isAIActive = false;
    let isRequestPending = false;
    let isSettingsMenuOpen = false;
    let isMathTranslationModeActive = false;
    let currentSubject = 'General'; // 'General', 'Math', 'Science', 'ELA', 'History'
    let lastRequestTime = 0;
    const COOLDOWN_PERIOD = 5000; // 5 seconds in milliseconds
    let chatHistory = [];
    let typingTimeout = null;
    let lastKeystrokeTime = 0;
    const latexSymbolMap = {
        '\\pi': 'π', '\\theta': 'θ', '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ',
        '\\delta': 'δ', '\\epsilon': 'ε', '\\infty': '∞', '\\pm': '±',
        '\\times': '×', '\\div': '÷', '\\cdot': '·', '\\degree': '°',
        '\\le': '≤', '\\ge': '≥', '\\ne': '≠',
        '\\approx': '≈', '\\equiv': '≡',
        '\\therefore': '∴', '\\because': '∵',
    };

    /**
     * Tries to get the user's location on script load and stores it.
     */
    function getLocationOnLoad() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                    if (!response.ok) return;
                    const data = await response.json();
                    if (data && data.address) {
                        let locationString = '';
                        if (data.address.country_code === 'us') {
                            locationString = data.address.state;
                        } else {
                            locationString = data.address.country;
                        }
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


    /**
     * Handles the keyboard shortcut for activating/deactivating the AI.
     */
    function handleKeyDown(e) {
        if (e.ctrlKey && e.key.toLowerCase() === 'c') {
            const selection = window.getSelection().toString();

            if (isAIActive) {
                const editor = document.getElementById('ai-input');
                if (editor && editor.innerText.trim().length === 0 && selection.length === 0) {
                    e.preventDefault();
                    deactivateAI();
                }
            } else {
                if (selection.length === 0) {
                    e.preventDefault();
                    activateAI();
                }
            }
        }
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
        container.dataset.subject = 'General';
        
        const brandTitle = document.createElement('div');
        brandTitle.id = 'ai-brand-title';
        const brandText = "4SP - AI MODE";
        brandText.split('').forEach(char => {
            const span = document.createElement('span');
            span.textContent = char;
            span.style.animationDelay = `${Math.random() * 2}s`;
            brandTitle.appendChild(span);
        });
        
        const persistentTitle = document.createElement('div');
        persistentTitle.id = 'ai-persistent-title';
        persistentTitle.textContent = "AI Mode";

        const welcomeMessage = document.createElement('div');
        welcomeMessage.id = 'ai-welcome-message';
        welcomeMessage.innerHTML = `
            <h2>Welcome to AI Mode</h2>
            <p>This is a beta feature. To improve your experience, your general location (state or country) will be shared with your first message. You may be subject to message limits.</p>
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
        visualInput.onkeyup = updateFractionFocus;
        visualInput.onclick = updateFractionFocus;

        const placeholder = document.createElement('div');
        placeholder.id = 'ai-input-placeholder';
        placeholder.textContent = 'Ask a question...';

        const charCounter = document.createElement('div');
        charCounter.id = 'ai-char-counter';
        charCounter.textContent = `0 / ${USER_CHAR_LIMIT}`;

        const settingsToggle = document.createElement('button');
        settingsToggle.id = 'ai-settings-toggle';
        settingsToggle.innerHTML = '&#8942;'; // Vertical ellipsis
        settingsToggle.onclick = (e) => { e.stopPropagation(); toggleSettingsMenu(); };
        
        inputWrapper.appendChild(visualInput);
        inputWrapper.appendChild(placeholder);
        inputWrapper.appendChild(charCounter);
        inputWrapper.appendChild(settingsToggle);
        inputWrapper.appendChild(createOptionsBar());
        
        container.appendChild(brandTitle);
        container.appendChild(persistentTitle);
        container.appendChild(welcomeMessage);
        container.appendChild(closeButton);
        container.appendChild(responseContainer);
        container.appendChild(inputWrapper);
        container.appendChild(createSettingsMenu()); // Add settings menu
        container.appendChild(createMathTranslatorUI()); // Add math translator UI

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
            clearTimeout(typingTimeout);
            container.classList.remove('active');
            setTimeout(() => {
                container.remove();
                const styles = document.getElementById('ai-dynamic-styles');
                if (styles) styles.remove();
            }, 500);
        }
        isAIActive = false;
        isSettingsMenuOpen = false;
        isMathTranslationModeActive = false;
        currentSubject = 'General';
        chatHistory = [];
    }

    function fadeOutWelcomeMessage() {
        const container = document.getElementById('ai-container');
        if (container && !container.classList.contains('chat-active')) {
            container.classList.add('chat-active');
        }
    }

    function updateFractionFocus() {
        const editor = document.getElementById('ai-input');
        if (!editor) return;
        editor.querySelectorAll('.ai-frac').forEach(f => f.classList.remove('focused'));
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && selection.isCollapsed) {
            const range = selection.getRangeAt(0);
            const nodeBefore = range.startContainer.childNodes[range.startOffset - 1];
            if (nodeBefore && nodeBefore.nodeType === 1 && nodeBefore.classList.contains('ai-frac')) {
                nodeBefore.classList.add('focused');
            }
        }
    }

    /**
     * Handles input on the contenteditable div, updating placeholder and counter.
     */
    function handleContentEditableInput(e) {
        fadeOutWelcomeMessage();
        const editor = e.target;
        
        const wrapper = document.getElementById('ai-input-wrapper');
        const now = Date.now();
        const timeDiff = now - (lastKeystrokeTime || now);
        lastKeystrokeTime = now;

        if (!wrapper.classList.contains('waiting')) {
            wrapper.style.animationPlayState = 'running';
            if (timeDiff < 150) { // Fast typing
                wrapper.style.animationDuration = '0.7s';
            } else { // Slower typing
                wrapper.style.animationDuration = '1.8s';
            }
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                const activeWrapper = document.getElementById('ai-input-wrapper');
                if (activeWrapper && !activeWrapper.classList.contains('waiting')) {
                     activeWrapper.style.animationDuration = '4s';
                }
            }, 1000);
        }

        editor.querySelectorAll('div:not(:last-child)').forEach(div => {
            if (div.innerHTML.trim() === '' || div.innerHTML === '<br>') {
                div.remove();
            }
        });

        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const node = range.startContainer;
            if (node.nodeType === 3) { // Text node
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

    /**
     * Parses the visually formatted HTML from the input into plain text for the API.
     */
    function parseInputForAPI(innerHTML) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = innerHTML.replace(/<div><br><\/div>/g, '\n').replace(/<br>/g, '\n');
        tempDiv.querySelectorAll('.ai-frac').forEach(frac => {
            const n = frac.querySelector('sup')?.innerText.trim() || '';
            const d = frac.querySelector('sub')?.innerText.trim() || '';
            frac.replaceWith(`(${n})/(${d})`);
        });
        tempDiv.querySelectorAll('sup').forEach(sup => sup.replaceWith(`^(${sup.innerText.trim()})`));
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

        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { 
            const lines = editor.innerHTML.split(/<br.*?>|<div>/);
            if (lines.length <= 1) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = lines[0] || '';
                const firstLineText = tempDiv.textContent || tempDiv.innerText;
                if (firstLineText.length >= FIRST_LINE_CHAR_LIMIT) {
                    e.preventDefault();
                    return;
                }
            }
        }
        
        if (e.key === 'Backspace') {
            const selection = window.getSelection();
            if (selection.rangeCount > 0 && selection.isCollapsed) {
                const range = selection.getRangeAt(0);
                const nodeBefore = range.startContainer.childNodes[range.startOffset - 1];

                if (nodeBefore && nodeBefore.nodeType === 1 && (nodeBefore.classList.contains('ai-frac') || nodeBefore.tagName.toLowerCase() === 'sup')) {
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

            if (chatHistory.length === 0) {
                const location = localStorage.getItem('ai-user-location');
                if (location) {
                    query = `(User is located in ${location}) ${query}`;
                }
            }

            isRequestPending = true;
            lastRequestTime = now;
            editor.contentEditable = false;
            document.getElementById('ai-input-wrapper').classList.add('waiting');

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
            callGoogleAI(responseBubble);
        }
    }

    /**
     * Parses Gemini's response, handling Markdown, math, and code blocks.
     */
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

    /**
     * Calls the Google AI API and populates the response bubble.
     */
    async function callGoogleAI(responseBubble, customPayload = null) {
        let systemInstruction = null;
        if (!customPayload) {
            switch (currentSubject) {
                case 'Math': systemInstruction = 'You are a mathematics expert. Prioritize accuracy, detailed steps, and formal notation. Be concise.'; break;
                case 'Science': systemInstruction = 'You are a science expert. Provide clear, evidence-based explanations and use scientific terminology correctly. Be concise.'; break;
                case 'ELA': systemInstruction = 'You are an English Language Arts expert. Focus on grammar, literary analysis, and writing structure. Be concise.'; break;
                case 'History': systemInstruction = 'You are a history expert. Provide historically accurate information with context, dates, and sources where applicable. Be concise.'; break;
            }
        }
        
        const payload = customPayload || { contents: chatHistory };
        if (systemInstruction) {
            payload.systemInstruction = { parts: [{ text: systemInstruction }] };
        }

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error('Network response was not ok.');
            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;
            
            if (!customPayload) {
                chatHistory.push({ role: "model", parts: [{ text: text }] });
            }
            
            responseBubble.innerHTML = `<div class="ai-response-content">${parseGeminiResponse(text)}</div>`;
        } catch (error) {
            console.error('AI API Error:', error);
            responseBubble.innerHTML = `<div class="ai-error">Sorry, an error occurred.</div>`;
        } finally {
            if (!customPayload) { // Only reset for chat mode
                responseBubble.classList.remove('loading');
                document.getElementById('ai-input-wrapper').classList.remove('waiting');
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
    }
    
    function insertAtCursor(html) {
        const editor = document.getElementById('ai-input');
        if (!editor) return;
        editor.focus();
        document.execCommand('insertHTML', false, html);
        handleContentEditableInput({target: editor});
    }
    
    function insertPower() {
        const editor = document.getElementById('ai-input');
        editor.focus();
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        range.deleteContents();

        const sup = document.createElement('sup');
        sup.contentEditable = true;
        sup.innerHTML = '&nbsp;'; // Add a space to make it selectable
        range.insertNode(sup);
        
        // Create a new range to place the cursor inside the sup
        const newRange = document.createRange();
        newRange.setStart(sup, 1); // Place cursor after the &nbsp;
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        handleContentEditableInput({ target: editor });
    }

    function createOptionsBar() {
        const bar = document.createElement('div');
        bar.id = 'ai-options-bar';
        const buttons = [
            { t: '+', v: '+' }, { t: '−', v: '−' }, { t: '×', v: '×' }, { t: '÷', v: '÷' },
            { t: 'x/y', action: () => insertAtCursor('<span class="ai-frac" contenteditable="false"><sup contenteditable="true"></sup><sub contenteditable="true"></sub></span>&nbsp;') },
            { t: '√', v: '√()' }, { t: '∛', v: '∛()' }, { t: 'xⁿ', action: insertPower },
            { t: 'π', v: 'π' }, { t: 'θ', v: 'θ' }, { t: '∞', v: '∞' }, { t: '°', v: '°' },
            { t: '<', v: '<' }, { t: '>', v: '>' }, { t: '≤', v: '≤' }, { t: '≥', v: '≥' }, { t: '≠', v: '≠' }
        ];

        buttons.forEach((btn, index) => {
            const buttonEl = document.createElement('button');
            buttonEl.innerHTML = btn.t;
            buttonEl.tabIndex = -1; // Not reachable by tab, only by arrow keys
            buttonEl.onclick = (e) => { 
                e.stopPropagation(); 
                if (btn.action) {
                    btn.action();
                } else {
                    insertAtCursor(btn.v);
                }
            };
            bar.appendChild(buttonEl);
        });

        // Arrow key navigation
        bar.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const currentButtons = Array.from(bar.querySelectorAll('button'));
                const focusedIndex = currentButtons.findIndex(b => b === document.activeElement);
                let nextIndex;

                if (e.key === 'ArrowRight') {
                    nextIndex = focusedIndex >= 0 ? (focusedIndex + 1) % currentButtons.length : 0;
                } else { // ArrowLeft
                    nextIndex = focusedIndex > 0 ? focusedIndex - 1 : currentButtons.length - 1;
                }
                currentButtons[nextIndex]?.focus();
            }
        });

        return bar;
    }

    function toggleSettingsMenu() {
        isSettingsMenuOpen = !isSettingsMenuOpen;
        const menu = document.getElementById('ai-settings-menu');
        const toggleBtn = document.getElementById('ai-settings-toggle');
        menu.classList.toggle('active', isSettingsMenuOpen);
        toggleBtn.classList.toggle('active', isSettingsMenuOpen);
    }
    
    function selectSubject(subject) {
        currentSubject = subject;
        const container = document.getElementById('ai-container');
        container.dataset.subject = subject;

        // Update active button style in menu
        const menu = document.getElementById('ai-settings-menu');
        menu.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        const activeBtn = menu.querySelector(`button[onclick="selectSubject('${subject}')"]`);
        if (activeBtn) activeBtn.classList.add('active');

        // Close menu
        toggleSettingsMenu();
        
        // Deactivate math translation mode if active
        if (isMathTranslationModeActive) {
            toggleMathTranslationMode();
        }
    }
    
    function createSettingsMenu() {
        const menu = document.createElement('div');
        menu.id = 'ai-settings-menu';
        const subjects = ['General', 'Math', 'ELA', 'History', 'Science'];
        
        subjects.forEach(subject => {
            const button = document.createElement('button');
            button.textContent = subject;
            if (subject === 'General') button.classList.add('active');
            button.onclick = () => selectSubject(subject);
            menu.appendChild(button);
        });
        
        const separator = document.createElement('hr');
        menu.appendChild(separator);
        
        const translatorButton = document.createElement('button');
        translatorButton.textContent = 'Mathematical Translation';
        translatorButton.onclick = () => { toggleMathTranslationMode(); toggleSettingsMenu(); };
        menu.appendChild(translatorButton);
        
        return menu;
    }
    
    function toggleMathTranslationMode() {
        isMathTranslationModeActive = !isMathTranslationModeActive;
        const container = document.getElementById('ai-container');
        container.classList.toggle('math-translation-active', isMathTranslationModeActive);
        if (isMathTranslationModeActive) {
             document.getElementById('ai-math-translator-input')?.focus();
        } else {
             document.getElementById('ai-input')?.focus();
        }
    }
    
    function createMathTranslatorUI() {
        const translator = document.createElement('div');
        translator.id = 'ai-math-translator';
        translator.innerHTML = `
            <h3>Mathematical Translation</h3>
            <p>Enter an equation or expression below.</p>
            <div id="ai-math-translator-input" contenteditable="true"></div>
            <p>Choose a conversion target:</p>
            <div id="ai-math-translator-options">
                <button data-action="Slope-Intercept to Standard Form">Standard Form</button>
                <button data-action="Expand the Expression">Expand</button>
                <button data-action="Factor the Expression">Factor</button>
            </div>
            <div id="ai-math-translator-custom">
                <input type="text" placeholder="Or type a custom conversion..." />
                <button>Go</button>
            </div>
            <div id="ai-math-translator-output-wrapper">
                <h4>Result:</h4>
                <div id="ai-math-translator-output"><div class="ai-loader" style="display: none;"></div></div>
            </div>
            <button id="ai-math-translator-back">Back to Chat</button>
        `;

        translator.querySelector('#ai-math-translator-back').onclick = toggleMathTranslationMode;

        const handleTranslate = (action) => {
            const input = translator.querySelector('#ai-math-translator-input').innerText.trim();
            if (!input || !action) return;
            
            const outputDiv = translator.querySelector('#ai-math-translator-output');
            const loader = outputDiv.querySelector('.ai-loader');
            loader.style.display = 'block';
            outputDiv.innerHTML = ''; // Clear previous result
            outputDiv.appendChild(loader);

            const prompt = `As a math expert, convert the following expression: "${input}" to this form: "${action}". Respond with only the final converted expression, without any explanation.`;
            const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };

            // Use a wrapper div for the response so it can be replaced
            const responseWrapper = document.createElement('div');
            outputDiv.appendChild(responseWrapper);
            callGoogleAI(responseWrapper, payload).finally(() => {
                loader.style.display = 'none';
            });
        };

        translator.querySelectorAll('#ai-math-translator-options button').forEach(btn => {
            btn.onclick = () => handleTranslate(btn.dataset.action);
        });

        translator.querySelector('#ai-math-translator-custom button').onclick = () => {
            const customAction = translator.querySelector('#ai-math-translator-custom input').value.trim();
            handleTranslate(customAction);
        };
        
        return translator;
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
                opacity: 1; transform: translateY(0); transition: opacity 0.5s 0.2s, transform 0.5s 0.2s;
            }
            #ai-container.chat-active #ai-brand-title { opacity: 0; pointer-events: none; }
            #ai-brand-title span { animation: brand-pulse 2s ease-in-out infinite; display: inline-block; }
            #ai-persistent-title {
                position: absolute; top: 28px; left: 30px; font-family: 'secondaryfont', sans-serif;
                font-size: 18px; font-weight: bold;
                color: white;
                opacity: 0; pointer-events: none; transition: opacity 0.5s 0.2s;
                animation: title-pulse 4s linear infinite;
            }
            #ai-container.chat-active #ai-persistent-title { opacity: 1; pointer-events: auto; }
            #ai-welcome-message {
                position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                text-align: center; color: rgba(255,255,255,0.5);
                opacity: 1; transition: opacity 0.5s;
                width: 100%;
            }
            #ai-container.chat-active #ai-welcome-message { opacity: 0; pointer-events: none; }
            #ai-welcome-message h2 { font-family: 'PrimaryFont', sans-serif; font-size: 2.5em; margin: 0; color: #fff; }
            #ai-welcome-message p { font-size: 0.9em; margin-top: 10px; max-width: 400px; margin-left: auto; margin-right: auto; line-height: 1.5; }
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
            .ai-frac { display: inline-flex; flex-direction: column; text-align: center; vertical-align: middle; background: rgba(0,0,0,0.2); padding: 0.1em 0.4em; border-radius: 5px; transition: box-shadow 0.2s, transform 0.2s; }
            .ai-frac.focused { box-shadow: 0 0 0 2px var(--ai-blue); transform: scale(1.1); }
            .ai-frac > sup, .ai-frac > sub { display: block; min-width: 1ch; }
            .ai-frac > sup { border-bottom: 1px solid currentColor; padding-bottom: 0.15em; }
            .ai-frac > sub { padding-top: 0.15em; }
            #ai-input sup, #ai-input sub { font-family: 'secondaryfont', sans-serif; outline: none; background: rgba(0,0,0,0.2); padding: 0.1em 0.3em; border-radius: 4px; }
            #ai-input-wrapper {
                flex-shrink: 0; position: relative; opacity: 0;
                transform: translateY(100px); transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                margin: 15px auto 30px; width: 90%; max-width: 800px;
                border-radius: 25px; background: rgba(10, 10, 10, 0.7);
                backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
                animation: glow 2.5s infinite; animation-play-state: paused;
                cursor: text; border: 1px solid rgba(255, 255, 255, 0.2);
            }
            #ai-input-wrapper.waiting { animation: gemini-glow 4s linear infinite !important; animation-play-state: running !important; }
            #ai-container.active #ai-input-wrapper { opacity: 1; transform: translateY(0); }
            #ai-input {
                min-height: 50px; color: white; font-size: 1.1em;
                padding: 12px 50px 12px 20px; box-sizing: border-box;
                word-wrap: break-word; outline: none;
            }
            #ai-input-placeholder { position: absolute; top: 14px; left: 20px; color: rgba(255,255,255,0.4); pointer-events: none; font-size: 1.1em; }
            #ai-settings-toggle { position: absolute; right: 10px; top: 25px; transform: translateY(-50%); background: none; border: none; color: rgba(255,255,255,0.5); font-size: 24px; cursor: pointer; padding: 5px; line-height: 1; transition: color 0.2s, transform 0.3s; z-index: 2; }
            #ai-settings-toggle:hover, #ai-settings-toggle.active { color: white; }
            #ai-settings-toggle.active { transform: translateY(-50%) rotate(90deg); }
            #ai-options-bar {
                display: flex; overflow-x: auto; background: rgba(0,0,0,0.3);
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                border-top: 1px solid transparent; max-height: 0;
                opacity: 0; visibility: hidden; padding: 0 15px;
            }
            #ai-container[data-subject="Math"] #ai-options-bar,
            #ai-container[data-subject="Science"] #ai-options-bar {
                max-height: 50px; opacity: 1; visibility: visible;
                padding: 8px 15px; border-top: 1px solid rgba(255,255,255,0.1);
            }
            #ai-options-bar button { background: rgba(255,255,255,0.1); border: none; border-radius: 8px; color: white; font-size: 1.1em; cursor: pointer; padding: 5px 10px; transition: background 0.2s, box-shadow 0.2s; flex-shrink: 0; margin-right: 8px; }
            #ai-options-bar button:hover { background: rgba(255,255,255,0.2); }
            #ai-options-bar button:focus { outline: none; box-shadow: 0 0 0 2px var(--ai-blue); }
            #ai-char-counter { position: absolute; right: 55px; top: 15px; font-size: 0.8em; color: rgba(255, 255, 255, 0.4); z-index: 2;}
            #ai-settings-menu {
                position: absolute; right: 10px; bottom: 110px;
                background: rgba(30, 32, 35, 0.5); backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
                border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px;
                padding: 10px; display: flex; flex-direction: column; gap: 8px;
                opacity: 0; visibility: hidden; transform: translateY(20px);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            #ai-settings-menu.active { opacity: 1; visibility: visible; transform: translateY(0); }
            #ai-settings-menu button { background: rgba(255,255,255,0.05); color: #ccc; border: 1px solid transparent; border-radius: 8px; padding: 8px 15px; text-align: left; cursor: pointer; transition: background .2s, border-color .2s; }
            #ai-settings-menu button:hover { background: rgba(255,255,255,0.1); }
            #ai-settings-menu button.active { background: rgba(66, 133, 244, 0.3); border-color: var(--ai-blue); color: #fff; }
            #ai-settings-menu hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 5px 0; }
            #ai-math-translator {
                position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                width: 90%; max-width: 600px; color: #fff; background: rgba(15, 15, 18, 0.9);
                border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px;
                padding: 25px; backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
                display: none; flex-direction: column; gap: 15px;
            }
            #ai-container.math-translation-active #ai-response-container,
            #ai-container.math-translation-active #ai-input-wrapper,
            #ai-container.math-translation-active #ai-welcome-message { display: none !important; }
            #ai-container.math-translation-active #ai-math-translator { display: flex; }
            #ai-math-translator h3, #ai-math-translator h4 { margin: 0; }
            #ai-math-translator p { margin: 0; color: #aaa; }
            #ai-math-translator-input { min-height: 40px; background: rgba(0,0,0,0.3); border: 1px solid #444; border-radius: 8px; padding: 10px; outline: none; }
            #ai-math-translator-options { display: flex; gap: 10px; }
            #ai-math-translator-options button { flex: 1; background: #333; border: 1px solid #555; color: #fff; padding: 10px; border-radius: 8px; cursor: pointer; transition: background .2s; }
            #ai-math-translator-options button:hover { background: #444; }
            #ai-math-translator-custom { display: flex; gap: 10px; }
            #ai-math-translator-custom input { flex: 1; background: rgba(0,0,0,0.3); border: 1px solid #444; border-radius: 8px; padding: 10px; color: #fff; outline: none; }
            #ai-math-translator-custom button { background: var(--ai-blue); border: none; color: #fff; padding: 10px 15px; border-radius: 8px; cursor: pointer; }
            #ai-math-translator-output { background: rgba(0,0,0,0.2); border-radius: 8px; padding: 15px; min-height: 40px; font-family: monospace; font-size: 1.2em; color: #a5d6ff; }
            #ai-math-translator-back { align-self: center; margin-top: 10px; background: none; border: 1px solid #555; color: #aaa; padding: 8px 20px; border-radius: 8px; cursor: pointer; }
            .ai-error, .ai-temp-message { text-align: center; color: rgba(255, 255, 255, 0.7); }
            .ai-loader { width: 25px; height: 25px; border: 3px solid rgba(255, 255, 255, 0.3); border-top-color: #fff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto; }
            @keyframes glow { 0%, 100% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.2), 0 0 10px rgba(255, 255, 255, 0.1); } 50% { box-shadow: 0 0 15px rgba(255, 255, 255, 0.5), 0 0 25px rgba(255, 255, 255, 0.3); } }
            @keyframes gemini-glow { 0%, 100% { box-shadow: 0 0 8px 2px var(--ai-blue); } 25% { box-shadow: 0 0 8px 2px var(--ai-green); } 50% { box-shadow: 0 0 8px 2px var(--ai-yellow); } 75% { box-shadow: 0 0 8px 2px var(--ai-red); } }
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes message-pop-in { 0% { opacity: 0; transform: translateY(10px) scale(0.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes brand-slide { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
            @keyframes brand-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
            @keyframes title-pulse { 0%, 100% { text-shadow: 0 0 7px var(--ai-blue); } 25% { text-shadow: 0 0 7px var(--ai-green); } 50% { text-shadow: 0 0 7px var(--ai-yellow); } 75% { text-shadow: 0 0 7px var(--ai-red); } }
        `;
        document.head.appendChild(style);
    }

    document.addEventListener('keydown', handleKeyDown);

})();
