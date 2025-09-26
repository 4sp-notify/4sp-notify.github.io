/**
 * AI MODE - ONLY FOR ADMINS AND ENROLLED USERS
 * Custom Chatbot By Gemini 2.5 Flash Lite Preview, from September of 2025.
 * A feature-rich, self-contained script with a unified attachment/subject menu,
 * enhanced animations, intelligent chat history (token saving),
 * and advanced file previews. This version includes UI fixes for the welcome
 * screen, loading animation, and incorporates new user-requested features.
 */
(function() {
    // --- CONFIGURATION ---
    // WARNING: Your API key is visible in this client-side code.
    const API_KEY = 'AIzaSyDcoUA4Js1oOf1nz53RbLaxUzD0GxTmKXA'; 
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview-09-2025:generateContent?key=${API_KEY}`;
    const MAX_INPUT_HEIGHT = 200;
    const CHAR_LIMIT = 500; // New character limit request

    // --- ICONS (for event handlers) ---
    const copyIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="copy-icon"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    const checkIconSVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="check-icon"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

    // --- STATE MANAGEMENT ---
    let isAIActive = false;
    let isRequestPending = false;
    let isActionMenuOpen = false;
    let currentAIRequestController = null;
    let currentSubject = 'General';
    let chatHistory = [];
    let attachedFiles = [];
    let shootingStarInterval = null;

    // --- EXPANDED SYMBOL MAP ---
    const latexSymbolMap = {
        '\\alpha':'α','\\beta':'β','\\gamma':'γ','\\delta':'δ','\\epsilon':'ε','\\zeta':'ζ','\\eta':'η','\\theta':'θ','\\iota':'ι','\\kappa':'κ','\\lambda':'λ','\\mu':'μ','\\nu':'ν','\\xi':'ξ','\\omicron':'ο','\\pi':'π','\\rho':'ρ','\\sigma':'σ','\\tau':'τ','\\upsilon':'υ','\\phi':'φ','\\chi':'χ','\\psi':'ψ','\\omega':'ω','\\Gamma':'Γ','\\Delta':'Δ','\\Theta':'Θ','\\Lambda':'Λ','\\Xi':'Ξ','\\Pi':'Π','\\Sigma':'Σ','\\Upsilon':'Υ','\\Phi':'Φ','\\Psi':'Ψ','\\Omega':'Ω','\\pm':'±','\\times':'×','\\div':'÷','\\cdot':'·','\\ast':'∗','\\cup':'∪','\\cap':'∩','\\in':'∈','\\notin':'∉','\\subset':'⊂','\\supset':'⊃','\\subseteq':'⊆','\\supseteq':'⊇','\\le':'≤','\\ge':'≥','\\ne':'≠','\\approx':'≈','\\equiv':'≡','\\leftarrow':'←','\\rightarrow':'→','\\uparrow':'↑','\\downarrow':'↓','\\leftrightarrow':'↔','\\Leftarrow':'⇐','\\Rightarrow':'⇒','\\Leftrightarrow':'⇔','\\forall':'∀','\\exists':'∃','\\nabla':'∇','\\partial':'∂','\\emptyset':'∅','\\infty':'∞','\\degree':'°','\\angle':'∠','\\hbar':'ħ','\\ell':'ℓ','\\therefore':'∴','\\because':'∵','\\bullet':'•','\\ldots':'…','\\prime':'′','\\hat':'^'
    };

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

    // --- UI EFFECTS (Redesigned Shooting Star) ---
    function startShootingStars() {
        if (shootingStarInterval) return; 
        const container = document.getElementById('ai-container');
        if (!container) return;

        stopShootingStars(); // Clear any existing interval before starting a new one

        shootingStarInterval = setInterval(() => {
            const star = document.createElement('div');
            star.className = 'shooting-star';
            
            // New Generative Logic: Stars start from the top/middle area and shoot down/right
            const startX = Math.random() * window.innerWidth * 1.5 - (window.innerWidth * 0.25); // Wider starting range
            const startY = Math.random() * window.innerHeight * 0.2; // Start in the very top quarter
            const duration = Math.random() * 3 + 5; // Longer duration: 5s to 8s
            const delay = Math.random() * 10; // Longer max delay: 10s
            
            star.style.left = `${startX}px`;
            star.style.top = `${startY}px`;
            star.style.setProperty('--duration', `${duration}s`);
            star.style.animationDelay = `${delay}s`;
            star.style.opacity = 0.8 + Math.random() * 0.2; // Slight opacity variation
            star.style.setProperty('--star-size', `${0.5 + Math.random() * 1.5}px`); // Size variation

            container.appendChild(star);
            
            star.addEventListener('animationend', () => {
                star.remove();
            }, { once: true });

        }, 1500 + Math.random() * 1500); // Spawn more frequently (every 1.5s to 3s)
    }

    function stopShootingStars() {
        if (shootingStarInterval) {
            clearInterval(shootingStarInterval);
            shootingStarInterval = null;
        }
        // Optional: Fade out existing stars if necessary, though they should clean up via animationend
    }


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
                // If AI is active, Ctrl+C on empty input/selection deactivates it
                const mainEditor = document.getElementById('ai-input');
                if (mainEditor && mainEditor.innerText.trim().length === 0 && selection.length === 0 && attachedFiles.length === 0) {
                    deactivateAI();
                    e.preventDefault();
                }
            } else {
                // If AI is inactive, Ctrl+C activates it (if authorized)
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
            // Start stars only if subject is General, as per request.
            if (currentSubject === 'General') {
                startShootingStars();
            }
        }, 10);
        
        visualInput.focus();
        isAIActive = true;
    }

    function deactivateAI() {
        if (typeof window.stopPanicKeyBlocker === 'function') { window.stopPanicKeyBlocker(); }
        stopShootingStars();
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
                bubble.querySelectorAll('.copy-code-btn').forEach(button => {
                    button.addEventListener('click', handleCopyCode);
                });
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
        if (textPart) {
             textPart.text = firstMessageContext + textPart.text;
        } else if (firstMessageContext) {
             userParts.unshift({ text: firstMessageContext.trim() });
        }
        
        let systemInstruction = 'You are a helpful and comprehensive AI assistant.';
        switch (currentSubject) {
            case 'Mathematics':
                systemInstruction = 'You are a mathematics expert. Prioritize accuracy and provide detailed, step-by-step reasoning for all calculations and proofs. Double-check your work for correctness.';
                break;
            case 'Science':
                systemInstruction = 'You are a science expert. Explain complex scientific concepts clearly and concisely, using analogies where helpful. Provide sources or references for claims where appropriate.';
                break;
            case 'History':
                systemInstruction = 'You are a history expert. Provide detailed and chronologically accurate information. When discussing events, include context and the perspectives of different groups involved.';
                break;
            case 'English':
                systemInstruction = 'You are an expert in English language and literature. Adopt a human-like, conversational, and slightly literary tone. Analyze texts with nuance, considering themes, character development, and authorial intent. Mirror the user\'s writing style in terms of formality.';
                break;
            case 'Programming':
                systemInstruction = 'You are an expert programmer and software architect. Provide complete and runnable code examples. Do not use brevity or omit necessary parts of the code for simplicity. Explain the code clearly, covering its logic, structure, and potential edge cases.';
                break;
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
                responseBubble.querySelectorAll('.copy-code-btn').forEach(button => {
                    button.addEventListener('click', handleCopyCode);
                });
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
            // Position menu relative to its toggle button, accounting for viewport edges
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
        const container = document.getElementById('ai-container');
        if (container) container.dataset.subject = subject;
        
        stopShootingStars();
        if (subject === 'General') {
            startShootingStars();
        }

        const menu=document.getElementById('ai-action-menu');
        menu.querySelectorAll('button[data-subject]').forEach(b=>b.classList.remove('active'));
        const activeBtn=menu.querySelector(`button[data-subject="${subject}"]`);
        if(activeBtn)activeBtn.classList.add('active');
        toggleActionMenu();
    }
    
    // --- FILE HANDLING ---

    /** Helper to generate a unique filename sequentially if one exists */
    function generateUniqueFileName(baseName, ext, existingNames) {
        if (!existingNames.has(baseName + '.' + ext)) {
            return baseName + '.' + ext;
        }
        let counter = 1;
        let newName = `${baseName}-${counter}.${ext}`;
        while (existingNames.has(newName)) {
            counter++;
            newName = `${baseName}-${counter}.${ext}`;
        }
        return newName;
    }

    /** Extracts all text content from all parts of the current message */
    function extractCurrentTextContent() {
        const editor = document.getElementById('ai-input');
        return editor ? editor.innerText : "";
    }

    /** Processes text content that exceeds the limit by converting it to a virtual file */
    function convertTextToAttachment(text) {
        if (!text || text.length <= CHAR_LIMIT) return;

        // 1. Determine existing file names (only for successfully uploaded/processed ones)
        const existingFileNames = new Set(attachedFiles.filter(f => !f.isLoading).map(f => f.fileName));

        // 2. Generate unique name for the 'paste' file
        const baseName = 'paste';
        const ext = 'txt';
        const fileName = generateUniqueFileName(baseName, ext, existingFileNames);

        // 3. Create a mock file object structure for Gemini API
        const mockFile = {
            name: fileName,
            type: 'text/plain',
            size: text.length // Approximate size
        };

        // 4. Read the file data (simulate loading/encoding)
        const tempId = `file-paste-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        
        attachedFiles.push({ 
            tempId, 
            file: mockFile, 
            isLoading: false, // Treat pasted text as immediately ready
            fileName: fileName,
            inlineData: { 
                mimeType: 'text/plain', 
                data: btoa(text) // Encode text as base64 data
            }
        });

        // 5. Notify user and clear editor
        alert(`Input exceeded ${CHAR_LIMIT} characters. Content was automatically converted into attachment: ${fileName}`);
        document.getElementById('ai-input').innerText = '';
        handleContentEditableInput({ target: document.getElementById('ai-input') }); // Resize input
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
            
            // Check size limit before proceeding with any file
            const currentTotalSize = attachedFiles.reduce((sum, file) => sum + (file.inlineData ? atob(file.inlineData.data).length : 0), 0);
            const newFilesSize = files.reduce((sum, file) => sum + file.size, 0);
            if (currentTotalSize + newFilesSize > (4 * 1024 * 1024)) { // Example: 4MB limit
                alert(`Upload failed: Total size of attachments would exceed the 4MB limit per message.`);
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
                const tempId = `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                attachedFiles.push({ tempId, file, isLoading: true });
                renderAttachments();
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    const base64Data = e.target.result.split(',')[1];
                    const itemIndex = attachedFiles.findIndex(f => f.tempId === tempId);
                    if (itemIndex > -1) {
                        const item = attachedFiles[itemIndex];
                        item.isLoading = false;
                        item.inlineData = { mimeType: file.type, data: base64Data };
                        item.fileName = file.name;
                        delete item.file;
                        delete item.tempId;
                        renderAttachments();
                    }
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
            previewContainer.innerHTML = '';
            return;
        }

        previewContainer.style.display = 'flex';
        inputWrapper.classList.add('has-attachments');
        previewContainer.innerHTML = ''; // Clear previous previews


        attachedFiles.forEach((file, index) => {
            const fileCard = document.createElement('div');
            fileCard.className = 'attachment-card';
            let previewHTML = '';
            let fileExt = 'FILE';
            let fileName = '';


            if (file.isLoading) {
                fileCard.classList.add('loading');
                fileName = file.file.name;
                fileExt = fileName.split('.').pop().toUpperCase();
                previewHTML = `<div class="ai-loader"></div><span class="file-icon">📄</span>`;
            } else {
                fileName = file.fileName;
                fileExt = fileName.split('.').pop().toUpperCase();
                if (file.inlineData.mimeType.startsWith('image/')) {
                    previewHTML = `<img src="data:${file.inlineData.mimeType};base64,${file.inlineData.data}" alt="${fileName}" />`;
                } else {
                    previewHTML = `<span class="file-icon">📄</span>`;
                }
            }


            if (fileExt.length > 5) fileExt = 'FILE';
            let fileTypeBadge = `<div class="file-type-badge">${fileExt}</div>`;
            if (file.inlineData && file.inlineData.mimeType.startsWith('image/')) {
                 fileTypeBadge = '';
            }


            const nameSpan = document.createElement('span');
            nameSpan.textContent = fileName;
            const marqueeWrapper = document.createElement('div');
            marqueeWrapper.className = 'file-name';
            marqueeWrapper.appendChild(nameSpan);


            fileCard.innerHTML = `${previewHTML}<div class="file-info"></div>${fileTypeBadge}<button class="remove-attachment-btn" data-index="${index}">&times;</button>`;
            fileCard.querySelector('.file-info').appendChild(marqueeWrapper);

            setTimeout(() => {
                if (nameSpan.scrollWidth > marqueeWrapper.clientWidth) {
                    const marqueeDuration = fileName.length / 4;
                    nameSpan.style.animationDuration = `${marqueeDuration}s`;
                    marqueeWrapper.classList.add('marquee');
                    nameSpan.innerHTML += `<span aria-hidden="true">${fileName}</span>`;
                }
            }, 0);


            fileCard.querySelector('.remove-attachment-btn').onclick = () => {
                attachedFiles.splice(index, 1);
                renderAttachments();
            };
            previewContainer.appendChild(fileCard);
        });
    }

    function createActionMenu() {
        const menu = document.createElement('div');
        menu.id = 'ai-action-menu';
        const attachments = [ { id: 'photo', icon: '📷', label: 'Photo', type: 'images' }, { id: 'file', icon: '📎', label: 'File', type: 'file' } ];
        const subjects = ['General','Mathematics','Science','History','English','Programming'];
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

    function updateInputVisuals(editor) {
        const currentText = editor.innerText;
        const currentLen = currentText.length;
        
        // 1. Character Limit Check & Conversion
        if (currentLen > CHAR_LIMIT) {
            convertTextToAttachment(currentText);
            // After conversion, the editor is cleared, so we stop visual updates here
            return; 
        }

        // 2. Dynamic Height Adjustment
        if (editor.scrollHeight > MAX_INPUT_HEIGHT) { 
            editor.style.height = `${MAX_INPUT_HEIGHT}px`; 
            editor.style.overflowY = 'auto'; 
        } else { 
            editor.style.height = 'auto'; 
            editor.style.height = `${editor.scrollHeight}px`; 
            editor.style.overflowY = 'hidden'; 
        }
        
        // 3. Live Character Count Display (New Feature)
        const inputWrapper = document.getElementById('ai-input-wrapper');
        if (!inputWrapper.querySelector('.char-counter')) {
            const counterDiv = document.createElement('div');
            counterDiv.className = 'char-counter';
            inputWrapper.prepend(counterDiv); // Prepend it before the attachment previews/input
        }
        const counter = inputWrapper.querySelector('.char-counter');
        counter.textContent = `${currentLen}/${CHAR_LIMIT}`;
        
        if (currentLen > CHAR_LIMIT * 0.9) {
            counter.style.color = '#fbbc05'; // Yellow warning
        } else if (currentLen > CHAR_LIMIT * 0.98) {
             counter.style.color = '#ea4335'; // Red critical warning
        }
        else {
            counter.style.color = 'rgba(255, 255, 255, 0.5)';
        }

        fadeOutWelcomeMessage();
    }

    function handleContentEditableInput(e) {
        updateInputVisuals(e.target);
    }

    function handleInputSubmission(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (isActionMenuOpen) { toggleActionMenu(); }
            
            const editor = e.target;
            const query = editor.innerText.trim();
            
            // Check for pending uploads
            if (attachedFiles.some(f => f.isLoading)) {
                alert("Please wait for files to finish uploading before sending.");
                return;
            }
            
            // Check if content is empty (text or attachments)
            if (!query && attachedFiles.length === 0) return;
            
            // Check if already processing a request
            if (isRequestPending) return;
            
            // Check if text needs to be converted *before* sending
            if (query.length > CHAR_LIMIT) {
                convertTextToAttachment(query);
                // If conversion happened, the editor text is now empty, so we stop here.
                if (document.getElementById('ai-input').innerText.trim().length === 0 && attachedFiles.length > 0) {
                    // We proceed to send the *new* attachment instead of the old text
                    editor.innerText = ''; // Ensure editor is clear visually
                    handleContentEditableInput({ target: editor }); // Update visuals
                    // Fall through to send logic below, which will now see attachments only
                } else {
                    return; // If conversion failed or something went wrong, stop submission
                }
            }

            isRequestPending = true;
            document.getElementById('ai-action-toggle').classList.add('generating');
            document.getElementById('ai-input-wrapper').classList.add('waiting');
            
            const parts = [];
            const finalQuery = editor.innerText.trim(); // Use potentially truncated/cleared text
            if (finalQuery) parts.push({ text: finalQuery });
            
            // Add ready attachments (including converted text files)
            attachedFiles.forEach(file => { if (file.inlineData) parts.push({ inlineData: file.inlineData }); });
            
            if (parts.length === 0) {
                isRequestPending = false;
                document.getElementById('ai-action-toggle').classList.remove('generating');
                document.getElementById('ai-input-wrapper').classList.remove('waiting');
                return;
            }

            chatHistory.push({ role: "user", parts: parts });
            
            const responseContainer = document.getElementById('ai-response-container');
            const userBubble = document.createElement('div');
            userBubble.className = 'ai-message-bubble user-message';
            let bubbleContent = finalQuery ? `<p>${escapeHTML(finalQuery)}</p>` : '';
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
            handleContentEditableInput({ target: editor }); // Reset height and counter
            callGoogleAI(responseBubble);
        }
    }
    
    function handleCopyCode(event) {
        const btn = event.currentTarget;
        const wrapper = btn.closest('.code-block-wrapper');
        const code = wrapper.querySelector('pre > code');
        if (code) {
            navigator.clipboard.writeText(code.innerText).then(() => {
                btn.innerHTML = checkIconSVG;
                btn.disabled = true;
                setTimeout(() => {
                    btn.innerHTML = copyIconSVG;
                    btn.disabled = false;
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy code: ', err);
                alert('Failed to copy code.');
            });
        }
    }
    
    function fadeOutWelcomeMessage(){const container=document.getElementById("ai-container");if(container&&!container.classList.contains("chat-active")){container.classList.add("chat-active")}}
    function escapeHTML(str){const p=document.createElement("p");p.textContent=str;return p.innerHTML}
    function parseGeminiResponse(text) {
        let html = text;
        const codeBlocks = [];


        html = html.replace(/
