/**
 * ai-activation.js
 *
 * A feature-rich, self-contained script with a powerful response parser,
 * expanded symbol support, file uploads, daily limits, and contextual awareness.
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
    let chatHistory = [];
    let attachedFiles = [];

    // --- EXPANDED SYMBOL MAP ---
    const latexSymbolMap = {
        // Greek Letters (Lowercase)
        '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ', '\\epsilon': 'ε', 
        '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ', '\\iota': 'ι', '\\kappa': 'κ', 
        '\\lambda': 'λ', '\\mu': 'μ', '\\nu': 'ν', '\\xi': 'ξ', '\\omicron': 'ο', 
        '\\pi': 'π', '\\rho': 'ρ', '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ', 
        '\\phi': 'φ', '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
        // Greek Letters (Uppercase)
        '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ', '\\Xi': 'Ξ', 
        '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Upsilon': 'Υ', '\\Phi': 'Φ', '\\Psi': 'Ψ', '\\Omega': 'Ω',
        // Math Operators
        '\\pm': '±', '\\times': '×', '\\div': '÷', '\\cdot': '·', '\\ast': '∗', 
        '\\cup': '∪', '\\cap': '∩', '\\in': '∈', '\\notin': '∉', '\\subset': '⊂', 
        '\\supset': '⊃', '\\subseteq': '⊆', '\\supseteq': '⊇',
        // Comparison
        '\\le': '≤', '\\ge': '≥', '\\ne': '≠', '\\approx': '≈', '\\equiv': '≡',
        // Arrows
        '\\leftarrow': '←', '\\rightarrow': '→', '\\uparrow': '↑', '\\downarrow': '↓', 
        '\\leftrightarrow': '↔', '\\Leftarrow': '⇐', '\\Rightarrow': '⇒', '\\Leftrightarrow': '⇔',
        // Logic and Set Theory
        '\\forall': '∀', '\\exists': '∃', '\\nabla': '∇', '\\partial': '∂', '\\emptyset': '∅',
        // Other Symbols
        '\\infty': '∞', '\\degree': '°', '\\angle': '∠', '\\hbar': 'ħ', '\\ell': 'ℓ',
        '\\therefore': '∴', '\\because': '∵', '\\bullet': '•', '\\ldots': '…',
        '\\prime': '′', '\\hat': '^'
    };

    // --- DAILY LIMITS CONFIGURATION ---
    const DAILY_LIMITS = { images: 5, videos: 1 };

    /**
     * Handles all daily limit logic (checking, decrementing, resetting).
     */
    const limitManager = {
        getToday:()=>new Date().toLocaleDateString("en-US"),
        getUsage:()=>{const e=JSON.parse(localStorage.getItem("aiUsageLimits"))||{};return e.date!==limitManager.getToday()?{date:limitManager.getToday(),images:0,videos:0}:e},
        saveUsage:e=>{localStorage.setItem("aiUsageLimits",JSON.stringify(e))},
        canUpload:e=>{const t=limitManager.getUsage();return e in DAILY_LIMITS?(t[e]||0)<DAILY_LIMITS[e]:!0},
        recordUpload:e=>{if(e in DAILY_LIMITS){let t=limitManager.getUsage();t[e]=(t[e]||0)+1,limitManager.saveUsage(t)}}
    };
    
    // --- All other functions (unchanged from the last full script) ---
    async function isUserAuthorized(){const e=firebase.auth().currentUser;if("undefined"==typeof firebase||!e)return!1;const t=["4simpleproblems@gmail.com","belkwy30@minerva.sparcc.org"];if(t.includes(e.email))return!0;try{const t=firebase.firestore().collection("users").doc(e.uid),n=await t.get();return n.exists&&!0===n.data().aiEnrolled}catch(e){return console.error("AI Auth Check Error:",e),!1}}
    async function handleKeyDown(e){if(e.ctrlKey&&"c"===e.key.toLowerCase()){const t=window.getSelection().toString();if(isAIActive){e.preventDefault();const t=document.getElementById("ai-input");t&&""===t.innerText.trim()&&0===selection.length&&0===attachedFiles.length&&deactivateAI()}else if(0===t.length){const t=await isUserAuthorized();t&&(e.preventDefault(),activateAI())}}}
    function activateAI(){if(document.getElementById("ai-container"))return;"function"==typeof window.startPanicKeyBlocker&&window.startPanicKeyBlocker(),chatHistory=[],attachedFiles=[],injectStyles();const e=document.createElement("div");e.id="ai-container";const t=document.createElement("div");t.id="ai-persistent-title",t.textContent="AI Mode";const n=document.createElement("div");n.id="ai-welcome-message",n.innerHTML=`\n            <h2>Welcome to AI Mode</h2>\n            <p>To improve your experience, this feature collects broad, non-identifying data like your general location (state or country), the current date, and time.</p>\n        `;const o=document.createElement("div");o.id="ai-close-button",o.innerHTML="&times;",o.onclick=deactivateAI;const a=document.createElement("div");a.id="ai-response-container";const i=document.createElement("div");i.id="ai-input-wrapper";const s=document.createElement("div");s.id="ai-attachment-preview";const r=document.createElement("div");r.id="ai-input",r.contentEditable=!0,r.onkeydown=handleInputSubmission,r.oninput=handleContentEditableInput;const l=document.createElement("div");l.id="ai-input-placeholder",l.textContent="Ask a question or describe your files...";const c=document.createElement("button");c.id="ai-settings-toggle",c.innerHTML="&#8942;",c.onclick=handleSettingsToggleClick,i.appendChild(s),i.appendChild(r),i.appendChild(l),i.appendChild(c),e.appendChild(t),e.appendChild(n),e.appendChild(o),e.appendChild(a),e.appendChild(i),e.appendChild(createAttachmentMenu()),document.body.appendChild(e),setTimeout(()=>e.classList.add("active"),10),r.focus(),isAIActive=!0}
    function deactivateAI(){"function"==typeof window.stopPanicKeyBlocker&&window.stopPanicKeyBlocker(),currentAIRequestController&&currentAIRequestController.abort();const e=document.getElementById("ai-container");e&&(e.classList.add("deactivating"),setTimeout(()=>{e.remove();const e=document.getElementById("ai-dynamic-styles");e&&e.remove()},500)),isAIActive=!1,isAttachmentMenuOpen=!1,isRequestPending=!1,chatHistory=[],attachedFiles=[]}
    async function callGoogleAI(e){if(!API_KEY)return void(e.innerHTML='<div class="ai-error">API Key is missing.</div>');currentAIRequestController=new AbortController;let t="";if(chatHistory.length<=1){const e=localStorage.getItem("ai-user-location")||"an unknown location",n=new Date,o=n.toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"}),a=n.toLocaleTimeString("en-US",{timeZoneName:"short"});t=`(System Info: User is asking from ${e}. Current date is ${o}, ${a}.)\n\n`}const n=chatHistory.length-1;chatHistory[n].parts[0].text=t+chatHistory[n].parts[0].text;const o={contents:chatHistory};try{const t=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(o),signal:currentAIRequestController.signal});if(!t.ok)throw new Error(`Network response was not ok. Status: ${t.status}`);const n=await t.json();if(!n.candidates||0===n.candidates.length)throw new Error("Invalid response from API.");const a=n.candidates[0].content.parts[0].text;chatHistory.push({role:"model",parts:[{text:a}]}),e.innerHTML=`<div class="ai-response-content">${parseGeminiResponse(a)}</div>`}catch(t){"AbortError"===t.name?e.innerHTML='<div class="ai-error">Message generation stopped.</div>':(console.error("AI API Error:",t),e.innerHTML='<div class="ai-error">Sorry, an error occurred.</div>')}finally{isRequestPending=!1,currentAIRequestController=null;const t=document.getElementById("ai-settings-toggle");t&&(t.classList.remove("generating"),t.innerHTML="&#8942;"),e.classList.remove("loading"),document.getElementById("ai-input-wrapper").classList.remove("waiting");const n=document.getElementById("ai-input");n&&(n.contentEditable=!0,n.focus());const o=document.getElementById("ai-response-container");o&&(o.scrollTop=o.scrollHeight)}}
    function handleSettingsToggleClick(e){e.stopPropagation(),isRequestPending?stopGeneration():toggleAttachmentMenu()}
    function stopGeneration(){currentAIRequestController&&currentAIRequestController.abort()}
    function toggleAttachmentMenu(){isAttachmentMenuOpen=!isAttachmentMenuOpen;const e=document.getElementById("ai-attachment-menu"),t=document.getElementById("ai-settings-toggle");if(isAttachmentMenuOpen){const n=t.getBoundingClientRect();e.style.bottom=`${window.innerHeight-n.top}px`,e.style.right=`${window.innerWidth-n.right}px`,e.querySelectorAll("button[data-type]").forEach(e=>{const t=e.dataset.type;if("images"===t||"videos"===t){const n=limitManager.getUsage(),o=`<span>${n[t]||0}/${DAILY_LIMITS[t]} used</span>`;e.querySelector("span:last-child").innerHTML=o,e.disabled=!limitManager.canUpload(t)}})}e.classList.toggle("active",isAttachmentMenuOpen),t.classList.toggle("active",isAttachmentMenuOpen)}
    function handleFileUpload(e){const t=document.createElement("input");t.type="file",t.accept={photo:"image/*",video:"video/*",audio:"audio/*",file:"*"}[e]||"*",t.onchange=e=>{const t=e.target.files[0];if(t){if(t.type.startsWith("video/")&&t.size>1024*1024*100)return void alert("Video file is too large. Please choose a shorter video (max approx. 5 minutes).");const n=new FileReader;n.onload=e=>{const n=e.target.result.split(",")[1];attachedFiles.push({inlineData:{mimeType:t.type,data:n},fileName:t.name});const o=t.type.startsWith("image/")?"images":t.type.startsWith("video/")?"videos":null;o&&limitManager.recordUpload(o),renderAttachments()},n.readAsDataURL(t)}},t.click()}
    function renderAttachments(){const e=document.getElementById("ai-attachment-preview");if(e.innerHTML="",0===attachedFiles.length)return void(e.style.display="none");e.style.display="grid",attachedFiles.forEach((t,n)=>{const o=document.createElement("div");o.className="attachment-card";let a='<span class="file-icon">📄</span>';t.inlineData.mimeType.startsWith("image/")?a=`<img src="data:${t.inlineData.mimeType};base64,${t.inlineData.data}" alt="${t.fileName}" />`:t.inlineData.mimeType.startsWith("video/")?a='<span class="file-icon">🎬</span>':t.inlineData.mimeType.startsWith("audio/")&&(a='<span class="file-icon">🎵</span>'),o.innerHTML=`\n                ${a}\n                <span class="file-name">${t.fileName}</span>\n                <button class="remove-attachment-btn" data-index="${n}">&times;</button>\n            `,e.appendChild(o)}),e.querySelectorAll(".remove-attachment-btn").forEach(e=>{e.onclick=()=>{attachedFiles.splice(e.dataset.index,1),renderAttachments()}})}
    function createAttachmentMenu(){const e=document.createElement("div");e.id="ai-attachment-menu";const t=[{id:"photo",icon:"📷",label:"Photo",type:"images"},{id:"video",icon:"🎬",label:"Video",type:"videos"},{id:"audio",icon:"🎤",label:"Audio",type:"audio"},{id:"file",icon:"📎",label:"File",type:"file"}];return t.forEach(t=>{const n=document.createElement("button");n.dataset.type=t.type;const o=limitManager.canUpload(t.type);let a="";if("images"===t.type||"videos"===t.type){const e=limitManager.getUsage();a=`<span>${e[t.type]||0}/${DAILY_LIMITS[t.type]} used</span>`}n.innerHTML=`<span class="icon">${t.icon}</span> ${t.label} ${a}`,o||(n.disabled=!0,n.title="You have reached your daily limit for this file type."),n.onclick=()=>{handleFileUpload(t.id),toggleAttachmentMenu()},e.appendChild(n)}),e}
    function handleContentEditableInput(e){const t=e.target;t.scrollHeight>MAX_INPUT_HEIGHT?(t.style.height=`${MAX_INPUT_HEIGHT}px`,t.style.overflowY="auto"):(t.style.height="auto",t.style.height=`${t.scrollHeight}px`,t.style.overflowY="hidden"),fadeOutWelcomeMessage();const n=document.getElementById("ai-input-placeholder"),o=t.innerText;n&&(n.style.display=o.length>0||attachedFiles.length>0?"none":"block")}
    function handleInputSubmission(e){if("Enter"===e.key&&!e.shiftKey){e.preventDefault();const t=e.target,n=t.innerText.trim();if(!n&&0===attachedFiles.length)return;if(isRequestPending)return;isRequestPending=!0,document.getElementById("ai-settings-toggle").classList.add("generating"),t.contentEditable=!1,document.getElementById("ai-input-wrapper").classList.add("waiting");const o=[];n&&o.push({text:n}),attachedFiles.forEach(e=>{o.push({inlineData:e.inlineData})}),chatHistory.push({role:"user",parts:o});const a=document.getElementById("ai-response-container"),i=document.createElement("div");i.className="ai-message-bubble user-message";let s=n?`<p>${escapeHTML(n)}</p>`:"";attachedFiles.length>0&&(s+=`<div class="sent-attachments">${attachedFiles.length} file(s) sent</div>`),i.innerHTML=s,a.appendChild(i);const r=document.createElement("div");r.className="ai-message-bubble gemini-response loading",r.innerHTML='<div class="ai-loader"></div>',a.appendChild(r),a.scrollTop=a.scrollHeight,t.innerHTML="",attachedFiles=[],renderAttachments(),handleContentEditableInput({target:t}),callGoogleAI(r)}}
    function escapeHTML(e){const t=document.createElement("p");return t.textContent=e,t.innerHTML}
    function injectStyles(){if(document.getElementById("ai-dynamic-styles"))return;if(!document.querySelector('style[data-font="primary"]')){const e=document.createElement("style");e.setAttribute("data-font","primary"),e.textContent="@font-face { font-family: 'PrimaryFont'; src: url('../fonts/primary.woff') format('woff'); font-weight: normal; font-style: normal; }",document.head.appendChild(e)}const e=document.createElement("style");e.id="ai-dynamic-styles",e.innerHTML=`
            :root { --ai-red: #ea4335; --ai-blue: #4285f4; --ai-green: #34a853; --ai-yellow: #fbbc05; }
            #ai-container { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0, 0, 0, 0); backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); z-index: 2147483647; opacity: 0; transition: opacity 0.5s, background-color 0.5s, backdrop-filter 0.5s; font-family: 'secondaryfont', sans-serif; display: flex; flex-direction: column; padding-top: 70px; box-sizing: border-box; }
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
            #ai-input-wrapper { display: flex; flex-direction: column; flex-shrink: 0; position: relative; z-index: 2; transition: all .4s cubic-bezier(.4,0,.2,1); margin: 15px auto 30px; width: 90%; max-width: 800px; border-radius: 25px; background: rgba(10,10,10,.7); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); animation: glow 3s infinite; animation-play-state: running; border: 1px solid rgba(255,255,255,.2); }
            #ai-input-wrapper.waiting { animation: gemini-glow 4s linear infinite!important; }
            #ai-input { min-height: 50px; max-height: ${MAX_INPUT_HEIGHT}px; overflow-y: hidden; color: #fff; font-size: 1.1em; padding: 15px 50px 15px 20px; box-sizing: border-box; word-wrap: break-word; outline: 0; }
            #ai-input-placeholder { position: absolute; bottom: 15px; left: 20px; color: rgba(255,255,255,.4); pointer-events: none; font-size: 1.1em; transition: opacity 0.2s; }
            #ai-settings-toggle { position: absolute; right: 10px; bottom: 12px; transform: translateY(0); background: 0 0; border: none; color: rgba(255,255,255,.5); font-size: 24px; cursor: pointer; padding: 5px; line-height: 1; z-index: 3; transition: all .3s ease; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; }
            #ai-settings-toggle.active { transform: rotate(90deg); }
            #ai-settings-toggle.generating { transform: rotate(45deg); background-color: rgba(255,82,82,.2); color: #ff8a80; }
            #ai-settings-toggle.generating::before { content: '■'; font-size: 18px; line-height: 1; transform: rotate(-45deg); }
            #ai-attachment-menu { position: fixed; background: rgba(10,10,10,0.8); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.2); animation: glow 3s infinite; border-radius: 12px; box-shadow: 0 5px 25px rgba(0,0,0,0.5); display: flex; flex-direction: column; gap: 5px; padding: 8px; z-index: 2147483647; opacity: 0; visibility: hidden; transform: translateY(10px) scale(.95); transition: all .25s cubic-bezier(.4,0,.2,1); transform-origin: bottom right; }
            #ai-attachment-menu.active { opacity: 1; visibility: visible; transform: translateY(-5px); }
            #ai-attachment-menu button { background: transparent; border: none; color: #ddd; font-family: 'PrimaryFont', sans-serif; font-size: 1em; padding: 10px 15px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 12px; text-align: left; transition: background-color 0.2s; }
            #ai-attachment-menu button:disabled { opacity: 0.5; cursor: not-allowed; color: #888; }
            #ai-attachment-menu button .icon { font-size: 1.2em; }
            #ai-attachment-menu button span:last-child { font-size: 0.8em; color: #888; margin-left: auto; font-family: 'secondaryfont', sans-serif; }
            #ai-attachment-preview { display: none; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 10px; padding: 10px 15px; border-bottom: 1px solid rgba(255,255,255,0.1); }
            .attachment-card { position: relative; border-radius: 8px; overflow: hidden; background: #333; height: 80px; }
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
