document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const BACKEND_URL = 'http://127.0.0.1:8000/proxy';
    const MAX_HISTORY_ITEMS = 30;

    // --- DOM ELEMENT REFERENCES ---
    const historyListEl = document.getElementById('history-list');
    const newTabBtn = document.getElementById('new-tab-btn');
    const tabBarEl = document.querySelector('.tab-bar');
    const tabContentPanelsEl = document.getElementById('tab-content-panels');
    const tabContentTemplate = document.getElementById('tab-content-template');
    const clearHistoryBtn = document.getElementById('clear-history-btn');

    // --- STATE MANAGEMENT ---
    let tabs = {}; // Store tab data by ID
    let history = [];
    let activeTabId = null;
    let nextTabId = 0;

    // --- CORE FUNCTIONS ---

    const createNewTab = (initialState = {}) => {
        const tabId = `tab-${nextTabId++}`;

        const tabButton = document.createElement('button');
        tabButton.className = 'tab';
        tabButton.dataset.tabId = tabId;
        tabButton.innerHTML = `
            <span>Untitled Request</span>
            <button class="close-tab-btn" data-tab-id="${tabId}">×</button>
        `;
        tabBarEl.insertBefore(tabButton, newTabBtn);

        const panelClone = tabContentTemplate.content.cloneNode(true);
        const newPanel = panelClone.querySelector('.tab-content-panel');
        newPanel.dataset.panelId = tabId;
        tabContentPanelsEl.appendChild(newPanel);

        tabs[tabId] = {
            id: tabId,
            url: initialState.url || '',
            method: initialState.method || 'GET',
            headers: initialState.headers || {},
            params: initialState.params || {},
            body: initialState.body || '',
            panelEl: newPanel,
            buttonEl: tabButton
        };

        populateTabFromState(tabId);
        switchTab(tabId);
    };

    const switchTab = (tabId) => {
        if (!tabs[tabId]) return;
        activeTabId = tabId;

        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tabs[tabId].buttonEl.classList.add('active');

        document.querySelectorAll('.tab-content-panel').forEach(p => p.classList.remove('active'));
        tabs[tabId].panelEl.classList.add('active');
    };

    const closeTab = (tabId) => {
        if (Object.keys(tabs).length <= 1) return;

        const tabToClose = tabs[tabId];
        tabToClose.buttonEl.remove();
        tabToClose.panelEl.remove();
        delete tabs[tabId];

        if (activeTabId === tabId) {
            const firstTabId = Object.keys(tabs)[0];
            switchTab(firstTabId);
        }
    };

    const populateTabFromState = (tabId) => {
        const { panelEl, url, method, headers, params, body } = tabs[tabId];

        panelEl.querySelector('.url-input').value = url;
        panelEl.querySelector('.method-select').value = method;
        panelEl.querySelector('.request-body').value = typeof body === 'object' ? JSON.stringify(body, null, 2) : body;

        const createRows = (listEl, data) => {
            listEl.innerHTML = '';
            for (const key in data) {
                const row = createKeyValueRow(listEl);
                row.querySelector('.key').value = key;
                row.querySelector('.value').value = data[key];
            }
        };

        createRows(panelEl.querySelector('.params-list'), params);
        createRows(panelEl.querySelector('.headers-list'), headers);
    };

    // --- HISTORY MANAGEMENT ---

    const saveRequestToHistory = (requestData) => {
        const historyItem = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            ...requestData
        };
        history.unshift(historyItem);
        if (history.length > MAX_HISTORY_ITEMS) {
            history.pop();
        }
        localStorage.setItem('postman-clone-history', JSON.stringify(history));
        renderHistory();
    };

    const loadHistory = () => {
        history = JSON.parse(localStorage.getItem('postman-clone-history')) || [];
        renderHistory();
    };

    const renderHistory = () => {
        historyListEl.innerHTML = '';
        history.forEach(item => {
            const li = document.createElement('li');
            li.className = 'history-item';
            li.dataset.historyId = item.id;
            li.innerHTML = `
                <div class="history-item-info">
                    <span class="method method-${item.method}">${item.method}</span>
                    <span class="url">${item.url}</span>
                    <span class="timestamp">${new Date(item.timestamp).toLocaleString()}</span>
                </div>
                <button class="delete-history-item-btn" title="Delete item">×</button>
            `;
            historyListEl.appendChild(li);
        });
    };

    const deleteHistoryItem = (historyId) => {
        history = history.filter(item => item.id != historyId);
        localStorage.setItem('postman-clone-history', JSON.stringify(history));
        renderHistory();
    };

    const clearAllHistory = () => {
        if (confirm('Are you sure you want to clear all request history?')) {
            history = [];
            localStorage.removeItem('postman-clone-history');
            renderHistory();
        }
    };

    const loadRequestFromHistory = (historyId) => {
        const historyItem = history.find(h => h.id == historyId);
        if (!historyItem) return;

        const tabState = tabs[activeTabId];
        tabState.url = historyItem.url;
        tabState.method = historyItem.method;
        tabState.headers = historyItem.headers;
        tabState.params = historyItem.params;
        tabState.body = historyItem.body;

        populateTabFromState(activeTabId);
        updateTabTitle(activeTabId);
    };

    const updateTabTitle = (tabId) => {
        const { url, buttonEl } = tabs[tabId];
        const title = url ? (url.split('?')[0].split('/').pop() || url) : 'Untitled Request';
        buttonEl.querySelector('span').textContent = title.substring(0, 20);
    };

    // --- UTILITY FUNCTIONS ---

    const createKeyValueRow = (listElement) => {
        const row = document.createElement('div');
        row.className = 'kv-pair';
        row.innerHTML = `
            <input type="text" class="key" placeholder="Key">
            <input type="text" class="value" placeholder="Value">
            <button class="remove-kv-btn">×</button>
        `;
        listElement.appendChild(row);
        row.querySelector('.remove-kv-btn').addEventListener('click', () => row.remove());
        return row;
    };

    const getKeyValueData = (listElement) => {
        const data = {};
        listElement.querySelectorAll('.kv-pair').forEach(row => {
            const key = row.querySelector('.key').value.trim();
            const value = row.querySelector('.value').value.trim();
            if (key) data[key] = value;
        });
        return data;
    };

    // --- EVENT LISTENERS ---

    document.addEventListener('click', async (e) => {
        const activePanel = tabs[activeTabId]?.panelEl;

        if (e.target.closest('.tab')) {
            switchTab(e.target.closest('.tab').dataset.tabId);
        }
        if (e.target.matches('.close-tab-btn')) {
            e.stopPropagation();
            closeTab(e.target.dataset.tabId);
        }
        if (e.target === newTabBtn) {
            createNewTab();
        }

        if (e.target === clearHistoryBtn) {
            clearAllHistory();
        }
        if (e.target.matches('.delete-history-item-btn')) {
            e.stopPropagation();
            const historyId = e.target.closest('.history-item').dataset.historyId;
            deleteHistoryItem(historyId);
        }
        if (e.target.closest('.history-item-info')) {
            loadRequestFromHistory(e.target.closest('.history-item').dataset.historyId);
        }

        if (!activePanel) return;

        if (e.target.matches('.add-param-btn')) {
            createKeyValueRow(activePanel.querySelector('.params-list'));
        }
        if (e.target.matches('.add-header-btn')) {
            createKeyValueRow(activePanel.querySelector('.headers-list'));
        }
        if (e.target.matches('.tab-link')) {
            activePanel.querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
            activePanel.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            activePanel.querySelector(`.tab-content[data-tab-id="${e.target.dataset.tab}"]`).classList.add('active');
        }
        if (e.target.matches('.tab-link-response')) {
            activePanel.querySelectorAll('.tab-link-response').forEach(t => t.classList.remove('active'));
            activePanel.querySelectorAll('.tab-content-response').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
            activePanel.querySelector(`.tab-content-response[data-tab-response-id="${e.target.dataset.tabResponse}"]`).classList.add('active');
        }
        if (e.target.matches('.clear-btn')) {
            activePanel.querySelector('.url-input').value = '';
            activePanel.querySelector('.params-list').innerHTML = '';
            activePanel.querySelector('.headers-list').innerHTML = '';
            activePanel.querySelector('.request-body').value = '';
        }

        if (e.target.matches('.send-btn')) {
            const url = activePanel.querySelector('.url-input').value.trim();
            if (!url) {
                alert('Please enter a URL.');
                return;
            }

            const spinner = activePanel.querySelector('.spinner');
            spinner.style.display = 'block';

            let requestBody = null;
            const bodyText = activePanel.querySelector('.request-body').value.trim();
            try {
                if (bodyText) requestBody = JSON.parse(bodyText);
            } catch (error) {
                alert('Invalid JSON in request body.');
                spinner.style.display = 'none';
                return;
            }

            const requestData = {
                method: activePanel.querySelector('.method-select').value,
                url: url,
                headers: getKeyValueData(activePanel.querySelector('.headers-list')),
                params: getKeyValueData(activePanel.querySelector('.params-list')),
                body: requestBody,
            };

            try {
                const response = await fetch(BACKEND_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestData),
                });
                const data = await response.json();

                activePanel.querySelector('.status-code').textContent = data.status_code;
                activePanel.querySelector('.response-time').textContent = `${data.duration} ms`;
                const responseBodyEl = activePanel.querySelector('.response-body');
                responseBodyEl.textContent = (typeof data.body === 'object' && data.body !== null)
                    ? JSON.stringify(data.body, null, 2)
                    : data.body;
                activePanel.querySelector('.response-headers').textContent = JSON.stringify(data.headers, null, 2);

                saveRequestToHistory(requestData);
                updateTabTitle(activeTabId);
            } catch (error) {
                activePanel.querySelector('.response-body').textContent = `Error: Could not connect to backend.\n\nDetails: ${error.message}`;
            } finally {
                spinner.style.display = 'none';
            }
        }
    });

    tabContentPanelsEl.addEventListener('input', (e) => {
        if (e.target.matches('.url-input')) {
            updateTabTitle(activeTabId);
        }
    });

    // --- INITIALIZATION ---
    loadHistory();
    createNewTab();
});
