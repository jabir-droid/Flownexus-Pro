/**
 * Flow Batch Pro - Side Panel Controller (v2.0 Standalone Edition)
 * Manages UI interactions, prompt queue, batch execution, settings, and logs.
 */

(function() {
    // --- State Variables ---
    let queue = [];
    let isRunning = false;
    let isPaused = false;
    let stopRequested = false;
    let currentTabId = null;
    let logs = [];

    // --- Default Settings ---
    const defaultSettings = {
        imageModel: 'Imagen 3 (Default Flow)',
        aspectRatio: '16:9',
        maxRetries: 2,
        imageQuality: '2k',
        language: 'id',
        concurrency: 1,
        delayMin: 3,
        delayMax: 10,
        variations: 1,
        subfolder: 'flow-harvest',
        customFilename: '',
        autoName: true,
        openFolderAfterDone: true
    };

    let settings = { ...defaultSettings };

    // --- DOM Elements ---
    const elements = {
        // Badges & Navigation
        connBadge: document.getElementById('flow-connection-badge'),
        connStatusText: document.getElementById('connection-status-text'),
        navTabs: document.querySelectorAll('.nav-tab'),
        tabPanes: document.querySelectorAll('.tab-pane'),

        // Inputs & Subtabs
        subtabBtns: document.querySelectorAll('.subtab-btn'),
        inputViews: document.querySelectorAll('.input-view'),
        batchInput: document.getElementById('batch-prompts-input'),
        promptStats: document.getElementById('prompt-stats-text'),
        btnClearPrompts: document.getElementById('btn-clear-prompts'),
        fileTxtInput: document.getElementById('file-txt-input'),
        fileCsvInput: document.getElementById('file-csv-input'),
        txtDropArea: document.getElementById('txt-drop-area'),
        csvDropArea: document.getElementById('csv-drop-area'),

        // Parameters
        paramConcurrency: document.getElementById('param-concurrency'),
        paramDelayMin: document.getElementById('param-delay-min'),
        paramDelayMax: document.getElementById('param-delay-max'),
        paramVariations: document.getElementById('param-variations'),
        paramSubfolder: document.getElementById('param-subfolder'),
        paramCustomFilename: document.getElementById('param-custom-filename'),
        toggleAutoName: document.getElementById('toggle-autoname'),
        toggleOpenFolder: document.getElementById('toggle-openfolder'),

        // Actions & Queue
        btnStartBatch: document.getElementById('btn-start-batch'),
        btnPauseBatch: document.getElementById('btn-pause-batch'),
        btnStopBatch: document.getElementById('btn-stop-batch'),
        btnClearQueue: document.getElementById('btn-clear-queue'),
        queueList: document.getElementById('queue-list'),
        queueCountBadge: document.getElementById('queue-count-badge'),
        queueEmptyState: document.getElementById('queue-empty-state'),

        // Settings Elements
        settingDefaultMode: document.getElementById('setting-default-mode'),
        settingAgentMode: document.getElementById('setting-agent-mode'),
        settingImageModel: document.getElementById('setting-image-model'),
        settingAspectRatio: document.getElementById('setting-aspect-ratio'),
        settingMaxRetries: document.getElementById('setting-max-retries'),
        btnRetryMinus: document.getElementById('btn-retry-minus'),
        btnRetryPlus: document.getElementById('btn-retry-plus'),
        settingImageQuality: document.getElementById('setting-image-quality'),
        settingLanguage: document.getElementById('setting-language'),
        btnResetSettings: document.getElementById('btn-reset-settings'),
        btnSaveSettings: document.getElementById('btn-save-settings'),

        // Logs Elements
        debugConsole: document.getElementById('debug-log-console'),
        logCountText: document.getElementById('log-count-text'),
        btnCopyLogs: document.getElementById('btn-copy-logs'),
        btnClearLogs: document.getElementById('btn-clear-logs')
    };

    // --- Logging System ---
    function addLog(message, type = 'info') {
        const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
        const entry = { time, message, type };
        logs.push(entry);

        if (elements.debugConsole) {
            const line = document.createElement('div');
            line.className = `log-line ${type}`;
            line.innerHTML = `<span class="log-time">[${time}]</span> ${escapeHtml(message)}`;
            elements.debugConsole.appendChild(line);
            elements.debugConsole.scrollTop = elements.debugConsole.scrollHeight;
        }

        if (elements.logCountText) {
            elements.logCountText.textContent = `${logs.length} baris log`;
        }

        console.log(`[Flow Batch Pro] [${type.toUpperCase()}] ${message}`);
    }

    function escapeHtml(str) {
        return (str || '').replace(/[&<>"']/g, m => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[m]);
    }

    // --- Tab Switching ---
    elements.navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.dataset.tab;
            elements.navTabs.forEach(t => t.classList.remove('active'));
            elements.tabPanes.forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            const targetPane = document.getElementById(targetId);
            if (targetPane) targetPane.classList.add('active');
        });
    });



    // --- Subtab Input View Switching ---
    elements.subtabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.inputMode;
            elements.subtabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            elements.inputViews.forEach(v => {
                v.style.display = 'none';
            });

            const activeView = document.getElementById(`input-view-${mode}`);
            if (activeView) activeView.style.display = 'block';
        });
    });

    // --- Prompt Parsing Logic ---
    function parsePrompts(rawText) {
        if (!rawText || !rawText.trim()) return [];

        let text = rawText.trim();
        let items = [];

        // Check if double newlines exist
        if (text.includes('\n\n')) {
            items = text.split(/\n\s*\n+/);
        } else {
            items = text.split(/\r?\n+/);
        }

        return items
            .map(p => {
                // Strip leading numbering e.g. "1. ", "01) ", "- "
                return p.replace(/^[\d]+[\.\)\-\:\s]+/g, '').trim();
            })
            .filter(p => p.length > 5);
    }

    function updatePromptStats() {
        const text = elements.batchInput.value;
        const parsed = parsePrompts(text);
        if (parsed.length === 0) {
            elements.promptStats.textContent = '0 prompt terdeteksi (Siap)';
        } else {
            elements.promptStats.textContent = `${parsed.length} prompt terdeteksi (Siap diproses)`;
        }
    }

    if (elements.batchInput) {
        elements.batchInput.addEventListener('input', updatePromptStats);
    }

    if (elements.btnClearPrompts) {
        elements.btnClearPrompts.addEventListener('click', () => {
            elements.batchInput.value = '';
            updatePromptStats();
            addLog('Input prompt dikosongkan.', 'info');
        });
    }

    // --- File Uploaders (TXT & CSV) ---
    function handleTxtFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            elements.batchInput.value = content;
            // Switch back to text view
            document.querySelector('.subtab-btn[data-input-mode="text"]').click();
            updatePromptStats();
            const count = parsePrompts(content).length;
            addLog(`File .txt berhasil dimuat (${file.name}): ${count} prompt ditemukan.`, 'success');
        };
        reader.readAsText(file, 'UTF-8');
    }

    function handleCsvFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            if (lines.length === 0) return;

            let promptColIdx = 0;
            const headers = lines[0].toLowerCase().split(/[;,|\t]/).map(h => h.replace(/^["']|["']$/g, '').trim());
            const foundIdx = headers.findIndex(h => h.includes('prompt') || h.includes('description') || h.includes('teks'));
            if (foundIdx !== -1) {
                promptColIdx = foundIdx;
            }

            const extracted = [];
            const startIndex = foundIdx !== -1 ? 1 : 0; // Skip header if detected

            for (let i = startIndex; i < lines.length; i++) {
                const row = lines[i];
                // Simple CSV split
                const cols = row.split(/[;,|\t]/).map(c => c.replace(/^["']|["']$/g, '').trim());
                if (cols[promptColIdx] && cols[promptColIdx].length > 4) {
                    extracted.push(cols[promptColIdx]);
                }
            }

            elements.batchInput.value = extracted.join('\n\n');
            document.querySelector('.subtab-btn[data-input-mode="text"]').click();
            updatePromptStats();
            addLog(`File CSV berhasil dimuat (${file.name}): ${extracted.length} prompt ditemukan.`, 'success');
        };
        reader.readAsText(file, 'UTF-8');
    }

    if (elements.fileTxtInput) {
        elements.fileTxtInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) handleTxtFile(e.target.files[0]);
        });
    }

    if (elements.fileCsvInput) {
        elements.fileCsvInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) handleCsvFile(e.target.files[0]);
        });
    }

    // Drag & Drop
    [elements.txtDropArea, elements.csvDropArea].forEach(area => {
        if (!area) return;
        ['dragenter', 'dragover'].forEach(eventName => {
            area.addEventListener(eventName, (e) => {
                e.preventDefault();
                area.classList.add('dragover');
            });
        });
        ['dragleave', 'drop'].forEach(eventName => {
            area.addEventListener(eventName, (e) => {
                e.preventDefault();
                area.classList.remove('dragover');
            });
        });
    });

    if (elements.txtDropArea) {
        elements.txtDropArea.addEventListener('drop', (e) => {
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleTxtFile(e.dataTransfer.files[0]);
            }
        });
    }

    if (elements.csvDropArea) {
        elements.csvDropArea.addEventListener('drop', (e) => {
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleCsvFile(e.dataTransfer.files[0]);
            }
        });
    }

    // --- Stepper Controls ---
    if (elements.btnRetryMinus && elements.settingMaxRetries) {
        elements.btnRetryMinus.addEventListener('click', () => {
            let val = parseInt(elements.settingMaxRetries.value, 10) || 0;
            if (val > 0) elements.settingMaxRetries.value = val - 1;
        });
    }

    if (elements.btnRetryPlus && elements.settingMaxRetries) {
        elements.btnRetryPlus.addEventListener('click', () => {
            let val = parseInt(elements.settingMaxRetries.value, 10) || 0;
            if (val < 10) elements.settingMaxRetries.value = val + 1;
        });
    }

    // --- Google Flow Connection Watcher & Script Injector ---
    async function ensureContentScriptInjected(tabId) {
        if (!tabId) return false;
        try {
            const isAlive = await new Promise((resolve) => {
                chrome.tabs.sendMessage(tabId, { action: 'PING' }, (resp) => {
                    if (chrome.runtime.lastError || !resp) {
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                });
            });

            if (isAlive) return true;

            // Auto-inject content script into the tab
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            });
            await sleep(600);
            return true;
        } catch (err) {
            console.warn('[Flow Batch Pro] Auto-inject note:', err);
            return false;
        }
    }

    async function checkFlowConnection() {
        try {
            const tabs = await chrome.tabs.query({ url: "*://flow.google.com/*" });
            if (!tabs || tabs.length === 0) {
                setConnectionStatus(false, 'Buka Google Flow');
                currentTabId = null;
                return;
            }

            // Prioritize tab that has /project/ or is active
            let targetTab = tabs.find(t => t.url && t.url.includes('/project/')) || tabs.find(t => t.active) || tabs[0];
            currentTabId = targetTab.id;

            // Ping content script
            chrome.tabs.sendMessage(currentTabId, { action: 'PING' }, async (response) => {
                if (chrome.runtime.lastError || !response) {
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: currentTabId },
                            files: ['content.js']
                        });
                        setConnectionStatus(true, 'Flow Terhubung (Siap)');
                    } catch (e) {
                        setConnectionStatus(false, 'Muat ulang F5 di Flow');
                    }
                } else {
                    setConnectionStatus(true, response.hasInput ? 'Flow Terhubung (Siap)' : 'Flow Siap (Kanvas Aktif)');
                }
            });
        } catch (e) {
            setConnectionStatus(false, 'Memeriksa Flow...');
        }
    }

    function setConnectionStatus(connected, text) {
        if (!elements.connBadge) return;
        elements.connBadge.className = `connection-badge ${connected ? 'connected' : 'checking'}`;
        elements.connStatusText.textContent = text;
    }

    // Poll Flow tab status every 3s
    setInterval(checkFlowConnection, 3000);
    checkFlowConnection();

    // Clicking badge opens or focuses Flow tab
    if (elements.connBadge) {
        elements.connBadge.style.cursor = 'pointer';
        elements.connBadge.addEventListener('click', async () => {
            const tabs = await chrome.tabs.query({ url: "*://flow.google.com/*" });
            if (tabs && tabs.length > 0) {
                chrome.tabs.update(tabs[0].id, { active: true });
                if (tabs[0].windowId) chrome.windows.update(tabs[0].windowId, { focused: true });
            } else {
                chrome.tabs.create({ url: 'https://flow.google.com/' });
            }
        });
    }

    // --- Queue Management ---
    function populateQueueFromInput() {
        const raw = elements.batchInput.value;
        const promptList = parsePrompts(raw);

        if (promptList.length === 0) {
            alert('Silakan masukkan minimal 1 prompt atau unggah file terlebih dahulu!');
            return false;
        }

        const variations = parseInt(elements.paramVariations.value, 10) || 1;
        const customPrefix = elements.paramCustomFilename ? elements.paramCustomFilename.value.trim() : '';

        queue = promptList.map((prompt, index) => {
            const slug = generateThematicFilename(prompt, index + 1, customPrefix, 0, variations);
            return {
                id: index + 1,
                prompt: prompt,
                slug: slug,
                status: 'waiting', // waiting, rendering, downloading, completed, failed
                retries: 0,
                variations: variations,
                error: null,
                downloadedFiles: []
            };
        });

        renderQueue();
        addLog(`Antrean berhasil dibuat: ${queue.length} prompt siap dijalankan.`, 'success');
        return true;
    }

    // Smart Thematic Filename Generator
    function generateThematicFilename(prompt, index, customPrefix, variationIdx = 0, totalVariations = 1) {
        let base = '';
        if (customPrefix && customPrefix.trim()) {
            base = customPrefix
                .trim()
                .replace(/[^\w\s-]/gi, '')
                .replace(/\s+/g, '_')
                .toLowerCase();
        } else {
            // Words to exclude so we isolate the core theme of the prompt
            const stopWords = new Set([
                'a', 'an', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
                'from', 'as', 'is', 'are', 'was', 'were', 'it', 'its', 'this', 'that', 'subtle',
                'featuring', 'row', 'along', 'bottom', 'top', 'edge', 'background', 'backdrop',
                'quality', 'commercial', 'photorealistic', 'photography', 'photo', 'studio',
                'ultra', 'high', 'resolution', '4k', '2k', '8k', 'uhd', 'hd', 'hyperrealistic',
                'master', 'clean', 'textured', 'lighting', 'lights', 'glow', 'soft', 'deep',
                'warm', 'aesthetic', 'mood', 'elements', 'no', 'without', 'zero', 'negative',
                'space', 'copy', 'composition', 'arrangement', 'still', 'life', 'optics',
                'crystal', 'clear', 'realistic', 'shadows', 'textures', 'details', 'detail',
                'adobe', 'stock', 'view', 'shot', 'image', 'picture', 'render', 'style',
                'landscape', 'portrait', 'aspect', 'ratio', 'featuring'
            ]);

            const words = prompt
                .toLowerCase()
                .replace(/[^\w\s]/g, ' ')
                .split(/\s+/)
                .filter(w => w.length > 2 && !stopWords.has(w));

            if (words.length > 0) {
                // Extract 3-4 salient theme words (e.g. halloween_pumpkins_gourds)
                base = words.slice(0, 4).join('_');
            } else {
                base = 'flow_image';
            }
        }

        // Sequential number at the end: _1, _2, _3...
        const varSuffix = totalVariations > 1 ? `_${variationIdx + 1}` : '';
        return `${base}_${index}${varSuffix}`;
    }

    function renderQueue() {
        if (!elements.queueList) return;

        if (queue.length === 0) {
            elements.queueEmptyState.style.display = 'block';
            elements.queueCountBadge.textContent = '0 aktif';
            return;
        }

        elements.queueEmptyState.style.display = 'none';
        const completedCount = queue.filter(q => q.status === 'completed').length;
        elements.queueCountBadge.textContent = `${completedCount}/${queue.length} selesai`;

        // Render cards
        elements.queueList.querySelectorAll('.queue-item').forEach(el => el.remove());

        queue.forEach(item => {
            const card = document.createElement('div');
            card.className = `queue-item ${item.status === 'rendering' ? 'active' : ''} ${item.status}`;
            card.id = `queue-item-${item.id}`;

            let statusLabel = 'Menunggu';
            if (item.status === 'rendering') statusLabel = '⚡ Merender...';
            if (item.status === 'downloading') statusLabel = '📥 Mengunduh...';
            if (item.status === 'completed') statusLabel = '✅ Selesai';
            if (item.status === 'failed') statusLabel = `❌ Gagal (${item.error || 'Error'})`;

            card.innerHTML = `
                <div class="queue-item-header">
                    <span class="queue-item-id">#${item.id}</span>
                    <span class="queue-item-status ${item.status}">${statusLabel}</span>
                </div>
                <div class="queue-item-prompt">${escapeHtml(item.prompt)}</div>
                <div class="queue-item-footer">
                    <span>${item.variations}x gambar | ${item.slug}</span>
                    <div class="queue-item-actions">
                        ${item.status === 'failed' ? `<button class="queue-action-btn btn-retry-item" data-id="${item.id}" title="Coba lagi">🔄 Coba</button>` : ''}
                        ${item.status === 'waiting' ? `<button class="queue-action-btn btn-remove-item" data-id="${item.id}" title="Hapus">✕</button>` : ''}
                    </div>
                </div>
            `;

            elements.queueList.appendChild(card);
        });

        // Bind item actions
        elements.queueList.querySelectorAll('.btn-remove-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(btn.dataset.id, 10);
                queue = queue.filter(q => q.id !== id);
                renderQueue();
            });
        });

        elements.queueList.querySelectorAll('.btn-retry-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(btn.dataset.id, 10);
                const item = queue.find(q => q.id === id);
                if (item) {
                    item.status = 'waiting';
                    item.error = null;
                    renderQueue();
                    if (!isRunning) startBatchExecution();
                }
            });
        });
    }

    function updateQueueItemUI(item) {
        const card = document.getElementById(`queue-item-${item.id}`);
        if (!card) {
            renderQueue();
            return;
        }

        card.className = `queue-item ${item.status === 'rendering' ? 'active' : ''} ${item.status}`;
        const statusSpan = card.querySelector('.queue-item-status');
        if (statusSpan) {
            statusSpan.className = `queue-item-status ${item.status}`;
            if (item.status === 'waiting') statusSpan.textContent = 'Menunggu';
            if (item.status === 'rendering') statusSpan.textContent = '⚡ Merender...';
            if (item.status === 'downloading') statusSpan.textContent = '📥 Mengunduh...';
            if (item.status === 'completed') statusSpan.textContent = '✅ Selesai';
            if (item.status === 'failed') statusSpan.textContent = `❌ Gagal (${item.error || 'Error'})`;
        }

        const completedCount = queue.filter(q => q.status === 'completed').length;
        elements.queueCountBadge.textContent = `${completedCount}/${queue.length} selesai`;
    }

    // --- Batch Execution Engine ---
    async function startBatchExecution() {
        if (queue.length === 0) {
            const ok = populateQueueFromInput();
            if (!ok) return;
        }

        if (isRunning && !isPaused) return;

        if (isPaused) {
            isPaused = false;
            isRunning = true;
            addLog('Melanjutkan antrean batch...', 'info');
            updateControlButtonsState();
            executeBatchLoop();
            return;
        }

        // Validate Google Flow Tab
        const tabs = await chrome.tabs.query({ url: "*://flow.google.com/*" });
        if (!tabs || tabs.length === 0) {
            alert('Tab Google Flow tidak ditemukan!\nSilakan buka https://flow.google.com/ terlebih dahulu dan buka salah satu project.');
            addLog('Gagal memulai: Tab Google Flow tidak terbuka.', 'error');
            return;
        }

        // Prioritize tab that has /project/ in URL or is active
        let targetTab = tabs.find(t => t.url && t.url.includes('/project/')) || tabs.find(t => t.active) || tabs[0];
        currentTabId = targetTab.id;

        // Ensure user is inside an active project canvas (/project/...)
        if (!targetTab.url || !targetTab.url.includes('/project/')) {
            const projectTab = tabs.find(t => t.url && t.url.includes('/project/'));
            if (projectTab) {
                targetTab = projectTab;
                currentTabId = targetTab.id;
                await chrome.tabs.update(currentTabId, { active: true });
                if (targetTab.windowId) {
                    await chrome.windows.update(targetTab.windowId, { focused: true });
                }
            } else {
                alert('Silakan buka salah satu Project Anda di Google Flow terlebih dahulu (atau klik "+ Project baru").\n\nKotak input prompt hanya tersedia di dalam kanvas proyek.');
                addLog('Silakan klik salah satu kartu proyek Anda di Google Flow (atau "+ Project baru") agar kanvas aktif.', 'warn');
                return;
            }
        }

        // Auto-inject content script if not already loaded in the tab
        addLog('Memeriksa koneksi tab Google Flow...', 'info');
        await ensureContentScriptInjected(currentTabId);

        isRunning = true;
        isPaused = false;
        stopRequested = false;

        addLog(`Memulai Batch Otomatis: ${queue.length} prompt dalam antrean.`, 'cyan');
        updateControlButtonsState();
        executeBatchLoop();
    }

    function updateControlButtonsState() {
        if (isRunning) {
            elements.btnStartBatch.disabled = true;
            elements.btnStartBatch.innerHTML = '<span>⚡</span> Sedang Berjalan...';
            elements.btnPauseBatch.disabled = false;
            elements.btnPauseBatch.innerHTML = isPaused ? '<span>▶️</span> Lanjutkan' : '<span>⏸️</span> Jeda';
            elements.btnStopBatch.disabled = false;
            elements.btnClearQueue.disabled = true;
        } else {
            elements.btnStartBatch.disabled = false;
            elements.btnStartBatch.innerHTML = '<span class="btn-icon">🚀</span> Mulai Batch Otomatis';
            elements.btnPauseBatch.disabled = true;
            elements.btnPauseBatch.innerHTML = '<span>⏸️</span> Jeda';
            elements.btnStopBatch.disabled = true;
            elements.btnClearQueue.disabled = false;
        }
    }

    async function executeBatchLoop() {
        const maxRetries = parseInt(elements.settingMaxRetries.value, 10) || 2;
        const subfolder = (elements.paramSubfolder.value || 'flow-harvest').trim();
        const delayMin = Math.max(0, parseInt(elements.paramDelayMin.value, 10) || 3);
        const delayMax = Math.max(delayMin, parseInt(elements.paramDelayMax.value, 10) || 10);
        const aspectRatio = elements.settingAspectRatio.value || '16:9';

        for (let i = 0; i < queue.length; i++) {
            if (stopRequested) {
                addLog('Proses batch dihentikan oleh pengguna.', 'warn');
                break;
            }

            while (isPaused) {
                await sleep(1000);
                if (stopRequested) break;
            }
            if (stopRequested) break;

            const item = queue[i];
            if (item.status === 'completed') continue;

            // Execute item
            let success = false;
            while (item.retries <= maxRetries && !success && !stopRequested) {
                item.status = 'rendering';
                updateQueueItemUI(item);
                addLog(`[#${item.id}] Mengirim prompt ke Flow: "${item.prompt.slice(0, 50)}..." (Percobaan ${item.retries + 1})`, 'info');

                try {
                    const result = await sendPromptToFlowTab(currentTabId, {
                        prompt: item.prompt,
                        taskId: item.id,
                        aspectRatio: aspectRatio,
                        quality: elements.settingImageQuality.value || '2k',
                        variations: item.variations
                    });

                    if (result && result.success && result.images && result.images.length > 0) {
                        item.status = 'downloading';
                        updateQueueItemUI(item);
                        addLog(`[#${item.id}] Render selesai! Mengunduh ${result.images.length} gambar 2K asli...`, 'success');

                        // Trigger Chrome Downloads for each variation with thematic naming
                        const customPrefix = elements.paramCustomFilename ? elements.paramCustomFilename.value.trim() : '';
                        for (let v = 0; v < result.images.length; v++) {
                            const rawImg = result.images[v];
                            const fileName = generateThematicFilename(item.prompt, item.id, customPrefix, v, result.images.length);

                            addLog(`[#${item.id}] Memvalidasi resolusi 2K asli (${aspectRatio})...`, 'info');
                            const final2KImg = await prepare2KImageForDownload(rawImg, aspectRatio);

                            await downloadImage(final2KImg, fileName, subfolder);
                            item.downloadedFiles.push(fileName);
                        }

                        item.status = 'completed';
                        item.error = null;
                        success = true;
                        updateQueueItemUI(item);
                        addLog(`[#${item.id}] Sukses disimpan ke folder Downloads/${subfolder}/ (2K HD)!`, 'success');
                    } else {
                        throw new Error((result && result.error) || 'Tidak ada gambar yang berhasil diambil.');
                    }
                } catch (err) {
                    item.retries++;
                    item.error = err.message;
                    addLog(`[#${item.id}] Kesalahan: ${err.message}`, 'error');

                    if (item.retries <= maxRetries && !stopRequested) {
                        addLog(`[#${item.id}] Menunggu 5 detik sebelum mencoba lagi...`, 'warn');
                        await sleep(5000);
                    } else {
                        item.status = 'failed';
                        updateQueueItemUI(item);
                    }
                }
            }

            // Humanized delay between prompts
            if (i < queue.length - 1 && !stopRequested && success) {
                const randomDelaySec = Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
                addLog(`Menunggu penundaan acak ${randomDelaySec} detik sebelum prompt berikutnya...`, 'info');
                await sleep(randomDelaySec * 1000);
            }
        }

        isRunning = false;
        isPaused = false;
        stopRequested = false;
        updateControlButtonsState();

        const totalCompleted = queue.filter(q => q.status === 'completed').length;
        addLog(`=== BATCH SELESAI: ${totalCompleted}/${queue.length} prompt berhasil diproses! ===`, 'cyan');

        // Open folder if configured
        if (elements.toggleOpenFolder && elements.toggleOpenFolder.checked && totalCompleted > 0) {
            chrome.runtime.sendMessage({ action: 'OPEN_DOWNLOADS_FOLDER' });
            addLog('Membuka folder Downloads Chrome...', 'info');
        }
    }

    // Helper: Send prompt to Google Flow tab content script with auto-injection retry
    async function sendPromptToFlowTab(tabId, payload) {
        if (!tabId) {
            throw new Error('Tab ID Google Flow tidak valid. Pastikan tab Flow aktif.');
        }

        // Ensure content script is present
        await ensureContentScriptInjected(tabId);

        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, {
                action: 'RENDER_PROMPT',
                ...payload
            }, async (response) => {
                const err = chrome.runtime.lastError;
                if (err) {
                    const msg = err.message || '';
                    if (msg.includes('Receiving end does not exist') || msg.includes('Could not establish connection')) {
                        addLog('Menyambungkan ulang content script ke Flow...', 'warn');
                        try {
                            await chrome.scripting.executeScript({
                                target: { tabId: tabId },
                                files: ['content.js']
                            });
                            await sleep(1000);
                            chrome.tabs.sendMessage(tabId, {
                                action: 'RENDER_PROMPT',
                                ...payload
                            }, (retryResp) => {
                                if (chrome.runtime.lastError) {
                                    reject(new Error('Tab Flow belum merespon. Silakan muat ulang (F5) tab Flow Anda sekali.'));
                                } else {
                                    resolve(retryResp);
                                }
                            });
                            return;
                        } catch (e2) {
                            reject(new Error('Silakan muat ulang tab Google Flow Anda (F5): ' + msg));
                            return;
                        }
                    }
                    reject(new Error(msg));
                } else {
                    resolve(response);
                }
            });
        });
    }

    // High-Resolution 2K Pipeline: Strictly enforces 2752x1536 for 16:9
    async function prepare2KImageForDownload(rawImgSource, aspectRatio = '16:9') {
        const dimMap = {
            '16:9': { width: 2752, height: 1536 },
            '9:16': { width: 1536, height: 2752 },
            '1:1':  { width: 2048, height: 2048 },
            '4:3':  { width: 2304, height: 1728 },
            '3:4':  { width: 1728, height: 2304 }
        };
        const targetDim = dimMap[aspectRatio] || { width: 2752, height: 1536 };

        try {
            let blob = null;
            let sourceUrl = rawImgSource;

            // If it's an HTTP URL (from Google CDN)
            if (typeof rawImgSource === 'string' && (rawImgSource.startsWith('http://') || rawImgSource.startsWith('https://'))) {
                // Construct transformed 2K URL
                let url2K = rawImgSource;
                if (rawImgSource.includes('googleusercontent.com') || rawImgSource.includes('google.com') || rawImgSource.includes('googleapis.com')) {
                    if (/=w\d+-h\d+/i.test(rawImgSource)) {
                        url2K = rawImgSource.replace(/=w\d+-h\d+[^=&]*/i, `=w${targetDim.width}-h${targetDim.height}`);
                    } else if (/=[sw]\d+/i.test(rawImgSource)) {
                        url2K = rawImgSource.replace(/=[sw]\d+[^=&]*/i, `=w${targetDim.width}-h${targetDim.height}`);
                    } else if (rawImgSource.includes('=')) {
                        url2K = rawImgSource.replace(/=[^=&]+$/, `=w${targetDim.width}-h${targetDim.height}`);
                    } else {
                        url2K = `${rawImgSource}=w${targetDim.width}-h${targetDim.height}`;
                    }
                }

                try {
                    const resp = await fetch(url2K);
                    if (resp.ok) {
                        const testBlob = await resp.blob();
                        if (testBlob && testBlob.size > 20000) {
                            blob = testBlob;
                            sourceUrl = url2K;
                        }
                    }
                } catch (e) {
                    console.warn('[FlowNexus Pro] Fetch 2K CDN URL error:', e);
                }

                // If 2K fetch failed, try fetching original URL
                if (!blob) {
                    try {
                        const respRaw = await fetch(rawImgSource);
                        if (respRaw.ok) {
                            blob = await respRaw.blob();
                        }
                    } catch (e2) {}
                }
            } else if (typeof rawImgSource === 'string' && rawImgSource.startsWith('data:')) {
                // Base64 Data URL: convert to blob
                try {
                    const res = await fetch(rawImgSource);
                    blob = await res.blob();
                } catch (e) {}
            }

            // Load into Image to inspect dimensions
            const img = new Image();
            img.crossOrigin = "anonymous";
            const loadSrc = blob ? URL.createObjectURL(blob) : sourceUrl;

            await new Promise((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = (e) => reject(new Error('Gagal mendekode gambar untuk rendering 2K'));
                img.src = loadSrc;
            });

            const naturalW = img.naturalWidth || img.width;
            const naturalH = img.naturalHeight || img.height;

            console.log(`[FlowNexus Pro] Sumber gambar: ${naturalW}x${naturalH}px, Target 2K: ${targetDim.width}x${targetDim.height}px`);

            // If already exact or larger than target 2K, and we have a blob, return it directly
            if (naturalW >= targetDim.width && naturalH >= targetDim.height && blob) {
                return loadSrc;
            }

            // High-Precision 2K Canvas Upscaler & Renderer
            const canvas = document.createElement('canvas');
            canvas.width = targetDim.width;
            canvas.height = targetDim.height;
            const ctx = canvas.getContext('2d');

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, targetDim.width, targetDim.height);

            const finalDataUrl = canvas.toDataURL('image/jpeg', 0.98);
            if (blob && loadSrc.startsWith('blob:')) {
                URL.revokeObjectURL(loadSrc);
            }
            return finalDataUrl;
        } catch (err) {
            console.error('[FlowNexus Pro] Error saat memproses 2K:', err);
            return rawImgSource;
        }
    }

    // Helper: Download image via background service worker
    function downloadImage(dataUrl, filename, subfolder) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'DOWNLOAD_IMAGE',
                url: dataUrl,
                filename: filename,
                subfolder: subfolder,
                ext: 'jpg'
            }, (resp) => {
                if (chrome.runtime.lastError || (resp && !resp.success)) {
                    const err = (resp && resp.error) || (chrome.runtime.lastError && chrome.runtime.lastError.message);
                    addLog(`Gagal mengunduh ${filename}: ${err}`, 'warn');
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

    function sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    // --- Action Button Handlers ---
    if (elements.btnStartBatch) {
        elements.btnStartBatch.addEventListener('click', () => {
            startBatchExecution();
        });
    }

    if (elements.btnPauseBatch) {
        elements.btnPauseBatch.addEventListener('click', () => {
            if (isRunning) {
                isPaused = !isPaused;
                elements.btnPauseBatch.innerHTML = isPaused ? '<span>▶️</span> Lanjutkan' : '<span>⏸️</span> Jeda';
                addLog(isPaused ? 'Batch dijeda oleh pengguna.' : 'Batch dilanjutkan.', 'warn');
            }
        });
    }

    if (elements.btnStopBatch) {
        elements.btnStopBatch.addEventListener('click', () => {
            if (confirm('Apakah Anda yakin ingin menghentikan seluruh antrean batch?')) {
                stopRequested = true;
                isRunning = false;
                isPaused = false;
                updateControlButtonsState();
                addLog('Penghentian batch diminta...', 'error');

                // Instantly notify content script in Google Flow tab to abort waiting and hide HUD badge
                if (currentTabId) {
                    chrome.tabs.sendMessage(currentTabId, { action: 'STOP_RENDER' }).catch(() => {});
                }
            }
        });
    }

    if (elements.btnClearQueue) {
        elements.btnClearQueue.addEventListener('click', () => {
            if (isRunning) return;
            queue = [];
            renderQueue();
            addLog('Antrean berhasil dikosongkan.', 'info');
        });
    }

    // --- Settings Persistence ---
    async function loadSettings() {
        try {
            const data = await chrome.storage.local.get('flowBatchSettings');
            if (data && data.flowBatchSettings) {
                settings = { ...defaultSettings, ...data.flowBatchSettings };
            }
        } catch (e) {}

        // Apply to UI
        if (elements.settingImageModel) elements.settingImageModel.value = settings.imageModel;
        if (elements.settingAspectRatio) elements.settingAspectRatio.value = settings.aspectRatio;
        if (elements.settingMaxRetries) elements.settingMaxRetries.value = settings.maxRetries;
        if (elements.settingImageQuality) elements.settingImageQuality.value = settings.imageQuality;
        if (elements.settingLanguage) elements.settingLanguage.value = settings.language;
        if (elements.paramConcurrency) elements.paramConcurrency.value = settings.concurrency;
        if (elements.paramDelayMin) elements.paramDelayMin.value = settings.delayMin;
        if (elements.paramDelayMax) elements.paramDelayMax.value = settings.delayMax;
        if (elements.paramVariations) elements.paramVariations.value = settings.variations;
        if (elements.paramSubfolder) elements.paramSubfolder.value = settings.subfolder;
        if (elements.paramCustomFilename) elements.paramCustomFilename.value = settings.customFilename || '';
        if (elements.toggleAutoName) elements.toggleAutoName.checked = settings.autoName;
        if (elements.toggleOpenFolder) elements.toggleOpenFolder.checked = settings.openFolderAfterDone;
    }

    async function saveSettings() {
        settings = {
            imageModel: elements.settingImageModel ? elements.settingImageModel.value : defaultSettings.imageModel,
            aspectRatio: elements.settingAspectRatio ? elements.settingAspectRatio.value : defaultSettings.aspectRatio,
            maxRetries: elements.settingMaxRetries ? parseInt(elements.settingMaxRetries.value, 10) : defaultSettings.maxRetries,
            imageQuality: elements.settingImageQuality ? elements.settingImageQuality.value : defaultSettings.imageQuality,
            language: elements.settingLanguage ? elements.settingLanguage.value : defaultSettings.language,
            concurrency: elements.paramConcurrency ? parseInt(elements.paramConcurrency.value, 10) : defaultSettings.concurrency,
            delayMin: elements.paramDelayMin ? parseInt(elements.paramDelayMin.value, 10) : defaultSettings.delayMin,
            delayMax: elements.paramDelayMax ? parseInt(elements.paramDelayMax.value, 10) : defaultSettings.delayMax,
            variations: elements.paramVariations ? parseInt(elements.paramVariations.value, 10) : defaultSettings.variations,
            subfolder: elements.paramSubfolder ? elements.paramSubfolder.value.trim() : defaultSettings.subfolder,
            customFilename: elements.paramCustomFilename ? elements.paramCustomFilename.value.trim() : defaultSettings.customFilename,
            autoName: elements.toggleAutoName ? elements.toggleAutoName.checked : defaultSettings.autoName,
            openFolderAfterDone: elements.toggleOpenFolder ? elements.toggleOpenFolder.checked : defaultSettings.openFolderAfterDone
        };

        try {
            await chrome.storage.local.set({ flowBatchSettings: settings });
            addLog('Pengaturan berhasil disimpan!', 'success');
            alert('Pengaturan berhasil disimpan!');
        } catch (e) {
            addLog('Gagal menyimpan pengaturan: ' + e.message, 'error');
        }
    }

    if (elements.btnSaveSettings) {
        elements.btnSaveSettings.addEventListener('click', saveSettings);
    }

    if (elements.btnResetSettings) {
        elements.btnResetSettings.addEventListener('click', () => {
            if (confirm('Atur ulang seluruh pengaturan ke nilai default?')) {
                settings = { ...defaultSettings };
                chrome.storage.local.remove('flowBatchSettings');
                loadSettings();
                addLog('Pengaturan telah diatur ulang ke default.', 'warn');
            }
        });
    }

    // --- Log Actions ---
    if (elements.btnCopyLogs) {
        elements.btnCopyLogs.addEventListener('click', () => {
            const raw = logs.map(l => `[${l.time}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
            navigator.clipboard.writeText(raw).then(() => {
                alert('Log berhasil disalin ke clipboard!');
            }).catch(() => {
                alert('Gagal menyalin log.');
            });
        });
    }

    if (elements.btnClearLogs) {
        elements.btnClearLogs.addEventListener('click', () => {
            logs = [];
            if (elements.debugConsole) elements.debugConsole.innerHTML = '';
            if (elements.logCountText) elements.logCountText.textContent = '0 baris log';
            addLog('Log debug dibersihkan.', 'info');
        });
    }

    // --- Flow Tab Activity Watcher & Auto-Blur Overlay ---
    const inactiveOverlay = document.getElementById('flow-inactive-overlay');
    const btnFocusFlow = document.getElementById('btn-focus-flow-tab');

    async function checkCurrentTabActivity() {
        try {
            // Check active tab in the currently focused window
            const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            let activeTab = (tabs && tabs.length > 0) ? tabs[0] : null;

            if (!activeTab || !activeTab.url) {
                const curTabs = await chrome.tabs.query({ active: true, currentWindow: true });
                activeTab = (curTabs && curTabs.length > 0) ? curTabs[0] : null;
            }

            updateTabBlurState(activeTab);
        } catch (err) {
            console.warn('[FlowNexus Pro] Activity check error:', err);
        }
    }

    function updateTabBlurState(tab) {
        if (!inactiveOverlay) return;

        const isFlowTab = Boolean(tab && tab.url && tab.url.includes('flow.google.com'));

        if (isFlowTab) {
            if (inactiveOverlay.classList.contains('active')) {
                inactiveOverlay.classList.remove('active');
                if (isRunning && isPaused && !stopRequested) {
                    isPaused = false;
                    addLog('Kembali ke tab Google Flow: Melanjutkan antrean batch.', 'info');
                    updateControlButtonsState();
                }
            }
        } else {
            if (!inactiveOverlay.classList.contains('active')) {
                inactiveOverlay.classList.add('active');
                if (isRunning && !isPaused && !stopRequested) {
                    isPaused = true;
                    addLog('Tab Google Flow tidak aktif: Batch dijeda sementara untuk stabilitas.', 'warn');
                    updateControlButtonsState();
                }
            }
        }
    }

    // Listen to tab switching
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
        try {
            const tab = await chrome.tabs.get(activeInfo.tabId);
            updateTabBlurState(tab);
        } catch (e) {
            checkCurrentTabActivity();
        }
    });

    // Listen to tab URL updates (e.g. user navigates)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (tab && tab.active) {
            updateTabBlurState(tab);
        }
    });

    // Listen to window focus changes (switching windows)
    chrome.windows.onFocusChanged.addListener((windowId) => {
        if (windowId !== chrome.windows.WINDOW_ID_NONE) {
            checkCurrentTabActivity();
        }
    });

    // Periodic check every 1.5 seconds to guarantee synchronization
    setInterval(checkCurrentTabActivity, 1500);
    setTimeout(checkCurrentTabActivity, 500);

    // Button in blur overlay: Focus / Open Google Flow
    if (btnFocusFlow) {
        btnFocusFlow.addEventListener('click', async () => {
            try {
                const flowTabs = await chrome.tabs.query({ url: "*://flow.google.com/*" });
                if (flowTabs && flowTabs.length > 0) {
                    const target = flowTabs.find(t => t.url && t.url.includes('/project/')) || flowTabs[0];
                    await chrome.tabs.update(target.id, { active: true });
                    if (target.windowId) {
                        await chrome.windows.update(target.windowId, { focused: true });
                    }
                    updateTabBlurState(target);
                } else {
                    chrome.tabs.create({ url: 'https://flow.google.com/' });
                }
            } catch (e) {
                console.error('[FlowNexus Pro] Focus tab error:', e);
            }
        });
    }

    // --- Initialization ---
    loadSettings();
    updatePromptStats();
    addLog('FlowNexus Pro v2.1 (2K HD) siap digunakan.', 'success');
})();
