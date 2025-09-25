/**
 * ai-activation.js
 *
 * Injects a redesigned, Gemini-inspired AI chat interface into the current page.
 *
 * Activation:
 * - Ctrl + C (only when no text is selected)
 *
 * Deactivation:
 * - 'X' button or Ctrl + C when the AI input box is empty.
 *
 * Features:
 * - A sophisticated, clean UI inspired by Google's AI design language.
 * - Advanced, fluid animations for all interactions using GSAP.
 * - An intuitive radial pop-up menu for math symbols.
 * - Keyboard-first arrow key navigation for all math symbols.
 * - Intelligent placeholders in math symbols that clear on input.
 * - A file uploader for up to 3 text-based files to provide context to the AI.
 * - AI responses render Markdown, LaTeX-style math, and code blocks with syntax highlighting.
 */

(function() {
    // --- CONFIGURATION ---
    const API_KEY = 'AIzaSyDcoUA4Js1oOf1nz53RbLaxUzD0GxTmKXA';
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;
    const USER_CHAR_LIMIT = 500;

    // --- STATE MANAGEMENT ---
    let isAIActive = false;
    let isRequestPending = false;
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

    function loadDependencies(callback) {
        const gsapUrl = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js';
        if (window.gsap) {
            callback();
        } else {
            const script = document.createElement('script');
            script.src = gsapUrl;
            script.onload = callback;
            document.head.appendChild(script);
        }
    }
    
    function handleGlobalKeyDown(e) {
        // Only listen for Ctrl+C
        if (!e.ctrlKey || e.key.toLowerCase() !== 'c') {
            return;
        }

        const selectionText = window.getSelection().toString();

        if (isAIActive) {
            // --- DEACTIVATION LOGIC ---
            const editor = document.getElementById('ai-input');
            const isFocusedInEditor = editor && editor.contains(document.activeElement);

            // Deactivate if the user presses Ctrl+C inside our empty input box
            if (isFocusedInEditor && editor.innerText.trim().length === 0 && selectionText.length === 0) {
                e.preventDefault();
                deactivateAI();
            }
            // Otherwise, do nothing and allow normal copy behavior.

        } else {
            // --- ACTIVATION LOGIC ---
            // Activate if the user is not trying to copy any selected text.
            if (selectionText.length === 0) {
                // A final check: don't prevent copying from password fields, even if no text is selected.
                if (document.activeElement.type === 'password') {
                    return;
                }
                e.preventDefault();
                loadDependencies(activateAI);
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
                <p>Hello! How can I help you today?</p>
            </div>
            <div id="ai-response-container"></div>
            <div id="ai-input-area">
                <div id="ai-attachment-container"></div>
                <div id="ai-input-wrapper">
                     <button id="ai-file-upload-btn" title="Attach up to 3 files">
                        <svg viewBox="0 0 24 24"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"></path></svg>
                    </button>
                    <div id="ai-input" contenteditable="true" data-placeholder="Ask a question..."></div>
                    <button id="ai-math-toggle" title="Math Symbols">
                        <svg viewBox="0 0 24 24"><path d="M3.5 18.5c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-8C2.4 2.5 1.5 3.4 1.5 4.5S2.4 6.5 3.5 6.5 5.5 5.6 5.5 4.5 4.6 2.5 3.5 2.5zm8 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm8 8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-8-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm8 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path></svg>
                    </button>
                </div>
            </div>
            <div id="ai-close-button">&times;</div>
            <input type="file" id="ai-file-input" hidden multiple>
        `;
        document.body.appendChild(container);

        const responseContainer = document.getElementById('ai-response-container');
        responseContainer.innerHTML = chatHTML;
        if (chatHistory.length > 0) {
            fadeOutWelcomeMessage();
            responseContainer.scrollTop = responseContainer.scrollHeight;
        }
        
        const brandTitle = document.getElementById('ai-brand-title');
        const brandText = "AI Mode";
        brandText.split('').forEach(char => {
            const span = document.createElement('span');
            span.textContent = char;
            brandTitle.appendChild(span);
        });

        const visualInput = document.getElementById('ai-input');
        visualInput.onkeydown = handleEditorKeyDown;
        visualInput.oninput = handleContentEditableInput;
        visualInput.onpaste = handlePaste;
        document.getElementById('ai-close-button').onclick = deactivateAI;
        document.getElementById('ai-math-toggle').onclick = (e) => { e.stopPropagation(); toggleRadialMenu(e); };
        document.getElementById('ai-file-upload-btn').onclick = () => document.getElementById('ai-file-input').click();
        document.getElementById('ai-file-input').onchange = handleFileSelect;

        gsap.fromTo("#ai-container", { backdropFilter: 'blur(0px)', backgroundColor: 'rgba(0,0,0,0)' }, { backdropFilter: 'blur(20px)', backgroundColor: 'rgba(0,0,0,0.6)', duration: 0.8, ease: 'power2.inOut' });
        gsap.from("#ai-brand-title span", { y: -30, opacity: 0, stagger: 0.05, ease: 'back.out(1.7)', duration: 0.8 });
        gsap.from("#ai-welcome-message p", { y: 20, opacity: 0, ease: 'power2.out', duration: 0.8, delay: 0.3 });
        gsap.from("#ai-input-area", { y: 100, opacity: 0, ease: 'power3.out', duration: 1, delay: 0.5 });
        
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
                window.getSelection().selectAllChildren(target);
            } else if (e.type === 'keydown') {
                if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                    target.textContent = '';
                    target.classList.remove('placeholder');
                    target.onkeydown = null;
                    target.onfocus = null;
                }
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
            
            if (e.key === 'ArrowRight' && range.startOffset === (currentNode.textContent.length || 0)) {
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
                    gsap.to(nodeBefore, { scale: 0, opacity: 0, duration: 0.3, ease: 'back.in(1.7)', onComplete: () => {
                        nodeBefore.remove();
                        handleContentEditableInput();
                    }});
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
        gsap.to("#ai-input-wrapper", { '--glow-opacity': 1, duration: 0.5, ease: 'power2.out' });
        
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
        gsap.from(userBubble, { scale: 0.8, opacity: 0, y: 20, duration: 0.5, ease: 'elastic.out(1, 0.75)' });
        
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
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        const currentText = e.currentTarget.innerText;

        if (currentText.length + pastedText.length > USER_CHAR_LIMIT) {
            if (attachedFiles.length >= 3) {
                alert("You cannot attach more than 3 files. Your pasted text was not added.");
                return;
            }
            attachedFiles.push({ id: `file_paste_${Date.now()}`, name: 'paste.txt', content: pastedText });
            renderAttachments();
        } else {
            document.execCommand('insertText', false, pastedText);
        }
    }

    function deactivateAI() {
        const container = document.getElementById('ai-container');
        if (container) {
            chatHTML = document.getElementById('ai-response-container').innerHTML;
            gsap.to(container, { opacity: 0, duration: 0.5, ease: 'power2.in', onComplete: () => {
                container.remove();
                document.getElementById('ai-dynamic-styles')?.remove();
            }});
        }
        isAIActive = false;
        attachedFiles = [];
    }

    function fadeOutWelcomeMessage() {
        const welcome = document.getElementById('ai-welcome-message');
        if (welcome && !welcome.classList.contains('faded')) {
            welcome.classList.add('faded');
            gsap.to(welcome, { opacity: 0, scale: 0.9, duration: 0.5, ease: 'power2.in' });
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
                attachedFiles.push({ id: `file_${Date.now()}_${Math.random()}`, name: file.name, content: event.target.result });
                renderAttachments();
            };
            reader.readAsText(file);
        });
        e.target.value = '';
    }

    function renderAttachments() {
        const container = document.getElementById('ai-attachment-container');
        if(!container) return;
        const existingChips = new Set([...container.querySelectorAll('.attachment-chip')].map(c => c.dataset.id));
        
        attachedFiles.forEach(file => {
            if (!existingChips.has(file.id)) {
                const chip = document.createElement('div');
                chip.className = 'attachment-chip';
                chip.dataset.id = file.id;
                chip.innerHTML = `<span>${file.name}</span><button class="remove-attachment-btn">&times;</button>`;
                chip.querySelector('.remove-attachment-btn').onclick = () => removeAttachment(file.id);
                container.appendChild(chip);
                gsap.from(chip, { scale: 0.5, opacity: 0, duration: 0.4, ease: 'back.out(1.7)' });
            }
        });

        [...container.querySelectorAll('.attachment-chip')].forEach(chip => {
            if (!attachedFiles.some(f => f.id === chip.dataset.id)) {
                gsap.to(chip, { scale: 0, opacity: 0, duration: 0.3, ease: 'back.in(1.7)', onComplete: () => chip.remove() });
            }
        });
        handleContentEditableInput();
    }

    function removeAttachment(fileId) {
        attachedFiles = attachedFiles.filter(f => f.id !== fileId);
        renderAttachments();
    }

    function handleContentEditableInput() {
        if (isAIActive) fadeOutWelcomeMessage();
        const editor = document.getElementById('ai-input');
        const rawText = editor.innerText;
        const hasContent = rawText.trim().length > 0 || editor.querySelector('.ai-frac, .ai-root, sup');
        editor.parentElement.classList.toggle('has-content', hasContent);
        document.getElementById('ai-char-counter').textContent = `${rawText.length} / ${USER_CHAR_LIMIT}`;
    }

    function parseInputForAPI(innerHTML) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = innerHTML.replace(/<div><br><\/div>/g, '\n').replace(/<br>/g, '\n');
        tempDiv.querySelectorAll('.placeholder').forEach(p => p.textContent = '');
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
        return tempDiv.innerText.replace(/×/g, '*').replace(/÷/g, '/').replace(/π/g, 'pi');
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
            gsap.to(responseBubble, { className: '-=loading' });
            gsap.from(responseBubble.firstElementChild, { y: 20, opacity: 0, duration: 0.5, ease: 'power2.out' });
        } catch (error) {
            console.error('AI API Error:', error);
            responseBubble.innerHTML = `<div class="ai-error">Sorry, an error occurred.</div>`;
        } finally {
            gsap.to("#ai-input-wrapper", { '--glow-opacity': 0, duration: 0.5 });
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
    
    function insertElement(element, exitNode = null) {
        const editor = document.getElementById('ai-input');
        editor.focus();
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(element);
            
            gsap.from(element, { scale: 0.5, opacity: 0, duration: 0.4, ease: 'back.out(1.7)' });
            
            const focusable = element.querySelector('[contenteditable="true"]');
            moveCaretTo(focusable || element, 'start');
            
            const spaceNode = document.createTextNode('\u00A0');
            (exitNode || element).after(spaceNode);
        }
    }
    
    function toggleRadialMenu(e) {
        let menu = document.getElementById('ai-radial-menu');
        if (menu) {
            gsap.to(".ai-radial-item", { scale: 0, opacity: 0, stagger: 0.05, duration: 0.3, ease: 'back.in(1.7)', onComplete: () => menu.remove() });
            return;
        }
        
        menu = document.createElement('div');
        menu.id = 'ai-radial-menu';
        const buttons = [
            { t: '+', v: '+' }, { t: '−', v: '−' }, { t: '×', v: '×' }, { t: '÷', v: '÷' }, { t: '=', v: '='},
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
            { t: 'π', v: 'π' }, { t: 'θ', v: 'θ' }, { t: '∞', v: '∞' }, { t: '∫', v: '∫' }, { t: '∑', v: '∑' },
            { t: '≤', v: '≤' }, { t: '≥', v: '≥' }, { t: '≠', v: '≠' }
        ];

        buttons.forEach((btn, i) => {
            const item = document.createElement('button');
            item.className = 'ai-radial-item';
            item.innerHTML = btn.t;
            item.onclick = (ev) => { 
                ev.stopPropagation(); 
                if (btn.action) btn.action();
                else document.execCommand('insertHTML', false, btn.v);
                toggleRadialMenu();
            };
            menu.appendChild(item);
        });

        document.getElementById('ai-container').appendChild(menu);
        gsap.from(".ai-radial-item", {
            scale: 0,
            opacity: 0,
            rotation: -90,
            stagger: 0.05,
            duration: 0.5,
            ease: 'back.out(1.7)'
        });
    }

    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;
        if (!document.querySelector('style[data-font="primary"]')) {
            const fontStyle = document.createElement('style');
            fontStyle.setAttribute('data-font', 'primary');
            fontStyle.textContent = `@import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Space+Mono&display=swap');`;
            document.head.appendChild(fontStyle);
        }
        const style = document.createElement('style');
        style.id = 'ai-dynamic-styles';
        style.innerHTML = `
            :root { 
                --ai-bg: #131314; --ai-surface: #1e1f20; --ai-primary: #8ab4f8; --ai-on-surface: #e8eaed;
                --glow-color: rgba(138, 180, 248, 0.8);
            }
            #ai-container {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background-color: rgba(0,0,0,0.6); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
                z-index: 2147483647; opacity: 1; font-family: 'Google Sans', sans-serif;
                display: flex; flex-direction: column; box-sizing: border-box; color: var(--ai-on-surface);
            }
            #ai-welcome-message {
                position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                text-align: center; color: #bdc1c6; display: flex; justify-content: center; align-items: center; flex-direction: column;
            }
            #ai-brand-title { font-size: 2.5em; font-weight: 700; color: var(--ai-on-surface); }
            #ai-brand-title span { display: inline-block; }
            #ai-welcome-message p { font-size: 1.1em; margin-top: 5px; }
            #ai-close-button {
                position: absolute; top: 20px; right: 30px; color: #9aa0a6; font-size: 40px; cursor: pointer;
                transition: color 0.2s, transform 0.2s; z-index: 10; font-family: 'Space Mono', monospace;
            }
            #ai-close-button:hover { color: var(--ai-on-surface); transform: scale(1.1); }
            #ai-response-container {
                flex: 1 1 auto; overflow-y: auto; width: 100%; max-width: 800px; margin: 0 auto;
                display: flex; flex-direction: column; gap: 20px; padding: 20px;
                -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%);
            }
            .ai-message-bubble { background: var(--ai-surface); border: 1px solid #3c4043; border-radius: 20px; padding: 15px 20px; max-width: 90%; line-height: 1.6; overflow-wrap: break-word; }
            .user-message { align-self: flex-end; background: #283141; border-color: #3f4a5b; }
            .gemini-response { align-self: flex-start; }
            .gemini-response.loading { display: flex; align-items: center; }
            #ai-input-area { width: 100%; max-width: 800px; margin: 0 auto 30px; padding: 0 20px; }
            #ai-attachment-container { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 8px; }
            #ai-input-wrapper {
                position: relative; --glow-opacity: 0;
                background: var(--ai-surface); border-radius: 28px;
                border: 1px solid #5f6368; display: flex; align-items: center; padding: 0 12px;
                box-shadow: 0 0 0 3px transparent; transition: box-shadow 0.3s ease;
            }
            #ai-input-wrapper:after {
                content: ''; position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px;
                border-radius: 30px; border: 2px solid var(--glow-color);
                opacity: var(--glow-opacity); transition: opacity 0.3s ease; pointer-events: none;
            }
            #ai-input-wrapper:focus-within { box-shadow: 0 0 0 3px rgba(138, 180, 248, 0.3); }
            #ai-input { min-height: 52px; color: var(--ai-on-surface); font-size: 1.1em; padding: 12px 0; box-sizing: border-box; outline: none; flex: 1; }
            #ai-input:empty:before { content: attr(data-placeholder); color: #9aa0a6; pointer-events: none; }
            .ai-input-container .has-content #ai-input:empty:before { display: none; }
            #ai-input .placeholder { color: #888; }
            .ai-frac { display: inline-flex; flex-direction: column; text-align: center; vertical-align: middle; padding: 0 0.4em; }
            .ai-frac > sup { border-bottom: 1px solid currentColor; }
            .ai-root { display: inline-flex; vertical-align: middle; }
            .ai-root-content { border-top: 1px solid currentColor; padding-left: 2px; }
            #ai-input sup, #ai-input sub, #ai-input .ai-frac, #ai-input .ai-root { outline: none; color: var(--ai-on-surface); }
            #ai-input-wrapper button { background: none; border: none; color: #bdc1c6; cursor: pointer; padding: 8px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background-color 0.2s, color 0.2s; }
            #ai-input-wrapper button:hover { background-color: rgba(255,255,255,0.1); color: var(--ai-on-surface); }
            #ai-input-wrapper button svg { width: 24px; height: 24px; fill: currentColor; }
            #ai-radial-menu { position: fixed; bottom: 120px; right: 50%; transform: translateX(50%); z-index: 2147483647; display: flex; justify-content: center; align-items: center; }
            .ai-radial-item {
                background: var(--ai-surface); border: 1px solid #5f6368; color: var(--ai-on-surface);
                width: 40px; height: 40px; border-radius: 50%; font-size: 1.2em;
                margin: 0 5px; cursor: pointer; transition: all 0.2s ease;
            }
            .ai-radial-item:hover { background: var(--ai-primary); color: var(--ai-bg); border-color: var(--ai-primary); }
            .attachment-chip { font-size: 0.9em; background: #283141; padding: 4px 12px; border-radius: 16px; display: inline-flex; align-items: center; gap: 8px; border: 1px solid #3f4a5b; }
            .remove-attachment-btn { background: none; border: none; color: #9aa0a6; cursor: pointer; font-size: 1.5em; line-height: 1; padding: 0; }
            .ai-typing-indicator span { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: #9aa0a6; margin: 0 2px; animation: typing-pulse 1.4s infinite ease-in-out both; }
            .ai-typing-indicator span:nth-child(1) { animation-delay: 0s; } .ai-typing-indicator span:nth-child(2) { animation-delay: 0.2s; } .ai-typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
            @keyframes typing-pulse { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1.0); } }
        `;
        document.head.appendChild(style);
    }
    
    document.addEventListener('keydown', handleGlobalKeyDown);
    getLocationOnLoad();

})();
