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
 * - Poppy and bubbly animations for a friendly user experience.
 * - Chat history is saved between activations but clears on page refresh.
 * - A dynamic, WYSIWYG contenteditable input with real-time LaTeX-to-symbol conversion.
 * - Keyboard-first arrow key navigation for all math symbols.
 * - Intelligent placeholders in math symbols that clear on input.
 * - A horizontally scrollable, expanded math options bar.
 * - A file uploader for up to 3 text-based files to provide context to the AI.
 * - AI responses render Markdown, LaTeX-style math, and code blocks.
 */

(function() {
    // --- CONFIGURATION ---
    const API_KEY = 'AIzaSyDcoUA4Js1oOf1nz53RbLaxUzD0GxTmKXA';
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;
    const USER_CHAR_LIMIT = 500;

    // --- STATE MANAGEMENT ---
    let isAIActive = false;
    let isRequestPending = false;
    let isMathModeActive = false;
    let lastRequestTime = 0;
    const COOLDOWN_PERIOD = 5000;
    let chatHistory = [], chatHTML = '', attachedFiles = [];
    const latexSymbolMap = {
        '\\pi': 'π', '\\theta': 'θ', '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ',
        '\\delta': 'δ', '\\epsilon': 'ε', '\\infty': '∞', '\\pm': '±',
        '\\times': '×', '\\div': '÷', '\\cdot': '·', '\\degree': '°',
        '\\le': '≤', '\\ge': '≥', '\\ne': '≠',
        '\\approx': '≈', '\\equiv': '≡', '\\therefore': '∴', '\\because': '∵',
        '\\int': '∫', '\\sum': '∑', '\\prod': '∏', '\\sqrt': '√'
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
                } catch (error) { console.error("AI location feature: Reverse geocoding failed.", error); }
            }, () => { console.warn("AI location feature: User denied geolocation permission."); });
        }
    }
    
    function handleGlobalKeyDown(e) {
        if (e.ctrlKey && e.key.toLowerCase() === 'c') {
            const activeEl = document.activeElement;
            const isEditing = activeEl.isContentEditable || ['INPUT', 'TEXTAREA'].includes(activeEl.tagName);
            const selection = window.getSelection().toString();
            
            if (isAIActive) {
                const editor = document.getElementById('ai-input');
                if (editor && editor.innerText.trim().length === 0 && selection.length === 0 && !isEditing) {
                    e.preventDefault();
                    deactivateAI();
                }
            } else if (selection.length === 0 && !isEditing) {
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
                <div class="welcome-content">
                    <div id="ai-brand-title"></div>
                    <p>This is a beta feature. Your general location will be shared with your first message.</p>
                </div>
            </div>
            <div id="ai-response-container"></div>
            <div id="ai-input-wrapper">
                <div id="ai-attachment-container"></div>
                <div class="ai-input-container">
                    <div id="ai-input" contenteditable="true"></div>
                    <div id="ai-input-placeholder">Ask a question...</div>
                    <button id="ai-file-upload-btn" title="Attach up to 3 files"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg></button>
                    <button id="ai-math-toggle" title="Math options">&#8942;</button>
                </div>
            </div>
            <div id="ai-char-counter">0 / ${USER_CHAR_LIMIT}</div>
            <div id="ai-close-button">&times;</div>
            <input type="file" id="ai-file-input" hidden multiple accept=".txt,.js,.html,.css,.json,.md,.py,.java,.c,.cpp,.cs,.php,.rb,.go,.rs,.swift,.kt,.xml,.sh">
        `;
        document.body.appendChild(container);

        const responseContainer = document.getElementById('ai-response-container');
        responseContainer.innerHTML = chatHTML;
        if (chatHistory.length > 0) {
            fadeOutWelcomeMessage();
            responseContainer.scrollTop = responseContainer.scrollHeight;
        }
        
        const brandTitle = document.getElementById('ai-brand-title');
        const brandText = "4SP AI";
        brandText.split('').forEach(char => {
            const span = document.createElement('span');
            span.textContent = char;
            span.style.animationDelay = `${Math.random() * 2}s`;
            brandTitle.appendChild(span);
        });

        const visualInput = document.getElementById('ai-input');
        visualInput.onkeydown = handleEditorKeyDown;
        visualInput.oninput = handleContentEditableInput;
        visualInput.onpaste = handlePaste;
        document.getElementById('ai-close-button').onclick = deactivateAI;
        document.getElementById('ai-math-toggle').onclick = (e) => { e.stopPropagation(); toggleMathMode(); };
        document.getElementById('ai-file-upload-btn').onclick = (e) => { e.currentTarget.classList.add('poppy'); document.getElementById('ai-file-input').click(); };
        document.getElementById('ai-file-input').onchange = handleFileSelect;
        document.getElementById('ai-input-wrapper').appendChild(createOptionsBar());
        
        container.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('animationend', () => btn.classList.remove('poppy'));
        });
        
        setTimeout(() => container.classList.add('active'), 10);
        visualInput.focus();
        isAIActive = true;
    }

    function moveCaretTo(element, position = 'end') {
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(element);
        range.collapse(position === 'start');
        selection.removeAllRanges();
        selection.addRange(range);
    }
    
    function handlePlaceholderInteraction(e) {
        const target = e.currentTarget;
        if (target.classList.contains('placeholder')) {
            if (e.type === 'focus') {
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(target);
                selection.removeAllRanges();
                selection.addRange(range);
            } else if (e.type === 'keydown') {
                target.textContent = '';
                target.classList.remove('placeholder');
                target.onkeydown = null;
                target.onfocus = null;
            }
        }
    }
    
    function handleEditorKeyDown(e) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const isCollapsed = range.collapsed;
        
        if (isCollapsed) {
            const currentNode = range.startContainer;
            const parentElement = currentNode.nodeType === 1 ? currentNode : currentNode.parentElement;
            
            if (e.key === 'ArrowRight' && range.startOffset === currentNode.textContent.length) {
                const nextElem = parentElement.closest('span')?.nextElementSibling;
                if (nextElem && (nextElem.classList.contains('ai-frac') || nextElem.classList.contains('ai-root'))) {
                    e.preventDefault();
                    moveCaretTo(nextElem.querySelector('[contenteditable="true"]'), 'start');
                }
            } else if (e.key === 'ArrowLeft' && range.startOffset === 0) {
                const prevElem = parentElement.closest('span')?.previousElementSibling;
                if (prevElem && (prevElem.classList.contains('ai-frac') || prevElem.classList.contains('ai-root'))) {
                    e.preventDefault();
                    const editables = prevElem.querySelectorAll('[contenteditable="true"]');
                    moveCaretTo(editables[editables.length - 1], 'end');
                }
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                const frac = parentElement.closest('.ai-frac');
                if (frac) {
                    e.preventDefault();
                    const targetSelector = (parentElement.tagName === 'SUP' && e.key === 'ArrowDown') ? 'sub' : (parentElement.tagName === 'SUB' && e.key === 'ArrowUp') ? 'sup' : null;
                    if (targetSelector) moveCaretTo(frac.querySelector(targetSelector), 'start');
                }
            }
        }
        
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitQuery();
        } else if (e.key === 'Backspace') {
            handleBackspace(e);
        }
    }

    function handleBackspace(e) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && selection.getRangeAt(0).collapsed) {
            const range = selection.getRangeAt(0);
            if (range.startOffset === 0) {
                const nodeBefore = range.startContainer.parentElement.closest('span')?.previousElementSibling;
                if (nodeBefore && (nodeBefore.classList.contains('ai-frac') || nodeBefore.classList.contains('ai-root') || nodeBefore.tagName === 'SUP')) {
                    e.preventDefault();
                    nodeBefore.remove();
                    handleContentEditableInput();
                }
            }
        }
    }

    function submitQuery() {
        fadeOutWelcomeMessage();
        const editor = document.getElementById('ai-input');
        let query = parseInputForAPI(editor.innerHTML);
        if ((!query && attachedFiles.length === 0) || isRequestPending) return;
        const now = Date.now();
        if (now - lastRequestTime < COOLDOWN_PERIOD) return;

        isRequestPending = true;
        lastRequestTime = now;
        editor.contentEditable = false;
        document.getElementById('ai-input-wrapper').classList.add('waiting');
        
        let contextualQuery = query;
        const dateTimeString = new Date().toLocaleString();
        contextualQuery = `(User's local time: ${dateTimeString}) ${contextualQuery}`;
        if (chatHistory.length === 0) {
            const location = localStorage.getItem('ai-user-location');
            if (location) contextualQuery = `(User is located in ${location}) ${contextualQuery}`;
        }
        if (attachedFiles.length > 0) {
            const fileContext = attachedFiles.map(f => `CONTEXT FROM FILE (${f.name}):\n\n${f.content}`).join('\n\n---\n\n');
            contextualQuery = `${fileContext}\n\n---\n\nUSER QUERY:\n${contextualQuery}`;
        }
        
        chatHistory.push({ role: "user", parts: [{ text: contextualQuery }] });

        const responseContainer = document.getElementById('ai-response-container');
        const userBubble = document.createElement('div');
        userBubble.className = 'ai-message-bubble user-message';
        let userBubbleHTML = editor.innerHTML;
        if (attachedFiles.length > 0) {
            userBubbleHTML = `<div class="attachment-chip-container">${attachedFiles.map(f => `<div class="attachment-chip">${f.name}</div>`).join('')}</div>` + userBubbleHTML;
        }
        userBubble.innerHTML = userBubbleHTML;
        responseContainer.appendChild(userBubble);
        
        attachedFiles = [];
        renderAttachments();

        const responseBubble = document.createElement('div');
        responseBubble.className = 'ai-message-bubble gemini-response loading';
        responseBubble.innerHTML = `<div class="ai-typing-indicator"><span></span><span></span><span></span></div>`;
        responseContainer.appendChild(responseBubble);
        responseContainer.scrollTop = responseContainer.scrollHeight;

        editor.innerHTML = '';
        handleContentEditableInput();
        callGoogleAI(contextualQuery, responseBubble);
    }
    
    function handlePaste(e) {
        e.preventDefault();
        const editor = e.target;
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        const currentText = editor.innerText;

        if (currentText.length + pastedText.length > USER_CHAR_LIMIT) {
            if (attachedFiles.length >= 3) {
                alert("You cannot attach more than 3 files. Your pasted text was not added.");
                return;
            }
            const fileId = `file_paste_${Date.now()}`;
            attachedFiles.push({ id: fileId, name: 'paste.txt', content: pastedText });
            renderAttachments();
        } else {
            document.execCommand('insertText', false, pastedText);
        }
    }

    function deactivateAI() {
        const container = document.getElementById('ai-container');
        if (container) {
            chatHTML = document.getElementById('ai-response-container').innerHTML;
            container.classList.remove('active');
            setTimeout(() => {
                container.remove();
                document.getElementById('ai-dynamic-styles')?.remove();
            }, 500);
        }
        isAIActive = false;
        isMathModeActive = false;
        attachedFiles = [];
    }

    function fadeOutWelcomeMessage() {
        const welcomeMessage = document.getElementById('ai-welcome-message');
        if (welcomeMessage && !welcomeMessage.classList.contains('faded')) {
            welcomeMessage.classList.add('faded');
        }
    }

    function handleFileSelect(e) {
        if (e.target.files.length + attachedFiles.length > 3) {
            alert("You can attach a maximum of 3 files.");
            return;
        }
        [...e.target.files].forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const fileId = `file_${Date.now()}_${Math.random()}`;
                attachedFiles.push({ id: fileId, name: file.name, content: event.target.result });
                renderAttachments();
            };
            reader.readAsText(file);
        });
        e.target.value = '';
    }

    function renderAttachments() {
        const container = document.getElementById('ai-attachment-container');
        if(!container) return;
        container.innerHTML = '';
        attachedFiles.forEach(file => {
            const chip = document.createElement('div');
            chip.className = 'attachment-chip';
            chip.innerHTML = `<span>${file.name}</span><button class="remove-attachment-btn">&times;</button>`;
            chip.querySelector('.remove-attachment-btn').onclick = () => removeAttachment(file.id);
            container.appendChild(chip);
        });
        handleContentEditableInput();
    }

    function removeAttachment(fileId) {
        attachedFiles = attachedFiles.filter(f => f.id !== fileId);
        renderAttachments();
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
        const rawText = editor.innerText.trim();
        if (charCounter) charCounter.textContent = `${rawText.length} / ${USER_CHAR_LIMIT}`;
        if (placeholder) placeholder.style.display = (rawText.length > 0 || editor.querySelector('.ai-frac, .ai-root, sup') || attachedFiles.length > 0) ? 'none' : 'block';
    }

    function parseInputForAPI(innerHTML) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = innerHTML.replace(/<div><br><\/div>/g, '\n').replace(/<br>/g, '\n');
        tempDiv.querySelectorAll('.ai-frac').forEach(frac => {
            const n = frac.querySelector('sup')?.innerText.trim() || '';
            const d = frac.querySelector('sub')?.innerText.trim() || '';
            frac.replaceWith(`(${n})/(${d})`);
        });
        tempDiv.querySelectorAll('.ai-root').forEach(root => {
            const content = root.querySelector('.ai-root-content')?.innerText.trim() || '';
            root.replaceWith(`sqrt(${content})`);
        });
        tempDiv.querySelectorAll('sup').forEach(sup => sup.replaceWith(`^(${sup.innerText})`));
        let text = tempDiv.innerText;
        text = text.replace(/×/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi');
        return text;
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
    
    function parseGeminiResponse(text) {
        let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html = html.replace(/```([\s\S]*?)```/g, (match, code) => `<pre><code>${code.trim()}</code></pre>`);
        html = html.replace(/\$([^\$]+)\$/g, (match, math) => {
            let processedMath = math;
            Object.keys(latexSymbolMap).forEach(key => {
                processedMath = processedMath.replace(new RegExp(key.replace(/\\/g, '\\\\'), 'g'), latexSymbolMap[key]);
            });
            processedMath = processedMath
                .replace(/(\w+)\^(\w+|\{(.*?)\})/g, '$1<sup>$2</sup>').replace(/\\sqrt\{(.+?)\}/g, '<span class="ai-root">√<span class="ai-root-content">$1</span></span>')
                .replace(/\\frac\{(.+?)\}\{(.+?)\}/g, '<span class="ai-frac"><sup>$1</sup><sub>$2</sub></span>')
                .replace(/\\boxed\{(.+?)\}/g, '<span class="ai-boxed-math">$1</span>');
            return `<span class="ai-math-inline">${processedMath}</span>`;
        });
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*([^\n\*]+)\*/g, '<strong>$1</strong>')
                   .replace(/^\* (.*$)/gm, '<li>$1</li>');
        html = html.replace(/<li>(.*?)<\/li>/g, '<ul><li>$1</li></ul>').replace(/<\/ul>\n?<ul>/g, '');
        return html.replace(/\n/g, '<br>');
    }
    
    function toggleMathMode() {
        isMathModeActive = !isMathModeActive;
        const inputWrapper = document.getElementById('ai-input-wrapper');
        inputWrapper.classList.toggle('options-active', isMathModeActive);
        document.getElementById('ai-math-toggle').classList.toggle('active', isMathModeActive);
    }
    
    function insertElement(element, exitNode = null) {
        const editor = document.getElementById('ai-input');
        editor.focus();
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(element);
            
            const focusable = element.querySelector('[contenteditable="true"]');
            moveCaretTo(focusable || element, 'start');
            
            const spaceNode = document.createTextNode('\u00A0');
            (exitNode || element).after(spaceNode);
        }
    }
    
    function createOptionsBar() {
        const bar = document.createElement('div');
        bar.id = 'ai-options-bar';
        const buttons = [
            { t: '+', v: '+' }, { t: '-', v: '-' }, { t: '×', v: '×' }, { t: '÷', v: '÷' }, { t: '=', v: '='},
            { t: 'x/y', action: () => {
                const frac = document.createElement('span');
                frac.className = 'ai-frac';
                frac.innerHTML = `<sup contenteditable="true" class="placeholder" onfocus="handlePlaceholderInteraction(event)" onkeydown="handlePlaceholderInteraction(event)">n</sup><sub contenteditable="true" class="placeholder" onfocus="handlePlaceholderInteraction(event)" onkeydown="handlePlaceholderInteraction(event)">d</sub>`;
                insertElement(frac);
            }}, 
            { t: '√', action: () => {
                const root = document.createElement('span');
                root.className = 'ai-root';
                root.innerHTML = `√<span class="ai-root-content placeholder" contenteditable="true" onfocus="handlePlaceholderInteraction(event)" onkeydown="handlePlaceholderInteraction(event)">x</span>`;
                insertElement(root, root.querySelector('.ai-root-content'));
            }},
            { t: 'xⁿ', action: () => {
                const sup = document.createElement('sup');
                sup.setAttribute('contenteditable', 'true');
                sup.classList.add('placeholder');
                sup.textContent = 'y';
                sup.onfocus = handlePlaceholderInteraction;
                sup.onkeydown = handlePlaceholderInteraction;
                insertElement(sup);
            }},
            { t: 'x²', v: '<sup>2</sup>' },
            { t: 'π', v: 'π' }, { t: 'θ', v: 'θ' }, { t: '∞', v: '∞' }, { t: '°', v: '°' }, { t: '∫', v: '∫' }, { t: '∑', v: '∑' },
            { t: '<', v: '<' }, { t: '>', v: '>' }, { t: '≤', v: '≤' }, { t: '≥', v: '≥' }, { t: '≠', v: '≠' }
        ];
        buttons.forEach(btn => {
            const buttonEl = document.createElement('button');
            buttonEl.innerHTML = btn.t;
            buttonEl.onclick = (e) => { 
                e.stopPropagation(); 
                e.currentTarget.classList.add('poppy');
                if (btn.action) {
                    btn.action();
                } else {
                    document.execCommand('insertHTML', false, btn.v);
                }
            };
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
                opacity: 1; transition: opacity 0.5s; width: 100%;
                display: flex; justify-content: center; align-items: center;
            }
            .welcome-content { display: flex; align-items: baseline; gap: 12px; }
            .faded { opacity: 0 !important; pointer-events: none; }
            #ai-brand-title {
                font-family: 'PrimaryFont', sans-serif; font-size: 2.5em; color: #fff;
                background: linear-gradient(to right, var(--ai-red), var(--ai-yellow), var(--ai-green), var(--ai-blue));
                -webkit-background-clip: text; background-clip: text; color: transparent;
                animation: brand-slide 10s linear infinite; background-size: 400% 100%;
            }
             #ai-brand-title span { animation: brand-pulse 2s ease-in-out infinite; display: inline-block; }
            #ai-welcome-message p { font-size: 0.9em; margin: 0; max-width: 400px; line-height: 1.5; }
            #ai-close-button { position: absolute; top: 20px; right: 30px; color: rgba(255, 255, 255, 0.7); font-size: 40px; cursor: pointer; transition: color 0.2s, transform 0.2s; z-index: 10; }
            #ai-close-button:hover { color: white; transform: scale(1.1); }
            #ai-response-container {
                flex: 1 1 auto; overflow-y: auto; width: 100%; max-width: 800px; margin: 0 auto;
                display: flex; flex-direction: column; gap: 15px; padding: 20px;
                -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%);
            }
            .ai-message-bubble { background: rgba(15, 15, 18, 0.8); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 15px 20px; color: #e0e0e0; backdrop-filter: blur(15px); animation: message-pop-in 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards; max-width: 90%; line-height: 1.6; overflow-wrap: break-word; }
            .user-message { align-self: flex-end; background: rgba(40, 45, 50, 0.8); }
            .gemini-response { align-self: flex-start; }
            .gemini-response.loading { display: flex; align-items: center; }
            .ai-math-inline, .user-message { color: #a5d6ff; }
            .ai-frac { display: inline-flex; flex-direction: column; text-align: center; vertical-align: middle; padding: 0 0.4em; }
            .ai-frac > sup { border-bottom: 1px solid currentColor; }
            .ai-root { display: inline-flex; vertical-align: middle; }
            .ai-root-content { border-top: 1px solid currentColor; padding-left: 2px; }
            .ai-boxed-math { border: 1px solid currentColor; padding: 2px 5px; border-radius: 4px; display: inline-block; }
            #ai-input sup, #ai-input sub, #ai-input .ai-frac, #ai-input .ai-root { outline: none; color: #FFF; }
            #ai-input > *:first-child { margin-top: 0; }
            #ai-input-wrapper {
                flex-shrink: 0; position: relative; opacity: 0; transform: translateY(100px);
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.5s ease-in-out;
                margin: 15px auto 30px; width: 90%; max-width: 800px;
                border-radius: 25px; background: rgba(10, 10, 10, 0.7); backdrop-filter: blur(20px);
                animation: glow 2.5s infinite;
                border: 1px solid rgba(255, 255, 255, 0.2);
                display: flex; flex-direction: column; padding-top: 5px;
            }
            #ai-input-wrapper.waiting { animation-name: gemini-glow !important; animation-duration: 4s !important; }
            #ai-container.active #ai-input-wrapper { opacity: 1; transform: translateY(0); }
            .ai-input-container { position: relative; width: 100%; }
            #ai-input { min-height: 38px; color: white; font-size: 1.1em; padding: 8px 110px 8px 20px; box-sizing: border-box; outline: none; }
            #ai-input .placeholder { color: #888; }
            #ai-attachment-container { display: flex; flex-wrap: wrap; gap: 5px; padding: 0 20px 5px; }
            #ai-input-placeholder { position: absolute; top: 10px; left: 20px; color: rgba(255,255,255,0.4); pointer-events: none; font-size: 1.1em; z-index: 1; }
            .ai-input-container > button {
                position: absolute; top: 50%; background: none; border: none; color: rgba(255,255,255,0.5); font-size: 24px; cursor: pointer; padding: 5px;
                line-height: 1; z-index: 2; transform: translateY(-50%);
                transition: color 0.2s, transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), top 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .ai-input-container > #ai-math-toggle { right: 10px; }
            .ai-input-container > #ai-file-upload-btn { right: 45px; }
            .ai-input-container > button:hover { color: white; }
            #ai-math-toggle.active { color: white; transform: translateY(-50%); }
            #ai-input-wrapper.options-active .ai-input-container > button { top: 10px; transform: translateY(0); }
            #ai-input-wrapper.options-active .ai-input-container > #ai-math-toggle.active { color: white; transform: translateY(0); }
            #ai-options-bar {
                display: flex; overflow-x: auto; background: rgba(0,0,0,0.3);
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                border-top: 1px solid transparent; max-height: 0; opacity: 0; visibility: hidden;
                border-bottom-left-radius: 25px; border-bottom-right-radius: 25px;
                scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.2) transparent;
            }
            #ai-input-wrapper.options-active #ai-options-bar { max-height: 50px; opacity: 1; visibility: visible; padding: 8px 15px; border-top: 1px solid rgba(255,255,255,0.1); }
            #ai-options-bar button { background: rgba(255,255,255,0.1); border: none; border-radius: 8px; color: white; font-size: 1.1em; cursor: pointer; padding: 5px 10px; transition: background 0.2s; flex-shrink: 0; margin-right: 8px; }
            #ai-char-counter { position: absolute; bottom: 10px; right: 30px; font-size: 0.8em; color: rgba(255, 255, 255, 0.4); z-index: 2;}
            .ai-typing-indicator span { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: rgba(255, 255, 255, 0.5); margin: 0 2px; animation: typing-pulse 1.4s infinite ease-in-out both; }
            .ai-typing-indicator span:nth-child(1) { animation-delay: 0s; }
            .ai-typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
            .ai-typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
            .attachment-chip { font-size: 0.8em; background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 10px; display: inline-flex; align-items: center; gap: 5px; animation: poppy 0.3s cubic-bezier(.17,.67,.5,1.33); }
            .remove-attachment-btn { background: none; border: none; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 1.2em; line-height: 1; padding: 0; }
            .user-message .attachment-chip-container { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; }
            .user-message .attachment-chip { background: rgba(255,255,255,0.15); }
            @keyframes typing-pulse { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1.0); } }
            @keyframes glow { 0%, 100% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.2), 0 0 10px rgba(255, 255, 255, 0.1); } 50% { box-shadow: 0 0 15px rgba(255, 255, 255, 0.5), 0 0 25px rgba(255, 255, 255, 0.3); } }
            @keyframes gemini-glow { 0%, 100% { box-shadow: 0 0 8px 2px var(--ai-blue); } 25% { box-shadow: 0 0 8px 2px var(--ai-green); } 50% { box-shadow: 0 0 8px 2px var(--ai-yellow); } 75% { box-shadow: 0 0 8px 2px var(--ai-red); } }
            @keyframes message-pop-in { 0% { opacity: 0; transform: translateY(10px) scale(0.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes brand-slide { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
            @keyframes brand-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
            @keyframes poppy { 0% { transform: scale(0.8); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
            button.poppy { animation: poppy 0.3s cubic-bezier(.17,.67,.5,1.33); }
        `;
        document.head.appendChild(style);
    }

    getLocationOnLoad();
    document.addEventListener('keydown', handleGlobalKeyDown);

})();
