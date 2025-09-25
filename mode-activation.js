/**
 * ai-activation.js
 *
 * Injects a fully-featured AI chat interface and manages a site-wide panic key.
 *
 * --- AI Features ---
 * Activation: Ctrl + C (no text selected)
 * Deactivation: 'X' button or Ctrl + C (input empty)
 * - Settings menu for subject selection (Math, Science, etc.).
 * - Conditional math symbols menu.
 * - Advanced WYSIWYG input with arrow-key navigation for math.
 * - Renders Markdown, LaTeX, and code blocks from Gemini.
 *
 * --- Panic Key Features ---
 * - Loads panic key settings from IndexedDB.
 * - Redirects the user when a configured key is pressed.
 * - **INTEGRATION**: The panic key functionality is automatically DISABLED
 * when the AI chat interface is active, preventing accidental redirects
 * while typing.
 */

(function() {
    // --- CONFIGURATION ---
    const API_KEY = 'AIzaSyDcoUA4Js1oOf1nz53RbLaxUzD0GxTmKXA'; // Replace with your actual key
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;
    const USER_CHAR_LIMIT = 500;
    const subjects = [
        { name: 'General', hasMath: true },
        { name: 'Mathematics', hasMath: true },
        { name: 'Science', hasMath: true },
        { name: 'Language Arts', hasMath: false },
        { name: 'History', hasMath: false },
        { name: 'Social Studies', hasMath: false },
    ];
    // Panic Key DB Config
    const PANIC_DB_NAME = 'userLocalSettingsDB';
    const PANIC_STORE_NAME = 'panicKeyStore';


    // --- STATE MANAGEMENT ---
    let isAIActive = false; // This is the key state for panic key rejection
    let isRequestPending = false;
    let isSettingsMenuOpen = false;
    let lastRequestTime = 0;
    const COOLDOWN_PERIOD = 5000;
    let chatHistory = [];
    let typingTimeout = null;
    let lastKeystrokeTime = 0;
    let currentSubject = subjects[0];
    const latexSymbolMap = {
        '\\pi': 'π', '\\theta': 'θ', '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ',
        '\\delta': 'δ', '\\epsilon': 'ε', '\\infty': '∞', '\\pm': '±',
        '\\times': '×', '\\div': '÷', '\\cdot': '·', '\\degree': '°',
        '\\le': '≤', '\\ge': '≥', '\\ne': '≠',
        '\\approx': '≈', '\\equiv': '≡',
        '\\therefore': '∴', '\\because': '∵',
    };

    //======================================================================
    // PANIC KEY FUNCTIONALITY (INTEGRATED)
    //======================================================================

    /**
     * Opens the IndexedDB for panic key settings.
     * @returns {Promise<IDBDatabase>} A promise that resolves with the database object.
     */
    function openPanicDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(PANIC_DB_NAME);
            request.onupgradeneeded = event => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(PANIC_STORE_NAME)) {
                    db.createObjectStore(PANIC_STORE_NAME, { keyPath: 'id' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Fetches all panic key settings from the IndexedDB.
     * @param {IDBDatabase} db - The database instance.
     * @returns {Promise<Array<object>>} A promise resolving with settings.
     */
    function getPanicSettings(db) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(PANIC_STORE_NAME, 'readonly');
            const store = transaction.objectStore(PANIC_STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Attaches the panic key listener with a crucial check for the AI mode.
     * @param {Array<object>} settingsArray - Array of panic key settings.
     */
    function addPanicKeyListener(settingsArray) {
        if (!settingsArray || settingsArray.length === 0) return;

        document.addEventListener('keydown', (event) => {
            // ======================================================================
            // >>> CORE REJECTION LOGIC <<<
            // If the AI chat is active, completely ignore the panic key press.
            // This prevents redirecting while the user is typing in the AI input.
            // ======================================================================
            if (isAIActive) {
                return;
            }

            // Original check for standard input fields (fallback for when AI is not active)
            const activeElement = document.activeElement.tagName.toLowerCase();
            if (['input', 'select', 'textarea'].includes(activeElement)) {
                return;
            }

            // Check for modifier keys
            const noModifiersPressed = !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey;
            if (noModifiersPressed) {
                const matchedSetting = settingsArray.find(setting => event.key.toLowerCase() === setting.key);
                if (matchedSetting) {
                    event.preventDefault();
                    window.location.href = matchedSetting.url; // 'url' property from your panic key script
                }
            }
        });
    }

    /**
     * Initializes the panic key system by fetching settings and adding the listener.
     */
    async function initializePanicKey() {
        try {
            const db = await openPanicDB();
            const settings = await getPanicSettings(db);
            if (settings && settings.length > 0) {
                addPanicKeyListener(settings);
            }
            db.close();
        } catch (error) {
            console.error("Panic Key Initialization Error:", error);
        }
    }


    //======================================================================
    // AI ACTIVATION & UI FUNCTIONALITY
    //======================================================================

    /**
     * Tries to get the user's location on script load.
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
                        let locationString = data.address.country_code === 'us' ? data.address.state : data.address.country;
                        localStorage.setItem('ai-user-location', locationString);
                    }
                } catch (error) {
                    console.error("AI location feature: Reverse geocoding failed.", error);
                }
            }, () => console.warn("AI location feature: User denied geolocation permission."));
        }
    }

    /**
     * Handles the keyboard shortcut for activating/deactivating the AI.
     */
    function handleAIActivationKey(e) {
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

    /**
     * Creates and injects the AI interface into the page.
     */
    function activateAI() {
        if (document.getElementById('ai-container')) return;

        // SET AI STATE TO ACTIVE - This will disable the panic key
        isAIActive = true;
        chatHistory = [];
        injectStyles();

        const container = document.createElement('div');
        container.id = 'ai-container';
        // ... (The rest of the `activateAI` function is identical to the previous version)
        container.onclick = (e) => {
            if (isSettingsMenuOpen && !document.getElementById('ai-settings-menu').contains(e.target)) {
                toggleSettingsMenu();
            }
        };
        const brandTitle = document.createElement('div');
        brandTitle.id = 'ai-brand-title';
        "4SP AI".split('').forEach(char => {
            const span = document.createElement('span');
            span.textContent = char;
            span.style.animationDelay = `${Math.random() * 2}s`;
            brandTitle.appendChild(span);
        });
        const welcomeMessage = document.createElement('div');
        welcomeMessage.id = 'ai-welcome-message';
        welcomeMessage.innerHTML = `
            <h2>Welcome to AI Mode</h2>
            <p>This is a beta feature. Your general location (state/country) may be shared. Message limits may apply.</p>
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
        visualInput.onkeydown = handleInputEvents;
        visualInput.oninput = handleContentEditableInput;
        const placeholder = document.createElement('div');
        placeholder.id = 'ai-input-placeholder';
        placeholder.textContent = 'Ask a question...';
        const settingsButton = document.createElement('button');
        settingsButton.id = 'ai-settings-button';
        settingsButton.innerHTML = '&#9881;';
        settingsButton.onclick = (e) => { e.stopPropagation(); toggleSettingsMenu(); };
        inputWrapper.appendChild(visualInput);
        inputWrapper.appendChild(placeholder);
        inputWrapper.appendChild(settingsButton);
        inputWrapper.appendChild(createOptionsBar());
        inputWrapper.appendChild(createSettingsMenu());
        const charCounter = document.createElement('div');
        charCounter.id = 'ai-char-counter';
        charCounter.textContent = `0 / ${USER_CHAR_LIMIT}`;
        container.appendChild(brandTitle);
        container.appendChild(welcomeMessage);
        container.appendChild(closeButton);
        container.appendChild(responseContainer);
        container.appendChild(inputWrapper);
        container.appendChild(charCounter);
        document.body.appendChild(container);
        setTimeout(() => container.classList.add('active'), 10);
        visualInput.focus();
        selectSubject(currentSubject.name);
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
        // SET AI STATE TO INACTIVE - This will re-enable the panic key
        isAIActive = false;
        isSettingsMenuOpen = false;
        chatHistory = [];
    }

    // --- All other helper functions (handleArrowKeyNavigation, callGoogleAI, etc.) remain unchanged ---
    // (For brevity, the unchanged helper functions from the previous response are omitted here,
    // but they would be included in the final script file.)
    function setCaretPosition(el, offset = 0) {
        const range = document.createRange();
        const sel = window.getSelection();
        const textNode = el.firstChild || el;
        const maxOffset = textNode.textContent ? textNode.textContent.length : 0;
        range.setStart(textNode, Math.min(offset, maxOffset));
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }
    function handleArrowKeyNavigation(e) {
        const sel = window.getSelection();
        if (!sel.isCollapsed || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        const container = range.startContainer;
        const offset = range.startOffset;
        const currentNode = container.nodeType === 3 ? container.parentNode : container;
        const nodeBefore = container.childNodes[offset - 1];
        const nodeAfter = container.childNodes[offset];
        let handled = false;
        if (e.key === 'ArrowRight' && nodeAfter && nodeAfter.matches?.('.ai-math-node')) {
            const target = nodeAfter.querySelector('[contenteditable="true"]');
            if (target) {
                setCaretPosition(target, 0);
                handled = true;
            }
        }
        else if (e.key === 'ArrowLeft' && nodeBefore && nodeBefore.matches?.('.ai-math-node')) {
            const editableChildren = Array.from(nodeBefore.querySelectorAll('[contenteditable="true"]'));
            if (editableChildren.length > 0) {
                const target = editableChildren[editableChildren.length - 1];
                setCaretPosition(target, target.textContent.length);
                handled = true;
            }
        }
        else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && currentNode.isContentEditable) {
            const parentFrac = currentNode.closest('.ai-frac');
            if (parentFrac) {
                if (e.key === 'ArrowUp' && currentNode.matches('sub')) {
                    const numerator = parentFrac.querySelector('sup');
                    setCaretPosition(numerator, offset);
                    handled = true;
                } else if (e.key === 'ArrowDown' && currentNode.matches('sup')) {
                    const denominator = parentFrac.querySelector('sub');
                    setCaretPosition(denominator, offset);
                    handled = true;
                }
            }
        }
        if (handled) {
            e.preventDefault();
        }
    }
    function fadeOutWelcomeMessage() {
        const container = document.getElementById('ai-container');
        if (container && !container.classList.contains('chat-active')) {
            container.classList.add('chat-active');
        }
    }
    function handleContentEditableInput(e) {
        fadeOutWelcomeMessage();
        const editor = e.target;
        const wrapper = document.getElementById('ai-input-wrapper');
        const now = Date.now();
        const timeDiff = now - (lastKeystrokeTime || now);
        lastKeystrokeTime = now;
        if (!wrapper.classList.contains('waiting')) {
            wrapper.style.animationPlayState = 'running';
            wrapper.style.animationDuration = timeDiff < 150 ? '0.7s' : '1.8s';
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                const activeWrapper = document.getElementById('ai-input-wrapper');
                if (activeWrapper && !activeWrapper.classList.contains('waiting')) {
                     activeWrapper.style.animationDuration = '4s';
                }
            }, 1000);
        }
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
        if (placeholder) placeholder.style.display = (rawText.length > 0 || editor.querySelector('.ai-math-node')) ? 'none' : 'block';
    }
    function parseInputForAPI(innerHTML) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = innerHTML.replace(/<div><br><\/div>/g, '\n').replace(/<br>/g, '\n');
        tempDiv.querySelectorAll('.ai-frac').forEach(frac => {
            const n = frac.querySelector('sup')?.innerText.trim() || '';
            const d = frac.querySelector('sub')?.innerText.trim() || '';
            frac.replaceWith(`(${n})/(${d})`);
        });
        tempDiv.querySelectorAll('.ai-sqrt').forEach(sqrt => {
            const content = sqrt.querySelector('.ai-sqrt-content')?.innerText.trim() || '';
            sqrt.replaceWith(`sqrt(${content})`);
        });
        tempDiv.querySelectorAll('.ai-cbrt').forEach(cbrt => {
            const content = cbrt.querySelector('.ai-cbrt-content')?.innerText.trim() || '';
            cbrt.replaceWith(`cbrt(${content})`);
        });
        tempDiv.querySelectorAll('sup').forEach(sup => sup.replaceWith(`^(${sup.innerText})`));
        return tempDiv.innerText.replace(/×/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi');
    }
    function handleInputEvents(e) {
        const editor = e.target;
        if (e.key.startsWith('Arrow')) {
            handleArrowKeyNavigation(e);
        }
        if (e.key === 'Backspace') {
            const selection = window.getSelection();
            if (selection.rangeCount > 0 && selection.isCollapsed) {
                const range = selection.getRangeAt(0);
                const nodeBefore = range.startContainer.childNodes[range.startOffset - 1];
                if (nodeBefore && nodeBefore.nodeType === 1 && nodeBefore.classList.contains('ai-math-node')) {
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
                let contextPrefix = `(User is focusing on the subject: ${currentSubject.name}.`;
                if (location) {
                    contextPrefix += ` User is located in ${location}.`;
                }
                contextPrefix += ') ';
                query = contextPrefix + query;
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
            callGoogleAI(query, responseBubble);
        }
    }
    function parseGeminiResponse(text) {
        let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html = html.replace(/\\boxed{([\s\S]*?)}/g, (match, content) => `<div class="ai-boxed-answer">${parseGeminiResponse(content)}</div>`);
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
            if (!response.ok) throw new Error(`Network response was not ok. Status: ${response.status}`);
            const data = await response.json();
            if (!data.candidates || data.candidates.length === 0) {
                 throw new Error('No candidates received from API.');
            }
            const text = data.candidates[0].content.parts[0].text;
            chatHistory.push({ role: "model", parts: [{ text: text }] });
            responseBubble.innerHTML = `<div class="ai-response-content">${parseGeminiResponse(text)}</div>`;
        } catch (error) {
            console.error('AI API Error:', error);
            responseBubble.innerHTML = `<div class="ai-error">Sorry, an error occurred. Please try again.</div>`;
        } finally {
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
    function toggleSettingsMenu() {
        isSettingsMenuOpen = !isSettingsMenuOpen;
        const menu = document.getElementById('ai-settings-menu');
        const button = document.getElementById('ai-settings-button');
        menu.classList.toggle('active', isSettingsMenuOpen);
        button.classList.toggle('active', isSettingsMenuOpen);
    }
    function selectSubject(subjectName) {
        currentSubject = subjects.find(s => s.name === subjectName);
        document.querySelectorAll('#ai-settings-menu button').forEach(btn => {
            btn.classList.toggle('selected', btn.textContent === subjectName);
        });
        const inputWrapper = document.getElementById('ai-input-wrapper');
        inputWrapper.classList.toggle('options-active', currentSubject.hasMath);
        document.getElementById('ai-input-placeholder').textContent = `Ask a ${currentSubject.name} question...`;
        if (isSettingsMenuOpen) {
            toggleSettingsMenu();
        }
    }
    function insertAtCursor(html) {
        const editor = document.getElementById('ai-input');
        if (!editor) return;
        editor.focus();
        document.execCommand('insertHTML', false, html);
        handleContentEditableInput({target: editor});
    }
    function createOptionsBar() {
        const bar = document.createElement('div');
        bar.id = 'ai-options-bar';
        const buttons = [
            { t: '+', v: '+' }, { t: '-', v: '-' }, { t: '×', v: '×' }, { t: '÷', v: '÷' },
            { t: 'x/y', v: '<span class="ai-math-node ai-frac" contenteditable="false"><sup contenteditable="true"></sup><span>/</span><sub contenteditable="true"></sub></span>&nbsp;' },
            { t: '√', v: '<span class="ai-math-node ai-sqrt" contenteditable="false">√(<span class="ai-sqrt-content" contenteditable="true"></span>)</span>&nbsp;' },
            { t: '∛', v: '<span class="ai-math-node ai-cbrt" contenteditable="false">∛(<span class="ai-cbrt-content" contenteditable="true"></span>)</span>&nbsp;' },
            { t: 'x²', v: '<sup>2</sup>' },
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
    function createSettingsMenu() {
        const menu = document.createElement('div');
        menu.id = 'ai-settings-menu';
        subjects.forEach(subject => {
            const button = document.createElement('button');
            button.textContent = subject.name;
            button.onclick = (e) => {
                e.stopPropagation();
                selectSubject(subject.name);
            };
            menu.appendChild(button);
        });
        return menu;
    }
    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;
        const style = document.createElement('style');
        style.id = 'ai-dynamic-styles';
        style.innerHTML = `
            :root { --ai-red: #ea4335; --ai-blue: #4285f4; --ai-green: #34a853; --ai-yellow: #fbbc05; }
            /* ... The rest of the CSS is identical to the previous version ... */
            #ai-container {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: linear-gradient(-45deg, #12121c, #1a1a2e, #2a2a3a, #1a1a2e);
                background-size: 400% 400%;
                animation: gradientBG 25s ease infinite;
                backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
                z-index: 2147483647; opacity: 0; transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; display: flex; flex-direction: column; padding-top: 70px; box-sizing: border-box;
            }
            #ai-container.active { opacity: 1; }
            #ai-brand-title {
                position: absolute; top: 25px; left: 30px;
                font-size: 24px; font-weight: bold;
                background: linear-gradient(to right, var(--ai-red), var(--ai-yellow), var(--ai-green), var(--ai-blue));
                -webkit-background-clip: text; background-clip: text; color: transparent;
                animation: brand-slide 10s linear infinite; background-size: 400% 100%;
                opacity: 1; transition: opacity 0.5s 0.2s;
            }
            #ai-container.chat-active #ai-brand-title { opacity: 0; pointer-events: none; }
            #ai-brand-title span { animation: brand-pulse 2s ease-in-out infinite; display: inline-block; }
            #ai-welcome-message {
                position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                text-align: center; color: rgba(255,255,255,0.5);
                opacity: 1; transition: opacity 0.5s; width: 100%;
            }
            #ai-container.chat-active #ai-welcome-message { opacity: 0; pointer-events: none; }
            #ai-welcome-message h2 { font-size: 2.5em; margin: 0; color: #fff; font-weight: 600; }
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
            .ai-math-inline { color: #a5d6ff; font-family: monospace; font-size: 1.1em; }
            .ai-boxed-answer { border: 1px solid var(--ai-green); background: rgba(52, 168, 83, 0.1); border-radius: 8px; padding: 12px; margin: 10px 0; }
            .ai-frac { display: inline-flex; flex-direction: column; text-align: center; vertical-align: middle; }
            .ai-frac > sup, .ai-frac > sub { display: block; line-height: 1; min-width: 1ch; padding: 0.1em 0.3em; }
            .ai-frac > sup { border-bottom: 1px solid currentColor; }
            .ai-frac > span { display: none; }
            #ai-input sup, #ai-input sub { outline: none; }
            #ai-input-wrapper {
                flex-shrink: 0; position: relative; opacity: 0; transform: translateY(100px);
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                margin: 15px auto 30px; width: 90%; max-width: 800px;
                border-radius: 25px; background: rgba(10, 10, 10, 0.7);
                backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
                animation: glow 2.5s infinite; animation-play-state: paused;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            #ai-input-wrapper.waiting { animation: gemini-glow 4s linear infinite !important; animation-play-state: running !important; }
            #ai-container.active #ai-input-wrapper { opacity: 1; transform: translateY(0); }
            #ai-input {
                min-height: 50px; color: white; font-size: 1.1em;
                padding: 12px 50px 12px 20px; box-sizing: border-box;
                word-wrap: break-word; outline: none;
            }
            #ai-input [contenteditable="true"] { outline: none; }
            #ai-input-placeholder { position: absolute; top: 14px; left: 20px; color: rgba(255,255,255,0.4); pointer-events: none; font-size: 1.1em; }
            #ai-settings-button { position: absolute; right: 10px; top: 25px; transform: translateY(-50%); background: none; border: none; color: rgba(255,255,255,0.5); font-size: 24px; cursor: pointer; padding: 5px; line-height: 1; transition: color 0.2s, transform 0.3s; z-index: 12; }
            #ai-settings-button:hover, #ai-settings-button.active { color: white; }
            #ai-settings-button.active { transform: translateY(-50%) rotate(90deg); }
            #ai-settings-menu {
                position: absolute; bottom: 120%; right: 0;
                background: linear-gradient(135deg, rgba(30, 30, 40, 0.9), rgba(50, 50, 60, 0.9));
                backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 15px;
                padding: 10px;
                display: flex;
                flex-direction: column;
                gap: 8px;
                opacity: 0; visibility: hidden;
                transform: translateY(10px) scale(0.95);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 10;
            }
            #ai-settings-menu.active { opacity: 1; visibility: visible; transform: translateY(0) scale(1); }
            #ai-settings-menu button { background: transparent; border: none; color: rgba(255, 255, 255, 0.7); font-size: 1em; text-align: left; padding: 8px 12px; border-radius: 8px; cursor: pointer; transition: background 0.2s, color 0.2s; }
            #ai-settings-menu button:hover { background: rgba(255, 255, 255, 0.1); color: white; }
            #ai-settings-menu button.selected { background: var(--ai-blue); color: white; font-weight: bold; }
            #ai-options-bar {
                display: flex; overflow-x: auto; background: rgba(0,0,0,0.3);
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                border-top: 1px solid transparent; max-height: 0; opacity: 0; visibility: hidden;
            }
            #ai-input-wrapper.options-active #ai-options-bar { max-height: 50px; opacity: 1; visibility: visible; padding: 8px 15px; border-top: 1px solid rgba(255,255,255,0.1); }
            #ai-options-bar button { background: rgba(255,255,255,0.1); border: none; border-radius: 8px; color: white; font-size: 1.1em; cursor: pointer; padding: 5px 10px; transition: background 0.2s; flex-shrink: 0; margin-right: 8px; }
            #ai-options-bar button:hover { background: rgba(255,255,255,0.2); }
            #ai-char-counter { position: fixed; bottom: 10px; right: 20px; font-size: 0.8em; color: rgba(255, 255, 255, 0.4); z-index: 2; user-select: none; }
            .ai-error { text-align: center; color: var(--ai-red); }
            .ai-loader { width: 25px; height: 25px; border: 3px solid rgba(255, 255, 255, 0.3); border-top-color: #fff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto; }
            @keyframes gradientBG { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
            @keyframes glow { 0%, 100% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.2), 0 0 10px rgba(255, 255, 255, 0.1); } 50% { box-shadow: 0 0 15px rgba(255, 255, 255, 0.5), 0 0 25px rgba(255, 255, 255, 0.3); } }
            @keyframes gemini-glow { 0%, 100% { box-shadow: 0 0 8px 2px var(--ai-blue); } 25% { box-shadow: 0 0 8px 2px var(--ai-green); } 50% { box-shadow: 0 0 8px 2px var(--ai-yellow); } 75% { box-shadow: 0 0 8px 2px var(--ai-red); } }
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes message-pop-in { 0% { opacity: 0; transform: translateY(10px) scale(0.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes brand-slide { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
            @keyframes brand-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        `;
        document.head.appendChild(style);
    }


    // --- SCRIPT INITIALIZATION ---
    getLocationOnLoad();
    initializePanicKey(); // Set up the panic key listener on script load
    document.addEventListener('keydown', handleAIActivationKey); // Listen for AI activation

})();
