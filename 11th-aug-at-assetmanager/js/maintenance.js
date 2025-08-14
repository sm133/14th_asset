// Maintenance History Management Module
// Added features:
// - New maintenance type option: "Maintenance Update/Comment" (replaces prior Routine generic type)
// - Photo attachment capture similar to test execution (stored locally & associated with record ID)
// - Viewer for attachments on each maintenance record

// Local attachment store { recordId: [ { name, type, dataUrl, addedAt } ] }
let maintenanceAttachments = {};
let maintenanceModalAttachments = []; // attachments while modal open prior to knowing record id
let maintenanceEditingId = null; // if set, editing existing record
let maintenanceDriveFolderId = null; // cached Drive folder id
// Adjustable image compression settings for maintenance photos
const MAINTENANCE_IMAGE_OPTIONS = { maxDimension: 2048, quality: 0.88 }; // higher than test step defaults

function loadMaintenanceAttachments() {
    try {
        const raw = localStorage.getItem('maintenanceAttachments');
        if (raw) maintenanceAttachments = JSON.parse(raw) || {};
    } catch (e) {
        console.warn('Could not load maintenance attachments', e);
        maintenanceAttachments = {};
    }
}

function persistMaintenanceAttachments() {
    try {
        localStorage.setItem('maintenanceAttachments', JSON.stringify(maintenanceAttachments));
    } catch (e) {
        console.warn('Could not persist maintenance attachments', e);
    }
}

async function handleMaintenanceAttachments(fileList) {
    try {
        if (!fileList || !fileList.length) return;
        const files = Array.from(fileList);
        for (const f of files) {
            if (!f.type || !f.type.startsWith('image/')) continue;
            if (typeof imageFileToDataUrlCompressed !== 'function') {
                console.warn('Compression helper not loaded');
                continue;
            }
            const dataUrl = await imageFileToDataUrlCompressed(f, MAINTENANCE_IMAGE_OPTIONS);
            maintenanceModalAttachments.push({
                name: f.name,
                type: 'image/jpeg',
                dataUrl,
                addedAt: new Date().toISOString()
            });
        }
        refreshMaintenanceAttachmentChips();
        M.toast({ html: `Added ${files.length} photo(s)`, classes: 'green' });
    } catch (e) {
        console.error('Maintenance attachment error', e);
        M.toast({ html: 'Failed to add photo(s)', classes: 'red' });
    }
}

function removeMaintenanceAttachment(index) {
    maintenanceModalAttachments.splice(index, 1);
    refreshMaintenanceAttachmentChips();
}

function refreshMaintenanceAttachmentChips() {
    const container = document.getElementById('maintenance-attachment-list');
    if (!container) return;
    if (!maintenanceModalAttachments.length) {
        container.innerHTML = "<span class='grey-text'>No photos attached</span>";
        return;
    }
    container.innerHTML = maintenanceModalAttachments.map((_, i) => `<div class='chip'>Photo ${i+1}<i class='close material-icons' onclick='removeMaintenanceAttachment(${i})'>close</i></div>`).join('');
}

function openMaintenanceAttachmentViewer(recordId) {
    const arr = maintenanceAttachments[recordId] || [];
    if (!arr.length) {
        M.toast({ html: 'No photos for this record', classes: 'blue' });
        return;
    }
    let viewer = document.getElementById('maintenanceAttachmentViewer');
    if (!viewer) {
        viewer = document.createElement('div');
        viewer.id = 'maintenanceAttachmentViewer';
        viewer.className = 'modal';
        viewer.innerHTML = `
            <div class="modal-content">
                <h5>Maintenance Photos</h5>
                <div id="maintenanceAttachmentViewerContent" class="row" style="margin-top:10px;"></div>
            </div>
            <div class="modal-footer"><button class="modal-close btn-flat">Close</button></div>`;
        document.body.appendChild(viewer);
        M.Modal.init(viewer, {});
    }
    const content = viewer.querySelector('#maintenanceAttachmentViewerContent');
    content.innerHTML = arr.map(a => `
        <div class='col s12 m4'>
            <div class='card' style='overflow:hidden;'>
                <div class='card-image'>
                    <img src='${a.dataUrl}' alt='${a.name}' style='width:100%;object-fit:cover;max-height:200px;'>
                </div>
                <div class='card-content' style='padding:8px;'>
                    <span style='font-size:12px;'>${a.name}</span>
                </div>
            </div>
        </div>`).join('');
    M.Modal.getInstance(viewer).open();
}

loadMaintenanceAttachments();
try { maintenanceDriveFolderId = localStorage.getItem('maintenanceDriveFolderId') || null; } catch(_) {}

async function ensureMaintenanceDriveFolder() {
    if (maintenanceDriveFolderId) return maintenanceDriveFolderId;
    const tokObj = gapi.client && gapi.client.getToken && gapi.client.getToken();
    if (!tokObj) return null;
    try {
        const resp = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer '+tokObj.access_token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Maintenance Photos', mimeType: 'application/vnd.google-apps.folder' })
        });
        if (!resp.ok) throw new Error('Folder create failed');
        const data = await resp.json();
        maintenanceDriveFolderId = data.id;
        localStorage.setItem('maintenanceDriveFolderId', maintenanceDriveFolderId);
        return maintenanceDriveFolderId;
    } catch(e) { console.warn('Drive folder error', e); return null; }
}

async function uploadMaintenancePhotos(recordId) {
    if (!maintenanceModalAttachments.length) return [];
    const tokObj = gapi.client && gapi.client.getToken && gapi.client.getToken();
    if (!tokObj) return [];
    const token = tokObj.access_token;
    const folderId = await ensureMaintenanceDriveFolder();
    const results = [];
    for (const att of maintenanceModalAttachments) {
        try {
            const b64 = att.dataUrl.split(',')[1];
            const meta = { name: `${recordId}_${att.name}` };
            if (folderId) meta.parents = [folderId];
            const boundary = '-------314159265358979323846';
            const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: image/jpeg\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64}\r\n--${boundary}--`;
            const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer '+token, 'Content-Type': 'multipart/related; boundary='+boundary },
                body
            });
            if (!resp.ok) throw new Error('Upload failed');
            const json = await resp.json();
            results.push(json.id);
        } catch(e) { console.warn('Upload failed', e); }
    }
    return results;
}

// Show maintenance history for current asset
function showMaintenanceHistory() {
    const container = document.getElementById('maintenanceHistory');
    
    // Ensure modal exists before rendering content (even if no history)
    if (!document.getElementById('logMaintenanceModal')) {
        createMaintenanceModal();
    }
    
    const assetHistory = maintenanceHistory.filter(record => record.assetId === currentAsset.id);
    
    // Button to log new maintenance event
    let logBtn = `<div style="margin-bottom: 20px; text-align: right;">
        <button class="btn waves-effect waves-light" onclick="openLogMaintenanceModal()">
            <i class="material-icons left">add_circle</i>Log Maintenance Event
        </button>
    </div>`;
    
    if (assetHistory.length === 0) {
        container.innerHTML = `
            ${logBtn}
            <div class="info-card">
                <p class="center-align" style="color: #64748b;">
                    <i class="material-icons" style="font-size: 48px;">build</i><br>
                    No maintenance history available for this asset.
                </p>
            </div>
        `;
        return;
    }
    
    // Sort by date (newest first)
    assetHistory.sort((a, b) => parseDate(b.date) - parseDate(a.date));
    
    container.innerHTML = `
        ${logBtn}
        <h5>Maintenance History</h5>
        ${assetHistory.map(record => {
            const t = record.type.toLowerCase();
            const typeClass = t.includes('preventive') ? 'preventive' : t.includes('corrective') ? 'corrective' : t.includes('emergency') ? 'emergency' : 'routine';
            const attArr = maintenanceAttachments[record.id] || [];
            const thumbs = attArr.slice(0,3).map(a => `<img src='${a.dataUrl}' style='width:50px;height:50px;object-fit:cover;border:1px solid #ccc;border-radius:4px;margin-right:4px;'>`).join('');
            return `
                <div class="maintenance-card">
                    <div style='display:flex;justify-content:space-between;align-items:flex-start;'>
                        <div class="maintenance-type ${typeClass}">${record.type}</div>
                        <div>
                            <button class='btn-flat' style='padding:0 6px;' title='Edit' onclick='editMaintenanceRecord("${record.id}")'><i class='material-icons' style='font-size:20px;'>edit</i></button>
                            <button class='btn-flat' style='padding:0 6px;' title='Delete' onclick='deleteMaintenanceRecord("${record.id}")'><i class='material-icons red-text' style='font-size:20px;'>delete</i></button>
                        </div>
                    </div>
                    <h6 style="margin-top: 6px;">${record.date}</h6>
                    <p style='margin:4px 0'><strong>Technician:</strong> ${record.technician}</p>
                    <p style='margin:4px 0'><strong>Description:</strong> ${record.description}</p>
                    ${record.partsReplaced ? `<p style='margin:4px 0'><strong>Parts Replaced:</strong> ${record.partsReplaced}</p>` : ''}
                    ${record.customerNotification === 'Yes' ? `<p style='margin:4px 0'><strong>Customer Notified</strong></p>` : ''}
                    ${attArr.length ? `<div style='margin-top:6px;'>${thumbs}${attArr.length>3?`<span class='grey-text' style='font-size:12px;'>+${attArr.length-3} more</span>`:''}<div><button class='btn-flat blue-text' style='padding:0 8px;' onclick='openMaintenanceAttachmentViewer("${record.id}")'>View Photos</button></div></div>`:''}
                </div>`;
        }).join('')}
    `;
}

// Create the maintenance modal (only once)
function createMaintenanceModal() {
    const modalDiv = document.createElement('div');
    modalDiv.id = 'logMaintenanceModal';
    modalDiv.className = 'modal modal-fixed-footer';
    modalDiv.style.maxHeight = '85%';
    modalDiv.style.height = 'auto';
    modalDiv.style.minHeight = '500px';
    modalDiv.innerHTML = `
        <div class="modal-content" style="padding-bottom: 0;">
            <h5 style="margin-bottom: 20px;">Log Maintenance Event</h5>
            <form id="logMaintenanceForm" style="margin-bottom: 0;">
                <div class="row">
                    <div class="input-field col s12">
                        <select id="maintenanceType" required>
                            <option value="" disabled selected>Select Type</option>
                               <option value="Preventive">Preventive</option>
                               <option value="Corrective">Corrective</option>
                               <option value="Emergency">Emergency</option>
                               <option value="Maintenance Update/Comment">Maintenance Update/Comment</option>
                        </select>
                        <label>Maintenance Type</label>
                    </div>
                </div>
                <div class="row">
                    <div class="input-field col s12 m6">
                        <input type="text" id="maintenanceDate" class="datepicker" required>
                        <label for="maintenanceDate">Date</label>
                    </div>
                    <div class="input-field col s12 m6">
                        <input type="text" id="maintenanceTechnician" required>
                        <label for="maintenanceTechnician">Technician(s)</label>
                    </div>
                </div>
                <div class="row">
                    <div class="input-field col s12">
                        <textarea id="maintenanceDescription" class="materialize-textarea" required style="min-height: 80px;"></textarea>
                        <label for="maintenanceDescription">Description</label>
                    </div>
                </div>
                <div class="row">
                    <div class="input-field col s12">
                        <input type="text" id="maintenanceParts">
                        <label for="maintenanceParts">Parts Replaced (optional)</label>
                    </div>
                </div>
                <div class="row">
                    <div class="input-field col s12">
                        <input type="text" id="nextMaintenanceDate" class="datepicker">
                        <label for="nextMaintenanceDate">Next Maintenance Date (optional)</label>
                    </div>
                </div>
                   <div class="row">
                       <div class="col s12">
                           <div class="card-panel grey lighten-5" style="border:1px dashed #9e9e9e;">
                               <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                                   <div style="display:flex;align-items:center;gap:8px;">
                                       <i class="material-icons grey-text text-darken-2">photo_camera</i>
                                       <span class="grey-text text-darken-2">Capture or attach photos (optional)</span>
                                   </div>
                                   <div>
                                       <input type="file" id="maintenance-attachments-input" accept="image/*" capture="environment" style="display:none" multiple onchange="handleMaintenanceAttachments(this.files)">
                                       <button type="button" class="btn-small waves-effect" onclick="document.getElementById('maintenance-attachments-input').click()">
                                           <i class="material-icons left">add_a_photo</i>Add Photos
                                       </button>
                                   </div>
                               </div>
                               <div id="maintenance-attachment-list" class="chip-container" style="margin-top:10px">
                                   <span class='grey-text'>No photos attached</span>
                               </div>
                           </div>
                       </div>
                   </div>
                <div class="row" id="customerNotificationField" style="display:none; margin-top:4px;">
                    <div class="col s12">
                        <label style="display:flex; align-items:center; gap:8px; font-weight:500;">
                            <input type="checkbox" id="customerNotification" />
                            <span>Customer notifications required</span>
                        </label>
                    </div>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button type="submit" form="logMaintenanceForm" class="btn waves-effect waves-light" style="margin-right: 10px;">
                <i class="material-icons left">save</i>Submit
            </button>
            <button type="button" class="modal-close btn-flat">Cancel</button>
        </div>
    `;
    document.body.appendChild(modalDiv);
    M.Modal.init(modalDiv, {
        dismissible: true,
        opacity: 0.5,
        inDuration: 250,
        outDuration: 250
    });
}

// Open maintenance modal with form setup
function openLogMaintenanceModal() {
    const modal = M.Modal.getInstance(document.getElementById('logMaintenanceModal'));
    const form = document.getElementById('logMaintenanceForm');
    
    // Reset form & attachments only if not editing
    if (!maintenanceEditingId) {
        form.reset();
        maintenanceModalAttachments = [];
    }
    document.getElementById('customerNotificationField').style.display = 'none';
    refreshMaintenanceAttachmentChips();
    
    // Set default date to today for maintenanceDate only
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB');
    if (!maintenanceEditingId) document.getElementById('maintenanceDate').value = dateStr;
    // Ensure nextMaintenanceDate starts blank
    const nextDateEl = document.getElementById('nextMaintenanceDate');
    if (nextDateEl) nextDateEl.value = '';
    M.updateTextFields();
    
    // Re-initialize Materialize components with delay to ensure DOM is ready
    setTimeout(() => {
        M.FormSelect.init(document.querySelectorAll('#logMaintenanceModal select'));
        // Initialize maintenanceDate with default today, but keep nextMaintenanceDate blank
        const md = document.querySelector('#maintenanceDate');
        if (md) {
            M.Datepicker.init(md, {
                format: 'dd/mm/yyyy',
                autoClose: true,
                defaultDate: today,
                setDefaultDate: true,
                container: document.body
            });
        }
        const nd = document.querySelector('#nextMaintenanceDate');
        if (nd) {
            nd.value = '';
            M.Datepicker.init(nd, {
                format: 'dd/mm/yyyy',
                autoClose: true,
                container: document.body
            });
        }
        M.textareaAutoResize(document.querySelector('#maintenanceDescription'));
        M.updateTextFields();
    }, 100);
    
    // Remove previous submit handler and add new one
    if (form._maintenanceSubmitHandler) {
        form.removeEventListener('submit', form._maintenanceSubmitHandler);
    }
    
    form._maintenanceSubmitHandler = async function(e) {
        e.preventDefault();
        if (form._submitting) {
            M.toast({ html: 'Already submitting…', classes: 'orange' });
            return;
        }
        form._submitting = true;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner" style="display:inline-block;width:18px;height:18px;border:2px solid #fff;border-right-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;vertical-align:middle;margin-right:6px;"></span>Saving';
        }
        
        const type = document.getElementById('maintenanceType').value;
        const date = document.getElementById('maintenanceDate').value;
        const technician = document.getElementById('maintenanceTechnician').value;
        const description = document.getElementById('maintenanceDescription').value;
        const parts = document.getElementById('maintenanceParts').value;
        const nextDate = document.getElementById('nextMaintenanceDate').value;
        const customerNotification = document.getElementById('customerNotification').checked ? 'Yes' : '';
        
        if (!type || !date || !technician || !description) {
            M.toast({html: 'Please fill in all required fields', classes: 'red'});
            return;
        }
        
    // Generate robust unique Record ID (includes ms + random) when creating
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const pad3 = n => n.toString().padStart(3, '0');
    const existing = maintenanceEditingId ? maintenanceHistory.find(r => r.id === maintenanceEditingId) : null;
    const baseId = `${currentAsset.id}-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${pad3(now.getMilliseconds())}-${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`;
    const id = maintenanceEditingId || baseId;
        let existingDriveIds = (existing && existing.attachments) ? existing.attachments : [];
        let uploadedIds = [];
        if (maintenanceModalAttachments.length && typeof gapi !== 'undefined' && gapi.client && gapi.client.getToken && gapi.client.getToken()) {
            uploadedIds = await uploadMaintenancePhotos(id);
        }
        const combinedDriveIds = [...existingDriveIds, ...uploadedIds].filter((v,i,a)=>a.indexOf(v)===i);
        const newRow = [
            id, currentAsset.id, date, type, technician, description, parts, nextDate, customerNotification, combinedDriveIds.join(';')
        ];
        const record = {
            id, assetId: currentAsset.id, date, type, technician, description,
            partsReplaced: parts, nextMaintenanceDate: nextDate, customerNotification,
            attachments: combinedDriveIds
        };
        
        try {
            // Check if user is authenticated before using gapi
            if (typeof gapi !== 'undefined' && gapi.client && gapi.client.getToken && gapi.client.getToken() !== null) {
                if (maintenanceEditingId) {
                    await updateExistingMaintenanceRow(id, newRow);
                } else {
                    await gapi.client.sheets.spreadsheets.values.append({
                        spreadsheetId: GOOGLE_CONFIG.SPREADSHEET_ID,
                        range: `${GOOGLE_CONFIG.SHEETS.MAINTENANCE_HISTORY}!A:J`,
                        valueInputOption: 'USER_ENTERED',
                        insertDataOption: 'INSERT_ROWS',
                        resource: { values: [newRow] }
                    });
                }
                M.toast({html: maintenanceEditingId ? 'Maintenance event updated!' : 'Maintenance event logged!', classes: 'green'});
                if (maintenanceEditingId) {
                    const idx = maintenanceHistory.findIndex(r => r.id === id);
                    if (idx >= 0) maintenanceHistory[idx] = record;
                } else {
                    maintenanceHistory.push(record);
                }
                if (maintenanceModalAttachments.length) {
                    maintenanceAttachments[id] = maintenanceModalAttachments.slice();
                    persistMaintenanceAttachments();
                }
                showMaintenanceHistory();
                modal.close();
            } else {
                // Save locally if not authenticated
                let queue = [];
                try { queue = JSON.parse(localStorage.getItem('localMaintenance') || '[]'); } catch(_) { queue = []; }
                queue.push({ values: [newRow] });
                localStorage.setItem('localMaintenance', JSON.stringify(queue));
                if (maintenanceEditingId) {
                    const idx = maintenanceHistory.findIndex(r => r.id === id);
                    if (idx >= 0) maintenanceHistory[idx] = record; else maintenanceHistory.push(record);
                } else {
                    maintenanceHistory.push(record);
                }
                if (maintenanceModalAttachments.length) {
                    maintenanceAttachments[id] = maintenanceModalAttachments.slice();
                    persistMaintenanceAttachments();
                }
                showMaintenanceHistory();
                modal.close();
                M.toast({html: maintenanceEditingId ? 'Updated locally (sync on sign-in).' : 'Saved locally. Sign in to sync to Google Sheets.', classes: 'blue'});
            }
        } catch (err) {
            console.error('Error logging maintenance:', err);
            M.toast({html: 'Error logging maintenance event', classes: 'red'});
        } finally {
            form._submitting = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        }
        maintenanceEditingId = null;
    };
    
    form.addEventListener('submit', form._maintenanceSubmitHandler);
    modal.open();
}

// Show/hide customer notification checkbox based on maintenance type
document.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'maintenanceType') {
        const val = e.target.value;
        const field = document.getElementById('customerNotificationField');
        if (field) {
            field.style.display = (val === 'Emergency') ? 'block' : 'none';
        }
    }
});

// Make functions available globally for onclick handlers
window.openLogMaintenanceModal = openLogMaintenanceModal;
window.showMaintenanceHistory = showMaintenanceHistory;
window.handleMaintenanceAttachments = handleMaintenanceAttachments;
window.removeMaintenanceAttachment = removeMaintenanceAttachment;
window.openMaintenanceAttachmentViewer = openMaintenanceAttachmentViewer;
window.editMaintenanceRecord = editMaintenanceRecord;
window.deleteMaintenanceRecord = deleteMaintenanceRecord;

async function fetchAllMaintenanceRows() {
    const resp = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: GOOGLE_CONFIG.SPREADSHEET_ID,
        range: `${GOOGLE_CONFIG.SHEETS.MAINTENANCE_HISTORY}!A2:J`
    });
    return resp.result.values || [];
}

async function updateExistingMaintenanceRow(recordId, rowValues) {
    const rows = await fetchAllMaintenanceRows();
    const idx = rows.findIndex(r => r[0] === recordId);
    if (idx === -1) throw new Error('Record not found');
    const rowNum = idx + 2; // header offset
    const range = `${GOOGLE_CONFIG.SHEETS.MAINTENANCE_HISTORY}!A${rowNum}:J${rowNum}`;
    await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: GOOGLE_CONFIG.SPREADSHEET_ID,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [rowValues] }
    });
}

async function markMaintenanceRowDeleted(recordId) {
    const rows = await fetchAllMaintenanceRows();
    const idx = rows.findIndex(r => r[0] === recordId);
    if (idx === -1) throw new Error('Record not found');
    const rowNum = idx + 2;
    const existing = rows[idx];
    existing[3] = 'Deleted';
    existing[5] = '[DELETED] ' + (existing[5] || '');
    const range = `${GOOGLE_CONFIG.SHEETS.MAINTENANCE_HISTORY}!A${rowNum}:J${rowNum}`;
    await gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: GOOGLE_CONFIG.SPREADSHEET_ID,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [existing] }
    });
}

function editMaintenanceRecord(recordId) {
    const rec = maintenanceHistory.find(r => r.id === recordId);
    if (!rec) return;
    maintenanceEditingId = recordId;
    openLogMaintenanceModal();
    setTimeout(() => {
        document.getElementById('maintenanceType').value = rec.type;
        document.getElementById('maintenanceDate').value = rec.date;
        document.getElementById('maintenanceTechnician').value = rec.technician;
        document.getElementById('maintenanceDescription').value = rec.description;
        document.getElementById('maintenanceParts').value = rec.partsReplaced || '';
        document.getElementById('nextMaintenanceDate').value = rec.nextMaintenanceDate || '';
        document.getElementById('customerNotification').checked = rec.customerNotification === 'Yes';
        maintenanceModalAttachments = (maintenanceAttachments[recordId] || []).slice();
        M.updateTextFields();
        refreshMaintenanceAttachmentChips();
        M.FormSelect.init(document.querySelectorAll('#logMaintenanceModal select'));
    }, 120);
}

async function deleteMaintenanceRecord(recordId) {
    if (!confirm('Delete this maintenance record? Row will be marked Deleted.')) return;
    try {
        if (typeof gapi !== 'undefined' && gapi.client && gapi.client.getToken && gapi.client.getToken()) {
            await markMaintenanceRowDeleted(recordId);
        }
        const idx = maintenanceHistory.findIndex(r => r.id === recordId);
        if (idx >= 0) maintenanceHistory.splice(idx,1);
        delete maintenanceAttachments[recordId];
        persistMaintenanceAttachments();
        showMaintenanceHistory();
        M.toast({ html: 'Record deleted', classes: 'green' });
    } catch (e) {
        console.error('Delete failed', e);
        M.toast({ html: 'Failed to delete record', classes: 'red' });
    }
}
