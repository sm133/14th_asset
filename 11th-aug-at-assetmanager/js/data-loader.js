// Data Loading Module

// Global data stores
let allAssets = [];
let maintenanceHistory = [];
let testProcedures = [];
let testResultsHistory = [];
let contractorsDirectory = {}; // { assetType: [ { name, company, role(optional) } ] }

// Load all data with authentication checks
async function loadAllData() {
    try {
        await Promise.all([
            loadAssets(),
            loadMaintenanceHistory(),
            loadTestProcedures(),
            loadTestResults(),
            loadContractorsDirectory()
        ]);
        
        if (typeof populateFilters === 'function') populateFilters();
        if (typeof filterAssets === 'function') filterAssets();
        if (typeof updateStatistics === 'function') updateStatistics();
        
        // Upload any local data if authenticated
        if (isAuthenticated()) {
            await uploadLocalData();
        }
        
    } catch (error) {
        console.error('Error loading data:', error);
        M.toast({html: 'Error loading data. Check console for details.', classes: 'red'});
    }
}

// Load assets data
async function loadAssets() {
    try {
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_CONFIG.SPREADSHEET_ID}/values/${GOOGLE_CONFIG.SHEETS.ASSETS}!A2:Z?key=${GOOGLE_CONFIG.API_KEY}`
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.values) {
            allAssets = data.values.map(row => ({
                id: (row[0] || '').trim(),
                name: (row[1] || '').trim(),
                type: (row[2] || '').trim(),
                building: (row[3] || '').trim(),
                floor: (row[4] || '').trim(),
                status: (row[5] || '').trim(),
                nextMaintenanceDate: (row[6] || '').trim(),
                lastMaintenanceDate: (row[7] || '').trim(),
                serialNumber: (row[8] || '').trim(),
                manufacturer: (row[9] || '').trim(),
                model: (row[10] || '').trim(),
                installationDate: (row[11] || '').trim()
            }));
        }
    } catch (error) {
        console.error('Error loading assets:', error);
        document.getElementById('assetsContainer').innerHTML = `
            <div class="col s12">
                <div class="card-panel red lighten-4">
                    <span class="red-text">Error loading assets: ${error.message}</span>
                    <br><br>
                    <small>Check console for details. Make sure your Google Sheets API is configured correctly.</small>
                </div>
            </div>
        `;
    }
}

// Load maintenance history
async function loadMaintenanceHistory() {
    try {
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_CONFIG.SPREADSHEET_ID}/values/${GOOGLE_CONFIG.SHEETS.MAINTENANCE_HISTORY}!A2:Z?key=${GOOGLE_CONFIG.API_KEY}`
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.values) {
            maintenanceHistory = data.values.map(row => ({
                id: row[0],
                assetId: row[1],
                date: row[2],
                type: row[3],
                technician: row[4],
                description: row[5],
                partsReplaced: row[6],
                nextMaintenanceDate: row[7],
                customerNotification: row[8],
                attachments: row[9] ? String(row[9]).split(';').filter(Boolean) : []
            }));
        }
    } catch (error) {
        console.error('Error loading maintenance history:', error);
    }
}

// Load test procedures
async function loadTestProcedures() {
    try {
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_CONFIG.SPREADSHEET_ID}/values/${GOOGLE_CONFIG.SHEETS.TEST_PROCEDURES}!A2:Z?key=${GOOGLE_CONFIG.API_KEY}`
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.values) {
            // Group procedures by ID
            const procedureMap = new Map();
            
            data.values.forEach(row => {
                const procedureId = row[0];
                const step = {
                    stepNumber: parseInt(row[3]),
                    description: row[4],
                    expectedResult: row[5],
                    imageUrl: row[6],
                    warningNotes: row[7],
                    fields: []
                };
                // Parse optional StepFields column: may be at index 9 (J) or any later column if user appended at end
                let stepFieldsRaw = row[9];
                if (!stepFieldsRaw) {
                    // Search any later column for a DSL pattern containing at least one pipe
                    for (let i = 10; i < row.length; i++) {
                        if (row[i] && row[i].includes('|')) { stepFieldsRaw = row[i]; break; }
                    }
                }
                if (stepFieldsRaw && typeof stepFieldsRaw === 'string') {
                    // DSL: key|Label|Type|Req|Extra ; key2|Label2|Type|Req|Extra
                    stepFieldsRaw.split(/;\s*/).forEach(segment => {
                        const trimmed = segment.trim();
                        if (!trimmed) return;
                        // Shorthand: single token with no pipe -> simple text field
                        if (!trimmed.includes('|')) {
                            const key = trimmed.replace(/\s+/g,'_');
                            if (!key) return;
                            step.fields.push({ key, label: trimmed, type: 'text', required: false });
                            return;
                        }
                        const parts = trimmed.split('|');
                        if (parts.length >= 3) {
                            const [key, label, type, req, extra] = parts;
                            const field = {
                                key: (key||'').trim(),
                                label: (label||'').trim(),
                                type: (type||'text').trim().toLowerCase(),
                                required: (req||'').trim().toLowerCase() === 'y'
                            };
                            if (field.type === 'number' && extra) field.unit = extra.trim();
                            if (field.type === 'select' && extra) field.options = extra.split(',').map(o => o.trim()).filter(Boolean);
                            if (!field.key) return;
                            step.fields.push(field);
                        }
                    });
                }
                
                if (!procedureMap.has(procedureId)) {
                    procedureMap.set(procedureId, {
                        id: procedureId,
                        assetType: row[1],
                        name: row[2],
                        estimatedDuration: parseInt(row[8]) || 30,
                        steps: []
                    });
                }
                
                // Merge if duplicate stepNumber already exists (combine descriptions and fields)
                const proc = procedureMap.get(procedureId);
                const existing = proc.steps.find(s => s.stepNumber === step.stepNumber);
                if (existing) {
                    // Append description if new one differs
                    if (step.description && existing.description !== step.description) {
                        existing.description += existing.description ? ` / ${step.description}` : step.description;
                    }
                    // Merge fields (avoid duplicate keys)
                    step.fields.forEach(f => {
                        if (!existing.fields.some(ef => ef.key === f.key)) existing.fields.push(f);
                    });
                    // Prefer expectedResult / warningNotes if existing empty
                    if (!existing.expectedResult && step.expectedResult) existing.expectedResult = step.expectedResult;
                    if (!existing.warningNotes && step.warningNotes) existing.warningNotes = step.warningNotes;
                    // Keep first imageUrl unless new one exists and existing lacks
                    if (!existing.imageUrl && step.imageUrl) existing.imageUrl = step.imageUrl;
                    // Debug (optional): mark merged
                    existing._merged = true;
                } else {
                    proc.steps.push(step);
                }
            });
            
            testProcedures = Array.from(procedureMap.values());
            
            // Sort steps by step number for each procedure
            testProcedures.forEach(procedure => {
                procedure.steps.sort((a, b) => a.stepNumber - b.stepNumber);
            });
        }
    } catch (error) {
        console.error('Error loading test procedures:', error);
    }
}

// Load test results with authentication check
async function loadTestResults() {
    try {
        let data;
        
        // Check if user is authenticated for private API access
        if (isAuthenticated()) {
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: GOOGLE_CONFIG.SPREADSHEET_ID,
                range: `${GOOGLE_CONFIG.SHEETS.TEST_RESULTS}!A2:Q`
            });
            data = response.result;
        } else {
            // Use public API
            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_CONFIG.SPREADSHEET_ID}/values/${GOOGLE_CONFIG.SHEETS.TEST_RESULTS}!A2:Q?key=${GOOGLE_CONFIG.API_KEY}`
            );
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            data = await response.json();
        }
        
        if (data.values) {
            // Group results by test instance (using timestamp)
            const testMap = new Map();
            
            data.values.forEach(row => {
                const assetId = (row[0] || '').trim();
                const procedureId = (row[3] || '').trim();
                const timestamp = (row[6] || '').trim();
                const key = `${assetId}-${procedureId}-${timestamp}`; // assetId-procedureId-timestamp
                
                if (!testMap.has(key)) {
                    testMap.set(key, {
                        assetId,
                        procedureId,
                        date: (row[5] || '').trim(),
                        technicians: (row[7] || '').trim(),
                        contractors: (row[8] || '').trim(),
                        overallStatus: (row[15] || '').trim(),
                        notes: (row[16] || '').trim(),
                        timestamp
                    });
                }
            });
            
            testResultsHistory = Array.from(testMap.values());
            // Keep window reference in sync for modules using window.testResultsHistory
            if (typeof window !== 'undefined') {
                window.testResultsHistory = testResultsHistory;
            }
        }
    } catch (error) {
        console.error('Error loading test results:', error);
        testResultsHistory = [];
        if (typeof window !== 'undefined') {
            window.testResultsHistory = testResultsHistory;
        }
    }
}

// Load contractors directory (asset-type specific)
async function loadContractorsDirectory() {
    // Preserve original object reference so window.contractorsDirectory stays in sync
    if (!contractorsDirectory) {
        contractorsDirectory = {};
    } else {
        // Clear existing keys
        Object.keys(contractorsDirectory).forEach(k => delete contractorsDirectory[k]);
    }
    try {
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_CONFIG.SPREADSHEET_ID}/values/${GOOGLE_CONFIG.SHEETS.CONTRACTORS}!A2:Z?key=${GOOGLE_CONFIG.API_KEY}`
        );
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.values) {
            data.values.forEach(row => {
                // Columns: AssetType | ContractorName (optional) | Company | Role/Notes (optional)
                const assetType = (row[0] || '').trim().toLowerCase();
                if (!assetType) return; // must have asset type
                const name = (row[1] || '').trim();
                const company = (row[2] || '').trim();
                const role = (row[3] || '').trim();
                // Accept rows where either name or company (or both) provided; skip if both empty
                if (!name && !company) return;
                if (!contractorsDirectory[assetType]) contractorsDirectory[assetType] = [];
                contractorsDirectory[assetType].push({ name, company, role });
            });
        }
        // Ensure global reference reflects any reinitialization
        if (typeof window !== 'undefined') window.contractorsDirectory = contractorsDirectory;
        // If user is currently on personnel step, refresh to show directory (safe checks)
        try {
            if (typeof currentTest !== 'undefined' && currentTest && typeof renderTestContent === 'function') {
                if (typeof wizardMode !== 'undefined' && wizardMode) {
                    if (typeof currentWizardStep !== 'undefined' && currentWizardStep === 0) {
                        renderTestContent();
                    }
                } else {
                    renderTestContent();
                }
            }
        } catch (_) {}
    } catch (e) {
        console.error('Error loading contractors directory:', e);
    }
}

// Upload local data when user signs in
async function uploadLocalData() {
    if (!isAuthenticated()) return;
    
    try {
        // Upload local maintenance records
        await uploadLocalMaintenance();
        
        // Upload local test results
        await uploadLocalTestResults();
        
    } catch (error) {
        console.error('Error uploading local data:', error);
    }
}

// Upload local maintenance records
async function uploadLocalMaintenance() {
    let localMaintenance = [];
    try { localMaintenance = JSON.parse(localStorage.getItem('localMaintenance') || '[]'); } catch(_) { localMaintenance = []; }
    if (localMaintenance.length === 0) return;
    
    let uploaded = 0;
    let failed = 0;
    
    for (const record of localMaintenance) {
        try {
            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: GOOGLE_CONFIG.SPREADSHEET_ID,
                range: `${GOOGLE_CONFIG.SHEETS.MAINTENANCE_HISTORY}!A:I`,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                resource: record
            });
            uploaded++;
        } catch (error) {
            console.error('Error uploading local maintenance:', error);
            failed++;
        }
    }
    
    if (uploaded > 0) {
        if (failed === 0) {
            localStorage.removeItem('localMaintenance');
        } else {
            // Keep only failed records
            const remainingRecords = localMaintenance.slice(-failed);
            localStorage.setItem('localMaintenance', JSON.stringify(remainingRecords));
        }
        
        M.toast({html: `Uploaded ${uploaded} maintenance records`, classes: 'green'});
        await loadMaintenanceHistory();
    }
    
    if (failed > 0) {
        M.toast({html: `Failed to upload ${failed} maintenance records`, classes: 'orange'});
    }
}

// Upload local test results
async function uploadLocalTestResults() {
    let localResults = [];
    try { localResults = JSON.parse(localStorage.getItem('localTestResults') || '[]'); } catch(_) { localResults = []; }
    if (localResults.length === 0) return;
    
    let uploaded = 0;
    let failed = 0;
    
    for (const result of localResults) {
        try {
            // Try to enrich rows with Drive links if authenticated and attachments exist locally
            const enriched = await enrichRowsWithDriveLinksIfPossible(result);
            await gapi.client.sheets.spreadsheets.values.append({
                spreadsheetId: GOOGLE_CONFIG.SPREADSHEET_ID,
                range: `${GOOGLE_CONFIG.SHEETS.TEST_RESULTS}!A:Q`,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                resource: enriched
            });
            uploaded++;
        } catch (error) {
            console.error('Error uploading local test result:', error);
            failed++;
        }
    }
    
    if (uploaded > 0) {
        if (failed === 0) {
            localStorage.removeItem('localTestResults');
        } else {
            // Keep only failed records
            const remainingResults = localResults.slice(-failed);
            localStorage.setItem('localTestResults', JSON.stringify(remainingResults));
        }
        
        M.toast({html: `Uploaded ${uploaded} test results`, classes: 'green'});
        await loadTestResults();
    }
    
    if (failed > 0) {
        M.toast({html: `Failed to upload ${failed} test results`, classes: 'orange'});
    }
}

// Attempt to upload any locally stored attachments for the test session(s)
// and append shareable Drive links into the notes column (index 14) before appending rows.
async function enrichRowsWithDriveLinksIfPossible(result) {
    try {
        if (!isAuthenticated()) return result; // Cannot upload without auth
        const values = (result && result.values) || [];
        if (!values.length) return result;

        // Load local attachments map from storage
        let attMap = {};
        try {
            attMap = JSON.parse(localStorage.getItem('testStepAttachments') || '{}') || {};
        } catch (_) { attMap = {}; }

        // Group rows by timestamp (col G index 6)
        const byTs = new Map();
        for (const row of values) {
            const ts = row[6];
            if (!byTs.has(ts)) byTs.set(ts, []);
            byTs.get(ts).push(row);
        }

        for (const [ts, rows] of byTs.entries()) {
            // Skip if no local attachments for this session
            const sessionAtt = attMap[ts];
            if (!sessionAtt) continue;

            // Collect minimal asset/procedure info from first row
            const first = rows[0] || [];
            const asset = { id: first[0] || '', name: first[1] || '' };
            const procedure = { id: first[3] || '', name: first[4] || '' };

            // If available, use global uploader to upload entire session in one go
            let linksByStep = {};
            if (typeof window.uploadSessionAttachmentsToDrive === 'function') {
                try {
                    linksByStep = await window.uploadSessionAttachmentsToDrive(ts, asset, procedure);
                } catch (e) {
                    console.warn('uploadSessionAttachmentsToDrive failed, continuing without links', e);
                    linksByStep = {};
                }
            }

            // Augment each row's notes with attachment count and any Drive links
            rows.forEach(r => {
                const stepNum = parseInt(r[9], 10);
                const attCount = Array.isArray(sessionAtt?.[stepNum]) ? sessionAtt[stepNum].length : 0;
                const links = linksByStep[stepNum] || [];
                const linkText = links.length ? ` Links: ${links.join(' ')}` : '';
                const existing = r[14] || '';
                const infoText = attCount ? `[Attachments: ${attCount}]${linkText}` : linkText;
                r[14] = existing ? `${existing} ${infoText}`.trim() : infoText || existing;
            });
        }

        return { values };
    } catch (e) {
        console.warn('enrichRowsWithDriveLinksIfPossible error; returning original rows', e);
        return result;
    }
}

// Utility function to parse dates
function parseDate(dateString) {
    if (!dateString) return new Date(0);
    
    // Handle DD/MM/YYYY format
    if (dateString.includes('/')) {
        const parts = dateString.split('/');
        if (parts.length === 3) {
            // Assume DD/MM/YYYY
            return new Date(parts[2], parts[1] - 1, parts[0]);
        }
    }
    
    // Handle other formats
    return new Date(dateString);
}

// Make functions and data available globally
window.loadAllData = loadAllData;
window.loadAssets = loadAssets;
window.loadMaintenanceHistory = loadMaintenanceHistory;
window.loadTestProcedures = loadTestProcedures;
window.loadTestResults = loadTestResults;
window.uploadLocalData = uploadLocalData;
window.parseDate = parseDate;
window.allAssets = allAssets;
window.maintenanceHistory = maintenanceHistory;
window.testProcedures = testProcedures;
window.testResultsHistory = testResultsHistory;
window.contractorsDirectory = contractorsDirectory;
window.loadContractorsDirectory = loadContractorsDirectory;
