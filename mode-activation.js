/**
 * ai-activation.js
 *
 * A simplified, self-contained script with a direct user authorization check.
 * Includes a functional category-selection menu and new animations.
 * API endpoint has been reverted to the original version.
 */
(function() {
    // --- CONFIGURATION ---
    // WARNING: Your API key is visible in this client-side code.
    const API_KEY = 'AIzaSyDcoUA4Js1oOf1nz53RbLaxUzD0GxTmKXA'; 
    // REVERTED: Using the original API URL as requested.
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;
    const USER_CHAR_LIMIT = 500;

    // --- STATE MANAGEMENT ---
    let isAIActive = false;
    let isRequestPending = false;
    let isSettingsMenuOpen = false;
    let currentAIRequestController = null;
    let currentSubject = 'General';
    let chatHistory = [];
    const latexSymbolMap = {
        '\\pi': 'π', '\\theta': 'θ', '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ',
        '\\delta': 'δ', '\\epsilon': 'ε', '\\infty': '∞', '\\pm': '±',
        '\\times': '×', '\\div': '÷', '\\cdot': '·', '\\degree': '°',
        '\\le': '≤', '\\ge': '≥', '\\ne': '≠',
        '\\approx': '≈', '\\equiv': '≡',
        '\\therefore': '∴', '\\because': '∵',
    };

    /**
     * Checks if the user is an admin or is enrolled via their Firestore document.
     */
    async function isUserAuthorized() {
        const user = firebase.auth().currentUser;
        if (typeof firebase === 'undefined' || !user) {
            return false;
        }
        const adminEmails = ['4simpleproblems@gmail.com', 'belkwy30@minerva.sparcc.org'];
        if (adminEmails.includes(user.email)) {
            return true;
        }
        try {
            const userDocRef = firebase.firestore().collection('users').doc(user.uid);
            const userDoc = await userDocRef.get();
            return userDoc.exists && userDoc.data().aiEnrolled === true;
        } catch (error) {
            console.error("AI Auth Check Error:", error);
            return false;
        }
    }

    /**
     * Handles the keyboard shortcut for activating/deactivating the AI.
     */
    async function handleKeyDown(e) {
        if (e.ctrlKey && e.key.toLowerCase() === 'c') {
            const selection = window.getSelection().toString();
            if (isAIActive) {
                e.preventDefault();
                if (isSettingsMenuOpen) {
                    toggleSettingsMenu();
                } else {
                    const mainEditor = document.getElementById('ai-input');
                    if (mainEditor && mainEditor.innerText.trim().length === 0 && selection.length === 0) {
                        deactivateAI();
                    }
                }
            } else {
                if (selection.length === 0) {
                    const isAuthorized = await isUserAuthorized();
                    if (isAuthorized) {
                        e.preventDefault();
                        activateAI();
                    }
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
        
        const persistentTitle = document.createElement('div');
        persistentTitle.id = 'ai-persistent-title';
        persistentTitle.textContent = "AI Mode - General";
        
        const welcomeMessage = document.createElement('div');
        welcomeMessage.id = 'ai-welcome-message';
        welcomeMessage.innerHTML = `
            <h2>Welcome to AI Mode</h2>
            <p>This is a beta feature. Your general location may be shared with your first message.</p>
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
        settingsToggle.innerHTML = '&#8942;';
        settingsToggle.onclick = handleSettingsToggleClick;
        inputWrapper.appendChild(createSettingsMenu());
        inputWrapper.appendChild(visualInput);
        inputWrapper.appendChild(placeholder);
        inputWrapper.appendChild(charCounter);
        inputWrapper.appendChild(settingsToggle);
        inputWrapper.appendChild(createOptionsBar());
        container.appendChild(persistentTitle);
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
     * Removes the AI interface from the page with a smooth animation.
     */
    function deactivateAI() {
        if (currentAIRequestController) {
            currentAIRequestController.abort();
        }
        const container = document.getElementById('ai-container');
        if (container) {
            container.classList.add('deactivating');
            setTimeout(() => {
                container.remove();
                const styles = document.getElementById('ai-dynamic-styles');
                if (styles) styles.remove();
            }, 500);
        }
        isAIActive = false;
        isSettingsMenuOpen = false;
        isRequestPending = false;
        currentSubject = 'General';
        chatHistory = [];
    }

    /**
     * Calls the Google AI API directly using the hardcoded key.
     */
    async function callGoogleAI(responseBubble) {
        if (!API_KEY) {
            responseBubble.innerHTML = `<div class="ai-error">API Key is missing.</div>`;
            return;
        }

        currentAIRequestController = new AbortController();
        
        let systemInstruction = 'You are a helpful and comprehensive AI assistant.';
        switch (currentSubject) {
            case 'Mathematics': systemInstruction = 'You are a mathematics expert. Prioritize accuracy, detailed step-by-step explanations, and formal notation using LaTeX where appropriate.'; break;
            case 'Science': systemInstruction = 'You are a science expert. Provide clear, evidence-based explanations using correct scientific terminology, citing sources if relevant.'; break;
            case 'History': systemInstruction = 'You are a history expert. Provide historically accurate information with context, key dates, and important figures.'; break;
            case 'Literature': systemInstruction = 'You are a literary expert. Focus on analyzing themes, characters, literary devices, and historical context.'; break;
            case 'Programming': systemInstruction = 'You are a programming expert. Provide clean, efficient, and well-commented code examples. Specify the language and explain the logic clearly.'; break;
        }
        
        // This API format uses `contents` for the full history, not a separate system instruction property.
        const payload = {
            contents: [
                { role: "user", parts: [{ text: `System instruction: ${systemInstruction}` }] },
                { role: "model", parts: [{ text: "Understood. I will act as requested." }] },
                ...chatHistory
            ]
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: currentAIRequestController.signal
            });
            if (!response.ok) throw new Error(`Network response was not ok. Status: ${response.status}`);
            const data = await response.json();

            if (!data.candidates || data.candidates.length === 0) {
                 throw new Error("Invalid response from API.");
            }

            const text = data.candidates[0].content.parts[0].text;
            
            chatHistory.push({ role: "model", parts: [{ text: text }] });
            responseBubble.innerHTML = `<div class="ai-response-content">${parseGeminiResponse(text)}</div>`;
        } catch (error) {
            if (error.name === 'AbortError') {
                responseBubble.innerHTML = `<div class="ai-error">Message generation stopped.</div>`;
            } else {
                console.error('AI API Error:', error);
                responseBubble.innerHTML = `<div class="ai-error">Sorry, an error occurred.</div>`;
            }
        } finally {
            isRequestPending = false;
            currentAIRequestController = null;
            
            const settingsToggle = document.getElementById('ai-settings-toggle');
            if (settingsToggle) {
                settingsToggle.classList.remove('generating');
                settingsToggle.innerHTML = '&#8942;';
            }

            responseBubble.classList.remove('loading');
            document.getElementById('ai-input-wrapper').classList.remove('waiting');
            const editor = document.getElementById('ai-input');
            if(editor) {
                editor.contentEditable = true;
                editor.focus();
            }
            const responseContainer = document.getElementById('ai-response-container');
            if(responseContainer) responseContainer.scrollTop = responseContainer.scrollHeight;
        }
    }

    /**
     * Handles clicks on the settings/stop button.
     */
    function handleSettingsToggleClick(e) {
        e.stopPropagation();
        if (isRequestPending) {
            stopGeneration();
        } else {
            toggleSettingsMenu();
        }
    }
    
    /**
     * Toggles the category selection menu.
     */
    function toggleSettingsMenu(){
        isSettingsMenuOpen=!isSettingsMenuOpen;
        const menu=document.getElementById('ai-settings-menu');
        const toggleBtn=document.getElementById('ai-settings-toggle');
        menu.classList.toggle('active',isSettingsMenuOpen);
        toggleBtn.classList.toggle('active',isSettingsMenuOpen);
    }
    
    /**
     * Handles the selection of a new subject category.
     */
    function selectSubject(subject){
        currentSubject=subject;
        chatHistory = []; // Clear history when changing subjects to apply new persona
        
        const persistentTitle = document.getElementById('ai-persistent-title');
        if (persistentTitle) {
            persistentTitle.textContent = `AI Mode - ${subject}`;
        }
        
        const menu=document.getElementById('ai-settings-menu');
        menu.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
        const activeBtn=menu.querySelector(`button[data-subject="${subject}"]`);
        if(activeBtn)activeBtn.classList.add('active');
        
        toggleSettingsMenu();
    }
    
    // --- All other UI and helper functions (unchanged) ---
    function stopGeneration(){if(currentAIRequestController){currentAIRequestController.abort();}}
    function fadeOutWelcomeMessage(){const container=document.getElementById('ai-container');if(container&&!container.classList.contains('chat-active')){container.classList.add('chat-active');}}
    function updateFractionFocus(){const editor=document.getElementById('ai-input');if(!editor)return;editor.querySelectorAll('.ai-frac').forEach(f=>f.classList.remove('focused'));const selection=window.getSelection();if(selection.rangeCount>0&&selection.isCollapsed){const range=selection.getRangeAt(0);const nodeBefore=range.startContainer.childNodes[range.startOffset-1];if(nodeBefore&&nodeBefore.nodeType===1&&nodeBefore.classList.contains('ai-frac')){nodeBefore.classList.add('focused');}}}
    function handleContentEditableInput(e){const editor=e.target;const selection=window.getSelection();if(!selection.rangeCount)return;const range=selection.getRangeAt(0).cloneRange();const node=range.startContainer;if(node.nodeType===3&&range.startOffset>0){const textContent=node.textContent;if(textContent.slice(range.startOffset-1,range.startOffset)==='^'){range.setStart(node,range.startOffset-1);range.deleteContents();const sup=document.createElement('sup');sup.contentEditable=true;sup.innerHTML='&#8203;';range.insertNode(sup);range.selectNodeContents(sup);range.collapse(false);selection.removeAllRanges();selection.addRange(range);return;}}
    if(node.nodeType===3){const textContent=node.textContent;const textBeforeCursor=textContent.slice(0,range.startOffset);const match=textBeforeCursor.match(/(\\[a-zA-Z]+)\s$/);if(match){const command=match[1];const symbol=latexSymbolMap[command];if(symbol){const commandStartIndex=textBeforeCursor.lastIndexOf(command);node.textContent=textContent.slice(0,commandStartIndex)+symbol+textContent.slice(range.startOffset);range.setStart(node,commandStartIndex+1);range.collapse(true);selection.removeAllRanges();selection.addRange(range);}}}
    fadeOutWelcomeMessage();editor.querySelectorAll('div:not(:last-child)').forEach(div=>{if(div.innerHTML.trim()===''||div.innerHTML==='<br>'){div.remove();}});const charCounter=document.getElementById('ai-char-counter');const placeholder=document.getElementById('ai-input-placeholder');const rawText=editor.innerText;if(charCounter)charCounter.textContent=`${rawText.length} / ${USER_CHAR_LIMIT}`;if(placeholder)placeholder.style.display=(rawText.length>0||editor.querySelector('.ai-frac'))?'none':'block';}
    function parseInputForAPI(innerHTML){const tempDiv=document.createElement('div');tempDiv.innerHTML=innerHTML.replace(/<div><br><\/div>/g,'\n').replace(/<br>/g,'\n');tempDiv.querySelectorAll('.ai-frac').forEach(frac=>{const n=frac.querySelector('sup')?.innerHTML||'';const d=frac.querySelector('sub')?.innerHTML||'';const nText=parseInputForAPI(n);const dText=parseInputForAPI(d);frac.replaceWith(`(${nText})/(${dText})`);});tempDiv.querySelectorAll('sup').forEach(sup=>{const supText=parseInputForAPI(sup.innerHTML);sup.replaceWith(`^(${supText})`);});let text=tempDiv.innerText;text=text.replace(/√\((.*?)\)/g,'sqrt($1)').replace(/∛\((.*?)\)/g,'cbrt($1)').replace(/×/g,'*').replace(/÷/g,'/').replace(/π/g,'pi');return text;}
    function handleInputSubmission(e){const editor=e.target;if(e.key==='Backspace'){const selection=window.getSelection();if(selection.rangeCount>0&&selection.isCollapsed){const range=selection.getRangeAt(0);const nodeBefore=range.startContainer.childNodes[range.startOffset-1];if(nodeBefore&&nodeBefore.nodeType===1&&(nodeBefore.classList.contains('ai-frac')||nodeBefore.tagName.toLowerCase()==='sup')){e.preventDefault();nodeBefore.remove();handleContentEditableInput({target:editor});return;}}}
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();fadeOutWelcomeMessage();let query=parseInputForAPI(editor.innerHTML);if(!query||isRequestPending)return;isRequestPending=true;document.getElementById('ai-settings-toggle').classList.add('generating');editor.contentEditable=false;document.getElementById('ai-input-wrapper').classList.add('waiting');chatHistory.push({role:"user",parts:[{text:query}]});const responseContainer=document.getElementById('ai-response-container');const userBubble=document.createElement('div');userBubble.className='ai-message-bubble user-message';userBubble.innerHTML=editor.innerHTML;responseContainer.appendChild(userBubble);const responseBubble=document.createElement('div');responseBubble.className='ai-message-bubble gemini-response loading';responseBubble.innerHTML='<div class="ai-loader"></div>';responseContainer.appendChild(responseBubble);responseContainer.scrollTop=responseContainer.scrollHeight;editor.innerHTML='';handleContentEditableInput({target:editor});callGoogleAI(responseBubble);}}
    function parseGeminiResponse(text){let html=text.replace(/</g,'&lt;').replace(/>/g,'&gt;');html=html.replace(/```([\s\S]*?)```/g,(match,code)=>`<pre><code>${code.trim()}</code></pre>`);html=html.replace(/\$([^\$]+)\$/g,(match,math)=>{let processedMath=math;Object.keys(latexSymbolMap).forEach(key=>{processedMath=processedMath.replace(new RegExp(key.replace(/\\/g,'\\\\'),'g'),latexSymbolMap[key]);});processedMath=processedMath.replace(/(\w+)\^(\w+)/g,'$1<sup>$2</sup>').replace(/\\sqrt\{(.+?)\}/g,'&radic;($1)').replace(/\\frac\{(.+?)\}\{(.+?)\}/g,'<span class="ai-frac"><sup>$1</sup><sub>$2</sub></span>');return`<span class="ai-math-inline">${processedMath}</span>`;});html=html.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\*([^\n\*]+)\*/g,'<strong>$1</strong>').replace(/^\* (.*$)/gm,'<li>$1</li>');html=html.replace(/<li>(.*?)<\/li>/g,'<ul><li>$1</li></ul>').replace(/<\/ul>\n?<ul>/g,'');return html.replace(/\n/g,'<br>');}
    function insertAtCursor(html){const editor=document.getElementById('ai-input');if(!editor)return;editor.focus();document.execCommand('insertHTML',false,html);handleContentEditableInput({target:editor});}
    function insertFraction(){const editor=document.getElementById('ai-input');editor.focus();const selection=window.getSelection();if(!selection.rangeCount)return;const range=selection.getRangeAt(0);range.deleteContents();const frac=document.createElement('span');frac.className='ai-frac';frac.contentEditable=false;const sup=document.createElement('sup');sup.contentEditable=true;sup.innerHTML='&#8203;';const sub=document.createElement('sub');sub.contentEditable=true;sub.innerHTML='&#8203;';frac.appendChild(sup);frac.appendChild(sub);range.insertNode(frac);const spaceNode=document.createTextNode('\u00A0');range.setStartAfter(frac);range.insertNode(spaceNode);range.selectNodeContents(sup);range.collapse(true);selection.removeAllRanges();selection.addRange(range);handleContentEditableInput({target:editor});}
    function insertPower(){const editor=document.getElementById('ai-input');editor.focus();const selection=window.getSelection();if(!selection.rangeCount)return;const range=selection.getRangeAt(0);range.deleteContents();const sup=document.createElement('sup');sup.contentEditable=true;sup.innerHTML='&#8203;';range.insertNode(sup);range.selectNodeContents(sup);range.collapse(false);selection.removeAllRanges();selection.addRange(range);handleContentEditableInput({target:editor});}
    function createOptionsBar(){const bar=document.createElement('div');bar.id='ai-options-bar';const buttons=[{t:'+',v:'+'},{t:'−',v:'−'},{t:'×',v:'×'},{t:'÷',v:'÷'},{t:'x/y',action:insertFraction},{t:'√',v:'√()'},{t:'∛',v:'∛()'},{t:'xⁿ',action:insertPower},{t:'π',v:'π'},{t:'θ',v:'θ'},{t:'∞',v:'∞'},{t:'°',v:'°'},{t:'<',v:'<'},{t:'>',v:'>'},{t:'≤',v:'≤'},{t:'≥',v:'≥'},{t:'≠',v:'≠'}];buttons.forEach((btn)=>{const buttonEl=document.createElement('button');buttonEl.innerHTML=btn.t;buttonEl.tabIndex=-1;buttonEl.onclick=(e)=>{e.stopPropagation();if(btn.action)btn.action();else insertAtCursor(btn.v);};bar.appendChild(buttonEl);});bar.addEventListener('keydown',(e)=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const currentButtons=Array.from(bar.querySelectorAll('button'));const focusedIndex=currentButtons.findIndex(b=>b===document.activeElement);let nextIndex;if(e.key==='ArrowRight')nextIndex=focusedIndex>=0?(focusedIndex+1)%currentButtons.length:0;else nextIndex=focusedIndex>0?focusedIndex-1:currentButtons.length-1;currentButtons[nextIndex]?.focus();}});return bar;}
    function createSettingsMenu(){const menu=document.createElement('div');menu.id='ai-settings-menu';const subjects=['General','Mathematics','Science','History','Literature','Programming'];subjects.forEach(subject=>{const button=document.createElement('button');button.textContent=subject;button.dataset.subject=subject;if(subject==='General')button.classList.add('active');button.onclick=()=>selectSubject(subject);menu.appendChild(button);});return menu;}
    function injectStyles(){if(document.getElementById('ai-dynamic-styles'))return;if(!document.querySelector('style[data-font="primary"]')){const fontStyle=document.createElement('style');fontStyle.setAttribute('data-font','primary');fontStyle.textContent=`@font-face { font-family: 'PrimaryFont'; src: url('../fonts/primary.woff') format('woff'); font-weight: normal; font-style: normal; }`;document.head.appendChild(fontStyle);}
    const style=document.createElement('style');style.id='ai-dynamic-styles';style.innerHTML=`
            :root { --ai-red: #ea4335; --ai-blue: #4285f4; --ai-green: #34a853; --ai-yellow: #fbbc05; }
            #ai-container { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0, 0, 0, 0); backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); z-index: 2147483647; opacity: 0; transition: opacity 0.5s, background-color 0.5s, backdrop-filter 0.5s; font-family: 'secondaryfont', sans-serif; display: flex; flex-direction: column; padding-top: 70px; box-sizing: border-box; }
            #ai-container.active { opacity: 1; background-color: rgba(0, 0, 0, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
            #ai-container.deactivating, #ai-container.deactivating > * { transition: opacity 0.4s, background-color 0.4s, backdrop-filter 0.4s, transform 0.4s; }
            #ai-container.deactivating { opacity: 0 !important; background-color: rgba(0, 0, 0, 0); backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
            #ai-persistent-title { position: absolute; top: 28px; left: 30px; font-family: 'secondaryfont', sans-serif; font-size: 18px; font-weight: bold; color: white; opacity: 0; transition: opacity 0.5s 0.2s; animation: title-pulse 4s linear infinite; }
            #ai-container.chat-active #ai-persistent-title { opacity: 1; }
            #ai-welcome-message { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); text-align: center; color: rgba(255,255,255,.5); opacity: 1; transition: opacity .5s; width: 100%; }
            #ai-container.chat-active #ai-welcome-message { opacity: 0; pointer-events: none; }
            #ai-welcome-message h2 { font-family: 'PrimaryFont', sans-serif; font-size: 2.5em; margin: 0; color: #fff; }
            #ai-welcome-message p { font-size: .9em; margin-top: 10px; max-width: 400px; margin-left: auto; margin-right: auto; line-height: 1.5; }
            #ai-close-button { position: absolute; top: 20px; right: 30px; color: rgba(255,255,255,.7); font-size: 40px; cursor: pointer; transition: color .2s ease,transform .3s ease, opacity 0.4s; }
            #ai-close-button:hover { color: #fff; transform: scale(1.1); }
            #ai-response-container { flex: 1 1 auto; overflow-y: auto; width: 100%; max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 15px; padding: 20px; -webkit-mask-image: linear-gradient(to bottom,transparent 0,black 5%,black 95%,transparent 100%); mask-image: linear-gradient(to bottom,transparent 0,black 5%,black 95%,transparent 100%); }
            .ai-message-bubble { background: rgba(15,15,18,.8); border: 1px solid rgba(255,255,255,.1); border-radius: 20px; padding: 15px 20px; color: #e0e0e0; backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px); animation: message-pop-in .5s cubic-bezier(.4,0,.2,1) forwards; max-width: 90%; line-height: 1.6; overflow-wrap: break-word; }
            .user-message { align-self: flex-end; background: rgba(40,45,50,.8); }
            .gemini-response { align-self: flex-start; }
            .gemini-response.loading { border: 1px solid transparent; animation: gemini-glow 4s linear infinite,message-pop-in .5s cubic-bezier(.4,0,.2,1) forwards; }
            .ai-response-content pre { background: #0c0d10; border: 1px solid #222; border-radius: 8px; padding: 12px; margin: 8px 0; overflow-x: auto; font-family: monospace; }
            .ai-math-inline,.user-message { color: #a5d6ff; font-family: monospace; font-size: 1.1em; }
            .ai-frac { display: inline-flex; flex-direction: column; text-align: center; vertical-align: middle; background: rgba(0,0,0,.2); padding: .1em .4em; border-radius: 5px; transition: box-shadow .2s,transform .2s; }
            .ai-frac.focused { box-shadow: 0 0 0 2px var(--ai-blue); transform: scale(1.1); }
            .ai-frac>sup,.ai-frac>sub { display: block; min-width: 1ch; line-height: 1; }
            .ai-frac>sup { border-bottom: 1px solid currentColor; padding: .2em .1em; }
            .ai-frac>sub { padding: .2em .1em; }
            #ai-input sup,#ai-input sub { font-family: secondaryfont,sans-serif; outline: 0; background: rgba(0,0,0,.2); padding: .1em .3em; border-radius: 4px; vertical-align: super; }
            #ai-input-wrapper { flex-shrink: 0; position: relative; opacity: 1; transform: translateY(0); transition: all .4s cubic-bezier(.4,0,.2,1); margin: 15px auto 30px; width: 90%; max-width: 800px; border-radius: 25px; background: rgba(10,10,10,.7); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); animation: glow 3s infinite; animation-play-state: running; border: 1px solid rgba(255,255,255,.2); overflow: hidden; }
            #ai-input-wrapper.waiting { animation: gemini-glow 4s linear infinite!important; }
            #ai-container.active #ai-input-wrapper { opacity: 1; transform: translateY(0); }
            #ai-input { min-height: 50px; color: #fff; font-size: 1.1em; padding: 12px 50px 12px 20px; box-sizing: border-box; word-wrap: break-word; outline: 0; }
            #ai-input-placeholder { position: absolute; top: 14px; left: 20px; color: rgba(255,255,255,.4); pointer-events: none; font-size: 1.1em; }
            #ai-settings-toggle { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: 0 0; border: none; color: rgba(255,255,255,.5); font-size: 24px; cursor: pointer; padding: 5px; line-height: 1; z-index: 3; transition: all .3s ease; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; }
            #ai-settings-toggle:hover,#ai-settings-toggle.active { color: #fff; background-color: rgba(255,255,255,.1); }
            #ai-settings-toggle.active { transform: translateY(-50%) rotate(90deg); }
            #ai-settings-toggle.generating { transform: translateY(-50%) rotate(45deg); background-color: rgba(255,82,82,.2); color: #ff8a80; }
            #ai-settings-toggle.generating:hover { background-color: rgba(255,82,82,.4); }
            #ai-settings-toggle.generating::before { content: '■'; font-size: 18px; line-height: 1; transform: rotate(-45deg); }
            #ai-settings-toggle.generating { innerHTML: ''; }
            #ai-options-bar { display: flex; overflow-x: auto; background: rgba(0,0,0,.3); transition: all .4s cubic-bezier(.4,0,.2,1); border-top: 1px solid transparent; max-height: 0; opacity: 0; visibility: hidden; padding: 0 15px; }
            #ai-container[data-subject=Math] #ai-options-bar,#ai-container[data-subject=Science] #ai-options-bar { max-height: 50px; opacity: 1; visibility: visible; padding: 8px 15px; border-top: 1px solid rgba(255,255,255,.1); }
            #ai-options-bar button { background: rgba(255,255,255,.1); border: none; border-radius: 8px; color: #fff; font-size: 1.1em; cursor: pointer; padding: 5px 10px; transition: background .2s,box-shadow .2s,transform .2s; flex-shrink: 0; margin-right: 8px; }
            #ai-options-bar button:hover { background: rgba(255,255,255,.2); transform: scale(1.05); }
            #ai-options-bar button:focus { outline: 0; box-shadow: 0 0 0 2px var(--ai-blue); }
            #ai-char-counter { position: absolute; right: 55px; top: 15px; font-size: .8em; color: rgba(255,255,255,.4); z-index: 2; }
            #ai-settings-menu { position: absolute; bottom: 60px; right: 5px; z-index: 10; background: #1e1e1e; border: 1px solid rgba(255,255,255,.2); border-radius: 15px; padding: 10px; display: flex; flex-direction: column; gap: 8px; opacity: 0; visibility: hidden; transform: translateY(10px) scale(.95); transition: all .2s cubic-bezier(.4,0,.2,1); transform-origin: bottom right; box-shadow: 0 5px 25px rgba(0,0,0,.3); }
            #ai-settings-menu.active { opacity: 1; visibility: visible; transform: translateY(0) scale(1); }
            #ai-settings-menu button { font-family: PrimaryFont,sans-serif; background: rgba(255,255,255,.05); color: #ccc; border: 1px solid transparent; border-radius: 8px; padding: 8px 15px; text-align: left; cursor: pointer; transition: background .2s,border-color .2s,transform .2s; font-size: 1.1em; }
            #ai-settings-menu button:hover { background: rgba(255,255,255,.1); transform: translateX(3px); }
            #ai-settings-menu button.active { background: rgba(66,133,244,.3); border-color: var(--ai-blue); color: #fff; }
            .ai-error,.ai-temp-message { text-align: center; color: rgba(255,255,255,.7); }
            .ai-loader { width: 25px; height: 25px; border: 3px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto; }
            @keyframes glow { 0%,100% { box-shadow: 0 0 8px rgba(255,255,255,.2); } 50% { box-shadow: 0 0 16px rgba(255,255,255,.4); } }
            @keyframes gemini-glow { 0%,100% { box-shadow: 0 0 8px 2px var(--ai-blue); } 25% { box-shadow: 0 0 8px 2px var(--ai-green); } 50% { box-shadow: 0 0 8px 2px var(--ai-yellow); } 75% { box-shadow: 0 0 8px 2px var(--ai-red); } }
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes message-pop-in { 0% { opacity: 0; transform: translateY(10px) scale(.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes brand-slide { 0% { background-position: 0 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }
            @keyframes brand-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
            @keyframes title-pulse { 0%, 100% { text-shadow: 0 0 7px var(--ai-blue); } 25% { text-shadow: 0 0 7px var(--ai-green); } 50% { text-shadow: 0 0 7px var(--ai-yellow); } 75% { text-shadow: 0 0 7px var(--ai-red); } }
        `;
    document.head.appendChild(style);}
    document.addEventListener('keydown', handleKeyDown);

})();
