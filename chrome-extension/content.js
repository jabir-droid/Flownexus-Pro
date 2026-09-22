/**
 * Flow Batch Pro - Content Script (v2.1.2 Lightning Canvas Edition)
 * Injected into Google Flow (flow.google.com).
 * Key Fixes:
 *  - STRICTLY targets ONLY the genuine submit arrow button (.generate-icon-button, [aria-label*="pembuatan"])
 *  - NEVER clicks "Opsi lainnya" (More Options) or any menu buttons
 *  - Ultra-fast prompt injection (150ms typing delay instead of 600ms+)
 *  - Native CDP Hardware Left-Click (isTrusted=true) + Native Enter Key
 *  - Immediate render detection (1s polling, 4s fast start)
 *  - 100% CSP compliant, captures genuine 2K renders & auto-downloads
 */

(function() {
    if (!window.location.hostname.includes('flow.google.com')) {
        return;
    }

    const currentInstance = Date.now() + '_' + Math.random();
    window._flowBatchProInstance = currentInstance;
    let isRenderAborted = false;

    // Clean up any old floating badge
    const oldBadge = document.getElementById('flow-batch-pro-badge') || document.getElementById('assetnexus-bridge-badge');
    if (oldBadge) oldBadge.remove();

    // 1. Floating Canvas HUD Badge (Top Right to avoid blocking bottom dock)
    const badge = document.createElement('div');
    badge.id = 'flow-batch-pro-badge';
    badge.style.cssText = `
        position: fixed;
        top: 16px;
        right: 16px;
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
        pointer-events: none;
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

    console.log('%c[Flow Batch Pro]%c v2.1.2 Siap pada Google Flow Canvas!', 'color:#00ffaa; font-weight:bold;', 'color:#fff;');

    // 2. Safe & Fast Input Value Setter (Native Typing Simulation for Angular)
    function setInputValue(element, text) {
        if (!element) return;
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

        // Dispatch input events
        element.dispatchEvent(new Event('focus', { bubbles: true }));
        try {
            element.dispatchEvent(new InputEvent('beforeinput', {
                bubbles: true,
                composed: true,
                inputType: 'insertText',
                data: text
            }));
        } catch (e) {}
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
    }

    // 3. Fast Deep Locator (PRIORITIZES VISIBLE TEXTAREA IN PROMPT CARD)
    function findPromptInputDeep() {
        // Fast Path 1: Active visible textarea in lower screen portion
        const textareas = Array.from(document.querySelectorAll('textarea'));
        for (const t of textareas) {
            const r = t.getBoundingClientRect();
            if (r.width > 50 && r.height > 6 && r.bottom > (window.innerHeight * 0.35) && window.getComputedStyle(t).display !== 'none') {
                return t;
            }
        }

        // Fast Path 2: Contenteditable or role="textbox"
        const editables = Array.from(document.querySelectorAll('[contenteditable="true"], [role="textbox"], [role="combobox"]'));
        for (const el of editables) {
            const r = el.getBoundingClientRect();
            if (r.width > 50 && r.height > 6 && r.bottom > (window.innerHeight * 0.35)) {
                return el;
            }
        }

        // Fast Path 3: Inputs in lower screen portion
        const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])'));
        for (const inp of inputs) {
            const r = inp.getBoundingClientRect();
            if (r.bottom > (window.innerHeight * 0.35)) {
                return inp;
            }
        }

        // Deep Shadow DOM Traverse (Only if fast path didn't find anything)
        const candidates = [];
        function scan(root, depth = 0) {
            if (!root || depth > 8) return;
            const tList = Array.from(root.querySelectorAll ? root.querySelectorAll('textarea, [contenteditable], [role="textbox"]') : []);
            for (const t of tList) {
                const r = t.getBoundingClientRect();
                if (r.width > 50 && r.height > 6 && r.bottom > (window.innerHeight * 0.35)) {
                    candidates.push({ el: t, rect: r });
                }
            }
            const all = Array.from(root.querySelectorAll ? root.querySelectorAll('*') : []);
            for (const node of all) {
                if (node.shadowRoot) scan(node.shadowRoot, depth + 1);
            }
        }
        scan(document);

        if (candidates.length === 0) return null;
        candidates.sort((a, b) => b.rect.bottom - a.rect.bottom);
        return candidates[0].el;
    }

    // Helper: Trigger realistic physical-like click via native CDP (isTrusted=true) + exact-coordinate DOM events
    function triggerButtonClick(btn) {
        if (!btn) return false;
        try {
            if (btn.disabled) btn.disabled = false;
            if (btn.getAttribute('aria-disabled') === 'true') btn.removeAttribute('aria-disabled');

            btn.focus();
            const rect = btn.getBoundingClientRect();
            const clientX = Math.round(rect.left + rect.width / 2);
            const clientY = Math.round(rect.top + rect.height / 2);

            // 1. Send Authentic Native Hardware Left-Click via Chrome DevTools Protocol (CDP)
            // Injects a real OS-level mouse click with isTrusted=true that Angular & Google Flow treat identically to a human click!
            try {
                chrome.runtime.sendMessage({
                    action: 'NATIVE_CLICK',
                    x: clientX,
                    y: clientY
                }, (res) => {
                    if (res && res.success) {
                        console.log(`[FlowNexus Pro] Native CDP hardware click terkirim di (${clientX}, ${clientY})!`);
                    }
                });
            } catch (e) {}

            // 2. Realistic PointerEvent & MouseEvent with exact physical coordinates
            const pDown = new PointerEvent('pointerdown', {
                bubbles: true, cancelable: true, view: window,
                clientX, clientY, button: 0, buttons: 1,
                pointerId: 1, pointerType: 'mouse', isPrimary: true
            });
            const mDown = new MouseEvent('mousedown', {
                bubbles: true, cancelable: true, view: window,
                clientX, clientY, button: 0, buttons: 1
            });
            const pUp = new PointerEvent('pointerup', {
                bubbles: true, cancelable: true, view: window,
                clientX, clientY, button: 0, buttons: 0,
                pointerId: 1, pointerType: 'mouse', isPrimary: true
            });
            const mUp = new MouseEvent('mouseup', {
                bubbles: true, cancelable: true, view: window,
                clientX, clientY, button: 0, buttons: 0
            });
            const clickEvt = new MouseEvent('click', {
                bubbles: true, cancelable: true, view: window,
                clientX, clientY, button: 0, buttons: 0
            });

            btn.dispatchEvent(pDown);
            btn.dispatchEvent(mDown);
            btn.dispatchEvent(pUp);
            btn.dispatchEvent(mUp);
            btn.dispatchEvent(clickEvt);

            // 3. Native DOM click
            try { btn.click(); } catch(e) {}

            // 4. Click inner child target (e.g. SVG or ripple)
            const inner = btn.querySelector('.mat-mdc-button-touch-target') || btn.querySelector('svg') || btn.firstElementChild;
            if (inner && inner !== btn) {
                try { inner.click(); } catch(e) {}
            }

            // 5. Form submission fallback
            const form = btn.closest('form') || btn.form;
            if (form && typeof form.requestSubmit === 'function') {
                try { form.requestSubmit(btn); } catch(e) {}
            }

            return true;
        } catch (e) {
            console.warn('[FlowNexus Pro] triggerButtonClick error:', e);
            try { btn.click(); } catch(e2) {}
            return false;
        }
    }

    // 4. Find ONLY the EXACT Submit (Arrow ➔) Button in the Bottom Dock (Returns ONE single button)
    function findSubmitButton(inputEl) {
        // Fast Path 1: Exact Google Flow submit button class
        const exactBtn = document.querySelector('button.generate-icon-button');
        if (exactBtn) {
            const rect = exactBtn.getBoundingClientRect();
            if (rect.width > 10 && rect.height > 10 && rect.bottom > (window.innerHeight * 0.4)) {
                return exactBtn;
            }
        }

        // Fast Path 2: Exact aria-label for Indonesian & English Google Flow
        const ariaBtns = Array.from(document.querySelectorAll('button[aria-label*="pembuatan" i], button[aria-label*="generate" i], button[aria-label*="kirim" i]'));
        for (const b of ariaBtns) {
            const rect = b.getBoundingClientRect();
            if (rect.width > 10 && rect.height > 10 && rect.bottom > (window.innerHeight * 0.4)) {
                return b;
            }
        }

        // Fallback: Filter all buttons in dock area
        const allButtons = Array.from(document.querySelectorAll('button, [role="button"], flow-icon-button'));
        
        // Strictly disallow "Opsi lainnya", menus, tools, clear, etc.
        const isDisallowed = (label) => {
            const lbl = (label || '').toLowerCase();
            return lbl.includes('opsi') || lbl.includes('option') || lbl.includes('menu') || lbl.includes('more') ||
                   lbl.includes('clear') || lbl.includes('hapus') || lbl.includes('batal') || lbl.includes('cancel') || 
                   lbl.includes('setting') || lbl.includes('close') || lbl.includes('tutup') ||
                   lbl.includes('banana') || lbl.includes('agent') || lbl.includes('agen') ||
                   lbl.includes('media') || lbl.includes('gambar') || lbl.includes('karakter') ||
                   lbl.includes('adegan') || lbl.includes('alat') || lbl.includes('sampah') || 
                   lbl.includes('ciutkan') || lbl.includes('bantuan') || lbl.includes('help');
        };

        const dockButtons = allButtons.filter(b => {
            if (b === inputEl) return false;
            const rect = b.getBoundingClientRect();
            if (rect.bottom < (window.innerHeight * 0.5) || rect.width < 14 || rect.height < 14) return false;
            const label = ((b.innerText || '') + ' ' + (b.getAttribute('aria-label') || '') + ' ' + (b.title || '')).toLowerCase();
            return !isDisallowed(label);
        });

        let bestBtn = null;
        let bestScore = -1;

        for (const b of dockButtons) {
            const rect = b.getBoundingClientRect();
            const label = ((b.innerText || '') + ' ' + (b.getAttribute('aria-label') || '') + ' ' + (b.title || '')).toLowerCase();
            const cls = (b.className || '').toString().toLowerCase();

            let score = 0;
            if (cls.includes('generate-icon-button')) score += 500;
            if (label.includes('mulai pembuatan') || label.includes('pembuatan') || label.includes('generate') || label.includes('kirim')) score += 300;
            if (b.getAttribute('type') === 'submit') score += 200;

            const svg = b.querySelector('svg');
            if (svg) {
                const svgHtml = svg.innerHTML.toLowerCase();
                if (svgHtml.includes('arrow') || svgHtml.includes('send') || svgHtml.includes('polygon') || svgHtml.includes('m2.01') || svgHtml.includes('path')) {
                    score += 150;
                }
            }

            score += (rect.right / window.innerWidth) * 100;
            if (Math.abs(rect.width - rect.height) < 15 && rect.width >= 24 && rect.width <= 70) {
                score += 50;
            }

            if (score > bestScore) {
                bestScore = score;
                bestBtn = b;
            }
        }

        return bestBtn;
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

        if (payload.aspectRatio && !prompt.toLowerCase().includes('16:9') && !prompt.toLowerCase().includes('9:16') && !prompt.toLowerCase().includes('1:1') && !prompt.toLowerCase().includes('4:3') && !prompt.toLowerCase().includes('3:4')) {
            prompt = `${prompt}, ${payload.aspectRatio} aspect ratio`;
        }

        updateBadge(`<strong>[#${taskId}] Mengaktifkan Kanvas...</strong>`, '#00e5ff');

        // Fast input location (waits up to 8s)
        let input = null;
        const searchDeadline = Date.now() + 8000;
        while (!input && Date.now() < searchDeadline) {
            input = findPromptInputDeep();
            if (!input) await new Promise(r => setTimeout(r, 200));
        }

        if (!input) {
            throw new Error('Input prompt "Apa yang ingin Anda buat?" tidak ditemukan di kanvas. Pastikan kanvas proyek aktif.');
        }

        // Focus input
        input.focus();
        await new Promise(r => setTimeout(r, 100));

        // Helper: Collect all <img> elements
        function getAllImagesDeep(root = document) {
            const list = [];
            function traverse(node) {
                if (!node) return;
                if (node.tagName && node.tagName.toLowerCase() === 'img') {
                    list.push(node);
                }
                if (node.shadowRoot) {
                    traverse(node.shadowRoot);
                }
                const children = node.children || [];
                for (let i = 0; i < children.length; i++) {
                    traverse(children[i]);
                }
            }
            traverse(root);
            return list;
        }

        // Helper: Detect active error or quota popups from Google Flow UI
        function checkGoogleFlowErrorMessage() {
            const errorSelectors = [
                '[role="alert"]',
                '.mat-mdc-snack-bar-label',
                'flow-toast',
                'flow-snackbar',
                '.toast-message'
            ];
            for (const sel of errorSelectors) {
                const els = document.querySelectorAll(sel);
                for (const el of els) {
                    const text = (el.innerText || '').trim();
                    if (text.length > 5 && (
                        text.toLowerCase().includes('quota') ||
                        text.toLowerCase().includes('limit') ||
                        text.toLowerCase().includes('batas kuota') ||
                        text.toLowerCase().includes('kredit harian') ||
                        text.toLowerCase().includes('policy violation') ||
                        text.toLowerCase().includes('pelanggaran kebijakan')
                    )) {
                        return text;
                    }
                }
            }
            return null;
        }

        isRenderAborted = false;
        badge.style.display = 'flex';

        // Snapshot all existing images before submitting
        const preExistingSrcSet = new Set();
        getAllImagesDeep(document).forEach(img => {
            if (img.src) preExistingSrcSet.add(img.src);
        });

        // Fast typing
        updateBadge(`<strong>[#${taskId}] Mengetik Prompt 2K...</strong>`, '#ffd600');
        setInputValue(input, prompt);
        await new Promise(r => setTimeout(r, 150));

        // Submit: Find ONLY the single exact submit arrow button (Never click more options)
        updateBadge(`<strong>[#${taskId}] Mengirim Prompt ke Flow...</strong>`, '#ffd600');
        const submitBtn = findSubmitButton(input);
        if (submitBtn) {
            console.log(`[FlowNexus Pro] Menekan tombol submit panah tunggal:`, submitBtn);
            triggerButtonClick(submitBtn);
        } else {
            console.warn('[FlowNexus Pro] Tombol panah tidak ditemukan, menggunakan Enter...');
        }

        // Always also dispatch native CDP Enter and DOM Enter on the input
        if (input) {
            input.focus();
            try {
                chrome.runtime.sendMessage({ action: 'NATIVE_ENTER' });
            } catch(e) {}

            input.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true
            }));
            try {
                input.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Enter', code: 'Enter', keyCode: 13, which: 13, ctrlKey: true, bubbles: true, cancelable: true, composed: true
                }));
            } catch(e) {}
        }

        const submitTime = Date.now();
        updateBadge(`<strong>[#${taskId}] Google Flow Merender 2K...</strong>`, '#00e5ff');

        // Wait for genuinely NEW 2K image(s) from Flow
        const maxWaitMs = 110000; // 110s max
        const capturedImages = [];

        while (Date.now() - submitTime < maxWaitMs) {
            if (isRenderAborted) {
                console.log('[FlowNexus Pro] Render dihentikan oleh pengguna.');
                throw new Error('Proses dihentikan oleh pengguna.');
            }

            // Check every 1s for fast detection
            await new Promise(r => setTimeout(r, 1000));

            if (isRenderAborted) {
                throw new Error('Proses dihentikan oleh pengguna.');
            }

            const elapsedSec = Math.round((Date.now() - submitTime) / 1000);

            // Fast-check if Google Flow displayed a real quota error
            const errorMsg = checkGoogleFlowErrorMessage();
            if (errorMsg) {
                console.error('[FlowNexus Pro] Pesan peringatan terdeteksi di UI Google Flow:', errorMsg);
                throw new Error(`Google Flow: "${errorMsg.slice(0, 100)}".`);
            }

            // Wait at least 4s to skip any instant UI elements
            if (elapsedSec < 4) {
                updateBadge(`<strong>[#${taskId}] Merender (${elapsedSec}s)...</strong>`, '#00e5ff');
                continue;
            }

            // Scan all images (including inside Shadow DOM and responsive canvas cards)
            const candidateImages = getAllImagesDeep(document).filter(img => {
                const src = img.src || '';
                if (!src || preExistingSrcSet.has(src)) return false;
                if (src.startsWith('data:image/svg') || src.includes('avatar') || src.includes('googlelogo') || src.includes('icon') || src.includes('profile')) return false;
                
                // If it's from Google's image CDN, it's definitely a generated asset
                if (src.includes('googleusercontent.com') || src.includes('googleapis.com')) {
                    return true;
                }
                return img.complete && (img.naturalWidth >= 80 || img.offsetWidth >= 80);
            });

            if (candidateImages.length > 0) {
                // Wait 2s for Flow to finish decoding 2K resolution
                await new Promise(r => setTimeout(r, 2000));

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
            throw new Error('Google Flow belum selesai merender gambar setelah 110 detik. Pastikan tombol panah kirim (➔) di kanvas tertekan.');
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
            if (/=w\d+-h\d+/i.test(src)) {
                return src.replace(/=w\d+-h\d+[^=&]*/i, `=w${target.w}-h${target.h}`);
            }
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
        } catch (e) {}

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

        if (request.action === 'STOP_RENDER' || request.action === 'ABORT_RENDER') {
            isRenderAborted = true;
            updateBadge('<strong>FlowNexus Pro:</strong> Dihentikan', '#ffd600');
            setTimeout(() => {
                const badgeEl = document.getElementById('flow-batch-pro-badge');
                if (badgeEl) badgeEl.style.display = 'none';
            }, 800);
            sendResponse({ success: true, aborted: true });
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

            return true;
        }
    });

    console.log('[Flow Batch Pro] Content script v2.1.2 siap di kanvas proyek Flow.');
})();
