// Asset Details and Modal Module

let currentAsset = null;

// Show asset details modal
function showAssetDetails(assetId) {
    currentAsset = allAssets.find(a => a.id === assetId);
    if (!currentAsset) {
        M.toast({html: 'Asset not found', classes: 'red'});
        return;
    }
    
    // Update modal header
    const nameEl = document.getElementById('modalAssetName');
    const typeEl = document.getElementById('modalAssetType');
    
    if (nameEl) nameEl.textContent = currentAsset.name;
    if (typeEl) typeEl.textContent = currentAsset.type.replace(/-/g, ' ').toUpperCase();
    
    // Show different sections
    showAssetInfo();
    if (typeof showMaintenanceHistory === 'function') showMaintenanceHistory();
    if (typeof showTestProcedures === 'function') showTestProcedures();
    if (typeof showTestHistory === 'function') showTestHistory();
    
    // Open modal and reset to first tab
    const modal = M.Modal.getInstance(document.getElementById('assetModal'));
    const tabsEl = document.querySelector('.tabs');
    if (tabsEl) {
        let tabs = M.Tabs.getInstance(tabsEl);
        if (!tabs) {
            tabs = M.Tabs.init(tabsEl);
        }
        if (tabs && typeof tabs.select === 'function') {
            tabs.select('assetInfo');
        }
    }
    
    if (modal) modal.open();
}

// Show asset information tab
function showAssetInfo() {
    const container = document.getElementById('assetInfo');
    if (!container || !currentAsset) return;
    
    const maintenanceStatus = getMaintenanceStatus(currentAsset);
    
    container.innerHTML = `
        <div class="info-card">
            <h6><i class="material-icons left">dashboard</i>Asset Overview</h6>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Asset ID</div>
                    <div class="info-value">${currentAsset.id}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Type</div>
                    <div class="info-value">${currentAsset.type.replace(/-/g, ' ').toUpperCase()}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Status</div>
                    <div class="info-value">
                        <select id="assetStatusDropdown" class="browser-default" style="max-width:180px; display:inline-block;">
                            <option value="normal" ${currentAsset.status === 'normal' ? 'selected' : ''}>Normal</option>
                            <option value="in maintenance" ${currentAsset.status === 'in maintenance' ? 'selected' : ''}>In Maintenance</option>
                            <option value="fault/shutdown" ${currentAsset.status === 'fault/shutdown' ? 'selected' : ''}>Fault/Shutdown</option>
                        </select>
                    </div>
                </div>
                <div class="info-item">
                    <div class="info-label">Maintenance Status</div>
                    <div class="info-value">
                        ${maintenanceStatus === 'overdue' ? '<span class="red-text">Overdue</span>' :
                          maintenanceStatus === 'due-soon' ? '<span class="orange-text">Due Soon</span>' :
                          '<span class="green-text">On Schedule</span>'}
                    </div>
                </div>
                <div class="info-item">
                    <div class="info-label">Building</div>
                    <div class="info-value">${currentAsset.building || '-'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Floor/Level</div>
                    <div class="info-value">${currentAsset.floor || '-'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Serial Number</div>
                    <div class="info-value">${currentAsset.serialNumber || '-'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Manufacturer</div>
                    <div class="info-value">${currentAsset.manufacturer || '-'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Model</div>
                    <div class="info-value">${currentAsset.model || '-'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Installation Date</div>
                    <div class="info-value">${currentAsset.installationDate || '-'}</div>
                </div>
            </div>
        </div>
        <div class="info-card">
            <h6><i class="material-icons left">schedule</i>Maintenance Schedule</h6>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Last Maintenance</div>
                    <div class="info-value">${currentAsset.lastMaintenanceDate || '-'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Next Maintenance</div>
                    <div class="info-value">${currentAsset.nextMaintenanceDate || '-'}</div>
                </div>
            </div>
        </div>
    `;

    // Add event listener for status change
    setTimeout(() => {
        const dropdown = document.getElementById('assetStatusDropdown');
        if (dropdown) {
            dropdown.addEventListener('change', async function() {
                const newStatus = this.value;
                
                try {
                    await updateAssetStatus(newStatus);
                    currentAsset.status = newStatus;
                    
                    // Update in allAssets array
                    const assetIndex = allAssets.findIndex(a => a.id === currentAsset.id);
                    if (assetIndex !== -1) {
                        allAssets[assetIndex].status = newStatus;
                    }
                    
                    // Refresh displays
                    if (typeof displayAssets === 'function') displayAssets();
                    if (typeof updateStatistics === 'function') updateStatistics();
                    
                    M.toast({html: 'Asset status updated!', classes: 'green'});
                } catch (error) {
                    console.error('Error updating asset status:', error);
                    M.toast({html: 'Failed to update asset status', classes: 'red'});
                    // Revert dropdown
                    this.value = currentAsset.status;
                }
            });
        }
    }, 100);
}

// Update asset status in Google Sheets
async function updateAssetStatus(newStatus) {
    if (!currentAsset) return;
    
    try {
        if (isAuthenticated()) {
            // Find the row number (assuming assets start at row 2)
            const assetIndex = allAssets.findIndex(a => a.id === currentAsset.id);
            const rowNumber = assetIndex + 2; // +2 because sheets are 1-indexed and we skip header
            
            await gapi.client.sheets.spreadsheets.values.update({
                spreadsheetId: GOOGLE_CONFIG.SPREADSHEET_ID,
                range: `${GOOGLE_CONFIG.SHEETS.ASSETS}!F${rowNumber}`, // Column F is status
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [[newStatus]]
                }
            });
        } else {
            // Save to local storage for later sync
            let localUpdates = [];
            try { localUpdates = JSON.parse(localStorage.getItem('localAssetUpdates') || '[]'); } catch(_) { localUpdates = []; }
            localUpdates.push({
                assetId: currentAsset.id,
                field: 'status',
                value: newStatus,
                timestamp: new Date().toISOString()
            });
            localStorage.setItem('localAssetUpdates', JSON.stringify(localUpdates));
            
            M.toast({html: 'Saved locally. Sign in to sync changes.', classes: 'blue'});
        }
    } catch (error) {
        console.error('Error updating asset status:', error);
        throw error;
    }
}

// Show test procedures for current asset
function showTestProcedures() {
    const container = document.getElementById('testProcedures');
    if (!container || !currentAsset) return;
    
    const applicableProcedures = testProcedures.filter(proc => 
        proc.assetType === currentAsset.type
    );
    
    if (applicableProcedures.length === 0) {
        container.innerHTML = `
            <div class="info-card">
                <p class="center-align" style="color: #64748b;">
                    <i class="material-icons" style="font-size: 48px;">assignment</i><br>
                    No test procedures available for this asset type.
                </p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <h5>Available Test Procedures</h5>
        ${applicableProcedures.map(procedure => `
            <div class="procedure-card">
                <div class="procedure-header">
                    <h6>${procedure.name}</h6>
                    <span class="procedure-duration">${procedure.estimatedDuration} minutes</span>
                </div>
                <p class="procedure-steps">${procedure.steps.length} steps</p>
                <div class="procedure-actions">
                    <button class="btn waves-effect waves-light" onclick="startTest('${procedure.id}')">
                        <i class="material-icons left">play_arrow</i>Start Test
                    </button>
                    <button class="btn-flat waves-effect" onclick="previewTest('${procedure.id}')">
                        <i class="material-icons left">visibility</i>Preview
                    </button>
                </div>
            </div>
        `).join('')}
    `;
}

// Show test history for current asset
function showTestHistory() {
    const container = document.getElementById('testHistory');
    if (!container || !currentAsset) return;
    
    const assetTests = testResultsHistory.filter(test => test.assetId === currentAsset.id);
    
    if (assetTests.length === 0) {
        container.innerHTML = `
            <div class="info-card">
                <p class="center-align" style="color: #64748b;">
                    <i class="material-icons" style="font-size: 48px;">history</i><br>
                    No test history available for this asset.
                </p>
            </div>
        `;
        return;
    }
    
    // Sort by date (newest first) using robust parser
    const pd = (typeof parseDate === 'function') ? parseDate : (d => new Date(d));
    assetTests.sort((a, b) => pd(b.date) - pd(a.date));
    
    container.innerHTML = `
        <h5>Test History</h5>
        ${assetTests.map(test => {
            const procedure = testProcedures.find(p => p.id === test.procedureId);
            const procedureName = procedure ? procedure.name : 'Unknown Procedure';
            const statusClass = test.overallStatus === 'passed' ? 'green' : 'red';
            
            return `
                <div class="test-history-card">
                    <div class="test-header">
                        <h6>${procedureName}</h6>
                        <span class="test-status ${statusClass}-text">${test.overallStatus.toUpperCase()}</span>
                    </div>
                    <p><strong>Date:</strong> ${formatDate(test.date)}</p>
                    <p><strong>Technicians:</strong> ${test.technicians || '-'}</p>
                    <p><strong>Contractors:</strong> ${test.contractors || '-'}</p>
                    ${test.notes ? `<p><strong>Notes:</strong> ${test.notes}</p>` : ''}
                    <div class="test-actions">
                        <button class="btn-flat waves-effect" onclick="viewTestDetails('${test.timestamp}')">
                            <i class="material-icons left">visibility</i>View Details
                        </button>
                    </div>
                </div>
            `;
        }).join('')}
    `;
}

// View detailed test results
async function viewTestDetails(timestamp) {
    const test = testResultsHistory.find(t => t.timestamp === timestamp);
    if (!test) {
        M.toast({html: 'Test details not found', classes: 'red'});
        return;
    }
    
    const procedure = testProcedures.find(p => p.id === test.procedureId);
    if (!procedure) {
        M.toast({html: 'Test procedure not found', classes: 'red'});
        return;
    }
    try {
        // Ensure details modal exists
        ensureTestDetailsModal();

        // Try to gather per-step results from the TestResults sheet for this test instance
        const rows = await fetchTestInstanceRows(test.assetId, test.procedureId, test.timestamp);

        const stepsByNumber = new Map();
        const cloudLinksByStep = {};
        if (rows && rows.length) {
            // Rows aligned to columns A:Q defined in data saving
            rows.forEach(r => {
                const stepNum = parseInt(r[9], 10); // Step Number
                if (!isNaN(stepNum)) {
                    stepsByNumber.set(stepNum, {
                        stepNumber: stepNum,
                        description: r[10] || '',
                        result: r[11] || '',
                        performer: r[12] || '',
                        performedAt: r[13] || '',
                        notes: r[14] || ''
                    });
                    // Attempt to extract any cloud URLs included in notes
                    const urls = extractUrlsFromText(r[14] || '');
                    if (urls.length) {
                        cloudLinksByStep[stepNum] = urls;
                    }
                }
            });
        }

        // Compose modal content
        const modalTitle = document.getElementById('testDetailsTitle');
        const modalBody = document.getElementById('testDetailsBody');
        if (modalTitle) {
            const assetName = (currentAsset && currentAsset.name) || (allAssets.find(a=>a.id===test.assetId)?.name) || test.assetId;
            modalTitle.textContent = `${procedure.name} — ${assetName}`;
        }

        const statusClass = test.overallStatus === 'passed' ? 'green' : 'red';
        const localAtt = getLocalAttachmentsForSession(test.timestamp);
        const stepCards = procedure.steps.map(step => {
            const s = stepsByNumber.get(step.stepNumber) || {};
            const res = (s.result || '').toLowerCase();
            const chipClass = res === 'pass' ? 'green' : (res === 'fail' ? 'red' : 'grey');
            const attList = (localAtt && localAtt[step.stepNumber]) || [];
            const attHtml = attList.length
                ? `<div class="attachments" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
                        ${attList.map((att, idx) => `
                            <img src="${att.dataUrl}" alt="Attachment ${idx+1}"
                                 onclick="showImage('${att.dataUrl}')"
                                 style="width:110px;height:80px;object-fit:cover;border-radius:4px;cursor:pointer;border:1px solid #e0e0e0"/>
                        `).join('')}
                   </div>`
                : '';
            const cloudList = cloudLinksByStep[step.stepNumber] || [];
            const cloudHtml = cloudList.length
                ? `<div class="attachments" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
                        ${cloudList.map((url, idx) => {
                            const safeUrl = String(url);
                            const isDirectImg = /^https:\/\/drive\.google\.com\/uc\?id=/.test(safeUrl) || /\.(png|jpe?g|gif|webp)$/i.test(safeUrl);
                            // Wrap each cloud item with a fallback link revealed on image error
                            return `
                                <span class="cloud-img" style="display:inline-flex;align-items:center;gap:6px;">
                                    ${isDirectImg ? `<img src="${safeUrl}" alt="Cloud Attachment ${idx+1}"
                                        onclick="showImage('${safeUrl}')"
                                        onerror="this.style.display='none'; var a=this.nextElementSibling; if(a) a.style.display='inline-block';"
                                        style="width:110px;height:80px;object-fit:cover;border-radius:4px;cursor:pointer;border:1px solid #e0e0e0"/>` : ''}
                                    <a href="${safeUrl}" target="_blank" rel="noopener" style="display:${isDirectImg ? 'none' : 'inline-block'};text-decoration:none;">
                                        <i class="material-icons" style="vertical-align:middle;">open_in_new</i>
                                        Open Cloud Attachment
                                    </a>
                                </span>`;
                        }).join('')}
                   </div>`
                : '';
            return `
                <li class="collection-item">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
                        <div style="flex:1;min-width:240px;">
                            <strong>Step ${step.stepNumber}:</strong> ${step.description || ''}
                            ${step.expectedResult ? `<br><em class="grey-text">Expected: ${step.expectedResult}</em>` : ''}
                            ${s.notes ? `<br><span class="grey-text">Notes: ${s.notes}</span>` : ''}
                            ${attHtml}
                            ${cloudHtml}
                        </div>
                        <div style="text-align:right;min-width:140px;">
                            <div class="chip ${chipClass} white-text" style="margin-bottom:6px;">${(s.result || 'n/a').toUpperCase()}</div>
                            ${s.performer ? `<div class="grey-text">${s.performer}</div>` : ''}
                            ${s.performedAt ? `<div class="grey-text">${s.performedAt}</div>` : ''}
                        </div>
                    </div>
                </li>
            `;
        }).join('');

        const html = `
            <div class="card-panel ${statusClass} lighten-4" style="margin-top:0;">
                <span class="${statusClass}-text text-darken-2"><i class="material-icons left">${statusClass === 'green' ? 'check_circle' : 'cancel'}</i>
                    Overall: ${test.overallStatus.toUpperCase()}</span>
            </div>
            <div class="row" style="margin-bottom:0;">
                <div class="col s12 m6">
                    <p><strong>Date:</strong> ${formatDate(test.date)}<br>
                    <strong>Technicians:</strong> ${test.technicians || '-'}<br>
                    <strong>Contractors:</strong> ${test.contractors || '-'}</p>
                </div>
                <div class="col s12 m6">
                    <p><strong>Procedure:</strong> ${procedure.name}<br>
                    <strong>Steps:</strong> ${procedure.steps.length}</p>
                </div>
            </div>
            ${test.notes ? `<div class="card-panel grey lighten-4"><strong>Notes:</strong> ${test.notes}</div>` : ''}
            <div class="card-panel blue lighten-5" style="border-left:4px solid #2196f3;">
                <span class="blue-text text-darken-2">
                    Local attachments are shown when available on this device. Cloud attachments appear when uploaded and are visible on any device.
                </span>
            </div>
            <ul class="collection with-header">
                <li class="collection-header"><h6>Step Results</h6></li>
                ${stepCards}
            </ul>
        `;

        if (modalBody) modalBody.innerHTML = html;

        // Store context for export
        window._currentTestDetailsContext = {
            test,
            procedure,
            stepsByNumber,
            cloudLinksByStep,
            localAttachments: localAtt
        };

        // Bind export button if present
        const exportBtn = document.getElementById('exportTestReportBtn');
        if (exportBtn && !exportBtn._bound) {
            exportBtn.addEventListener('click', exportCurrentTestReport);
            exportBtn._bound = true;
        }

        const instance = M.Modal.getInstance(document.getElementById('testDetailsModal')) ||
                         M.Modal.init(document.getElementById('testDetailsModal'));
        instance.open();
    } catch (e) {
        console.error('Failed to load test details:', e);
        M.toast({html: 'Failed to load test details', classes: 'red'});
    }
}

// Ensure the Test Details modal exists in DOM
function ensureTestDetailsModal() {
    if (document.getElementById('testDetailsModal')) return;
    const modalHtml = `
        <div id="testDetailsModal" class="modal modal-fixed-footer" style="width:80%;max-width:1000px;">
            <div class="modal-content">
                <h5 id="testDetailsTitle">Test Details</h5>
                <div id="testDetailsBody">Loading...</div>
            </div>
            <div class="modal-footer">
                <a href="#!" id="exportTestReportBtn" class="waves-effect waves-light btn blue" style="margin-right:8px;">
                    <i class="material-icons left">picture_as_pdf</i>Export Report
                </a>
                <a href="#!" class="modal-close waves-effect waves-green btn-flat">Close</a>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const el = document.getElementById('testDetailsModal');
    M.Modal.init(el);
    const exportBtn = document.getElementById('exportTestReportBtn');
    if (exportBtn && !exportBtn._bound) {
        exportBtn.addEventListener('click', exportCurrentTestReport);
        exportBtn._bound = true;
    }
}

// Fetch all rows in TestResults for a given assetId/procedureId/timestamp
async function fetchTestInstanceRows(assetId, procedureId, timestamp) {
    try {
        // Prefer authenticated call for larger ranges; fallback to public
        const range = `${GOOGLE_CONFIG.SHEETS.TEST_RESULTS}!A:Q`;
        let values = null;
        if (typeof gapi !== 'undefined' && gapi.client && gapi.client.getToken && gapi.client.getToken()) {
            const resp = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: GOOGLE_CONFIG.SPREADSHEET_ID,
                range
            });
            values = resp.result?.values || [];
        } else {
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(range)}?key=${GOOGLE_CONFIG.API_KEY}`;
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            values = data.values || [];
        }
        // Filter rows for the instance
        return values.filter(r => r[0] === assetId && r[3] === procedureId && r[6] === timestamp);
    } catch (e) {
        console.warn('Could not fetch test instance rows, proceeding with minimal details', e);
        return [];
    }
}

// Load locally stored attachments for a given session timestamp
function getLocalAttachmentsForSession(sessionKey) {
    try {
        const raw = localStorage.getItem('testStepAttachments');
        if (!raw) return null;
        const all = JSON.parse(raw);
        return all && all[sessionKey] ? all[sessionKey] : null;
    } catch (e) {
        console.warn('Failed to read local attachments', e);
        return null;
    }
}

// Extract URLs from a free text string
function extractUrlsFromText(text) {
    if (!text) return [];
    const urlRegex = /(https?:\/\/[^\s)]+)\b/g;
    const out = [];
    let m;
    while ((m = urlRegex.exec(text)) !== null) {
        out.push(m[1]);
    }
    return out;
}

// Export the currently viewed test details to a printable report window
function exportCurrentTestReport() {
    const ctx = window._currentTestDetailsContext;
    if (!ctx) {
        M.toast({ html: 'Open a test details view first', classes: 'orange' });
        return;
    }
    const { test, procedure, stepsByNumber, cloudLinksByStep, localAttachments } = ctx;
    const asset = allAssets.find(a => a.id === test.assetId);
    const title = `${procedure.name} — ${asset?.name || test.assetId}`;

    // Compute summary stats
    const totalSteps = procedure.steps.length;
    let passed = 0, failed = 0;
    procedure.steps.forEach(step => {
        const s = stepsByNumber.get(step.stepNumber) || {};
        if ((s.result || '').toLowerCase() === 'pass') passed++;
        else if ((s.result || '').toLowerCase() === 'fail') failed++;
    });

    const statusColor = (test.overallStatus || '').toLowerCase() === 'passed' ? '#2e7d32' : '#c62828';

    const head = `
        <meta charset="utf-8"/>
        <title>${title}</title>
        <link href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700&display=swap" rel="stylesheet">
        <style>
            :root {
                --primary:#1565c0;
                --primary-2:#1976d2;
                --success:#2e7d32;
                --error:#c62828;
                --muted:#607d8b;
                --border:#e0e0e0;
            }
            @page { margin: 16mm; }
            @media print {
                * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .no-print { display:none !important; }
                .page-break { page-break-after: always; }
                /* Keep steps intact for cleaner pagination */
                h2, .step-header { page-break-after: avoid; }
                .img-grid { page-break-inside: avoid; }
            }
            body { font-family: Roboto, Arial, sans-serif; color:#111; margin: 0; }
            .container { padding: 16mm; }
            .cover {
                border-bottom: 4px solid var(--primary);
                padding-bottom: 12px; margin-bottom: 18px;
            }
            .title { font-weight:700; font-size: 24px; margin: 0; }
            .subtitle { color: var(--muted); margin: 4px 0 0; }
            .status-pill {
                display:inline-block; padding:6px 12px; border-radius:16px; color:#fff; font-weight:500; font-size:12px;
            }
            .meta-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px 24px; margin-top: 12px; }
            .meta-item { font-size: 13px; }
            .meta-item b { color:#333; }
            .summary-card {
                border:1px solid var(--border); border-radius:8px; padding:12px; margin: 16px 0 24px;
                background: #fafafa;
            }
            .summary-stats { display:flex; gap: 16px; flex-wrap: wrap; }
            .stat { min-width: 120px; border:1px solid var(--border); border-radius:8px; padding:10px; background:white; }
            .stat .label{ font-size:12px; color:#666; }
            .stat .value{ font-size:18px; font-weight:600; }
            h2 { font-size:16px; margin: 18px 0 8px; border-bottom:1px solid var(--border); padding-bottom:6px; }
            .step { border:1px solid var(--border); border-radius:8px; padding:14px; margin:12px 0; background:white; break-inside: avoid; page-break-inside: avoid; }
            .step-header { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
            .step-title { font-weight:600; margin:0; }
            .chip { display:inline-block; padding:4px 10px; border-radius:14px; color:#fff; font-size:12px; font-weight:600; }
            .chip.pass{ background: var(--success); }
            .chip.fail{ background: var(--error); }
            .expected { color:#555; font-style: italic; }
            .notes { color:#333; font-size: 12px; font-weight:700; }
            .byline { color:#555; font-size: 12px; }
            .img-grid { display:flex; flex-wrap:wrap; gap:12px; margin-top:10px; break-inside: avoid; page-break-inside: avoid; }
            .img-grid.two-col img { width: calc(50% - 6px); height:auto; max-height: 420px; object-fit:cover; border:1px solid var(--border); border-radius:6px; }
            .img-grid.single img { width: 100%; height:auto; max-height: 700px; object-fit:contain; border:1px solid var(--border); border-radius:6px; }
            footer { margin-top: 18px; font-size: 11px; color:#777; text-align:center; }
        </style>
    `;

    const header = `
        <div class="cover">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                <div>
                    <h1 class="title">${title}</h1>
                    <div class="subtitle">Generated ${new Date().toLocaleString()}</div>
                </div>
                <div class="status-pill" style="background:${statusColor}">${(test.overallStatus || 'N/A').toUpperCase()}</div>
            </div>
            <div class="meta-grid">
                <div class="meta-item"><b>Asset:</b> ${asset?.name || test.assetId} (${asset?.id || test.assetId})</div>
                <div class="meta-item"><b>Procedure:</b> ${procedure.name} (${procedure.id})</div>
                <div class="meta-item"><b>Date:</b> ${formatDate(test.date)}</div>
                <div class="meta-item"><b>Technicians:</b> ${test.technicians || '-'}</div>
                <div class="meta-item"><b>Contractors:</b> ${test.contractors || '-'}</div>
                <div class="meta-item"><b>Total Steps:</b> ${totalSteps} • <span style="color:var(--success)">Passed: ${passed}</span> • <span style="color:var(--error)">Failed: ${failed}</span></div>
            </div>
        </div>
        ${test.notes ? `<div class="summary-card"><b>Overall Notes:</b> ${test.notes}</div>` : ''}
    `;

    const stepsHtml = procedure.steps.map((step, idx) => {
        const s = stepsByNumber.get(step.stepNumber) || {};
        const r = String(s.result || '').trim().toLowerCase();
        const cls = r.startsWith('pass') ? 'pass' : (r.startsWith('fail') ? 'fail' : '');
        const cloud = cloudLinksByStep[step.stepNumber] || [];
        const local = (localAttachments && localAttachments[step.stepNumber]) || [];
        // Clean notes: remove any attachment lines and URLs that were appended during upload
        let notesClean = '';
        if (s.notes) {
            notesClean = String(s.notes)
                // remove URLs
                .replace(/https?:\/\/\S+/gi, '')
                .replace(/\bdrive\.google\.com\/\S+/gi, '')
                // remove appended attachment notes like "[Attachments: 1]"
                .replace(/\[\s*attachments?:\s*\d+\s*\]/gi, '')
                // remove any remaining "Links:" or "Link:" labels left after URL stripping
                .replace(/\blinks?:\s*/gi, '')
                // remove common attachment prefixes/lines
                .replace(/(^|\n)\s*(cloud\s*attachments?|attachments?\s*(uploaded)?)(:)?\s*.*$/gmi, '')
                // collapse extra spaces/newlines and stray brackets
                .replace(/[\[\]]/g, '')
                .replace(/[\t ]{2,}/g, ' ')
                .replace(/\n{2,}/g, '\n')
                .trim();
        }
        // Only embed local images to avoid broken cloud previews in print; list cloud links separately
        const images = [
            ...local.map(a => ({ src: a.dataUrl }))
        ];
        const imgClass = images.length <= 1 ? 'single' : 'two-col';
        const imgsHtml = images.map((img, i2) => `<img src="${img.src}" alt="Step ${step.stepNumber} Image ${i2+1}"/>`).join('');
        const cloudLinksHtml = cloud.length ? `<div style="margin-top:8px; font-size:12px; color:#1565c0;">
            Cloud attachments: ${cloud.map((u,i3) => `<a href="${u}" target="_blank" rel="noopener">Link ${i3+1}</a>`).join(' • ')}
        </div>` : '';
        return `
            <div class="step">
                <div class="step-header">
                    <h3 class="step-title">Step ${step.stepNumber}: ${step.description || ''}</h3>
                    ${cls ? `<span class="chip ${cls}">${(s.result || 'N/A').toUpperCase()}</span>` : `<span class="chip" style="background:#9e9e9e">${(s.result || 'N/A').toUpperCase()}</span>`}
                </div>
                ${step.expectedResult ? `<div class="expected">Expected: ${step.expectedResult}</div>` : ''}
                ${notesClean ? `<div class="notes">Notes: ${notesClean}</div>` : ''}
                <div class="byline">${s.performer ? `Performed By: ${s.performer}` : ''} ${s.performedAt ? ` • ${s.performedAt}` : ''}</div>
                ${images.length ? `<div class="img-grid ${imgClass}">${imgsHtml}</div>` : ''}
                ${cloudLinksHtml}
            </div>
        `;
    }).join('');

    const footer = `<footer>Report generated by Data Centre Asset Management — ${new Date().toLocaleString()}</footer>`;
    const html = `<!doctype html><html><head>${head}</head><body><div class="container">${header}<h2>Step Details</h2>${stepsHtml}${footer}</div></body></html>`;
    const w = window.open('', '_blank');
    if (!w) {
        M.toast({ html: 'Pop-up blocked. Allow pop-ups to export.', classes: 'red' });
        return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.onload = () => setTimeout(() => { try { w.print(); } catch(e){} }, 900);
}

// Expose for external use if needed
window.exportCurrentTestReport = exportCurrentTestReport;

// Make functions available globally
window.showAssetDetails = showAssetDetails;
window.showAssetInfo = showAssetInfo;
window.updateAssetStatus = updateAssetStatus;
window.showTestProcedures = showTestProcedures;
window.showTestHistory = showTestHistory;
window.viewTestDetails = viewTestDetails;

// Make currentAsset available as a getter so it's always current
Object.defineProperty(window, 'currentAsset', {
    get: function() {
        return currentAsset;
    },
    set: function(value) {
        currentAsset = value;
    }
});
