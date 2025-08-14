// Test Execution and Management Module

let currentTest = null;
let testResults = {};
let wizardMode = true;
let currentWizardStep = 0;
let currentTestStep = 0;
// Local attachments cache by session timestamp and step number
let attachmentsBySession = {};
// Autosave timer id
let _autosaveTimer = null;

// Start a test procedure
function startTest(procedureId) {
    console.log('Starting test:', procedureId);
    // If preview modal is open, close it first
    const previewEl = document.getElementById('testPreviewModal');
    if (previewEl) {
        let previewInst = M.Modal.getInstance(previewEl);
        if (!previewInst) {
            previewInst = M.Modal.init(previewEl);
        }
        try { previewInst.close(); } catch (e) { /* noop */ }
        // Remove preview modal after closing to avoid duplicates
        setTimeout(() => { if (previewEl && previewEl.parentNode) previewEl.parentNode.removeChild(previewEl); }, 300);
    }
    
    currentTest = testProcedures.find(p => p.id === procedureId);
    if (!currentTest) {
        console.error('Test procedure not found:', procedureId);
        M.toast({html: 'Error: Test procedure not found', classes: 'red'});
        return;
    }
    
    // Check for saved progress
    const progressLoaded = loadTestProgress();
    
    if (!progressLoaded) {
        // Initialize test results
        testResults = {
            assetId: currentAsset.id,
            procedureId: currentTest.id,
            date: new Date().toLocaleDateString('en-GB'),
            technicians: [],
            contractors: [],
            // Store contractor companies parallel to contractors for clearer structure.
            // We'll still output combined "Name (Company)" strings for display and export.
            contractorCompanies: [],
            steps: {},
            notes: '',
            timestamp: new Date().toISOString()
        };
        // Initialize attachments map for this session
        attachmentsBySession[testResults.timestamp] = attachmentsBySession[testResults.timestamp] || {};
        
        // Reset wizard step
        currentWizardStep = 0;
    }
    // Ensure attachments are loaded and session bucket exists
    if (typeof loadPersistedAttachments === 'function') {
        loadPersistedAttachments();
    }
    if (testResults && testResults.timestamp) {
        attachmentsBySession[testResults.timestamp] = attachmentsBySession[testResults.timestamp] || {};
    }
    
    // Update modal content
    const procedureNameEl = document.getElementById('testProcedureName');
    if (procedureNameEl) {
        procedureNameEl.textContent = currentTest.name;
    }
    
    // Setup wizard mode toggle
    const wizardToggle = document.getElementById('wizardModeToggle');
    if (wizardToggle) {
        wizardToggle.checked = wizardMode;
        wizardToggle.addEventListener('change', function() {
            wizardMode = this.checked;
            renderTestContent();
        });
    }
    
    renderTestContent();
    // Late-load contractors directory if empty, then refresh personnel step
    try {
        const dirKeys = Object.keys(window.contractorsDirectory || {});
        if (!dirKeys.length && typeof loadContractorsDirectory === 'function') {
            console.log('[Contractors] Directory empty at test start; attempting late load');
            loadContractorsDirectory().then(() => {
                if (wizardMode && currentWizardStep === 0) {
                    console.log('[Contractors] Directory loaded; refreshing personnel step');
                    renderTestContent();
                }
            }).catch(e => console.warn('Late contractor load failed', e));
        }
    } catch(_) {}
    
    // Close asset modal
    const assetModal = M.Modal.getInstance(document.getElementById('assetModal'));
    if (assetModal) assetModal.close();
    
    // Open test modal after a short delay
    setTimeout(() => {
        const testModal = M.Modal.getInstance(document.getElementById('testModal'));
        if (testModal) testModal.open();

        // Ensure Cancel saves progress before closing
        const cancelBtn = document.getElementById('cancelTest');
        if (cancelBtn && !cancelBtn._boundSaveHandler) {
            cancelBtn.addEventListener('click', () => {
                if (typeof saveTestProgress === 'function') saveTestProgress();
            });
            cancelBtn._boundSaveHandler = true;
        }

        // Start autosave timer
        if (_autosaveTimer) clearInterval(_autosaveTimer);
        const interval = (window.APP_CONFIG && window.APP_CONFIG.SETTINGS && window.APP_CONFIG.SETTINGS.AUTO_SAVE_INTERVAL) || 30000;
        _autosaveTimer = setInterval(() => {
            try { if (typeof saveTestProgress === 'function') saveTestProgress(); } catch(_) {}
        }, interval);

        // Save when tab/window is being hidden or closed
        if (!window._boundVisibilitySave) {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    try { if (typeof saveTestProgress === 'function') saveTestProgress(); } catch(_) {}
                }
            });
            window._boundVisibilitySave = true;
        }
        if (!window._boundBeforeUnloadSave) {
            window.addEventListener('beforeunload', () => {
                try { if (typeof saveTestProgress === 'function') saveTestProgress(); } catch(_) {}
            });
            window._boundBeforeUnloadSave = true;
        }
    }, 300);
}

// Preview test procedure without starting
function previewTest(procedureId) {
    const procedure = testProcedures.find(p => p.id === procedureId);
    if (!procedure) {
        M.toast({html: 'Test procedure not found', classes: 'red'});
        return;
    }
    
    // Show preview modal or detailed view
    const previewHtml = `
        <div class="modal modal-fixed-footer" id="testPreviewModal" style="width:80%; max-width: 1000px;">
            <div class="modal-content" style="max-height: 70vh; overflow-y: auto;">
                <h4>${procedure.name}</h4>
                <p><strong>Asset Type:</strong> ${procedure.assetType}</p>
                <p><strong>Estimated Duration:</strong> ${procedure.estimatedDuration} minutes</p>
                <p><strong>Steps:</strong> ${procedure.steps.length}</p>
                
                <h5>Procedure Steps:</h5>
                <ol>
                    ${procedure.steps.map(step => `
                        <li>
                            <strong>Step ${step.stepNumber}:</strong> ${step.description}
                            ${step.expectedResult ? `<br><em>Expected: ${step.expectedResult}</em>` : ''}
                            ${step.warningNotes ? `<br><strong>Warning:</strong> ${step.warningNotes}` : ''}
                        </li>
                    `).join('')}
                </ol>
            </div>
            <div class="modal-footer">
                <button class="modal-close btn-flat">Cancel</button>
                <button class="btn waves-effect waves-light" onclick="startTest('${procedureId}')">Start Test</button>
            </div>
        </div>
    `;
    
    // Remove existing preview modal
    const existingModal = document.getElementById('testPreviewModal');
    if (existingModal) existingModal.remove();
    
    // Add new modal
    document.body.insertAdjacentHTML('beforeend', previewHtml);
    const modal = M.Modal.init(document.getElementById('testPreviewModal'));
    modal.open();
}

// Render test content based on mode
function renderTestContent() {
    const container = document.getElementById('testContent');
    if (!container || !currentTest) return;
    
    if (wizardMode) {
        renderWizardMode(container);
    } else {
    renderClassicMode(container);
    }

    // Toggle footer buttons visibility based on wizard step
    const submitBtn = document.getElementById('submitTest');
    const cancelBtn = document.getElementById('cancelTest');
    if (submitBtn && cancelBtn) {
        if (wizardMode) {
            const totalSteps = currentTest.steps.length + 2; // personnel + steps + summary
            const onSummary = currentWizardStep === totalSteps - 1;
            submitBtn.style.display = onSummary ? 'inline-block' : 'none';
            cancelBtn.style.display = onSummary ? 'none' : 'inline-block';
        } else {
            // In classic mode, show Submit & Cancel together
            submitBtn.style.display = 'inline-block';
            cancelBtn.style.display = 'inline-block';
        }
    }
}

// Classic mode: single page showing personnel, all steps, and a summary/notes section.
function renderClassicMode(container) {
    let content = '<div class="classic-mode">';
    content += '<div class="card-panel blue lighten-5" style="padding:8px 16px; margin-bottom:16px;"><strong>Classic Mode:</strong> All steps are on one page. Scroll to complete each result, then click Submit below.</div>';
    // Personnel
    content += renderPersonnelStep();
    // Steps
    (currentTest.steps || []).forEach(step => {
        content += renderWizardStep(step);
    });
    // Overall notes & summary area mimicking summary step layout
    content += '<div class="summary-step" style="margin-top:24px;">'
        + '<h5><i class="material-icons left">assignment</i>Overall Notes</h5>'
        + `<div class="input-field">
                <textarea id="overallNotesClassic" class="materialize-textarea" onchange="testResults.notes=this.value">${testResults.notes || ''}</textarea>
                <label for="overallNotesClassic" class="${testResults.notes ? 'active' : ''}">Final Notes</label>
           </div>`
        + '</div>';
    content += '</div>';
    container.innerHTML = content;
    // Init Materialize components
    M.FormSelect.init(container.querySelectorAll('select'));
    M.updateTextFields();
}

// Render wizard mode interface
function renderWizardMode(container) {
    const totalSteps = currentTest.steps.length + 2; // personnel + steps + summary
    const progressPercent = ((currentWizardStep + 1) / totalSteps) * 100;
    
    let content = `
        <div class="wizard-progress">
            <div class="progress">
                <div class="determinate" style="width: ${progressPercent}%"></div>
            </div>
            <p class="center-align">Step ${currentWizardStep + 1} of ${totalSteps}</p>
        </div>
        
        <div id="stepValidationMessage" class="card-panel amber lighten-4" style="display: none;">
            <span id="validationText"></span>
        </div>
    `;
    
    if (currentWizardStep === 0) {
        // Personnel step
        content += renderPersonnelStep();
    } else if (currentWizardStep <= currentTest.steps.length) {
        // Test steps
        const step = currentTest.steps[currentWizardStep - 1];
        content += renderWizardStep(step);
    } else {
        // Summary step
        content += renderSummaryStep();
    }
    
    // Navigation buttons (no Finish inside wizard; Submit is in footer on summary step)
    content += `
        <div class="wizard-navigation">
            <div class="row">
                <div class="col s6">
                    <button id="prevBtn" class="btn-flat waves-effect" 
                            onclick="previousStep()" 
                            ${currentWizardStep === 0 ? 'disabled' : ''}>
                        <i class="material-icons left">chevron_left</i>Previous
                    </button>
                </div>
                <div class="col s6 right-align">
                    ${currentWizardStep < totalSteps - 1 ? 
                        `<button id="nextBtn" class="btn waves-effect waves-light" onclick="nextStep()">
                            Next<i class="material-icons right">chevron_right</i>
                        </button>` : ''}
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = content;
    
    // Initialize components
    M.FormSelect.init(document.querySelectorAll('select'));
    M.updateTextFields();
    // Start each wizard page at the top
    if (typeof scrollModalToTop === 'function') scrollModalToTop();
}

// Render personnel step
function renderPersonnelStep() {
    const assetTypeKey = (currentAsset?.type || '').trim().toLowerCase();
    const dirList = (window.contractorsDirectory && window.contractorsDirectory[assetTypeKey]) || [];
    const companyList = Array.from(new Set(dirList.map(c => c.company).filter(Boolean))).sort();
    let fallbackUsed = false;
    if (!companyList.length && window.contractorsDirectory) {
        const allCompanies = Array.from(new Set(Object.values(window.contractorsDirectory).flat().map(c => c.company).filter(Boolean))).sort();
        if (allCompanies.length) {
            fallbackUsed = true;
            allCompanies.forEach(c => { if (!companyList.includes(c)) companyList.push(c); });
        }
    }
    console.log('[Contractors] renderPersonnelStep', { assetTypeKey, dirListCount: dirList.length, companyList, fallbackUsed, directoryKeys: Object.keys(window.contractorsDirectory || {}) });
    return `
        <div class="personnel-step">
            <h5><i class="material-icons left">people</i>Personnel Information</h5>
            <p>Add at least one technician or contractor to proceed.</p>
            <div class="row">
                <div class="col s12 m6">
                    <h6>Technicians</h6>
                    ${[1, 2, 3].map(i => `
                        <div class="input-field">
                            <input type="text" id="technician${i}" 
                                   value="${testResults.technicians[i-1] || ''}"
                                   onchange="updatePersonnel()">
                            <label for="technician${i}" class="${testResults.technicians[i-1] ? 'active' : ''}">
                                Technician ${i}${i === 1 ? ' (required if no contractors)' : ' (optional)'}
                            </label>
                        </div>
                    `).join('')}
                </div>
                <div class="col s12 m6">
                    <h6>Contractors</h6>
                    <p class="grey-text text-darken-1" style="margin-top:0;">Enter contractor name (free text) and choose the company from the approved list.</p>
                    ${[1, 2, 3].map(i => `
                        <div class="row" style="margin-bottom:0; position:relative;">
                            <div class="input-field col s7" style="padding-left:0;">
                                <input type=\"text\" id=\"contractor${i}\" 
                                       value="${(function(){
                                            const formatted = testResults.contractors[i-1] || '';
                                            const companyVal = (testResults.contractorCompanies && testResults.contractorCompanies[i-1]) || '';
                                            if (!formatted) return '';
                                            if (companyVal && formatted.endsWith('(' + companyVal + ')')) {
                                                return formatted.replace(/\s*\([^)]*\)$/, '');
                                            }
                                            return formatted.replace(/\s*\([^)]*\)$/, '');
                                       })()}"
                                       onchange="updatePersonnel()" autocomplete="off">
                                <label for="contractor${i}" class="${testResults.contractors[i-1] ? 'active' : ''}">
                                    Contractor ${i} Name${i === 1 ? ' (req. if no techs)' : ''}
                                </label>
                            </div>
                            <div class="input-field col s5" style="padding-right:0;">
                                <select id="contractor${i}Company" onchange="updatePersonnel()">
                                    <option value="" ${!(testResults.contractorCompanies && testResults.contractorCompanies[i-1]) ? 'selected' : ''}>Select Company</option>
                                    ${companyList.map(co => {
                                        const prev = (testResults.contractorCompanies && testResults.contractorCompanies[i-1]) || '';
                                        const sel = co === prev ? 'selected' : '';
                                        return `<option value="${co}" ${sel}>${co}</option>`;
                                    }).join('')}
                                    ${(function(){
                                        const prev = (testResults.contractorCompanies && testResults.contractorCompanies[i-1]) || '';
                                        if (prev && !companyList.includes(prev)) {
                                            return `<option value="${prev}" selected>${prev} (legacy)</option>`;
                                        }
                                        return '';
                                    })()}
                                </select>
                                <label>Company</label>
                            </div>
                        </div>
                    `).join('')}
                            <!-- Helper example text removed as requested -->
                            <!-- Directory status panel removed as per request -->
                </div>
            </div>
        </div>
    `;
}

// Update personnel arrays from inputs, formatting contractors as Name (Company)
function updatePersonnel() {
    // Technicians
    const techs = [1,2,3].map(i => (document.getElementById(`technician${i}`)?.value || '').trim()).filter(v => v);
    testResults.technicians = techs;
    // Contractors & companies
    const contractorNames = [1,2,3].map(i => (document.getElementById(`contractor${i}`)?.value || '').trim());
    const contractorCompanies = [1,2,3].map(i => (document.getElementById(`contractor${i}Company`)?.value || '').trim());
    testResults.contractorCompanies = contractorCompanies;
    // Build formatted array; skip empty name rows entirely
    const formatted = contractorNames.map((name, idx) => {
        if (!name) return '';
        const company = contractorCompanies[idx];
        return company ? `${name} (${company})` : name;
    }).filter(v => v);
    testResults.contractors = formatted;
    // Simple validation message toggle
    const valid = (testResults.technicians && testResults.technicians.length) || (formatted.length);
    const msgBox = document.getElementById('stepValidationMessage');
    const msgText = document.getElementById('validationText');
    if (msgBox && msgText) {
        if (!valid) {
            msgText.textContent = 'Please add at least one technician or contractor.';
            msgBox.style.display = 'block';
        } else {
            msgBox.style.display = 'none';
        }
    }
    // Autosave after change if feature exists
    if (typeof scheduleAutosave === 'function') scheduleAutosave();

    // In classic mode, refresh performer checkbox lists for every step without re-rendering whole content
    try {
        if (!wizardMode && currentTest && Array.isArray(currentTest.steps)) {
            const allPersonnel = [
                ...testResults.technicians.filter(Boolean).map(t => `Technician: ${t}`),
                ...testResults.contractors.filter(Boolean).map(c => `Contractor: ${c}`)
            ];
            currentTest.steps.forEach(step => {
                const container = document.getElementById(`step-${step.stepNumber}-performers`);
                if (!container) return;
                const stepData = (testResults.steps && testResults.steps[step.stepNumber]) || {};
                container.innerHTML = allPersonnel.length ? allPersonnel.map(person => {
                    const checked = Array.isArray(stepData.performers) && stepData.performers.includes(person);
                    const id = `chk-${step.stepNumber}-${person.replace(/[^a-z0-9]+/gi,'_')}`;
                    return `
                        <p style="margin:4px 0;">
                            <label>
                                <input type="checkbox" id="${id}" value="${person}" ${checked ? 'checked' : ''}
                                       onchange="updateStepPerformers(${step.stepNumber})"/>
                                <span>${person}</span>
                            </label>
                        </p>`;
                }).join('') : '<div class="grey-text">Add personnel above to enable selection.</div>';
            });
        }
    } catch (e) { console.warn('Classic mode performer refresh failed', e); }
}
// (Suggestion dropdown removed: company now restricted to select list; name free-form)

// Render individual test step
function renderWizardStep(step) {
    const stepData = testResults.steps[step.stepNumber] || {};
    const allPersonnel = [
        ...testResults.technicians.filter(Boolean).map(t => `Technician: ${t}`),
        ...testResults.contractors.filter(Boolean).map(c => `Contractor: ${c}`)
    ];
    const sessionKey = testResults.timestamp;
    const stepAtt = (attachmentsBySession[sessionKey] && attachmentsBySession[sessionKey][step.stepNumber]) || [];
    const fieldsHtml = (step.fields && step.fields.length) ? (() => {
        const controls = step.fields.map(f => {
            const fv = (stepData.fieldValues && stepData.fieldValues[f.key]) || '';
            const requiredMark = f.required ? ' <span class="red-text" title="Required">*</span>' : '';
            const colClass = (f.type === 'multiline') ? 'col s12' : 'col s12 m6 l4';
            if (f.type === 'number') {
                return `<div class="${colClass}">
                    <div class="input-field" style="margin-top:0;">
                        <input type="number" id="field-${step.stepNumber}-${f.key}" value="${fv}" onchange="updateStepField(${step.stepNumber}, '${f.key}', this.value)">
                        <label for="field-${step.stepNumber}-${f.key}" class="${fv ? 'active' : ''}">${f.label || f.key}${requiredMark}${f.unit ? ' ('+f.unit+')' : ''}</label>
                    </div>
                </div>`;
            } else if (f.type === 'select' && Array.isArray(f.options)) {
                return `<div class="${colClass}">
                    <div class="input-field" style="margin-top:0;">
                        <select id="field-${step.stepNumber}-${f.key}" onchange="updateStepField(${step.stepNumber}, '${f.key}', this.value)">
                            <option value="">${f.required ? 'Select *' : 'Select'}</option>
                            ${f.options.map(o => `<option value="${o}" ${o===fv?'selected':''}>${o}</option>`).join('')}
                        </select>
                        <label>${f.label || f.key}${requiredMark}</label>
                    </div>
                </div>`;
            } else if (f.type === 'multiline') {
                return `<div class="${colClass}">
                    <div class="input-field" style="margin-top:0;">
                        <textarea id="field-${step.stepNumber}-${f.key}" class="materialize-textarea" onchange="updateStepField(${step.stepNumber}, '${f.key}', this.value)">${fv}</textarea>
                        <label for="field-${step.stepNumber}-${f.key}" class="${fv ? 'active' : ''}">${f.label || f.key}${requiredMark}</label>
                    </div>
                </div>`;
            }
            // text default
            return `<div class="${colClass}">
                <div class="input-field" style="margin-top:0;">
                    <input type="text" id="field-${step.stepNumber}-${f.key}" value="${fv}" onchange="updateStepField(${step.stepNumber}, '${f.key}', this.value)">
                    <label for="field-${step.stepNumber}-${f.key}" class="${fv ? 'active' : ''}">${f.label || f.key}${requiredMark}</label>
                </div>
            </div>`;
        }).join('');
        return `<div class="card-panel teal lighten-5" style="padding:12px 16px; margin-top:12px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <i class="material-icons teal-text text-darken-2">tune</i>
                <strong>Recorded Values</strong>
            </div>
            <div class="row" style="margin-bottom:0;">${controls}</div>
        </div>`;
    })() : '';
    // Pretty multi-line description if merged
    const descParts = (step.description || '').split(' / ').filter(Boolean);
    const descriptionBlock = descParts.length > 1
        ? `<ul style="margin:4px 0 8px 18px;">${descParts.map(d => `<li>${d}</li>`).join('')}</ul>`
        : `<p><strong>Description:</strong> ${step.description}</p>`;
    
    return `
        <div class="test-step">
            <h5>Step ${step.stepNumber}</h5>
            <div class="step-description">
                ${descriptionBlock}
                ${step.expectedResult ? `<p><strong>Expected Result:</strong> ${step.expectedResult}</p>` : ''}
                ${step.warningNotes ? `
                    <div class="card-panel orange lighten-4">
                        <span class="orange-text text-darken-2">
                            <i class="material-icons left">warning</i>
                            <strong>Warning:</strong> ${step.warningNotes}
                        </span>
                    </div>
                ` : ''}
                ${step.imageUrl ? `
                    <div class="card-panel blue lighten-5" style="border: 1px dashed #2196f3;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                            <div style="display:flex;align-items:center;gap:8px;">
                                <i class="material-icons blue-text text-darken-2">image</i>
                                <span class="blue-text text-darken-2">This step has a reference image.</span>
                            </div>
                            <a href="#!" class="btn-small waves-effect waves-light" onclick="event.preventDefault(); showImage('${step.imageUrl}')">
                                <i class="material-icons left">visibility</i>View Image
                            </a>
                        </div>
                    </div>
                ` : ''}
                ${fieldsHtml}
            </div>
            
            <div class="step-inputs">
                <div class="row">
                    <div class="col s12 m6">
                        <label>Result</label>
                        <p>
                            <label>
                                <input type="radio" name="step-${step.stepNumber}-result" 
                                       value="pass" ${stepData.result === 'pass' ? 'checked' : ''}
                                       onchange="updateStepResult(${step.stepNumber}, 'pass')">
                                <span>Pass/Done</span>
                            </label>
                        </p>
                        <p>
                            <label>
                                <input type="radio" name="step-${step.stepNumber}-result" 
                                       value="fail" ${stepData.result === 'fail' ? 'checked' : ''}
                                       onchange="updateStepResult(${step.stepNumber}, 'fail')">
                                <span>Fail</span>
                            </label>
                        </p>
                    </div>
                    <div class="col s12 m6">
                        <label>Verified By</label>
                        <div id="step-${step.stepNumber}-performers" class="person-checkboxes" style="padding-top:6px;">
                            ${allPersonnel.length ? allPersonnel.map(person => {
                                const checked = Array.isArray(stepData.performers) && stepData.performers.includes(person);
                                const id = `chk-${step.stepNumber}-${person.replace(/[^a-z0-9]+/gi,'_')}`;
                                return `
                                    <p style="margin:4px 0;">
                                        <label>
                                            <input type="checkbox" id="${id}" value="${person}" ${checked ? 'checked' : ''}
                                                   onchange="updateStepPerformers(${step.stepNumber})"/>
                                            <span>${person}</span>
                                        </label>
                                    </p>`;
                            }).join('') : '<div class="grey-text">Add personnel on the first step to enable selection.</div>'}
                        </div>
                    </div>
                </div>
                
                <div class="input-field">
                    <textarea id="step-${step.stepNumber}-notes" 
                              class="materialize-textarea"
                              onchange="updateStepNotes(${step.stepNumber}, this.value)">${stepData.notes || ''}</textarea>
                    <label for="step-${step.stepNumber}-notes" class="${stepData.notes ? 'active' : ''}">
                        Notes (optional)
                    </label>
                </div>

                <div class="card-panel grey lighten-5" style="border: 1px dashed #9e9e9e;">
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <i class="material-icons grey-text text-darken-2">photo_camera</i>
                            <span class="grey-text text-darken-2">Capture or attach photos (optional)</span>
                        </div>
                        <div>
                            <input type="file" id="file-${step.stepNumber}" accept="image/*" capture="environment" style="display:none" multiple onchange="handleStepAttachments(${step.stepNumber}, this.files)">
                            <button class="btn-small waves-effect" onclick="document.getElementById('file-${step.stepNumber}').click()">
                                <i class="material-icons left">add_a_photo</i>Add Photos
                            </button>
                        </div>
                    </div>
                    <div id="att-list-${step.stepNumber}" class="chip-container" style="margin-top:10px">
                        ${stepAtt.map((_, idx) => `<div class='chip'>Photo ${idx+1}<i class='close material-icons' onclick='removeStepAttachment(${step.stepNumber}, ${idx})'>close</i></div>`).join('')}
                        ${stepAtt.length === 0 ? '<span class="grey-text">No photos attached</span>' : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Update dynamic field value for a step
function updateStepField(stepNumber, key, value) {
    if (!testResults.steps[stepNumber]) testResults.steps[stepNumber] = {};
    if (!testResults.steps[stepNumber].fieldValues) testResults.steps[stepNumber].fieldValues = {};
    testResults.steps[stepNumber].fieldValues[key] = value;
    if (typeof saveTestProgress === 'function') saveTestProgress();
}

// Render summary step
function renderSummaryStep() {
    const passedSteps = Object.values(testResults.steps).filter(s => s.result === 'pass').length;
    const failedSteps = Object.values(testResults.steps).filter(s => s.result === 'fail').length;
    const totalSteps = currentTest.steps.length;
    const overallStatus = failedSteps === 0 ? 'passed' : 'failed';
    
    return `
        <div class="test-summary">
            <h5>Test Summary</h5>
            
            <div class="card-panel ${overallStatus === 'passed' ? 'green' : 'red'} lighten-4">
                <h6 class="${overallStatus === 'passed' ? 'green' : 'red'}-text text-darken-2">
                    <i class="material-icons left">${overallStatus === 'passed' ? 'check_circle' : 'cancel'}</i>
                    Test ${overallStatus.toUpperCase()}
                </h6>
            </div>
            
            <div class="row">
                <div class="col s12 m6">
                    <h6>Test Information</h6>
                    <p><strong>Asset:</strong> ${currentAsset.name}</p>
                    <p><strong>Procedure:</strong> ${currentTest.name}</p>
                    <p><strong>Date:</strong> ${testResults.date}</p>
                </div>
                <div class="col s12 m6">
                    <h6>Results</h6>
                    <p><strong>Pass/Done:</strong> ${passedSteps} / ${totalSteps} steps</p>
                    <p><strong>Failed:</strong> ${failedSteps} / ${totalSteps} steps</p>
                </div>
            </div>
            
            <h6>Personnel</h6>
            <ul>
                ${testResults.technicians.map(t => `<li>Technician: ${t}</li>`).join('')}
                ${testResults.contractors.map(c => `<li>Contractor: ${c}</li>`).join('')}
            </ul>
            
            <div class="input-field">
                <textarea id="testNotes" class="materialize-textarea" 
                          onchange="testResults.notes = this.value">${testResults.notes}</textarea>
                <label for="testNotes" class="${testResults.notes ? 'active' : ''}">
                    Additional Notes (optional)
                </label>
            </div>
        </div>
    `;
}

// Update step result
function updateStepResult(stepNumber, result) {
    if (!testResults.steps[stepNumber]) {
        testResults.steps[stepNumber] = {};
    }
    testResults.steps[stepNumber].result = result;
    testResults.steps[stepNumber].performedAt = new Date().toLocaleString();
    saveTestProgress();
}

// Update step performer
function updateStepPerformer(stepNumber, performer) {
    if (!testResults.steps[stepNumber]) {
        testResults.steps[stepNumber] = {};
    }
    testResults.steps[stepNumber].performer = performer;
    saveTestProgress();
}

// Update multiple performers (verifiers) for a step
function updateStepPerformers(stepNumber) {
    if (!testResults.steps[stepNumber]) {
        testResults.steps[stepNumber] = {};
    }
    const container = document.getElementById(`step-${stepNumber}-performers`);
    if (!container) return;
    const selected = Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    testResults.steps[stepNumber].performers = selected;
    if (selected.length && !testResults.steps[stepNumber].performedAt) {
        testResults.steps[stepNumber].performedAt = new Date().toLocaleString();
    }
    saveTestProgress();
}

// Update step notes
function updateStepNotes(stepNumber, notes) {
    if (!testResults.steps[stepNumber]) {
        testResults.steps[stepNumber] = {};
    }
    testResults.steps[stepNumber].notes = notes;
    saveTestProgress();
}

// Handle adding attachments for a given step (compress + store in localStorage)
async function handleStepAttachments(stepNumber, fileList) {
    try {
        if (!fileList || fileList.length === 0) return;
        const sessionKey = testResults.timestamp;
        attachmentsBySession[sessionKey] = attachmentsBySession[sessionKey] || {};
        attachmentsBySession[sessionKey][stepNumber] = attachmentsBySession[sessionKey][stepNumber] || [];
        const files = Array.from(fileList);
        for (const f of files) {
            // Only accept image/*
            if (!f.type || !f.type.startsWith('image/')) continue;
            const dataUrl = await imageFileToDataUrlCompressed(f, { maxDimension: 1600, quality: 0.7 });
            attachmentsBySession[sessionKey][stepNumber].push({
                name: f.name,
                type: 'image/jpeg',
                dataUrl,
                addedAt: new Date().toISOString()
            });
        }
        persistAttachments();
        refreshAttachmentChips(stepNumber);
        M.toast({ html: `Attached ${files.length} photo(s)`, classes: 'green' });
    } catch (e) {
        console.error('Attachment error', e);
        M.toast({ html: 'Failed to attach photo(s)', classes: 'red' });
    }
}

function removeStepAttachment(stepNumber, index) {
    const sessionKey = testResults.timestamp;
    const arr = attachmentsBySession[sessionKey]?.[stepNumber];
    if (!arr) return;
    arr.splice(index, 1);
    persistAttachments();
    refreshAttachmentChips(stepNumber);
}

function refreshAttachmentChips(stepNumber) {
    const container = document.getElementById(`att-list-${stepNumber}`);
    const sessionKey = testResults.timestamp;
    const arr = (attachmentsBySession[sessionKey] && attachmentsBySession[sessionKey][stepNumber]) || [];
    if (!container) return;
    if (arr.length === 0) {
        container.innerHTML = '<span class="grey-text">No photos attached</span>';
        return;
    }
    container.innerHTML = arr.map((_, idx) => `<div class='chip'>Photo ${idx+1}<i class='close material-icons' onclick='removeStepAttachment(${stepNumber}, ${idx})'>close</i></div>`).join('');
}

function persistAttachments() {
    try {
        const key = 'testStepAttachments';
        localStorage.setItem(key, JSON.stringify(attachmentsBySession));
    } catch (e) {
        console.warn('Could not persist attachments', e);
    }
}

function loadPersistedAttachments() {
    try {
        const key = 'testStepAttachments';
        const raw = localStorage.getItem(key);
        attachmentsBySession = raw ? JSON.parse(raw) : {};
    } catch (e) {
        attachmentsBySession = {};
    }
}

// Save test progress to localStorage
function saveTestProgress() {
    if (!currentTest || !currentAsset) return;
    
    const progressKey = `testProgress_${currentAsset.id}_${currentTest.id}`;
    const progressData = {
        testResults: testResults,
        currentWizardStep: currentWizardStep,
        wizardMode: wizardMode,
        savedAt: new Date().toISOString(),
        assetName: currentAsset.name,
        procedureName: currentTest.name
    };
    
    localStorage.setItem(progressKey, JSON.stringify(progressData));
}

// Load test progress from localStorage
function loadTestProgress() {
    if (!currentTest || !currentAsset) return false;
    
    const progressKey = `testProgress_${currentAsset.id}_${currentTest.id}`;
    const savedProgress = localStorage.getItem(progressKey);
    
    if (!savedProgress) return false;
    
    try {
        const progressData = JSON.parse(savedProgress);
        
        // Check if saved progress is less than 24 hours old
        const savedAt = new Date(progressData.savedAt);
        const now = new Date();
        const hoursDiff = (now - savedAt) / (1000 * 60 * 60);
        
        if (hoursDiff < 24) {
            testResults = progressData.testResults;
            currentWizardStep = progressData.currentWizardStep;
            wizardMode = progressData.wizardMode;
            
            M.toast({html: 'Loaded saved test progress', classes: 'blue'});
            return true;
        } else {
            // Remove old progress
            localStorage.removeItem(progressKey);
        }
    } catch (error) {
        console.error('Error loading test progress:', error);
        localStorage.removeItem(progressKey);
    }
    
    return false;
}

// Finish test and save results
function finishTest() {
    if (!currentTest || !currentAsset || !testResults) return;
    
    // Validate that all steps have results
    const incompleteSteps = currentTest.steps.filter(step => {
        const data = testResults.steps[step.stepNumber] || {};
        const hasResult = !!data.result;
        // Support multiple verifiers; if step.requiredVerifiers is set, enforce that many; else require at least one
        const performers = Array.isArray(data.performers) ? data.performers : [];
        const hasSingle = !!data.performer; // backward compatibility
        const required = typeof step.requiredVerifiers === 'number' ? step.requiredVerifiers : 1;
        const hasEnough = performers.length >= required || (required <= 1 && hasSingle);
        return !(hasResult && hasEnough);
    });
    if (incompleteSteps.length > 0) {
        M.toast({html: 'Please complete all test steps before finishing', classes: 'orange'});
        return;
    }
    
    // Calculate overall status
    const failedSteps = Object.values(testResults.steps).filter(s => s.result === 'fail').length;
    const overallStatus = failedSteps === 0 ? 'passed' : 'failed';
    
    // Save test results
    saveTestResults(overallStatus);
    
    // Clear saved progress
    const progressKey = `testProgress_${currentAsset.id}_${currentTest.id}`;
    localStorage.removeItem(progressKey);
    
    // Close modal
    const testModal = M.Modal.getInstance(document.getElementById('testModal'));
    if (testModal) testModal.close();
    if (_autosaveTimer) { clearInterval(_autosaveTimer); _autosaveTimer = null; }
    
    M.toast({html: 'Test completed and saved!', classes: 'green'});
}

// Save test results
async function saveTestResults(overallStatus) {
    try {
        const techniciansStr = (testResults.technicians || []).join(', ');
        const contractorsStr = (testResults.contractors || []).join(', ');
        const dateStr = testResults.date || new Date().toLocaleDateString('en-GB');
        const ts = testResults.timestamp || new Date().toISOString();

        // Optionally upload attachments to Drive and collect URLs if authenticated
        let driveLinksByStep = {};
        try {
            const token = (typeof gapi !== 'undefined' && gapi.client && gapi.client.getToken && gapi.client.getToken());
            if (token && attachmentsBySession && attachmentsBySession[ts]) {
                driveLinksByStep = await uploadSessionAttachmentsToDrive(ts, currentAsset, currentTest);
            }
        } catch (e) {
            console.warn('Attachment upload skipped or failed:', e);
        }

        // Build one row per step matching headers:
        // Asset ID, Asset Name, Asset Type, Procedure ID, Procedure Name, Date, Timestamp,
        // Technicians, Contractors, Step Number, Step Description, Step Result,
        // Performed By, Performed At, Step Notes, Overall Status, Overall Notes
        const rows = (currentTest?.steps || []).map(step => {
            const data = (testResults.steps && testResults.steps[step.stepNumber]) || {};
            const desc = step.description || step.title || '';
            const sessionKey = ts;
            const attCount = attachmentsBySession[sessionKey]?.[step.stepNumber]?.length || 0;
            const links = driveLinksByStep[step.stepNumber] || [];
            const linkText = links.length ? ` Links: ${links.join(' ')}` : '';
            // Serialize field values if present
            let fieldStr = '';
            if (data.fieldValues && typeof data.fieldValues === 'object') {
                const entries = Object.entries(data.fieldValues).filter(([k,v]) => v !== undefined && v !== '');
                if (entries.length) {
                    fieldStr = '[Fields: ' + entries.map(([k,v]) => `${k}=${v}`).join('; ') + ']';
                }
            }
            const baseNote = data.notes ? data.notes : '';
            const attInfo = attCount ? `[Attachments: ${attCount}]${linkText}` : (linkText || '');
            const notesAugmented = [baseNote, fieldStr, attInfo].filter(Boolean).join(' ').trim();
            const performedByStr = (Array.isArray(data.performers) && data.performers.length)
                ? data.performers.join(', ')
                : (data.performer || '');
            return [
                currentAsset?.id || '',
                currentAsset?.name || '',
                currentAsset?.type || '',
                currentTest?.id || '',
                currentTest?.name || '',
                dateStr,
                ts,
                techniciansStr,
                contractorsStr,
                step.stepNumber,
                desc,
                data.result || '',
                performedByStr,
                data.performedAt || '',
                notesAugmented,
                overallStatus,
                testResults.notes || ''
            ];
        });

        const appendParams = {
            spreadsheetId: GOOGLE_CONFIG.SPREADSHEET_ID,
            range: `${GOOGLE_CONFIG.SHEETS.TEST_RESULTS}!A:Q`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: rows }
        };

        const isAuthed = (typeof gapi !== 'undefined' && gapi.client && gapi.client.getToken && gapi.client.getToken() !== null);
        if (isAuthed) {
            await gapi.client.sheets.spreadsheets.values.append(appendParams);
            M.toast({ html: 'Test results saved to Google Sheets', classes: 'green' });
        } else {
            let queue = [];
            try { queue = JSON.parse(localStorage.getItem('localTestResults') || '[]'); } catch (_) { queue = []; }
            queue.push({ values: rows });
            localStorage.setItem('localTestResults', JSON.stringify(queue));
            M.toast({ html: 'Saved locally. Sign in to sync test results.', classes: 'blue' });
        }

        // Update in-memory history summary (one per test instance)
        try {
            const historyEntry = {
                assetId: currentAsset?.id || '',
                procedureId: currentTest?.id || '',
                date: dateStr,
                technicians: techniciansStr,
                contractors: contractorsStr,
                overallStatus: overallStatus,
                notes: testResults.notes || '',
                timestamp: ts
            };
            if (Array.isArray(window.testResultsHistory)) {
                window.testResultsHistory.push(historyEntry);
            }
        } catch (e) {
            console.warn('Could not update in-memory testResultsHistory:', e);
        }

        // Refresh history from source to ensure it appears immediately
        try {
            if (typeof loadTestResults === 'function') {
                await loadTestResults();
            }
        } catch (e) {
            console.warn('Could not refresh test results from source', e);
        }
        if (typeof showTestHistory === 'function') {
            showTestHistory();
        }
    } catch (err) {
        console.error('Error saving test results:', err);
        M.toast({ html: 'Error saving test results', classes: 'red' });
    }
}

// Upload all attachments for a given session to Google Drive (folder per asset/procedure)
async function uploadSessionAttachmentsToDrive(sessionKey, asset, procedure) {
    const result = {};
    try {
        // Ensure we have a valid token
        if (!(gapi.client && gapi.client.getToken && gapi.client.getToken()?.access_token) && typeof window.requestDriveAccess === 'function') {
            await window.requestDriveAccess();
        }
        const session = attachmentsBySession?.[sessionKey] || {};
        const folderId = await ensureDriveFolder(`Asset_${asset?.id || 'unknown'}_${asset?.name || ''}`, `Test_${procedure?.id || 'unknown'}_${procedure?.name || ''}`);
        const entries = Object.entries(session);
        for (const [stepNumberStr, attList] of entries) {
            const stepNum = parseInt(stepNumberStr, 10);
            for (const att of attList) {
                const fileId = await uploadDataUrlToDrive(att.dataUrl, att.name || `step-${stepNum}.jpg`, folderId);
                const link = `https://drive.google.com/uc?id=${fileId}`;
                (result[stepNum] = result[stepNum] || []).push(link);
            }
        }
    } catch (e) {
        console.warn('Drive upload error:', e);
    }
    return result;
}

// Ensure a Drive folder structure exists: root app folder > asset folder > test folder
async function ensureDriveFolder(assetFolderName, testFolderName) {
    // Cache final path to avoid repeated Drive listing calls
    const cacheKey = `DCAM Test Attachments/${assetFolderName}/${testFolderName}`.replaceAll('/', '_');
    try {
        const cache = JSON.parse(localStorage.getItem('driveFolderCache') || '{}');
        if (cache[cacheKey]) return cache[cacheKey];
    } catch {}
    const appRoot = await getOrCreateDriveFolder('DCAM Test Attachments');
    const assetFolder = await getOrCreateDriveFolder(assetFolderName, appRoot);
    const testFolder = await getOrCreateDriveFolder(testFolderName, assetFolder);
    try {
        const cache = JSON.parse(localStorage.getItem('driveFolderCache') || '{}');
        cache[cacheKey] = testFolder;
        localStorage.setItem('driveFolderCache', JSON.stringify(cache));
    } catch {}
    return testFolder;
}

async function getOrCreateDriveFolder(name, parentId) {
    const accessToken = gapi.client.getToken()?.access_token;
    if (!accessToken) throw new Error('No access token');
    // First, try create (avoids files.list 403 with drive.file scope)
    const createOnce = async () => {
        const metadata = { name, mimeType: 'application/vnd.google-apps.folder' };
        if (parentId) metadata.parents = [parentId];
        const resp = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${gapi.client.getToken()?.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        });
        return resp;
    };
    let createResp = await createOnce();
    if (createResp.status === 403 && typeof window.requestDriveAccess === 'function') {
        const granted = await window.requestDriveAccess();
        if (granted) createResp = await createOnce();
    }
    if (createResp.ok) {
        const created = await createResp.json();
        return created.id;
    }
    // Try escalating scope once if still forbidden
    if (createResp.status === 403 && typeof window.requestFullDriveAccess === 'function' && !window._fullDriveTried) {
        window._fullDriveTried = true;
        try {
            const escalated = await window.requestFullDriveAccess();
            if (escalated) {
                createResp = await createOnce();
                if (createResp.ok) {
                    const created = await createResp.json();
                    return created.id;
                }
            }
        } catch (_) {}
    }
    // If create failed with other status, attempt list as a fallback
    const tryList = async () => {
        const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' ${parentId ? `and '${parentId}' in parents` : ''} and trashed=false`);
        const resp = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
            headers: { Authorization: `Bearer ${gapi.client.getToken()?.access_token}` }
        });
        return resp;
    };
    let listResp = await tryList();
    if (listResp.status === 403 && typeof window.requestDriveAccess === 'function') {
        const granted = await window.requestDriveAccess();
        if (granted) listResp = await tryList();
    }
    if (listResp.ok) {
        const found = await listResp.json();
        if (found.files && found.files.length > 0) return found.files[0].id;
    }
    let detail = '';
    try { detail = await createResp.text(); } catch(_) {}
    throw new Error(`Drive create/list folder error (${createResp.status}/${listResp.status}) ${detail}`);
}

// Upload a data URL (image/jpeg) to Drive and return fileId; set anyone with link to view
async function uploadDataUrlToDrive(dataUrl, fileName, parentId) {
    const accessToken = gapi.client.getToken()?.access_token;
    if (!accessToken) throw new Error('No access token');
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const metadata = { name: fileName, parents: parentId ? [parentId] : undefined };
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;
    const body = new Blob([
        delimiter,
        'Content-Type: application/json; charset=UTF-8\r\n\r\n',
        JSON.stringify(metadata),
        delimiter,
        `Content-Type: ${blob.type || 'image/jpeg'}\r\n\r\n`,
        blob,
        closeDelim
    ], { type: 'multipart/related; boundary=' + boundary });
    const doUpload = async () => fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${gapi.client.getToken()?.access_token}`,
            'Content-Type': 'multipart/related; boundary=' + boundary
        },
        body
    });
    let uploadResp = await doUpload();
    if (uploadResp.status === 403 && typeof window.requestDriveAccess === 'function') {
        const granted = await window.requestDriveAccess();
        if (granted) uploadResp = await doUpload();
    }
    if (uploadResp.status === 403 && typeof window.requestFullDriveAccess === 'function' && !window._fullDriveTriedUpload) {
        window._fullDriveTriedUpload = true;
        try {
            const escalated = await window.requestFullDriveAccess();
            if (escalated) uploadResp = await doUpload();
        } catch(_) {}
    }
    if (!uploadResp.ok) {
        let msg = '';
        try { msg = await uploadResp.text(); } catch(_) {}
        throw new Error(`Drive upload error (${uploadResp.status}) ${msg}`);
    }
    const uploaded = await uploadResp.json();
    const fileId = uploaded.id;
    // Make shareable (anyone with link)
    const permResp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${gapi.client.getToken()?.access_token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: 'reader', type: 'anyone' })
    });
    if (!permResp.ok) {
        let info = '';
        try { info = await permResp.text(); } catch(_) {}
        console.warn('Drive permission setting failed; link may require auth', permResp.status, info);
    }
    return fileId;
}

// Navigate between test steps with validation
function navigateTest(direction) {
    const modal = document.getElementById('testModal');
    
    if (direction === 'next') {
        // Validate current step before proceeding
    if (!validateCurrentStep()) {
            M.toast({html: '⚠️ Please complete all required items before proceeding', classes: 'orange darken-2', displayLength: 3000});
            
            // Highlight incomplete items
            const uncheckedRequired = document.querySelectorAll('#testModal .required-item input[type="checkbox"]:not(:checked)');
            uncheckedRequired.forEach(item => {
                const label = item.closest('label');
                label.style.backgroundColor = '#fff3cd';
                label.style.border = '2px solid #ff9800';
                setTimeout(() => {
                    label.style.backgroundColor = '';
                    label.style.border = '';
                }, 3000);
            });
            return;
        }
        
        if (currentTestStep < currentTest.steps.length - 1) {
            currentTestStep++;
            renderClassicStep();
        }
    } else if (direction === 'prev' && currentTestStep > 0) {
        currentTestStep--;
        renderClassicStep();
    }
}

// Validate current step requirements
function validateCurrentStep() {
    const step = currentTest.steps[currentTestStep];
    
    // Check minimum required checkboxes
    if (step.minRequired) {
        const totalBoxes = document.querySelectorAll('#testModal input[type="checkbox"]').length;
        const checkedBoxes = document.querySelectorAll('#testModal input[type="checkbox"]:checked').length;
        
        if (checkedBoxes < step.minRequired) {
            const remaining = step.minRequired - checkedBoxes;
            M.toast({
                html: `<i class="material-icons left">info</i>Please complete at least ${remaining} more item(s)`,
                classes: 'orange',
                displayLength: 4000
            });
            return false;
        }
    }
    
    // Check required input fields
    const requiredInputs = document.querySelectorAll('#testModal input[required]:not([type="checkbox"]), #testModal textarea[required]');
    for (let input of requiredInputs) {
        if (!input.value.trim()) {
            input.focus();
            input.classList.add('invalid');
            M.toast({html: `Please fill in: ${input.previousElementSibling?.textContent || 'required field'}`, classes: 'red'});
            return false;
        }
    }
    
    return true;
}

// Submit results from the modal footer button
async function submitTestResults() {
    try {
        // If there are attachments for this session and we're authenticated, request Drive consent now (user gesture)
        const ts = (typeof testResults !== 'undefined' && testResults && testResults.timestamp) || null;
        const hasAtt = !!(ts && attachmentsBySession && attachmentsBySession[ts] && Object.keys(attachmentsBySession[ts]).length);
        const authed = (typeof isAuthenticated === 'function') ? isAuthenticated() : (typeof gapi !== 'undefined' && gapi.client && gapi.client.getToken && gapi.client.getToken());
        if (hasAtt && authed && typeof window.requestDriveAccess === 'function' && !window._driveConsentEnsured) {
            // Informative toast to allow popups
            M.toast({ html: 'Requesting permission to upload photos to Drive. Please allow pop-ups.', classes: 'blue' });
            try {
                const granted = await window.requestDriveAccess();
                window._driveConsentEnsured = !!granted;
            } catch (_) { /* ignore */ }
        }
    } catch (_) { /* ignore */ }

    // Classic mode validation: ensure all steps have a result and personnel present (mirrors finishTest)
    if (!wizardMode) {
        // Validate personnel first
        const hasPersonnel = (testResults.technicians && testResults.technicians.length) || (testResults.contractors && testResults.contractors.length);
        if (!hasPersonnel) {
            M.toast({ html: 'Add at least one technician or contractor.', classes: 'red' });
            return;
        }
        // Validate each step has result & performer(s)
        const incomplete = [];
        (currentTest.steps || []).forEach(step => {
            const data = (testResults.steps && testResults.steps[step.stepNumber]) || {};
            const hasResult = !!data.result;
            const performers = Array.isArray(data.performers) ? data.performers : (data.performer ? [data.performer] : []);
            const required = typeof step.requiredVerifiers === 'number' ? step.requiredVerifiers : 1;
            const enough = performers.length >= required;
            if (!(hasResult && enough)) incomplete.push(step.stepNumber);
        });
        if (incomplete.length) {
            M.toast({ html: `Incomplete steps: ${incomplete.slice(0,10).join(', ')}${incomplete.length>10?'…':''}`, classes: 'orange' });
            // Scroll to first incomplete step element if present
            try {
                const first = incomplete[0];
                const el = document.querySelector(`.test-step h5:contains('Step ${first}')`) || document.querySelector(`.test-step:nth-of-type(${first})`);
                if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch(_) {}
            return;
        }
    }
    // Delegate to finishTest which performs validation and saving
    if (typeof finishTest === 'function') {
        finishTest();
    } else {
        console.warn('finishTest() not available');
    }
}

// Render current test step with enhanced features
function renderClassicStep() {
    const modal = document.getElementById('testModal');
    const modalContent = modal.querySelector('.modal-content');
    const step = currentTest.steps[currentTestStep];
    
    let stepContent = `
        <h5>${currentTest.name}</h5>
        <h6>Step ${currentTestStep + 1} of ${currentTest.steps.length}: ${step.title}</h6>
    `;
    
    // Add minimum requirements indicator
    if (step.minRequired) {
        stepContent += `
            <div class="chip red white-text" style="margin: 10px 0;">
                <i class="material-icons tiny">warning</i> 
                Minimum ${step.minRequired} items required
            </div>
            <div id="progress-indicator" class="amber lighten-4" style="padding: 8px; border-radius: 4px; margin-bottom: 10px;">
                <span id="progress-text">0 of ${step.minRequired} required items completed</span>
            </div>
        `;
    }
    
    // Render checklist with proper required indicators
    if (step.checklist && step.checklist.length > 0) {
        stepContent += '<div class="checklist-section" style="margin: 20px 0;">';
        step.checklist.forEach((item, index) => {
            const isRequired = step.minRequired && index < step.minRequired;
            const itemClass = isRequired ? 'required-item' : '';
            stepContent += `
                <label class="${itemClass}" style="display: block; padding: 10px; margin: 5px 0; border-radius: 4px; cursor: pointer; transition: all 0.3s;">
                    <input type="checkbox" id="check-${currentTestStep}-${index}" 
                           onchange="updateStepProgress()" />
                    <span>${item} ${isRequired ? '<span class="red-text">*</span>' : ''}</span>
                </label>
            `;
        });
        stepContent += '</div>';
    }
    
    // Render input fields
    if (step.inputs && step.inputs.length > 0) {
        stepContent += '<div class="input-section" style="margin: 20px 0;">';
        step.inputs.forEach(input => {
            stepContent += `
                <div class="input-field">
                    <input type="${input.type || 'text'}" 
                           id="${input.id}" 
                           ${input.required ? 'required' : ''} />
                    <label for="${input.id}">${input.label}${input.required ? ' *' : ''}</label>
                </div>
            `;
        });
        stepContent += '</div>';
    }
    
    // If there is a single reference image URL, show a hint with a View Image button (opens modal)
    if (step.imageUrl) {
        stepContent += `
            <div class="card-panel blue lighten-5" style="margin: 20px 0; border: 1px dashed #2196f3;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <i class="material-icons blue-text text-darken-2">image</i>
                        <span class="blue-text text-darken-2">This step has a reference image.</span>
                    </div>
                    <a href="#!" class="btn-small waves-effect waves-light" onclick="event.preventDefault(); showImage('${step.imageUrl}')">
                        <i class="material-icons left">visibility</i>View Image
                    </a>
                </div>
            </div>
        `;
    }

    // Render images with reveal functionality for multiple images
    if (step.images && step.images.length > 0) {
        stepContent += '<div class="images-section" style="margin: 20px 0;">';
        step.images.forEach((image, index) => {
            const imageId = `img-${currentTestStep}-${index}`;
            stepContent += `
                <div class="image-container" style="margin: 15px 0;">
                    <div id="help-${imageId}" class="help-box" style="
                        background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
                        border: 2px dashed #2196f3;
                        border-radius: 8px;
                        padding: 30px;
                        text-align: center;
                        cursor: pointer;
                        transition: all 0.3s;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                    " onclick="revealImage('${imageId}')"
                       onmouseover="this.style.transform='scale(1.02)'"
                       onmouseout="this.style.transform='scale(1)'">
                        <i class="material-icons" style="font-size: 48px; color: #1976d2;">help_outline</i>
                        <p style="margin: 15px 0; color: #1565c0; font-weight: 500; font-size: 16px;">
                            ${image.helpText || 'Click to reveal reference image'}
                        </p>
                        <a class="btn-small waves-effect waves-light blue">
                            <i class="material-icons left">visibility</i>Show Image
                        </a>
                    </div>
                    <div id="${imageId}" style="display: none; animation: fadeIn 0.5s;">
                        <img src="${image.src || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHRleHQtYW5jaG9yPSJtaWRkbGUiIHg9IjIwMCIgeT0iMTUwIiBzdHlsZT0iZmlsbDojYWFhO2ZvbnQtd2VpZ2h0OmJvbGQ7Zm9udC1zaXplOjE5cHg7Zm9udC1mYW1pbHk6QXJpYWwsSGVsdmV0aWNhLHNhbnMtc2VyaWY7ZG9taW5hbnQtYmFzZWxpbmU6Y2VudHJhbCI+UmVmZXJlbmNlIEltYWdlPC90ZXh0Pjwvc3ZnPg=='}" 
                             alt="${image.alt || 'Reference image'}" 
                             style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
                        ${image.caption ? `<p class="grey-text text-darken-1" style="margin-top: 10px; font-style: italic;">${image.caption}</p>` : ''}
                        <button class="btn-small btn-flat grey lighten-2" onclick="hideImage('${imageId}')" style="margin-top: 10px;">
                            <i class="material-icons left">visibility_off</i>Hide Image
                        </button>
                    </div>
                </div>
            `;
        });
        stepContent += '</div>';
    }
    
    // Add notes field
    stepContent += `
        <div class="input-field" style="margin-top: 20px;">
            <textarea id="step-notes-${currentTestStep}" class="materialize-textarea"></textarea>
            <label for="step-notes-${currentTestStep}">Additional Notes (Optional)</label>
        </div>
    `;
    
    // Progress bar
    const progress = ((currentTestStep + 1) / currentTest.steps.length) * 100;
    stepContent += `
        <div class="progress" style="margin: 20px 0;">
            <div class="determinate" style="width: ${progress}%; transition: width 0.5s;"></div>
        </div>
    `;
    
    // Navigation buttons
    stepContent += `
        <div class="test-navigation" style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px;">
            <button class="btn-flat waves-effect" 
                    onclick="navigateTest('prev')" 
                    ${currentTestStep === 0 ? 'disabled' : ''}>
                <i class="material-icons left">arrow_back</i>Previous
            </button>
            
            <span class="grey-text">Step ${currentTestStep + 1} of ${currentTest.steps.length}</span>
            
            ${currentTestStep === currentTest.steps.length - 1 ? 
                `<button class="btn waves-effect waves-light green" onclick="completeTest()">
                    <i class="material-icons left">check_circle</i>Complete Test
                </button>` :
                `<button class="btn waves-effect waves-light" onclick="navigateTest('next')">
                    Next<i class="material-icons right">arrow_forward</i>
                </button>`
            }
        </div>
    `;
    
    modalContent.innerHTML = stepContent;
    
    // Initialize Materialize components
    M.updateTextFields();
    // Materialize expects a single textarea element, not a NodeList
    document.querySelectorAll('.materialize-textarea').forEach(el => {
        M.textareaAutoResize(el);
    });
    
    // Ensure we start at the top of the newly rendered step
    if (typeof scrollModalToTop === 'function') scrollModalToTop();

    // Update initial progress
    updateStepProgress();
}

// Update progress indicator
function updateStepProgress() {
    const step = currentTest.steps[currentTestStep];
    if (!step.minRequired) return;
    
    const checkedCount = document.querySelectorAll('#testModal input[type="checkbox"]:checked').length;
    const progressText = document.getElementById('progress-text');
    const progressIndicator = document.getElementById('progress-indicator');
    
    if (progressText) {
        progressText.textContent = `${checkedCount} of ${step.minRequired} required items completed`;
        
        if (checkedCount >= step.minRequired) {
            progressIndicator.className = 'green lighten-4';
            progressIndicator.innerHTML = `
                <i class="material-icons tiny green-text">check_circle</i>
                <span class="green-text text-darken-2">${progressText.textContent} ✓</span>
            `;
        } else {
            progressIndicator.className = 'amber lighten-4';
            progressIndicator.innerHTML = `
                <i class="material-icons tiny amber-text text-darken-3">info</i>
                <span class="amber-text text-darken-3">${progressText.textContent}</span>
            `;
        }
    }
}

// Image reveal function
function revealImage(imageId) {
    const helpBox = document.getElementById(`help-${imageId}`);
    const imageDiv = document.getElementById(imageId);
    
    if (helpBox && imageDiv) {
        helpBox.style.display = 'none';
        imageDiv.style.display = 'block';
    }
}

// Image hide function
function hideImage(imageId) {
    const helpBox = document.getElementById(`help-${imageId}`);
    const imageDiv = document.getElementById(imageId);
    
    if (helpBox && imageDiv) {
        imageDiv.style.display = 'none';
        helpBox.style.display = 'block';
    }
}

// Add CSS animation for fade in
if (!document.getElementById('test-animations')) {
    const style = document.createElement('style');
    style.id = 'test-animations';
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);
}

// Make functions available globally
window.startTest = startTest;
window.previewTest = previewTest;
window.renderTestContent = renderTestContent;
// Expose specific renderers for debugging if needed
window.renderWizardStep = renderWizardStep;
window.updateStepResult = updateStepResult;
window.updateStepPerformer = updateStepPerformer;
window.updateStepPerformers = updateStepPerformers;
window.updateStepNotes = updateStepNotes;
window.saveTestProgress = saveTestProgress;
window.loadTestProgress = loadTestProgress;
window.finishTest = finishTest;
window.currentTest = currentTest;
window.testResults = testResults;
window.wizardMode = wizardMode;
window.currentWizardStep = currentWizardStep;
window.navigateTest = navigateTest;
window.validateCurrentStep = validateCurrentStep;
window.updateStepProgress = updateStepProgress;
window.revealImage = revealImage;
window.hideImage = hideImage;
window.submitTestResults = submitTestResults;
// Expose Drive upload helper for cross-module use (offline -> online sync)
window.uploadSessionAttachmentsToDrive = uploadSessionAttachmentsToDrive;
