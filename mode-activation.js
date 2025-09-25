/**
 * @file gemini-injector.js
 * @version 2.0
 * @description Injects a highly customizable, Gemini-styled AI chat interface into any webpage.
 *
 * This script provides a powerful, self-contained chat environment with selectable AI personas,
 * dynamic theming, and context-aware tools. It maintains a professional and clean aesthetic.
 *
 * Activation Shortcut:
 * - Press `Ctrl + C` when no text is selected on the page.
 *
 * Deactivation Methods:
 * - Click the '×' button in the top-right corner.
 * - Press `Ctrl + C` when the chat input box is empty.
 *
 * Core Features:
 * - **Helper Types**: A settings menu allows switching between various AI personas (e.g., Math, History, Science), which alters the AI's response style.
 * - **Dynamic Theming**: Each helper type applies a unique accent color to the UI for clear visual feedback.
 * - **Secret Timestamps & Context**: Invisibly prepends the system time and selected persona to every message for enhanced AI context.
 * - **Conditional Math Toolbar**: A rich math symbol toolbar automatically appears when a scientific or mathematical helper type is selected.
 * - **Rich WYSIWYG Input**: A `contenteditable` input that supports real-time LaTeX-to-symbol conversion and custom elements like fractions.
 * - **Full Rendering**: Renders AI responses containing Markdown, code blocks, and LaTeX-style mathematics.
 */

(function() {
    // --- SCRIPT CONFIGURATION ---
    const API_KEY = 'YOUR_GOOGLE_AI_API_KEY_HERE';
    const API_URL = `https://generativelace.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;
    const USER_CHAR_LIMIT = 2000;

    // --- STATE MANAGEMENT ---
    let isAIActive = false;
    let isRequestPending = false;
    let chatHistory = [];
    let currentMode = 'general'; // The default helper type.

    // --- HELPER TYPE DEFINITIONS ---
    const helperModes = {
        general: {
            label: 'General Assistant',
            systemPrompt: 'You are a helpful and professional general-purpose AI assistant.',
            themeColor: '#8E9397', // Neutral Gray
            showMathBar: false
        },
        math: {
            label: 'Math',
            systemPrompt: 'You are an expert mathematician. Provide clear, logical, step-by-step solutions. Use LaTeX for all mathematical expressions.',
            themeColor: '#4285F4', // Google Blue
            showMathBar: true
        },
        language_arts: {
            label: 'Language Arts',
            systemPrompt: 'You are an expert in literature and language arts. Provide insightful analysis of texts, grammar, and writing styles.',
            themeColor: '#EA4335', // Google Red
            showMathBar: false
        },
        science: {
            label: 'Science',
            systemPrompt: 'You are a science communicator. Explain complex scientific concepts clearly and concisely for a broad audience.',
            themeColor: '#34A853', // Google Green
            showMathBar: true
        },
        biology: {
            label: 'Biology',
            systemPrompt: 'You are a biologist. Provide detailed and accurate information on biological systems, from molecular to ecological levels.',
            themeColor: '#00A86B', // Jade Green
            showMathBar: false
        },
        chemistry: {
            label: 'Chemistry',
            systemPrompt: 'You are a chemist. Provide precise explanations of chemical reactions, principles, and molecular structures.',
            themeColor: '#F9A825', // Bright Yellow
            showMathBar: true
        },
        american_history: {
            label: 'American History',
            systemPrompt: 'You are an American History expert. Provide detailed, factual, and nuanced accounts of events, figures, and developments in U.S. history.',
            themeColor: '#B22234', // Old Glory Red
            showMathBar: false
        },
        ancient_history: {
            label: 'Ancient History',
            systemPrompt: 'You are an expert on ancient civilizations. Provide detailed information about ancient history, cultures, and archaeology.',
            themeColor: '#C8A464', // Papyrus Tan
            showMathBar: false
        }
    };

    const latexSymbolMap = {
        '\\pi': 'π', '\\theta': 'θ', '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ',
        '\\delta': 'δ', '\\epsilon': 'ε', '\\infty': '∞', '\\pm': '±', '\\times': '×',
        '\\div': '÷', '\\cdot': '·', '\\degree': '°', '\\le': '≤', '\\ge': '≥', '\\ne': '≠',
        '\\approx': '≈', '\\equiv': '≡', '\\therefore': '∴', '\\because': '∵',
    };
    
    // --- INITIALIZATION ---
    document.addEventListener('keydown', handleActivationShortcut);
    initializeUserLocation();

    // --- CORE FUNCTIONS ---

    function initializeUserLocation() { /* ... (Function is unchanged from previous version) ... */ }
    function getCurrentDateTimeString() { /* ... (Function is unchanged from previous version) ... */ }

    function handleActivationShortcut(e) {
        if (e.ctrlKey && e.key.toLowerCase() === 'c') {
            const selection = window.getSelection().toString();
            const input = document.getElementById('gemini-input');
            if (isAIActive && input && input.innerText.trim().length === 0 && selection.length === 0) {
                e.preventDefault();
                deactivateAI();
            } else if (!isAIActive && selection.length === 0) {
                e.preventDefault();
                activateAI();
            }
        }
    }

    function activateAI() {
        if (document.getElementById('gemini-container')) return;

        chatHistory = [];
        injectStyles();

        const container = document.createElement('div');
        container.id = 'gemini-container';
        container.style.setProperty('--theme-accent-color', helperModes[currentMode].themeColor);

        const title = createDOMElement('div', 'gemini-title', 'Gemini');
        const settingsButton = createSettingsButton();
        const closeButton = createDOMElement('div', 'gemini-close-button', '&times;');
        closeButton.onclick = deactivateAI;
        
        const topBar = createDOMElement('div', 'gemini-top-bar');
        topBar.append(title, settingsButton, closeButton);

        const settingsMenu = createSettingsMenu();
        const responseContainer = createDOMElement('div', 'gemini-response-container');
        const inputWrapper = createInputArea();

        container.append(topBar, settingsMenu, responseContainer, inputWrapper);
        document.body.appendChild(container);

        requestAnimationFrame(() => {
            container.classList.add('active');
            document.getElementById('gemini-input').focus();
        });
        isAIActive = true;
    }

    function deactivateAI() {
        const container = document.getElementById('gemini-container');
        if (container) {
            container.classList.remove('active');
            setTimeout(() => container.remove(), 500);
        }
        isAIActive = false;
    }
    
    function createDOMElement(tag, id, innerHTML) { /* ... (Function is unchanged) ... */ }

    // --- UI CREATION ---

    function createSettingsButton() {
        const button = createDOMElement('button', 'gemini-settings-button', '⚙️');
        button.onclick = (e) => {
            e.stopPropagation();
            toggleSettingsMenu();
        };
        return button;
    }
    
    function createSettingsMenu() {
        const menu = createDOMElement('div', 'gemini-settings-menu');
        menu.innerHTML = '<h4>Select Helper Type</h4>';

        Object.keys(helperModes).forEach(key => {
            const mode = helperModes[key];
            const item = document.createElement('button');
            item.className = 'gemini-settings-item';
            item.textContent = mode.label;
            item.dataset.mode = key;
            if (key === currentMode) {
                item.classList.add('active');
            }
            item.onclick = () => setMode(key);
            menu.appendChild(item);
        });

        // Close menu when clicking outside of it
        document.addEventListener('click', (e) => {
            if (isAIActive && !menu.contains(e.target) && !document.getElementById('gemini-settings-button').contains(e.target)) {
                 menu.classList.remove('active');
            }
        }, true);
        
        return menu;
    }

    function createInputArea() {
        const wrapper = createDOMElement('div', 'gemini-input-wrapper');
        const input = createDOMElement('div', 'gemini-input');
        input.contentEditable = true;
        input.onkeydown = handleInputSubmission;
        input.oninput = handleWYSIWYGInput;

        const placeholder = createDOMElement('div', 'gemini-input-placeholder', 'Ask anything...');
        const charCounter = createDOMElement('div', 'gemini-char-counter', `0 / ${USER_CHAR_LIMIT}`);
        const optionsBar = createOptionsBar();
        
        wrapper.append(input, placeholder, charCounter, optionsBar);
        return wrapper;
    }
    
    function createOptionsBar() {
        const bar = createDOMElement('div', 'gemini-options-bar');
        const buttons = [
            { t: '+', v: '+' }, { t: '-', v: '-' }, { t: '×', v: '×' }, { t: '÷', v: '÷' },
            { t: 'x/y', v: '<span class="gemini-frac" contenteditable="false"><sup contenteditable="true">num</sup><sub contenteditable="true">den</sub></span>&nbsp;' }, 
            { t: '√', v: '√()' }, { t: '∛', v: '∛()' }, { t: 'x²', v: '<sup>2</sup>' },
            { t: 'π', v: 'π' }, { t: 'θ', v: 'θ' }, { t: '∞', v: '∞' }, { t: '°', v: '°' },
            { t: '≤', v: '≤' }, { t: '≥', v: '≥' }, { t: '≠', v: '≠' }
        ];
        buttons.forEach(btn => {
            const buttonEl = document.createElement('button');
            buttonEl.innerHTML = btn.t;
            buttonEl.onclick = (e) => { e.stopPropagation(); insertAtCursor(btn.v); };
            bar.appendChild(buttonEl);
        });
        return bar;
    }

    // --- EVENT HANDLING & LOGIC ---

    function toggleSettingsMenu() {
        document.getElementById('gemini-settings-menu').classList.toggle('active');
    }
    
    function setMode(modeKey) {
        if (!helperModes[modeKey]) return;
        currentMode = modeKey;
        const mode = helperModes[modeKey];

        // Update theme color
        document.getElementById('gemini-container').style.setProperty('--theme-accent-color', mode.themeColor);

        // Update math bar visibility
        document.getElementById('gemini-container').classList.toggle('math-mode-active', mode.showMathBar);
        
        // Update active button in settings menu
        const menu = document.getElementById('gemini-settings-menu');
        menu.querySelectorAll('.gemini-settings-item').forEach(item => {
            item.classList.toggle('active', item.dataset.mode === modeKey);
        });

        menu.classList.remove('active'); // Close menu after selection
    }
    
    function insertAtCursor(html) {
        const editor = document.getElementById('gemini-input');
        if (!editor) return;
        editor.focus();
        document.execCommand('insertHTML', false, html);
        handleWYSIWYGInput({target: editor});
    }

    function handleWYSIWYGInput(e) { /* ... (Function is largely unchanged) ... */ }
    
    /**
     * Parses the visually formatted HTML from the input into plain text for the API.
     */
    function parseInputForAPI(innerHTML) {
        const tempDiv = document.createElement('div');
        // Standardize line breaks
        tempDiv.innerHTML = innerHTML.replace(/<div><br><\/div>/g, '\n').replace(/<br>/g, '\n');
        
        // Convert fractions
        tempDiv.querySelectorAll('.gemini-frac').forEach(frac => {
            const n = frac.querySelector('sup')?.innerText.trim() || '';
            const d = frac.querySelector('sub')?.innerText.trim() || '';
            frac.replaceWith(`(${n})/(${d})`);
        });

        // Convert superscripts
        tempDiv.querySelectorAll('sup').forEach(sup => sup.replaceWith(`^(${sup.innerText})`));

        return tempDiv.innerText;
    }


    async function handleInputSubmission(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const editor = e.target;
            const userHtmlContent = editor.innerHTML;
            const query = parseInputForAPI(userHtmlContent).trim();

            if (!query || isRequestPending) return;

            appendMessage(userHtmlContent, 'user');
            
            const mode = helperModes[currentMode];
            const systemPrompt = `[Persona: ${mode.systemPrompt}]`;
            const dateTime = `[System Time: ${getCurrentDateTimeString()}]`;

            let fullQuery = query;
            if (chatHistory.length === 0) {
                const location = localStorage.getItem('gemini-injector-location');
                if (location) {
                    fullQuery = `(User is in ${location}) ${fullQuery}`;
                }
            }
            
            fullQuery = `${systemPrompt}\n${dateTime}\n${fullQuery}`;

            chatHistory.push({ role: "user", parts: [{ text: fullQuery }] });
            sendToAI();

            editor.innerHTML = '';
            handleWYSIWYGInput({ target: editor });
        }
    }
    
    function appendMessage(content, type) { /* ... (Function is unchanged) ... */ }
    async function sendToAI() { /* ... (Function is unchanged) ... */ }
    function parseAIResponse(text) { /* ... (Function is unchanged) ... */ }

    // --- STYLES ---

    function injectStyles() {
        if (document.getElementById('gemini-dynamic-styles')) return;

        // Assumes 'SecondaryFont' is loaded elsewhere or is a system font.
        // You can add the @font-face rule here if needed.

        const style = document.createElement('style');
        style.id = 'gemini-dynamic-styles';
        style.innerHTML = `
            :root { --theme-accent-color: #8E9397; }
            #gemini-container { /* ... (Container styling mostly unchanged) ... */ }
            #gemini-container.active { opacity: 1; }

            .gemini-top-bar {
                position: absolute; top: 0; left: 0; right: 0; height: 70px;
                display: flex; align-items: center; padding: 0 30px;
            }
            .gemini-title { font-size: 20px; font-weight: 600; color: var(--theme-accent-color); transition: color 0.3s ease; }
            .gemini-settings-button {
                background: none; border: none; font-size: 22px; cursor: pointer;
                color: rgba(255, 255, 255, 0.6); margin-left: 16px; transition: color 0.2s, transform 0.3s;
            }
            .gemini-settings-button:hover { color: white; transform: rotate(45deg); }
            .gemini-close-button { margin-left: auto; /* ... (Styling mostly unchanged) ... */ }
            
            #gemini-settings-menu {
                position: absolute; top: 75px; left: 30px;
                background: rgba(40, 42, 48, 0.8);
                backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                padding: 12px;
                z-index: 10;
                opacity: 0; visibility: hidden;
                transform: translateY(-10px);
                transition: opacity 0.3s ease, transform 0.3s ease, visibility 0.3s;
                display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
            }
            #gemini-settings-menu.active { opacity: 1; visibility: visible; transform: translateY(0); }
            #gemini-settings-menu h4 {
                grid-column: 1 / -1; margin: 0 0 8px; font-weight: 500;
                color: rgba(255, 255, 255, 0.9);
            }
            .gemini-settings-item {
                background: rgba(255, 255, 255, 0.05); border: 1px solid transparent;
                color: rgba(255, 255, 255, 0.8);
                border-radius: 8px; padding: 8px 12px; text-align: center;
                cursor: pointer; transition: background 0.2s, border-color 0.2s;
            }
            .gemini-settings-item:hover { background: rgba(255, 255, 255, 0.1); }
            .gemini-settings-item.active {
                background: var(--theme-accent-color);
                color: white; font-weight: 600;
                border-color: rgba(255, 255, 255, 0.8);
            }

            .gemini-response-container { /* ... (Styling mostly unchanged) ... */ }
            .gemini-message-bubble { /* ... (Styling mostly unchanged) ... */ }
            .gemini-user-message {
                align-self: flex-end; background: #1E2023;
                border: 1px solid var(--theme-accent-color);
            }
            .gemini-gemini-message { align-self: flex-start; }
            
            #gemini-input-wrapper {
                /* ... (Styling mostly unchanged, but using var for focus) ... */
                border: 1px solid rgba(255, 255, 255, 0.2);
                transition: box-shadow 0.3s ease, border-color 0.3s ease;
            }
            #gemini-input:focus-within {
                border-color: var(--theme-accent-color);
                box-shadow: 0 0 8px 0px var(--theme-accent-color);
            }
            #gemini-input-wrapper.waiting {
                border-color: var(--theme-accent-color);
                animation: gemini-wait-pulse 2s infinite;
            }
            
            #gemini-options-bar {
                display: flex; overflow-x: auto; background: rgba(0,0,0,0.3);
                border-top: 1px solid rgba(255,255,255,0.1);
                transition: max-height 0.4s ease, opacity 0.4s ease, padding 0.4s ease;
                max-height: 0; opacity: 0; visibility: hidden; padding: 0 15px;
            }
            #gemini-container.math-mode-active #gemini-options-bar {
                max-height: 50px; opacity: 1; visibility: visible; padding: 8px 15px;
            }
            #gemini-options-bar button { /* ... (Styling is similar to original) ... */ }
            
            .gemini-frac {
                display: inline-flex; flex-direction: column; text-align: center;
                vertical-align: middle; background: rgba(0,0,0,0.2); padding: 0.1em 0.4em;
                border-radius: 5px; margin: 0 0.1em;
            }
            .gemini-frac > sup { border-bottom: 1px solid currentColor; padding-bottom: 0.15em; }
            .gemini-frac > sub { padding-top: 0.15em; }
            #gemini-input sup, #gemini-input sub { outline: none; }
            
            @keyframes gemini-wait-pulse {
                50% { box-shadow: 0 0 10px 0px var(--theme-accent-color); }
            }
        `;
        document.head.appendChild(style);
    }
})();
