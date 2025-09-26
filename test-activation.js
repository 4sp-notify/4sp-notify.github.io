/**
 * ai-activation.js
 *
 * A feature-rich, self-contained script with a unified attachment/subject menu,
 * enhanced animations, intelligent chat history (token saving),
 * and advanced file previews.
 */
(function() {
    // --- CONFIGURATION ---
    const API_KEY = 'AIzaSyDcoUA4Js1oOf1nz53RbLaxUzD0GxTmKXA'; 
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-09-2025:generateContent?key=${API_KEY}`;
    const MAX_INPUT_HEIGHT = 200;
    const TOTAL_UPLOAD_LIMIT_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB

    // --- STATE MANAGEMENT ---
    let isAIActive = false;
    let isRequestPending = false;
    let isActionMenuOpen = false;
    let currentAIRequestController = null;
    let currentSubject = 'General';
    let chatHistory = [];
    let attachedFiles = [];

    // --- DAILY LIMITS CONFIGURATION ---
    const DAILY_LIMITS = { images: 5 };

    const limitManager = {
        getToday: () => new Date().toLocaleDateString("en-US"),
        getUsage: () => {
            const usageData = JSON.parse(localStorage.getItem('aiUsageLimits')) || {};
            const today = limitManager.getToday();
            if (usageData.date !== today) {
                return { date: today, images: 0 };
            }
            return usageData;
        },
        saveUsage: (usageData) => { localStorage.setItem('aiUsageLimits', JSON.stringify(usageData)); },
        canUpload: (type) => { const usage = limitManager.getUsage(); return (type in DAILY_LIMITS) ? ((usage[type] || 0) < DAILY_LIMITS[type]) : true; },
        recordUpload: (type, count = 1) => { if (type in DAILY_LIMITS) { let usage = limitManager.getUsage(); usage[type] = (usage[type] || 0) + count; limitManager.saveUsage(usage); } }
    };

    async function isUserAuthorized() {
        const user = firebase.auth().currentUser;
        if (typeof firebase === 'undefined' || !user) return false;
        const adminEmails = ['4simpleproblems@gmail.com', 'belkwy30@minerva.sparcc.org'];
        if (adminEmails.includes(user.email)) return true;
        try {
            const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
            return userDoc.exists && userDoc.data().aiEnrolled === true;
        } catch (error) { console.error("AI Auth Check Error:", error); return false; }
    }

    async function handleKeyDown(e) {
        if (e.ctrlKey && e.key.toLowerCase() === 'c') {
            const selection = window.getSelection().toString();
            if (isAIActive) {
                e.preventDefault();
                const mainEditor = document.getElementById('ai-input');
                if (mainEditor && mainEditor.innerText.trim().length === 0 && selection.length === 0 && attachedFiles.length === 0) {
                    deactivateAI();
                }
            } else {
                if (selection.length === 0) {
                    const isAuthorized = await isUserAuthorized();
                    if (isAuthorized) { e.preventDefault(); activateAI(); }
                }
            }
        }
    }

    function activateAI() {
        if (document.getElementById('ai-container')) return;
        if (typeof window.startPanicKeyBlocker === 'function') { window.startPanicKeyBlocker(); }
        
        attachedFiles = [];
        injectStyles();
        
        const container = document.createElement('div');
        container.id = 'ai-container';
        container.dataset.subject = currentSubject;
        
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
        persistentTitle.textContent = "AI Mode - General";
        
        const welcomeMessage = document.createElement('div');
        welcomeMessage.id = 'ai-welcome-message';
        welcomeMessage.innerHTML = `<h2>Welcome to AI Mode</h2><p>This is a beta feature. To improve your experience, your general location (state or country) will be shared with your first message. You may be subject to message limits.</p>`;
        
        const closeButton = document.createElement('div');
        closeButton.id = 'ai-close-button';
        closeButton.innerHTML = '&times;';
        closeButton.onclick = deactivateAI;
        
        const responseContainer = document.createElement('div');
        responseContainer.id = 'ai-response-container';
        
        const inputWrapper = document.createElement('div');
        inputWrapper.id = 'ai-input-wrapper';
        
        const attachmentPreviewContainer = document.createElement('div');
        attachmentPreviewContainer.id = 'ai-attachment-preview';
        
        const visualInput = document.createElement('div');
        visualInput.id = 'ai-input';
        visualInput.contentEditable = true;
        visualInput.onkeydown = handleInputSubmission;
        visualInput.oninput = handleContentEditableInput;
        
        const actionToggle = document.createElement('button');
        actionToggle.id = 'ai-action-toggle';
        actionToggle.innerHTML = '<span class="icon-ellipsis">&#8942;</span><span class="icon-stop">■</span>';
        actionToggle.onclick = handleActionToggleClick;

        inputWrapper.appendChild(attachmentPreviewContainer);
        inputWrapper.appendChild(visualInput);
        inputWrapper.appendChild(actionToggle);
        
        container.appendChild(brandTitle);
        container.appendChild(persistentTitle);
        container.appendChild(welcomeMessage);
        container.appendChild(closeButton);
        container.appendChild(responseContainer);
        container.appendChild(inputWrapper);
        container.appendChild(createActionMenu());
        
        document.body.appendChild(container);
        
        if (chatHistory.length > 0) { renderChatHistory(); }
        
        setTimeout(() => {
             if (chatHistory.length > 0) { container.classList.add('chat-active'); }
            container.classList.add('active');
        }, 10);
        
        visualInput.focus();
        isAIActive = true;
    }

    function deactivateAI() {
        if (typeof window.stopPanicKeyBlocker === 'function') { window.stopPanicKeyBlocker(); }
        if (currentAIRequestController) currentAIRequestController.abort();
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
        isActionMenuOpen = false;
        isRequestPending = false;
        attachedFiles = [];
    }
    
    function renderChatHistory() {
        const responseContainer = document.getElementById('ai-response-container');
        if (!responseContainer) return;
        responseContainer.innerHTML = '';
        chatHistory.forEach(message => {
            const bubble = document.createElement('div');
            bubble.className = `ai-message-bubble ${message.role === 'user' ? 'user-message' : 'gemini-response'}`;
            if (message.role === 'model') {
                bubble.innerHTML = `<div class="ai-response-content">${parseGeminiResponse(message.parts[0].text)}</div>`;
            } else {
                let bubbleContent = ''; let textContent = ''; let fileCount = 0;
                message.parts.forEach(part => {
                    if (part.text) textContent = part.text;
                    if (part.inlineData) fileCount++;
                });
                if (textContent) bubbleContent += `<p>${escapeHTML(textContent)}</p>`;
                if (fileCount > 0) bubbleContent += `<div class="sent-attachments">${fileCount} file(s) sent</div>`;
                bubble.innerHTML = bubbleContent;
            }
            responseContainer.appendChild(bubble);
        });
        setTimeout(() => responseContainer.scrollTop = responseContainer.scrollHeight, 50);
    }

    async function callGoogleAI(responseBubble) {
        if (!API_KEY) { responseBubble.innerHTML = `<div class="ai-error">API Key is missing.</div>`; return; }
        currentAIRequestController = new AbortController();
        let firstMessageContext = '';
        if (chatHistory.length <= 1) {
            const location = localStorage.getItem('ai-user-location') || 'an unknown location';
            const now = new Date();
            const date = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const time = now.toLocaleTimeString('en-US', { timeZoneName: 'short' });
            firstMessageContext = `(System Info: User is asking from ${location}. Current date is ${date}, ${time}.)\n\n`;
        }
        
        let processedChatHistory = [...chatHistory];
        if (processedChatHistory.length > 6) {
             processedChatHistory = [ ...processedChatHistory.slice(0, 3), ...processedChatHistory.slice(-3) ];
        }

        const lastMessageIndex = processedChatHistory.length - 1;
        const userParts = processedChatHistory[lastMessageIndex].parts;
        const textPart = userParts.find(p => p.text);
        if (textPart) { textPart.text = firstMessageContext + textPart.text; } 
        else { userParts.unshift({ text: firstMessageContext }); }
        
        let systemInstruction = 'You are a helpful and comprehensive AI assistant.';
        switch (currentSubject) {
            case 'Mathematics': systemInstruction = 'You are a mathematics expert...'; break;
            case 'Science': systemInstruction = 'You are a science expert...'; break;
            case 'History': systemInstruction = 'You are a history expert...'; break;
            case 'Literature': systemInstruction = 'You are a literary expert...'; break;
            case 'Programming': systemInstruction = 'You are a programming expert...'; break;
        }

        const payload = { contents: processedChatHistory, systemInstruction: { parts: [{ text: systemInstruction }] } };
        
        try {
            const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: currentAIRequestController.signal });
            if (!response.ok) throw new Error(`Network response was not ok. Status: ${response.status}`);
            const data = await response.json();
            if (!data.candidates || data.candidates.length === 0) throw new Error("Invalid response from API.");
            const text = data.candidates[0].content.parts[0].text;
            chatHistory.push({ role: "model", parts: [{ text: text }] });
            
            const contentHTML = `<div class="ai-response-content">${parseGeminiResponse(text)}</div>`;
            responseBubble.style.opacity = '0';
            setTimeout(() => {
                responseBubble.innerHTML = contentHTML;
                responseBubble.style.opacity = '1';
            }, 300);

        } catch (error) {
            if (error.name === 'AbortError') { responseBubble.innerHTML = `<div class="ai-error">Message generation stopped.</div>`; } 
            else { console.error('AI API Error:', error); responseBubble.innerHTML = `<div class="ai-error">Sorry, an error occurred.</div>`; }
        } finally {
            isRequestPending = false;
            currentAIRequestController = null;
            const actionToggle = document.getElementById('ai-action-toggle');
            if (actionToggle) { actionToggle.classList.remove('generating'); }
            
            setTimeout(() => {
                responseBubble.classList.remove('loading');
                const responseContainer = document.getElementById('ai-response-container');
                if(responseContainer) responseContainer.scrollTop = responseContainer.scrollHeight;
            }, 300);

            document.getElementById('ai-input-wrapper').classList.remove('waiting');
            const editor = document.getElementById('ai-input');
            if(editor) { editor.contentEditable = true; editor.focus(); }
        }
    }

    function handleActionToggleClick(e) { e.stopPropagation(); if (isRequestPending) { stopGeneration(); } else { toggleActionMenu(); } }
    function stopGeneration(){if(currentAIRequestController){currentAIRequestController.abort();}}
    function toggleActionMenu(){
        isActionMenuOpen = !isActionMenuOpen;
        const menu = document.getElementById('ai-action-menu');
        const toggleBtn = document.getElementById('ai-action-toggle');
        if (isActionMenuOpen) {
            const btnRect = toggleBtn.getBoundingClientRect();
            menu.style.bottom = `${window.innerHeight - btnRect.top}px`;
            menu.style.right = `${window.innerWidth - btnRect.right}px`;
            menu.querySelectorAll('button[data-type]').forEach(button => {
                const type = button.dataset.type;
                if (type === 'images') {
                    const usage = limitManager.getUsage();
                    const limitText = `<span>${usage[type] || 0}/${DAILY_LIMITS[type]} used</span>`;
                    button.querySelector('span:last-child').innerHTML = limitText;
                    button.disabled = !limitManager.canUpload(type);
                }
            });
        }
        menu.classList.toggle('active', isActionMenuOpen);
        toggleBtn.classList.toggle('active', isActionMenuOpen);
    }
    
    function selectSubject(subject){
        currentSubject=subject;
        chatHistory = [];
        const persistentTitle = document.getElementById('ai-persistent-title');
        if (persistentTitle) { persistentTitle.textContent = `AI Mode - ${subject}`; }
        document.getElementById('ai-container').dataset.subject = subject;
        const menu=document.getElementById('ai-action-menu');
        menu.querySelectorAll('button[data-subject]').forEach(b=>b.classList.remove('active'));
        const activeBtn=menu.querySelector(`button[data-subject="${subject}"]`);
        if(activeBtn)activeBtn.classList.add('active');
        toggleActionMenu();
    }
    
    function handleFileUpload(fileType) {
        const input = document.createElement('input');
        input.type = 'file';
        const typeMap = {'photo':'image/*','file':'*'};
        input.accept = typeMap[fileType] || '*';
        if (fileType === 'photo') { input.multiple = true; }
        input.onchange = (event) => {
            const files = Array.from(event.target.files);
            if (!files || files.length === 0) return;
            
            const currentTotalSize = attachedFiles.reduce((sum, file) => sum + (atob(file.inlineData.data).length), 0);
            const newFilesSize = files.reduce((sum, file) => sum + file.size, 0);

            if (currentTotalSize + newFilesSize > TOTAL_UPLOAD_LIMIT_BYTES) {
                const attemptedMB = ((currentTotalSize + newFilesSize) / (1024*1024)).toFixed(2);
                const limitGB = (TOTAL_UPLOAD_LIMIT_BYTES / (1024*1024*1024)).toFixed(2);
                alert(`Upload failed: Total size of attachments (${attemptedMB} MB) would exceed the ${limitGB} GB limit per message.`);
                return;
            }

            let filesToProcess = [...files];
            const usage = limitManager.getUsage();
            const remainingSlots = DAILY_LIMITS.images - (usage.images || 0);
            if (fileType === 'photo' && filesToProcess.length > remainingSlots) {
                alert(`You can only upload ${remainingSlots} more image(s) today.`);
                filesToProcess = filesToProcess.slice(0, remainingSlots);
            }
            
            filesToProcess.forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const base64Data = e.target.result.split(',')[1];
                    attachedFiles.push({ inlineData: { mimeType: file.type, data: base64Data }, fileName: file.name });
                    renderAttachments();
                };
                reader.readAsDataURL(file);
            });
            if (fileType === 'photo') { limitManager.recordUpload('images', filesToProcess.length); }
        };
        input.click();
    }
    
    function renderAttachments() {
        const previewContainer = document.getElementById('ai-attachment-preview');
        const inputWrapper = document.getElementById('ai-input-wrapper');
        
        if (attachedFiles.length === 0) {
            inputWrapper.classList.remove('has-attachments');
            return;
        }

        previewContainer.style.display = 'flex';
        inputWrapper.classList.add('has-attachments');
        previewContainer.innerHTML = '';

        attachedFiles.forEach((file, index) => {
            const fileCard = document.createElement('div');
            fileCard.className = 'attachment-card';
            let previewHTML = `<span class="file-icon">📄</span>`;
            let fileExt = file.fileName.split('.').pop().toUpperCase();
            if (fileExt.length > 5) fileExt = 'FILE';
            
            let fileTypeBadge = `<div class="file-type-badge">${fileExt}</div>`;

            if (file.inlineData.mimeType.startsWith('image/')) { 
                previewHTML = `<img src="data:${file.inlineData.mimeType};base64,${file.inlineData.data}" alt="${file.fileName}" />`;
                fileTypeBadge = '';
            } 
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = file.fileName;
            const marqueeWrapper = document.createElement('div');
            marqueeWrapper.className = 'file-name';
            marqueeWrapper.appendChild(nameSpan);
            
            fileCard.innerHTML = `
                ${previewHTML}
                <div class="file-info"></div>
                ${fileTypeBadge}
                <button class="remove-attachment-btn" data-index="${index}">&times;</button>`;
            fileCard.querySelector('.file-info').appendChild(marqueeWrapper);
            
            setTimeout(() => {
                if (nameSpan.scrollWidth > marqueeWrapper.clientWidth) {
                    const marqueeDuration = file.fileName.length / 4;
                    nameSpan.style.animationDuration = `${marqueeDuration}s`;
                    marqueeWrapper.classList.add('marquee');
                    nameSpan.innerHTML += `<span aria-hidden="true">${file.fileName}</span>`;
                }
            }, 0);

            fileCard.querySelector('.remove-attachment-btn').onclick = () => { attachedFiles.splice(index, 1); renderAttachments(); };
            previewContainer.appendChild(fileCard);
        });
    }

    function createActionMenu() {
        const menu = document.createElement('div');
        menu.id = 'ai-action-menu';
        const attachments = [ { id: 'photo', icon: '📷', label: 'Photo', type: 'images' }, { id: 'file', icon: '📎', label: 'File', type: 'file' } ];
        const subjects = ['General','Mathematics','Science','History','Literature','Programming'];
        attachments.forEach(opt => {
            const button = document.createElement('button');
            button.dataset.type = opt.type;
            const canUpload = limitManager.canUpload(opt.type);
            let limitText = '';
            if (opt.type === 'images') { const usage = limitManager.getUsage(); limitText = `<span>${usage[opt.type] || 0}/${DAILY_LIMITS[opt.type]} used</span>`; }
            button.innerHTML = `<span class="icon">${opt.icon}</span> ${opt.label} ${limitText}`;
            if (!canUpload) { button.disabled = true; button.title = 'You have reached your daily limit for this file type.'; }
            button.onclick = () => { handleFileUpload(opt.id); toggleActionMenu(); };
            menu.appendChild(button);
        });
        menu.appendChild(document.createElement('hr'));
        const subjectHeader = document.createElement('div');
        subjectHeader.className = 'menu-header';
        subjectHeader.textContent = 'Focus Topic';
        menu.appendChild(subjectHeader);
        subjects.forEach(subject => {
            const button = document.createElement('button');
            button.textContent = subject;
            button.dataset.subject = subject;
            if (subject === 'General') button.classList.add('active');
            button.onclick = () => selectSubject(subject);
            menu.appendChild(button);
        });
        return menu;
    }

    function handleContentEditableInput(e) {
        const editor = e.target;
        if (editor.scrollHeight > MAX_INPUT_HEIGHT) { editor.style.height = `${MAX_INPUT_HEIGHT}px`; editor.style.overflowY = 'auto'; } 
        else { editor.style.height = 'auto'; editor.style.height = `${editor.scrollHeight}px`; editor.style.overflowY = 'hidden'; }
        fadeOutWelcomeMessage();
    }

    function handleInputSubmission(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const editor = e.target;
            const query = editor.innerText.trim();
            if (!query && attachedFiles.length === 0) return;
            if (isRequestPending) return;
            isRequestPending = true;
            document.getElementById('ai-action-toggle').classList.add('generating');
            document.getElementById('ai-input-wrapper').classList.add('waiting');
            const parts = [];
            if (query) parts.push({ text: query });
            attachedFiles.forEach(file => { parts.push({ inlineData: file.inlineData }); });
            chatHistory.push({ role: "user", parts: parts });
            const responseContainer = document.getElementById('ai-response-container');
            const userBubble = document.createElement('div');
            userBubble.className = 'ai-message-bubble user-message';
            let bubbleContent = query ? `<p>${escapeHTML(query)}</p>` : '';
            if (attachedFiles.length > 0) { bubbleContent += `<div class="sent-attachments">${attachedFiles.length} file(s) sent</div>`; }
            userBubble.innerHTML = bubbleContent;
            responseContainer.appendChild(userBubble);
            const responseBubble = document.createElement('div');
            responseBubble.className = 'ai-message-bubble gemini-response loading';
            responseBubble.innerHTML = '<div class="ai-loader"></div>';
            responseContainer.appendChild(responseBubble);
            responseContainer.scrollTop = responseContainer.scrollHeight;
            editor.innerHTML = '';
            attachedFiles = [];
            renderAttachments();
            handleContentEditableInput({ target: editor });
            callGoogleAI(responseBubble);
        }
    }
    
    function fadeOutWelcomeMessage(){const container=document.getElementById("ai-container");if(container&&!container.classList.contains("chat-active")){container.classList.add("chat-active")}}
    function escapeHTML(str){const p=document.createElement("p");p.textContent=str;return p.innerHTML}
    function parseGeminiResponse(text){let html=text;const codeBlocks=[];html=html.replace(/```(\w*)\n([\s\S]*?)```/g,(match,lang,code)=>{const escapedCode=escapeHTML(code.trim());const langClass=lang?`language-${lang.toLowerCase()}`:'';codeBlocks.push(`<div class="code-block-wrapper"><pre><code class="${langClass}">${escapedCode}</code></pre><button class="copy-code-btn">Copy Code</button></div>`);return "%%CODE_BLOCK%%"});html=escapeHTML(html);html=html.replace(/^### (.*$)/gm,"<h3>$1</h3>").replace(/^## (.*$)/gm,"<h2>$1</h2>").replace(/^# (.*$)/gm,"<h1>$1</h1>");html=html.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em>$1</em>");html=html.replace(/^(?:\*|-)\s(.*$)/gm,"<li>$1</li>");html=html.replace(/(<\/li>\s*<li>)/g,"</li><li>").replace(/((<li>.*<\/li>)+)/gs,"<ul>$1</ul>");html=html.replace(/\n/g,"<br>");html=html.replace(/%%CODE_BLOCK%%/g,()=>codeBlocks.shift());return html}

    function injectStyles() {
        if (document.getElementById('ai-dynamic-styles')) return;
        if (!document.querySelector('style[data-font="primary"]')) {
            const fontStyle = document.createElement("style");
            fontStyle.setAttribute("data-font","primary");
            fontStyle.textContent = `@font-face { font-family: 'PrimaryFont'; src: url('../fonts/primary.woff') format('woff'); font-weight: normal; font-style: normal; }`;
            document.head.appendChild(fontStyle);
        }
        const style = document.createElement("style");
        style.id = "ai-dynamic-styles";
        style.innerHTML = `
            :root { --ai-red: #ea4335; --ai-blue: #4285f4; --ai-green: #34a853; --ai-yellow: #fbbc05; }
            #ai-container { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0,0,0,0); backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); z-index: 2147483647; opacity: 0; transition: opacity 0.5s, background-color 0.5s, backdrop-filter 0.5s; font-family: 'secondaryfont', sans-serif; display: flex; flex-direction: column; justify-content: flex-end; padding: 0; box-sizing: border-box; }
            #ai-container.active { opacity: 1; background-color: rgba(0,0,0,0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
            #ai-container.deactivating, #ai-container.deactivating > * { transition: opacity 0.4s, transform 0.4s; }
            #ai-container.deactivating { opacity: 0 !important; background-color: rgba(0,0,0,0); backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
            #ai-persistent-title { position: absolute; top: 28px; left: 30px; font-family: 'secondaryfont', sans-serif; font-size: 18px; font-weight: bold; color: white; opacity: 0; transition: opacity 0.5s 0.2s; animation: title-pulse 4s linear infinite; }
            #ai-container.chat-active #ai-persistent-title { opacity: 1; }
            #ai-welcome-message { position: absolute; top: 45%; left: 50%; transform: translate(-50%,-50%); text-align: center; color: rgba(255,255,255,.5); opacity: 1; transition: opacity .5s, transform .5s; width: 100%; }
            #ai-container.chat-active #ai-welcome-message { opacity: 0; pointer-events: none; transform: translate(-50%,-50%) scale(0.95); }
            #ai-welcome-message h2 { font-family: 'PrimaryFont', sans-serif; font-size: 2.5em; margin: 0; color: #fff; }
            #ai-welcome-message p { font-size: .9em; margin-top: 10px; max-width: 400px; margin-left: auto; margin-right: auto; line-height: 1.5; }
            #ai-close-button { position: absolute; top: 20px; right: 30px; color: rgba(255,255,255,.7); font-size: 40px; cursor: pointer; transition: color .2s ease,transform .3s ease, opacity 0.4s; }
            #ai-response-container { flex: 1 1 auto; overflow-y: auto; width: 100%; max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 15px; padding: 70px 20px 0 20px; -webkit-mask-image: linear-gradient(to bottom,transparent 0,black 3%,black 97%,transparent 100%); mask-image: linear-gradient(to bottom,transparent 0,black 3%,black 97%,transparent 100%);}
            .ai-message-bubble { background: rgba(15,15,18,.8); border: 1px solid rgba(255,255,255,.1); border-radius: 20px; padding: 15px 20px; color: #e0e0e0; backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px); animation: message-pop-in .5s cubic-bezier(.4,0,.2,1) forwards; max-width: 90%; line-height: 1.6; overflow-wrap: break-word; transition: opacity 0.3s ease-in-out; }
            .user-message { align-self: flex-end; background: rgba(40,45,50,.8); }
            .gemini-response.loading { display: flex; justify-content: center; align-items: center; min-height: 60px; max-width: 100px; padding: 15px; background: rgba(15,15,18,.8); animation: gemini-glow 4s linear infinite; }
            #ai-input-wrapper { display: flex; flex-direction: column; flex-shrink: 0; position: relative; z-index: 2; transition: all .4s cubic-bezier(.4,0,.2,1); margin: 15px auto; width: 90%; max-width: 800px; border-radius: 25px; background: rgba(10,10,10,.7); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); animation: glow 3s infinite; border: 1px solid rgba(255,255,255,.2); transition: box-shadow 0.5s ease-in-out; }
            #ai-input-wrapper.waiting { animation: gemini-glow 4s linear infinite!important; }
            #ai-input { min-height: 52px; max-height: ${MAX_INPUT_HEIGHT}px; overflow-y: hidden; color: #fff; font-size: 1.1em; padding: 15px 50px 15px 20px; box-sizing: border-box; word-wrap: break-word; outline: 0; }
            #ai-input:empty::before { content: 'Ask a question or describe your files...'; color: rgba(255, 255, 255, 0.4); pointer-events: none; }
            #ai-action-toggle { position: absolute; right: 10px; bottom: 12px; transform: translateY(0); background: 0 0; border: none; color: rgba(255,255,255,.5); font-size: 24px; cursor: pointer; padding: 5px; line-height: 1; z-index: 3; transition: all .3s ease; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
            #ai-action-toggle .icon-ellipsis, #ai-action-toggle .icon-stop { transition: opacity 0.3s, transform 0.3s; position: absolute; }
            #ai-action-toggle .icon-stop { opacity: 0; transform: scale(0.5); font-size: 14px; }
            #ai-action-toggle.generating { background-color: #581e1e; border: 1px solid #a12832; color: #ff8a80; border-radius: 8px; }
            #ai-action-toggle.generating .icon-ellipsis { opacity: 0; transform: scale(0.5); }
            #ai-action-toggle.generating .icon-stop { opacity: 1; transform: scale(1); }
            #ai-action-menu { position: fixed; background: rgba(20, 20, 22, 0.7); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); border: 1px solid rgba(255,255,255,0.2); animation: glow 3s infinite; border-radius: 12px; box-shadow: 0 5px 25px rgba(0,0,0,0.5); display: flex; flex-direction: column; gap: 5px; padding: 8px; z-index: 2147483647; opacity: 0; visibility: hidden; transform: translateY(10px) scale(.95); transition: all .25s cubic-bezier(.4,0,.2,1); transform-origin: bottom right; }
            #ai-action-menu.active { opacity: 1; visibility: visible; transform: translateY(-5px); }
            #ai-action-menu button { background: rgba(255,255,255,0.05); border: none; color: #ddd; font-family: 'PrimaryFont', sans-serif; font-size: 1em; padding: 10px 15px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 12px; text-align: left; transition: background-color 0.2s, border-color 0.2s, transform 0.2s; }
            #ai-action-menu button[data-subject].active { background: rgba(66,133,244,.3); color: #fff; }
            #ai-action-menu hr { border: none; height: 1px; background-color: rgba(255,255,255,0.1); margin: 5px 10px; }
            #ai-action-menu .menu-header { font-size: 0.8em; color: #888; text-transform: uppercase; padding: 10px 15px 5px; cursor: default; }
            #ai-attachment-preview { display: none; flex-direction: row; gap: 10px; padding: 0; max-height: 0; border-bottom: 1px solid transparent; overflow-x: auto; transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
            #ai-input-wrapper.has-attachments #ai-attachment-preview { max-height: 100px; padding: 10px 15px; }
            .attachment-card { position: relative; border-radius: 8px; overflow: hidden; background: #333; height: 80px; width: auto; min-width: 80px; flex-shrink: 0; display: flex; justify-content: center; align-items: center; }
            .attachment-card img { width: 100%; height: 100%; object-fit: cover; }
            .file-info { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.6); overflow: hidden; }
            .file-name { display: block; color: #fff; font-size: 0.75em; padding: 4px; text-align: center; white-space: nowrap; }
            .file-name.marquee > span { display: inline-block; padding-left: 100%; animation: marquee linear infinite; }
            .file-type-badge { position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.6); color: #fff; font-size: 0.7em; padding: 2px 5px; border-radius: 4px; font-family: sans-serif; font-weight: bold; }
            .remove-attachment-btn { position: absolute; top: 5px; left: 5px; background: rgba(0,0,0,0.5); color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; }
            .ai-loader { width: 25px; height: 25px; border-radius: 50%; animation: spin 1s linear infinite; border: 3px solid rgba(255,255,255,0.3); border-top-color: #fff; }
            @keyframes glow { 0%,100% { box-shadow: 0 0 8px rgba(255,255,255,.2); } 50% { box-shadow: 0 0 16px rgba(255,255,255,.4); } }
            @keyframes gemini-glow { 0%,100% { box-shadow: 0 0 12px 3px var(--ai-blue); } 25% { box-shadow: 0 0 12px 3px var(--ai-green); } 50% { box-shadow: 0 0 12px 3px var(--ai-yellow); } 75% { box-shadow: 0 0 12px 3px var(--ai-red); } }
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes message-pop-in { 0% { opacity: 0; transform: translateY(10px) scale(.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes title-pulse { 0%, 100% { text-shadow: 0 0 7px var(--ai-blue); } 25% { text-shadow: 0 0 7px var(--ai-green); } 50% { text-shadow: 0 0 7px var(--ai-yellow); } 75% { text-shadow: 0 0 7px var(--ai-red); } }
            @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }
        `;
    document.head.appendChild(style);}
    document.addEventListener('keydown', handleKeyDown);

})();
