/**
 * ai-activation.js
 *
 * A feature-rich, self-contained script with a polished UI, file uploads,
 * daily limits, contextual awareness, and persistent chat history per session.
 */
(function() {
    // --- CONFIGURATION ---
    const API_KEY = 'AIzaSyDcoUA4Js1oOf1nz53RbLaxUzD0GxTmKXA'; 
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-09-2025:generateContent?key=${API_KEY}`;
    const USER_CHAR_LIMIT = 500;
    const MAX_INPUT_HEIGHT = 200;

    // --- STATE MANAGEMENT ---
    let isAIActive = false;
    let isRequestPending = false;
    let isAttachmentMenuOpen = false;
    let currentAIRequestController = null;
    let chatHistory = []; // This will now persist when closing/re-opening the UI
    let attachedFiles = [];

    // --- DAILY LIMITS CONFIGURATION ---
    const DAILY_LIMITS = {
        images: 5,
        videos: 1,
    };

    /**
     * Handles all daily limit logic (checking, decrementing, resetting).
     */
    const limitManager = {
        getToday: () => new Date().toLocaleDateString("en-US"),
        getUsage: () => {
            const usageData = JSON.parse(localStorage.getItem('aiUsageLimits')) || {};
            const today = limitManager.getToday();
            if (usageData.date !== today) {
                return { date: today, images: 0, videos: 0 };
            }
            return usageData;
        },
        saveUsage: (usageData) => {
            localStorage.setItem('aiUsageLimits', JSON.stringify(usageData));
        },
        canUpload: (type) => {
            const usage = limitManager.getUsage();
            if (type in DAILY_LIMITS) {
                return (usage[type] || 0) < DAILY_LIMITS[type];
            }
            return true;
        },
        recordUpload: (type) => {
            if (type in DAILY_LIMITS) {
                let usage = limitManager.getUsage();
                usage[type] = (usage[type] || 0) + 1;
                limitManager.saveUsage(usage);
            }
        }
    };

    /**
     * Checks if the user is authorized to use the AI.
     */
    async function isUserAuthorized() {
        const user = firebase.auth().currentUser;
        if (typeof firebase === 'undefined' || !user) return false;
        const adminEmails = ['4simpleproblems@gmail.com', 'belkwy30@minerva.sparcc.org'];
        if (adminEmails.includes(user.email)) return true;
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
                const mainEditor = document.getElementById('ai-input');
                if (mainEditor && mainEditor.innerText.trim().length === 0 && selection.length === 0 && attachedFiles.length === 0) {
                    deactivateAI();
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
        
        if (typeof window.startPanicKeyBlocker === 'function') {
            window.startPanicKeyBlocker();
        }

        attachedFiles = [];
        injectStyles();
        
        const container = document.createElement('div');
        container.id = 'ai-container';
        
        const persistentTitle = document.createElement('div');
        persistentTitle.id = 'ai-persistent-title';
        persistentTitle.textContent = "AI Mode";
        
        const welcomeMessage = document.createElement('div');
        welcomeMessage.id = 'ai-welcome-message';
        welcomeMessage.innerHTML = `
            <h2>Welcome to AI Mode</h2>
            <p>To improve your experience, this feature collects broad, non-identifying data like your general location (state or country), the current date, and time.</p>
        `;

        const closeButton = document.createElement('div');
        closeButton.id = 'ai-close-button';
        closeButton.onclick = deactivateAI;
        closeButton.innerHTML = '&times;';

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
        
        const placeholder = document.createElement('div');
        placeholder.id = 'ai-input-placeholder';
        placeholder.textContent = 'Ask a question or describe your files...';

        const settingsToggle = document.createElement('button');
        settingsToggle.id = 'ai-settings-toggle';
        settingsToggle.innerHTML = '&#8942;';
        settingsToggle.onclick = handleSettingsToggleClick;

        inputWrapper.appendChild(attachmentPreviewContainer);
        inputWrapper.appendChild(visualInput);
        inputWrapper.appendChild(placeholder);
        inputWrapper.appendChild(settingsToggle);
        
        container.appendChild(persistentTitle);
        container.appendChild(welcomeMessage);
        container.appendChild(closeButton);
        container.appendChild(responseContainer);
        container.appendChild(inputWrapper);
        container.appendChild(createAttachmentMenu());
        
        document.body.appendChild(container);
        
        // NEW: Render existing chat history if it exists
        if (chatHistory.length > 0) {
            renderChatHistory();
        }

        setTimeout(() => {
             if (chatHistory.length > 0) {
                container.classList.add('chat-active');
            }
            container.classList.add('active');
        }, 10);
        
        visualInput.focus();
        isAIActive = true;
    }

    /**
     * Deactivates the AI, but keeps chat history in memory.
     */
    function deactivateAI() {
        if (typeof window.stopPanicKeyBlocker === 'function') {
            window.stopPanicKeyBlocker();
        }
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
        isAttachmentMenuOpen = false;
        isRequestPending = false;
        // NOTE: chatHistory is NOT cleared here, to allow it to persist.
    }

    /**
     * Renders the existing chat history when the AI is re-activated.
     */
    function renderChatHistory() {
        const responseContainer = document.getElementById('ai-response-container');
        if (!responseContainer) return;
        
        responseContainer.innerHTML = ''; // Clear any potential placeholders
        
        chatHistory.forEach(message => {
            const bubble = document.createElement('div');
            bubble.className = `ai-message-bubble ${message.role === 'user' ? 'user-message' : 'gemini-response'}`;
            
            if (message.role === 'model') {
                bubble.innerHTML = `<div class="ai-response-content">${parseGeminiResponse(message.parts[0].text)}</div>`;
            } else { // User message
                let bubbleContent = '';
                let textContent = '';
                let fileCount = 0;
                message.parts.forEach(part => {
                    if (part.text) {
                        textContent = part.text;
                    }
                    if (part.inlineData) {
                        fileCount++;
                    }
                });
                if (textContent) bubbleContent += `<p>${escapeHTML(textContent)}</p>`;
                if (fileCount > 0) bubbleContent += `<div class="sent-attachments">${fileCount} file(s) sent</div>`;
                bubble.innerHTML = bubbleContent;
            }
            responseContainer.appendChild(bubble);
        });
        
        setTimeout(() => responseContainer.scrollTop = responseContainer.scrollHeight, 50);
    }
    
    // ... all other functions like callGoogleAI, handleFileUpload, etc., remain the same as the previous full version.
    async function callGoogleAI(responseBubble) {if(!API_KEY){responseBubble.innerHTML=`<div class="ai-error">API Key is missing.</div>`;return}currentAIRequestController=new AbortController;let firstMessageContext="";if(chatHistory.length<=1){const location=localStorage.getItem("ai-user-location")||"an unknown location",now=new Date,date=now.toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"}),time=now.toLocaleTimeString("en-US",{timeZoneName:"short"});firstMessageContext=`(System Info: User is asking from ${location}. Current date is ${date}, ${time}.)\n\n`}const lastMessageIndex=chatHistory.length-1;chatHistory[lastMessageIndex].parts[0].text=firstMessageContext+chatHistory[lastMessageIndex].parts[0].text;const payload={contents:chatHistory};try{const response=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),signal:currentAIRequestController.signal});if(!response.ok)throw new Error(`Network response was not ok. Status: ${response.status}`);const data=await response.json();if(!data.candidates||data.candidates.length===0)throw new Error("Invalid response from API.");const text=data.candidates[0].content.parts[0].text;chatHistory.push({role:"model",parts:[{text:text}]});responseBubble.innerHTML=`<div class="ai-response-content">${parseGeminiResponse(text)}</div>`}catch(error){if(error.name==="AbortError"){responseBubble.innerHTML=`<div class="ai-error">Message generation stopped.</div>`}else{console.error("AI API Error:",error);responseBubble.innerHTML=`<div class="ai-error">Sorry, an error occurred.</div>`}}finally{isRequestPending=false;currentAIRequestController=null;const settingsToggle=document.getElementById("ai-settings-toggle");if(settingsToggle){settingsToggle.classList.remove("generating");settingsToggle.innerHTML="&#8942;"}responseBubble.classList.remove("loading");document.getElementById("ai-input-wrapper").classList.remove("waiting");const editor=document.getElementById("ai-input");if(editor){editor.contentEditable=true;editor.focus()}const responseContainer=document.getElementById("ai-response-container");if(responseContainer)responseContainer.scrollTop=responseContainer.scrollHeight}}
    function handleSettingsToggleClick(e){e.stopPropagation();if(isRequestPending){stopGeneration()}else{toggleAttachmentMenu()}}
    function stopGeneration(){if(currentAIRequestController){currentAIRequestController.abort()}}
    function toggleAttachmentMenu(){isAttachmentMenuOpen=!isAttachmentMenuOpen;const menu=document.getElementById("ai-attachment-menu"),toggleBtn=document.getElementById("ai-settings-toggle");if(isAttachmentMenuOpen){const btnRect=toggleBtn.getBoundingClientRect();menu.style.bottom=`${window.innerHeight-btnRect.top}px`;menu.style.right=`${window.innerWidth-btnRect.right}px`;menu.querySelectorAll('button[data-type]').forEach(button=>{const type=button.dataset.type;if(type==="images"||type==="videos"){const usage=limitManager.getUsage(),limitText=`<span>${usage[type]||0}/${DAILY_LIMITS[type]} used</span>`;button.querySelector("span:last-child").innerHTML=limitText;button.disabled=!limitManager.canUpload(type)}})}menu.classList.toggle("active",isAttachmentMenuOpen);toggleBtn.classList.toggle("active",isAttachmentMenuOpen)}
    function handleFileUpload(fileType){const input=document.createElement("input");input.type="file";const typeMap={photo:"image/*",video:"video/*",audio:"audio/*",file:"*"};input.accept=typeMap[fileType]||"*";input.onchange=event=>{const file=event.target.files[0];if(!file)return;if(file.type.startsWith("video/")&&file.size>100*1024*1024){alert("Video file is too large. Please choose a shorter video (max approx. 5 minutes).");return}const reader=new FileReader;reader.onload=e=>{const base64Data=e.target.result.split(",")[1];attachedFiles.push({inlineData:{mimeType:file.type,data:base64Data},fileName:file.name});const limitType=file.type.startsWith("image/")?"images":file.type.startsWith("video/")?"videos":null;if(limitType){limitManager.recordUpload(limitType)}renderAttachments()};reader.readAsDataURL(file)};input.click()}
    function renderAttachments(){const previewContainer=document.getElementById("ai-attachment-preview");previewContainer.innerHTML="";if(attachedFiles.length===0){previewContainer.style.display="none";return}previewContainer.style.display="flex";attachedFiles.forEach((file,index)=>{const fileCard=document.createElement("div");fileCard.className="attachment-card";let previewHTML=`<span class="file-icon">📄</span>`;if(file.inlineData.mimeType.startsWith("image/")){previewHTML=`<img src="data:${file.inlineData.mimeType};base64,${file.inlineData.data}" alt="${file.fileName}" />`}else if(file.inlineData.mimeType.startsWith("video/")){previewHTML=`<span class="file-icon">🎬</span>`}else if(file.inlineData.mimeType.startsWith("audio/")){previewHTML=`<span class="file-icon">🎵</span>`}fileCard.innerHTML=`
                ${previewHTML}
                <span class="file-name">${file.fileName}</span>
                <button class="remove-attachment-btn" data-index="${index}">&times;</button>
            `;previewContainer.appendChild(fileCard)});previewContainer.querySelectorAll(".remove-attachment-btn").forEach(btn=>{btn.onclick=()=>{attachedFiles.splice(btn.dataset.index,1);renderAttachments()}})}
    function createAttachmentMenu(){const menu=document.createElement("div");menu.id="ai-attachment-menu";const options=[{id:"photo",icon:"📷",label:"Photo",type:"images"},{id:"video",icon:"🎬",label:"Video",type:"videos"},{id:"audio",icon:"🎤",label:"Audio",type:"audio"},{id:"file",icon:"📎",label:"File",type:"file"}];options.forEach(opt=>{const button=document.createElement("button");button.dataset.type=opt.type;const canUpload=limitManager.canUpload(opt.type);let limitText="";if(opt.type==="images"||opt.type==="videos"){const usage=limitManager.getUsage();limitText=`<span>${usage[opt.type]||0}/${DAILY_LIMITS[opt.type]} used</span>`}button.innerHTML=`<span class="icon">${opt.icon}</span> ${opt.label} ${limitText}`;if(!canUpload){button.disabled=true;button.title="You have reached your daily limit for this file type."}button.onclick=()=>{handleFileUpload(opt.id);toggleAttachmentMenu()};menu.appendChild(button)});return menu}
    function handleContentEditableInput(e){const editor=e.target;if(editor.scrollHeight>MAX_INPUT_HEIGHT){editor.style.height=`${MAX_INPUT_HEIGHT}px`;editor.style.overflowY="auto"}else{editor.style.height="auto";editor.style.height=`${editor.scrollHeight}px`;editor.style.overflowY="hidden"}fadeOutWelcomeMessage();const placeholder=document.getElementById("ai-input-placeholder"),rawText=editor.innerText;if(placeholder)placeholder.style.display=rawText.length>0||attachedFiles.length>0?"none":"block"}
    function handleInputSubmission(e){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();const editor=e.target,query=editor.innerText.trim();if(!query&&attachedFiles.length===0)return;if(isRequestPending)return;isRequestPending=true;document.getElementById("ai-settings-toggle").classList.add("generating");editor.contentEditable=false;document.getElementById("ai-input-wrapper").classList.add("waiting");const parts=[];if(query)parts.push({text:query});attachedFiles.forEach(file=>{parts.push({inlineData:file.inlineData})});chatHistory.push({role:"user",parts:parts});const responseContainer=document.getElementById("ai-response-container"),userBubble=document.createElement("div");userBubble.className="ai-message-bubble user-message";let bubbleContent=query?`<p>${escapeHTML(query)}</p>`:"";if(attachedFiles.length>0){bubbleContent+=`<div class="sent-attachments">${attachedFiles.length} file(s) sent</div>`}userBubble.innerHTML=bubbleContent;responseContainer.appendChild(userBubble);const responseBubble=document.createElement("div");responseBubble.className="ai-message-bubble gemini-response loading";responseBubble.innerHTML='<div class="ai-loader"></div>';responseContainer.appendChild(responseBubble);responseContainer.scrollTop=responseContainer.scrollHeight;editor.innerHTML="";attachedFiles=[];renderAttachments();handleContentEditableInput({target:editor});callGoogleAI(responseBubble)}}
    function fadeOutWelcomeMessage(){const container=document.getElementById("ai-container");if(container&&!container.classList.contains("chat-active")){container.classList.add("chat-active")}}
    function escapeHTML(str){const p=document.createElement("p");p.textContent=str;return p.innerHTML}
    function parseGeminiResponse(text){let html=text.replace(/</g,"&lt;").replace(/>/g,"&gt;");html=html.replace(/```([\s\S]*?)```/g,(match,code)=>`<pre><code>${escapeHTML(code.trim())}</code></pre>`);const codeBlocks=[];html=html.replace(/\\([a-zA-Z]+)/g,(match,command)=>latexSymbolMap[match]||match);html=html.replace(/^### (.*$)/gm,"<h3>$1</h3>").replace(/^## (.*$)/gm,"<h2>$1</h2>").replace(/^# (.*$)/gm,"<h1>$1</h1>");html=html.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em>$1</em>");html=html.replace(/^(?:\*|-)\s(.*$)/gm,"<li>$1</li>");html=html.replace(/(<\/li>\s*<li>)/g,"</li><li>").replace(/((<li>.*<\/li>)+)/gs,"<ul>$1</ul>");return html.replace(/\n/g,"<br>")}
    function injectStyles(){if(document.getElementById("ai-dynamic-styles"))return;if(!document.querySelector('style[data-font="primary"]')){const fontStyle=document.createElement("style");fontStyle.setAttribute("data-font","primary");fontStyle.textContent="@font-face { font-family: 'PrimaryFont'; src: url('../fonts/primary.woff') format('woff'); font-weight: normal; font-style: normal; }";document.head.appendChild(fontStyle)}const style=document.createElement("style");style.id="ai-dynamic-styles";style.innerHTML=`
            :root { --ai-red: #ea4335; --ai-blue: #4285f4; --ai-green: #34a853; --ai-yellow: #fbbc05; }
            #ai-container { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0,0,0,0); backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); z-index: 2147483647; opacity: 0; transition: opacity 0.5s, background-color 0.5s, backdrop-filter 0.5s; font-family: 'secondaryfont', sans-serif; display: flex; flex-direction: column; justify-content: flex-end; padding-top: 70px; box-sizing: border-box; }
            #ai-container.active { opacity: 1; background-color: rgba(0, 0, 0, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
            #ai-container.deactivating, #ai-container.deactivating > * { transition: opacity 0.4s, transform 0.4s; }
            #ai-container.deactivating { opacity: 0 !important; background-color: rgba(0, 0, 0, 0); backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
            #ai-persistent-title { position: absolute; top: 28px; left: 30px; font-family: 'secondaryfont', sans-serif; font-size: 18px; font-weight: bold; color: white; opacity: 0; transition: opacity 0.5s 0.2s; animation: title-pulse 4s linear infinite; }
            #ai-container.chat-active #ai-persistent-title { opacity: 1; }
            #ai-welcome-message { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); text-align: center; color: rgba(255,255,255,.5); opacity: 1; transition: opacity .5s, transform .5s; width: 100%; }
            #ai-container.chat-active #ai-welcome-message { opacity: 0; pointer-events: none; transform: translate(-50%,-50%) scale(0.95); }
            #ai-welcome-message h2 { font-family: 'PrimaryFont', sans-serif; font-size: 2.5em; margin: 0; color: #fff; }
            #ai-welcome-message p { font-size: .9em; margin-top: 10px; max-width: 400px; margin-left: auto; margin-right: auto; line-height: 1.5; }
            #ai-close-button { position: absolute; top: 20px; right: 30px; color: rgba(255,255,255,.7); font-size: 40px; cursor: pointer; transition: color .2s ease,transform .3s ease, opacity 0.4s; }
            #ai-close-button:hover { color: #fff; transform: scale(1.1); }
            #ai-response-container { flex: 1 1 auto; overflow-y: auto; width: 100%; max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 15px; padding: 20px; -webkit-mask-image: linear-gradient(to bottom,transparent 0,black 5%,black 95%,transparent 100%); mask-image: linear-gradient(to bottom,transparent 0,black 5%,black 95%,transparent 100%); }
            .ai-message-bubble { background: rgba(15,15,18,.8); border: 1px solid rgba(255,255,255,.1); border-radius: 20px; padding: 15px 20px; color: #e0e0e0; backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px); animation: message-pop-in .5s cubic-bezier(.4,0,.2,1) forwards; max-width: 90%; line-height: 1.6; overflow-wrap: break-word; }
            .ai-message-bubble h1, .ai-message-bubble h2, .ai-message-bubble h3 { margin-top: 0; }
            .user-message { align-self: flex-end; background: rgba(40,45,50,.8); }
            .user-message p { margin: 0; }
            .sent-attachments { display: block; font-size: 0.8em; color: #ccc; margin-top: 8px; font-style: italic; }
            .gemini-response { align-self: flex-start; }
            .gemini-response.loading { border: 1px solid transparent; animation: gemini-glow 4s linear infinite,message-pop-in .5s cubic-bezier(.4,0,.2,1) forwards; }
            .gemini-response ul { padding-left: 20px; margin: 10px 0; }
            #ai-input-wrapper { display: flex; flex-direction: column; flex-shrink: 0; position: relative; z-index: 2; transition: all .4s cubic-bezier(.4,0,.2,1); margin: 15px auto; width: 90%; max-width: 800px; border-radius: 25px; background: rgba(10,10,10,.7); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); animation: glow 3s infinite; animation-play-state: running; border: 1px solid rgba(255,255,255,.2); }
            #ai-input-wrapper.waiting { animation: gemini-glow 4s linear infinite!important; }
            #ai-input { min-height: 50px; max-height: ${MAX_INPUT_HEIGHT}px; overflow-y: hidden; color: #fff; font-size: 1.1em; padding: 15px 50px 15px 20px; box-sizing: border-box; word-wrap: break-word; outline: 0; }
            #ai-input-placeholder { position: absolute; bottom: 15px; left: 20px; color: rgba(255,255,255,.4); pointer-events: none; font-size: 1.1em; transition: opacity 0.2s; }
            #ai-settings-toggle { position: absolute; right: 10px; bottom: 12px; transform: translateY(0); background: 0 0; border: none; color: rgba(255,255,255,.5); font-size: 24px; cursor: pointer; padding: 5px; line-height: 1; z-index: 3; transition: all .3s ease; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; }
            #ai-settings-toggle.active { transform: rotate(90deg); }
            #ai-settings-toggle.generating { transform: rotate(45deg); background-color: rgba(255,82,82,.2); color: #ff8a80; }
            #ai-settings-toggle.generating::before { content: '■'; font-size: 18px; line-height: 1; transform: rotate(-45deg); }
            #ai-attachment-menu { position: fixed; background: rgba(20, 20, 22, 0.7); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); border: 1px solid rgba(255,255,255,0.2); animation: glow 3s infinite; border-radius: 16px; box-shadow: 0 5px 25px rgba(0,0,0,0.5); display: flex; flex-direction: column; gap: 5px; padding: 8px; z-index: 2147483647; opacity: 0; visibility: hidden; transform: translateY(10px) scale(.95); transition: all .25s cubic-bezier(.4,0,.2,1); transform-origin: bottom right; }
            #ai-attachment-menu.active { opacity: 1; visibility: visible; transform: translateY(-5px); }
            #ai-attachment-menu button { background: transparent; border: none; color: #ddd; font-family: 'PrimaryFont', sans-serif; font-size: 1em; padding: 10px 15px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 12px; text-align: left; transition: background-color 0.2s; }
            #ai-attachment-menu button:disabled { opacity: 0.5; cursor: not-allowed; color: #888; }
            #ai-attachment-menu button .icon { font-size: 1.2em; }
            #ai-attachment-menu button span:last-child { font-size: 0.8em; color: #888; margin-left: auto; font-family: 'secondaryfont', sans-serif; }
            #ai-attachment-preview { display: none; flex-direction: row; gap: 10px; padding: 10px 15px; border-bottom: 1px solid rgba(255,255,255,0.1); overflow-x: auto; }
            .attachment-card { position: relative; border-radius: 8px; overflow: hidden; background: #333; height: 80px; width: 100px; flex-shrink: 0; }
            .attachment-card img { width: 100%; height: 100%; object-fit: cover; }
            .attachment-card .file-icon { font-size: 2.5em; display: flex; align-items: center; justify-content: center; height: 100%; color: #ccc; }
            .attachment-card .file-name { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.6); color: #fff; font-size: 0.75em; padding: 4px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .remove-attachment-btn { position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.5); color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; }
            .ai-loader { width: 25px; height: 25px; border: 3px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto; }
            @keyframes glow { 0%,100% { box-shadow: 0 0 8px rgba(255,255,255,.2); } 50% { box-shadow: 0 0 16px rgba(255,255,255,.4); } }
            @keyframes gemini-glow { 0%,100% { box-shadow: 0 0 8px 2px var(--ai-blue); } 25% { box-shadow: 0 0 8px 2px var(--ai-green); } 50% { box-shadow: 0 0 8px 2px var(--ai-yellow); } 75% { box-shadow: 0 0 8px 2px var(--ai-red); } }
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes message-pop-in { 0% { opacity: 0; transform: translateY(10px) scale(.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes title-pulse { 0%, 100% { text-shadow: 0 0 7px var(--ai-blue); } 25% { text-shadow: 0 0 7px var(--ai-green); } 50% { text-shadow: 0 0 7px var(--ai-yellow); } 75% { text-shadow: 0 0 7px var(--ai-red); } }
        `;
    document.head.appendChild(style);}
    document.addEventListener('keydown', handleKeyDown);

})();
