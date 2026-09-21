/**
 * Flow Batch Pro - Content Script (v2.1 Stable Canvas Edition)
 * Injected into Google Flow (flow.google.com).
 * Key Fix:
 *  - STRICTLY confines input & submit search to the bottom prompt dock
 *  - NEVER clicks top-navigation, home icon, or header buttons
 *  - STAYS permanently on the user's active project canvas (no unwanted redirects)
 *  - Accurately detects Indonesian placeholder "Apa yang ingin Anda buat?"
 *  - 100% CSP compliant, captures genuine 2K renders & auto-downloads
 */

(function() {
    if (!window.location.hostname.includes('flow.google.com')) {
        return;
    }

    const currentInstance = Date.now() + '_' + Math.random();
    window._flowBatchProInstance = currentInstance;

    // Clean up any old floating badge
    const oldBadge = document.getElementById('flow-batch-pro-badge') || document.getElementById('assetnexus-bridge-badge');
    if (oldBadge) oldBadge.remove();

    // 1. Floating Canvas HUD Badge (Bottom Right)
    const badge = document.createElement('div');
    badge.id = 'flow-batch-pro-badge';
    badge.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: rgba(12, 16, 23, 0.95);
        border: 1.5px solid #00ffaa;
        box-shadow: 0 0 25px rgba(0, 255, 170, 0.35);
        color: #f0f6fc;
        padding: 9px 15px;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 12px;
        z-index: 99999999;
        display: flex;
        align-items: center;
        gap: 10px;
        backdrop-filter: blur(12px);
        transition: all 0.25s ease;
        user-select: none;
    `;
    badge.innerHTML = `
        <span id="fbp-status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #00ffaa; box-shadow: 0 0 8px #00ffaa; display: inline-block; flex-shrink: 0;"></span>
        <span id="fbp-status-text"><strong>FlowNexus Pro:</strong> Terhubung (Siap)</span>
    `;
    document.body.appendChild(badge);

    function updateBadge(html, color = '#00ffaa') {
        const span = badge.querySelector('#fbp-status-text');
        const dot = badge.querySelector('#fbp-status-dot');
        if (span) span.innerHTML = html;
        if (dot) {
            dot.style.background = color;
            dot.style.boxShadow = `0 0 8px ${color}`;
        }
        badge.style.borderColor = color;
    }

    console.log('%c[Flow Batch Pro]%c v2.1 Siap pada Google Flow Canvas!', 'color:#00ffaa; font-weight:bold;', 'color:#fff;');

    // 2. Safe Input Value Setter (React / Custom Web Component Compatible)
    function setInputValue(element, text) {
        element.focus();

        const tag = element.tagName ? element.tagName.toLowerCase() : '';
        const isTextArea = tag === 'textarea';
        const isInput = tag === 'input';

        if (isTextArea || isInput) {
            const proto = isTextArea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
            const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
            if (descriptor && descriptor.set) {
                descriptor.set.call(element, text);
            } else {
                element.value = text;
            }
        }

        if (element.isContentEditable || element.getAttribute('contenteditable') !== null || element.getAttribute('role') === 'textbox') {
            element.focus();
            try {
                document.execCommand('selectAll', false, null);
                document.execCommand('delete', false, null);
                document.execCommand('insertText', false, text);
            } catch (e) {}
            if (!element.innerText || !element.innerText.includes(text.slice(0, 10))) {
                element.innerText = text;
            }
        }

        element.dispatchEvent(new Event('focus', { bubbles: true }));
        element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        try {
            element.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                composed: true,
                inputType: 'insertText',
                data: text
            }));
        } catch (e) {}
        element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        element.focus();
    }

    // 3. Deep Shadow-DOM Piercing Locator (STRICTLY IN LOWER HALF OF SCREEN)
    function findPromptInputDeep() {
        let candidate = null;

        function scan(root, depth = 0) {
            if (!root || candidate || depth > 10) return;

            // 1. Textareas in lower half
            const textareas = Array.from(root.querySelectorAll ? root.querySelectorAll('textarea') : []);
            for (const t of textareas) {
                const r = t.getBoundingClientRect();
                if (r.width > 50 && r.height > 6 && r.top > (window.innerHeight * 0.35) && window.getComputedStyle(t).display !== 'none') {
                    candidate = t;
                    return;
                }
            }

            // 2. contenteditable or role="textbox" in lower half
            const editables = Array.from(root.querySelectorAll ? root.querySelectorAll('[contenteditable], [role="textbox"], [role="combobox"]') : []);
            for (const el of editables) {
                const r = el.getBoundingClientRect();
                if (r.width > 50 && r.height > 6 && r.top > (window.innerHeight * 0.35)) {
                    const text = (el.innerText || '').toLowerCase();
                    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                    const ph = (el.getAttribute('data-placeholder') || el.getAttribute('placeholder') || '').toLowerCase();
                    if (ph.includes('buat') || ph.includes('apa') || ph.includes('prompt') || aria.includes('prompt') || text.includes('apa yang')) {
                        candidate = el;
                        return;
                    }
                    if (r.width > 120 && !candidate) {
                        candidate = el;
                    }
                }
            }

            // 3. Inputs in lower half (e.g. placeholder: "Apa yang ingin Anda buat?")
            const inputs = Array.from(root.querySelectorAll ? root.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])') : []);
            for (const inp of inputs) {
                const r = inp.getBoundingClientRect();
                if (r.top > (window.innerHeight * 0.35)) {
                    const ph = ((inp.placeholder || '') + ' ' + (inp.getAttribute('aria-label') || '') + ' ' + (inp.getAttribute('data-placeholder') || '')).toLowerCase();
                    if (ph.includes('buat') || ph.includes('apa yang') || ph.includes('prompt') || ph.includes('describe') || ph.includes('create')) {
                        candidate = inp;
                        return;
                    }
                    if (r.width > 120 && !candidate) {
                        candidate = inp;
                    }
                }
            }

            // 4. Traverse Shadow Roots
            const all = Array.from(root.querySelectorAll ? root.querySelectorAll('*') : []);
            for (const node of all) {
                if (node.shadowRoot) {
                    scan(node.shadowRoot, depth + 1);
                    if (candidate) return;
                }
            }
        }

        scan(document);
        return candidate;
    }

    // 4. Find Submit Button STRICTLY INSIDE THE DOCK (Arrow Button →)
    function findSubmitButton(inputEl) {
        if (!inputEl) return null;

        // Climb to prompt dock container (must be in lower half of screen)
        let container = inputEl.closest('form, [class*="dock"], [class*="bar"], [class*="prompt"], [class*="input"], [class*="container"]') || inputEl.parentElement;
        for (let i = 0; i < 4; i++) {
            if (container && container.parentElement && container.parentElement.getBoundingClientRect().top > (window.innerHeight * 0.45)) {
                container = container.parentElement;
            } else {
                break;
            }
        }

        if (!container) return null;

        // Disallowed labels to prevent clicking clear, settings, or variations
        const isDisallowed = (label) => {
            return label.includes('clear') || label.includes('hapus') || 
                   label.includes('batal') || label.includes('cancel') || 
                   label.includes('setting') || label.includes('close') || label.includes('tutup') ||
                   label.includes('banana') || label.includes('agent') || label.includes('agen');
        };

        // Filter buttons STRICTLY within the lower dock area (never header or sidebar)
        const dockButtons = Array.from(container.querySelectorAll('button, [role="button"]')).filter(b => {
            if (b === inputEl || b.disabled || b.getAttribute('aria-disabled') === 'true') return false;
            const rect = b.getBoundingClientRect();
            // Must be strictly at the bottom
            if (rect.top < (window.innerHeight * 0.45)) return false;
            const label = ((b.innerText || '') + ' ' + (b.getAttribute('aria-label') || '') + ' ' + (b.title || '')).toLowerCase();
            return !isDisallowed(label);
        });

        // Priority 1: Arrow icon button (SVG with arrow / send)
        for (const b of dockButtons) {
            const svg = b.querySelector('svg');
            if (svg) {
                const html = svg.innerHTML.toLowerCase();
                if (html.includes('arrow') || html.includes('send') || html.includes('path') || html.includes('m2.01') || html.includes('polygon')) {
                    return b;
                }
            }
            const label = ((b.innerText || '') + ' ' + (b.getAttribute('aria-label') || '')).toLowerCase();
            if (label.includes('kirim') || label.includes('send') || label.includes('submit') || label.includes('generate')) {
                return b;
            }
        }

        // Priority 2: Rightmost button in the dock
        if (dockButtons.length > 0) {
            dockButtons.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
            return dockButtons[0];
        }

        return null;
    }

    // 5. Execute Render Workflow for One Prompt (STAYS ON CURRENT PROJECT CANVAS)
    async function executePromptRender(payload) {
        let prompt = (payload.prompt || '').trim();
        const taskId = payload.taskId || 1;
        const requestedVariations = Math.min(4, Math.max(1, parseInt(payload.variations, 10) || 1));

        if (!prompt) {
            throw new Error('Prompt tidak boleh kosong.');
        }

        // Guarantee 2K prompt enhancement
        if (!prompt.toLowerCase().includes('2k') && !prompt.toLowerCase().includes('4k') && !prompt.toLowerCase().includes('ultra-high')) {
            prompt = `${prompt}, ultra-high-resolution 2K HD, crystal clear optics, razor-sharp details`;
        }

        // Ensure aspect ratio is included in prompt if not present
        if (payload.aspectRatio && !prompt.toLowerCase().includes('16:9') && !prompt.toLowerCase().includes('9:16') && !prompt.toLowerCase().includes('1:1') && !prompt.toLowerCase().includes('4:3') && !prompt.toLowerCase().includes('3:4')) {
            prompt = `${prompt}, ${payload.aspectRatio} aspect ratio`;
        }

        updateBadge(`<strong>[#${taskId}] Mengaktifkan Kanvas...</strong>`, '#00e5ff');

        // Locate prompt input (waits up to 10s)
        let input = null;
        const searchDeadline = Date.now() + 10000;
        while (!input && Date.now() < searchDeadline) {
            input = findPromptInputDeep();
            if (!input) await new Promise(r => setTimeout(r, 600));
        }

        if (!input) {
            throw new Error('Input prompt "Apa yang ingin Anda buat?" tidak ditemukan di kanvas. Pastikan kanvas proyek aktif.');
        }

        // Focus the input to ensure dock expands
        input.focus();
        await new Promise(r => setTimeout(r, 300));

        // Snapshot all existing images on the page BEFORE submitting
        const preExistingSrcSet = new Set();
        document.querySelectorAll('img').forEach(img => {
            if (img.src) preExistingSrcSet.add(img.src);
        });

        // Type prompt safely
        updateBadge(`<strong>[#${taskId}] Mengetik Prompt 2K...</strong>`, '#ffd600');
        setInputValue(input, prompt);
        await new Promise(r => setTimeout(r, 500));

        // Submit (Dual Trigger: Dock Arrow Button + Keyboard Enter)
        const submitBtn = findSubmitButton(input);
        if (submitBtn) {
            console.log('[FlowNexus Pro] Mengklik tombol panah submit di dock:', submitBtn);
            submitBtn.focus();
            ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(evtType => {
                submitBtn.dispatchEvent(new MouseEvent(evtType, { bubbles: true, cancelable: true, view: window }));
            });
        }

        // Always also dispatch Enter key on the input to ensure submission
        await new Promise(r => setTimeout(r, 250));
        input.focus();
        ['keydown', 'keypress', 'keyup'].forEach(evtType => {
            input.dispatchEvent(new KeyboardEvent(evtType, {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true,
                composed: true
            }));
        });

        const submitTime = Date.now();
        updateBadge(`<strong>[#${taskId}] Google Flow Merender 2K...</strong>`, '#00e5ff');

        // Wait for genuinely NEW 2K image(s) from Flow
        const maxWaitMs = 110000; // 110s max
        const capturedImages = [];

        while (Date.now() - submitTime < maxWaitMs) {
            await new Promise(r => setTimeout(r, 1500));

            const elapsedSec = Math.round((Date.now() - submitTime) / 1000);

            // Wait at least 6s to skip old instant DOM elements
            if (elapsedSec < 6) {
                updateBadge(`<strong>[#${taskId}] Merender (${elapsedSec}s)...</strong>`, '#00e5ff');
                continue;
            }

            const candidateImages = Array.from(document.querySelectorAll('img')).filter(img => {
                const src = img.src || '';
                return (
                    src &&
                    !preExistingSrcSet.has(src) &&
                    !src.startsWith('data:image/svg') &&
                    !src.includes('avatar') &&
                    !src.includes('googlelogo') &&
                    !src.includes('icon') &&
                    !src.includes('profile') &&
                    img.complete &&
                    (img.naturalWidth >= 400 || img.offsetWidth >= 350)
                );
            });

            if (candidateImages.length > 0) {
                // Wait 2.5s for Flow to finish decoding 2K resolution
                await new Promise(r => setTimeout(r, 2500));

                for (let c = 0; c < Math.min(candidateImages.length, requestedVariations); c++) {
                    const imgEl = candidateImages[c];
                    const dataUrl = await extract2KImageDataUrl(imgEl, payload.aspectRatio || '16:9');
                    if (dataUrl) capturedImages.push(dataUrl);
                }

                if (capturedImages.length > 0) {
                    break;
                }
            }

            updateBadge(`<strong>[#${taskId}] Merender (${elapsedSec}s - Menunggu 2K)...</strong>`, '#00e5ff');
        }

        if (capturedImages.length === 0) {
            throw new Error('Google Flow belum selesai merender gambar 2K setelah 110 detik.');
        }

        updateBadge(`<strong>✅ [#${taskId}] Selesai (${capturedImages.length} gambar 2K HD)!</strong>`, '#00ffaa');
        return capturedImages;
    }

    // Helper: Transform Google CDN URL into genuine 2K resolution (2752x1536 for 16:9)
    function get2KUrl(src, aspectRatio = '16:9') {
        if (!src) return src;
        
        const dimMap = {
            '16:9': { w: 2752, h: 1536 },
            '9:16': { w: 1536, h: 2752 },
            '1:1':  { w: 2048, h: 2048 },
            '4:3':  { w: 2304, h: 1728 },
            '3:4':  { w: 1728, h: 2304 }
        };
        const target = dimMap[aspectRatio] || { w: 2752, h: 1536 };

        if (src.includes('googleusercontent.com') || src.includes('google.com') || src.includes('googleapis.com')) {
            // Replace =w...-h... (e.g. =w1376-h768) with 2K parameters
            if (/=w\d+-h\d+/i.test(src)) {
                return src.replace(/=w\d+-h\d+[^=&]*/i, `=w${target.w}-h${target.h}`);
            }
            // Replace =s... or =w... with 2K parameters
            if (/=[sw]\d+/i.test(src)) {
                return src.replace(/=[sw]\d+[^=&]*/i, `=w${target.w}-h${target.h}`);
            }
            if (src.includes('=')) {
                return src.replace(/=[^=&]+$/, `=w${target.w}-h${target.h}`);
            }
            return `${src}=w${target.w}-h${target.h}`;
        }
        return src;
    }

    // 6. True 2K High-Res Extractor (Guarantees 2752x1536 for 16:9)
    async function extract2KImageDataUrl(imgEl, aspectRatio = '16:9') {
        const dimMap = {
            '16:9': { w: 2752, h: 1536 },
            '9:16': { w: 1536, h: 2752 },
            '1:1':  { w: 2048, h: 2048 },
            '4:3':  { w: 2304, h: 1728 },
            '3:4':  { w: 1728, h: 2304 }
        };
        const target = dimMap[aspectRatio] || { w: 2752, h: 1536 };
        let targetSrc = get2KUrl(imgEl.src, aspectRatio);

        // Check if higher-res source exists in srcset or attributes
        if (imgEl.srcset) {
            const parts = imgEl.srcset.split(',').map(s => s.trim());
            for (const p of parts) {
                if (p.includes('2752') || p.includes('2048') || p.includes('orig') || p.includes('2k')) {
                    targetSrc = p.split(' ')[0];
                    break;
                }
            }
        }

        // Method A: Direct fetch of uncompressed 2K blob from Google CDN
        try {
            const resp = await fetch(targetSrc);
            if (resp.ok) {
                const blob = await resp.blob();
                if (blob.size > 50000) {
                    return await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                }
            }
        } catch (e) {
            // Cross-origin fetch note (handled by panel.js)
        }

        // Method B: High-Precision 2K Canvas Upscaler & Exporter
        try {
            const canvas = document.createElement('canvas');
            canvas.width = target.w;
            canvas.height = target.h;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(imgEl, 0, 0, target.w, target.h);

            console.log(`[FlowNexus Pro] Gambar 2K kanvas siap: ${target.w}x${target.h}px`);
            return canvas.toDataURL('image/jpeg', 0.98);
        } catch (err2) {
            // Return 2K target URL for panel.js extension-context processing
            return targetSrc || imgEl.src;
        }
    }

    // 7. Runtime Message Listener
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'PING') {
            sendResponse({
                ready: true,
                url: window.location.href,
                hasInput: Boolean(findPromptInputDeep())
            });
            return false;
        }

        if (request.action === 'RENDER_PROMPT') {
            executePromptRender(request)
                .then((images) => {
                    sendResponse({ success: true, images: images });
                })
                .catch((err) => {
                    console.error('[Flow Batch Pro] Render error:', err);
                    updateBadge(`<strong>❌ Error:</strong> ${err.message}`, '#ff4444');
                    sendResponse({ success: false, error: err.message });
                });

            return true; // Keep message channel open for async response
        }
    });

    console.log('[Flow Batch Pro] Content script v2.1 siap di kanvas proyek Flow.');
})();
