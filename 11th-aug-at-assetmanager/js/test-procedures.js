// Test Procedures Module

// Sample test procedures with enhanced validation and image support
const testProcedures = {
    'SERVER-001': [
        {
            id: 'test-power-redundancy',
            name: 'Power Redundancy Test',
            description: 'Verify dual power supply failover functionality',
            estimatedTime: '30 minutes',
            steps: [
                {
                    title: 'Pre-Test Verification',
                    minRequired: 3,
                    checklist: [
                        'Confirm both PSUs are connected and powered',
                        'Check PSU LED indicators are green',
                        'Verify UPS backup is available',
                        'Document current power consumption readings',
                        'Notify affected users (if applicable)'
                    ],
                    images: [
                        {
                            src: 'assets/images/psu-indicators.png',
                            alt: 'PSU LED Indicators',
                            helpText: 'Reference diagram for PSU status LEDs',
                            caption: 'Green = Normal, Amber = Warning, Red = Fault'
                        }
                    ]
                },
                {
                    title: 'Primary PSU Test',
                    minRequired: 2,
                    checklist: [
                        'Remove power cable from PSU 1',
                        'Verify system continues running on PSU 2',
                        'Check event logs for failover notification',
                        'Monitor system stability for 5 minutes'
                    ],
                    inputs: [
                        { id: 'psu1-voltage', label: 'PSU 1 Voltage Reading', type: 'number', required: true },
                        { id: 'failover-time', label: 'Failover Time (seconds)', type: 'number', required: true }
                    ]
                },
                {
                    title: 'Secondary PSU Test',
                    minRequired: 2,
                    checklist: [
                        'Reconnect PSU 1',
                        'Remove power cable from PSU 2',
                        'Verify system continues running on PSU 1',
                        'Check event logs for failover notification'
                    ],
                    inputs: [
                        { id: 'psu2-voltage', label: 'PSU 2 Voltage Reading', type: 'number', required: true }
                    ]
                },
                {
                    title: 'Post-Test Verification',
                    minRequired: 4,
                    checklist: [
                        'Reconnect all power cables',
                        'Verify both PSUs are operational',
                        'Clear any system alerts',
                        'Update maintenance log',
                        'Generate test report'
                    ],
                    images: [
                        {
                            src: 'assets/images/test-report-template.png',
                            alt: 'Test Report Template',
                            helpText: 'Click to see report format example',
                            caption: 'Use this template for documenting results'
                        }
                    ]
                }
            ]
        },
        {
            id: 'test-memory-diagnostic',
            name: 'Memory Diagnostic Test',
            description: 'Comprehensive RAM testing and validation',
            estimatedTime: '45 minutes',
            steps: [
                {
                    title: 'Pre-Test Setup',
                    minRequired: 2,
                    checklist: [
                        'Backup critical data',
                        'Schedule maintenance window',
                        'Prepare diagnostic tools',
                        'Document current memory configuration'
                    ],
                    images: [
                        {
                            src: 'assets/images/memory-slots.png',
                            alt: 'Memory Slot Configuration',
                            helpText: 'Memory slot identification guide',
                            caption: 'Ensure proper slot population for dual-channel'
                        }
                    ]
                },
                {
                    title: 'Run Memory Test',
                    minRequired: 3,
                    checklist: [
                        'Boot into diagnostic mode',
                        'Select comprehensive memory test',
                        'Monitor test progress',
                        'Document any errors found',
                        'Complete full test cycle'
                    ],
                    inputs: [
                        { id: 'memory-size', label: 'Total Memory Detected (GB)', type: 'number', required: true },
                        { id: 'test-duration', label: 'Test Duration (minutes)', type: 'number', required: true },
                        { id: 'errors-found', label: 'Number of Errors', type: 'number', required: true }
                    ]
                }
            ]
        }
    ],
    'STORAGE-001': [
        {
            id: 'test-raid-rebuild',
            name: 'RAID Rebuild Test',
            description: 'Test RAID array rebuild and hot-spare functionality',
            estimatedTime: '2 hours',
            steps: [
                {
                    title: 'RAID Array Verification',
                    minRequired: 4,
                    checklist: [
                        'Verify RAID array health status',
                        'Check all drives are online',
                        'Confirm hot-spare is configured',
                        'Document current RAID configuration',
                        'Backup critical data',
                        'Schedule maintenance window'
                    ],
                    images: [
                        {
                            src: 'assets/images/raid-status.png',
                            alt: 'RAID Status Dashboard',
                            helpText: 'How to check RAID array status',
                            caption: 'All drives should show "Online" status'
                        }
                    ]
                },
                {
                    title: 'Simulate Drive Failure',
                    minRequired: 3,
                    checklist: [
                        'Mark one drive as failed',
                        'Verify hot-spare activation',
                        'Monitor rebuild progress',
                        'Check system performance impact',
                        'Document rebuild statistics'
                    ],
                    inputs: [
                        { id: 'rebuild-rate', label: 'Rebuild Rate (MB/s)', type: 'number', required: true },
                        { id: 'estimated-time', label: 'Estimated Completion (hours)', type: 'number', required: true }
                    ],
                    images: [
                        {
                            src: 'assets/images/rebuild-progress.png',
                            alt: 'Rebuild Progress Monitor',
                            helpText: 'Monitor rebuild progress here',
                            caption: 'Expected rebuild rate: 150-200 MB/s'
                        }
                    ]
                }
            ]
        }
    ],
    'NETWORK-001': [
        {
            id: 'test-failover',
            name: 'Network Failover Test',
            description: 'Test network path redundancy and failover',
            estimatedTime: '20 minutes',
            steps: [
                {
                    title: 'Network Path Verification',
                    minRequired: 3,
                    checklist: [
                        'Verify primary path connectivity',
                        'Verify secondary path connectivity',
                        'Check spanning tree configuration',
                        'Document current routing table',
                        'Start continuous ping test'
                    ],
                    inputs: [
                        { id: 'primary-latency', label: 'Primary Path Latency (ms)', type: 'number', required: true },
                        { id: 'secondary-latency', label: 'Secondary Path Latency (ms)', type: 'number', required: true }
                    ]
                },
                {
                    title: 'Failover Test',
                    minRequired: 2,
                    checklist: [
                        'Disconnect primary network path',
                        'Verify automatic failover to secondary',
                        'Check for packet loss during failover',
                        'Monitor failover time'
                    ],
                    inputs: [
                        { id: 'failover-time', label: 'Failover Time (seconds)', type: 'number', required: true },
                        { id: 'packets-lost', label: 'Packets Lost During Failover', type: 'number', required: true }
                    ],
                    images: [
                        {
                            src: 'assets/images/network-topology.png',
                            alt: 'Network Topology',
                            helpText: 'View network path diagram',
                            caption: 'Primary path (blue), Secondary path (green)'
                        }
                    ]
                }
            ]
        }
    ]
};

// Navigate between test steps
function navigateTest(direction) {
    const modal = document.getElementById('testModal');
    const modalContent = modal.querySelector('.modal-content');
    
    if (direction === 'next') {
        // Validate current step before proceeding
        if (!validateCurrentStep()) {
            M.toast({html: 'Please complete all required items before proceeding', classes: 'orange darken-2'});
            return;
        }
        
        if (currentTestStep < currentTest.steps.length - 1) {
            currentTestStep++;
            renderTestStep();
        }
    } else if (direction === 'prev' && currentTestStep > 0) {
        currentTestStep--;
        renderTestStep();
    }
}

// Validate current step requirements
function validateCurrentStep() {
    const step = currentTest.steps[currentTestStep];
    
    // Check if step has minimum requirements
    if (step.minRequired) {
        const checkedBoxes = document.querySelectorAll('#testModal input[type="checkbox"]:checked').length;
        if (checkedBoxes < step.minRequired) {
            // Highlight unchecked items
            document.querySelectorAll('#testModal input[type="checkbox"]:not(:checked)').forEach(cb => {
                cb.closest('label').style.backgroundColor = '#fff3cd';
                setTimeout(() => {
                    cb.closest('label').style.backgroundColor = '';
                }, 2000);
            });
            return false;
        }
    }
    
    // Check for required fields
    const requiredInputs = document.querySelectorAll('#testModal input[required], #testModal textarea[required]');
    for (let input of requiredInputs) {
        if (!input.value.trim()) {
            input.focus();
            input.style.borderColor = '#f44336';
            setTimeout(() => {
                input.style.borderColor = '';
            }, 2000);
            return false;
        }
    }
    
    return true;
}

// Render current test step with image reveal functionality
function renderTestStep() {
    const modal = document.getElementById('testModal');
    const modalContent = modal.querySelector('.modal-content');
    const step = currentTest.steps[currentTestStep];
    
    // Add minimum required indicator if applicable
    const minRequiredText = step.minRequired ? 
        `<div class="chip red white-text" style="margin-bottom: 10px;">
            <i class="material-icons tiny">warning</i> Minimum ${step.minRequired} items required
        </div>` : '';
    
    let stepContent = `
        <h5>${currentTest.name} - Step ${currentTestStep + 1} of ${currentTest.steps.length}</h5>
        <h6>${step.title}</h6>
        ${minRequiredText}
        <div class="test-step-content">
    `;
    
    // Render checklist items
    if (step.checklist && step.checklist.length > 0) {
        stepContent += '<div class="checklist-items">';
        step.checklist.forEach((item, index) => {
            const itemId = `check-${currentTestStep}-${index}`;
            stepContent += `
                <label style="display: block; margin: 10px 0; padding: 8px; border-radius: 4px; transition: background-color 0.3s;">
                    <input type="checkbox" id="${itemId}" onchange="updateChecklistProgress()" />
                    <span>${item}</span>
                </label>
            `;
        });
        stepContent += '</div>';
    }
    
    // Render input fields
    if (step.inputs && step.inputs.length > 0) {
        stepContent += '<div class="input-fields" style="margin-top: 20px;">';
        step.inputs.forEach(input => {
            const required = input.required ? 'required' : '';
            stepContent += `
                <div class="input-field">
                    <input type="${input.type || 'text'}" id="${input.id}" ${required} />
                    <label for="${input.id}">${input.label}${input.required ? ' *' : ''}</label>
                </div>
            `;
        });
        stepContent += '</div>';
    }
    
    // Render images with reveal functionality
    if (step.images && step.images.length > 0) {
        stepContent += '<div class="test-images" style="margin-top: 20px;">';
        step.images.forEach((image, index) => {
            const imageId = `image-${currentTestStep}-${index}`;
            stepContent += `
                <div class="image-container" style="margin: 15px 0;">
                    <div class="image-help-box" id="help-${imageId}" style="
                        background: #e3f2fd;
                        border: 2px dashed #2196f3;
                        border-radius: 8px;
                        padding: 20px;
                        text-align: center;
                        cursor: pointer;
                        transition: all 0.3s;
                    " onclick="revealImage('${imageId}')">
                        <i class="material-icons" style="font-size: 48px; color: #2196f3;">help_outline</i>
                        <p style="margin: 10px 0; color: #1976d2; font-weight: 500;">
                            ${image.helpText || 'Click to reveal reference image'}
                        </p>
                        <button class="btn-small waves-effect waves-light blue">
                            <i class="material-icons left">visibility</i>Show Image
                        </button>
                    </div>
                    <div id="${imageId}" style="display: none;">
                        <img src="${image.src}" alt="${image.alt || 'Test reference'}" 
                             style="max-width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
                        ${image.caption ? `<p class="grey-text" style="margin-top: 8px;">${image.caption}</p>` : ''}
                        <button class="btn-small btn-flat" onclick="hideImage('${imageId}')" style="margin-top: 10px;">
                            <i class="material-icons left">visibility_off</i>Hide Image
                        </button>
                    </div>
                </div>
            `;
        });
        stepContent += '</div>';
    }
    
    // Add notes section
    stepContent += `
        <div class="input-field" style="margin-top: 20px;">
            <textarea id="step-notes-${currentTestStep}" class="materialize-textarea"></textarea>
            <label for="step-notes-${currentTestStep}">Additional Notes (Optional)</label>
        </div>
    `;
    
    stepContent += '</div>';
    
    // Add progress indicator
    const progress = ((currentTestStep + 1) / currentTest.steps.length) * 100;
    stepContent += `
        <div class="progress" style="margin-top: 20px;">
            <div class="determinate" style="width: ${progress}%"></div>
        </div>
    `;
    
    // Navigation buttons
    stepContent += `
        <div style="margin-top: 20px; display: flex; justify-content: space-between;">
            <button class="btn-flat waves-effect" onclick="navigateTest('prev')" 
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
    
    // Update checklist progress
    updateChecklistProgress();
}

// Reveal image function
function revealImage(imageId) {
    const helpBox = document.getElementById(`help-${imageId}`);
    const imageDiv = document.getElementById(imageId);
    
    if (helpBox && imageDiv) {
        helpBox.style.display = 'none';
        imageDiv.style.display = 'block';
        // Animate the reveal
        imageDiv.style.opacity = '0';
        setTimeout(() => {
            imageDiv.style.transition = 'opacity 0.5s';
            imageDiv.style.opacity = '1';
        }, 10);
    }
}

// Hide image function
function hideImage(imageId) {
    const helpBox = document.getElementById(`help-${imageId}`);
    const imageDiv = document.getElementById(imageId);
    
    if (helpBox && imageDiv) {
        imageDiv.style.display = 'none';
        helpBox.style.display = 'block';
    }
}

// Update checklist progress indicator
function updateChecklistProgress() {
    const step = currentTest.steps[currentTestStep];
    const checkedBoxes = document.querySelectorAll('#testModal input[type="checkbox"]:checked').length;
    const totalBoxes = document.querySelectorAll('#testModal input[type="checkbox"]').length;
    
    // Update visual feedback for progress
    if (step.minRequired) {
        const statusText = document.querySelector('.test-step-content');
        if (statusText) {
            const existingStatus = document.getElementById('checklist-status');
            if (existingStatus) {
                existingStatus.remove();
            }
            
            const statusDiv = document.createElement('div');
            statusDiv.id = 'checklist-status';
            statusDiv.style.cssText = 'margin: 10px 0; padding: 10px; border-radius: 4px;';
            
            if (checkedBoxes >= step.minRequired) {
                statusDiv.className = 'green lighten-4';
                statusDiv.innerHTML = `
                    <i class="material-icons tiny green-text">check_circle</i>
                    <span class="green-text text-darken-2">Requirement met: ${checkedBoxes}/${totalBoxes} items checked</span>
                `;
            } else {
                statusDiv.className = 'orange lighten-4';
                statusDiv.innerHTML = `
                    <i class="material-icons tiny orange-text">info</i>
                    <span class="orange-text text-darken-2">
                        ${step.minRequired - checkedBoxes} more item(s) needed (${checkedBoxes}/${step.minRequired} minimum)
                    </span>
                `;
            }
            
            const checklistDiv = document.querySelector('.checklist-items');
            if (checklistDiv) {
                checklistDiv.prepend(statusDiv);
            }
        }
    }
}

// Complete test procedure
function completeTest() {
    // Final validation before completion
    if (!validateCurrentStep()) {
        M.toast({html: 'Please complete all required items before finishing', classes: 'orange darken-2'});
        return;
    }
    
    const testResults = {
        id: currentTest.id,
        name: currentTest.name,
        steps: []
    };
    
    // Compile results from each step
    currentTest.steps.forEach((step, index) => {
        const stepResult = {
            title: step.title,
            checklist: [],
            inputs: {},
            notes: ''
        };
        
        // Checklist results
        if (step.checklist && step.checklist.length > 0) {
            step.checklist.forEach((item, itemIndex) => {
                const itemId = `check-${index}-${itemIndex}`;
                const isChecked = document.getElementById(itemId).checked;
                stepResult.checklist.push({ item, isChecked });
            });
        }
        