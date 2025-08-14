// Test Navigation and Validation Module

// Show validation message in wizard mode
function showValidationMessage(message) {
    const validationEl = document.getElementById('stepValidationMessage');
    const textEl = document.getElementById('validationText');
    if (validationEl && textEl) {
        textEl.textContent = message;
        validationEl.classList.add('error');
        validationEl.style.display = 'block';
        // Also show a toast for extra visibility
        if (typeof M !== 'undefined' && M.toast) {
            M.toast({ html: message, classes: 'orange darken-2' });
        }
    } else {
        M.toast({ html: message, classes: 'orange' });
    }
}

// Hide validation message
function hideValidationMessage() {
    const validationEl = document.getElementById('stepValidationMessage');
    if (validationEl) {
    validationEl.classList.remove('error');
    validationEl.style.display = 'none';
    }
}

// Scroll the test modal content to the top
function scrollModalToTop() {
    try {
        const modalContent = document.querySelector('#testModal .modal-content');
        if (modalContent && typeof modalContent.scrollTo === 'function') {
            modalContent.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    } catch (e) {
        // Fallback without smooth behavior
        const modalContent = document.querySelector('#testModal .modal-content');
        if (modalContent) modalContent.scrollTop = 0;
        else window.scrollTo(0, 0);
    }
}

// Check if a step is completed
function isStepCompleted(stepIndex) {
    if (stepIndex === 0) {
        // Personnel step
        return (testResults.technicians && testResults.technicians.length > 0) ||
               (testResults.contractors && testResults.contractors.length > 0);
    }
    
    const totalSteps = currentTest.steps.length + 2;
    if (stepIndex < totalSteps - 1) {
        const step = currentTest.steps[stepIndex - 1];
        const stepData = testResults.steps[step.stepNumber] || {};
        const hasResult = !!stepData.result;
        const required = typeof step.requiredVerifiers === 'number' ? step.requiredVerifiers : 1;
        const performers = Array.isArray(stepData.performers) ? stepData.performers : [];
        const hasSingle = !!stepData.performer; // backward compatibility
        const hasEnough = performers.length >= required || (required <= 1 && hasSingle);
        return hasResult && hasEnough;
    }
    
    return false;
}

// Navigate to next step with validation
function nextStep() {
    if (!currentTest) return;
    const totalSteps = currentTest.steps.length + 2; // personnel + steps + summary

    if (currentWizardStep === 0) {
        // Force update personnel data from current inputs
        updatePersonnel();
        
        const hasPersonnel = (testResults.technicians && testResults.technicians.length > 0) ||
                             (testResults.contractors && testResults.contractors.length > 0);
        if (!hasPersonnel) {
            showValidationMessage('Please add at least one technician or contractor to proceed.');
            return;
        }
    } else if (currentWizardStep > 0 && currentWizardStep < totalSteps - 1) {
        const step = currentTest.steps[currentWizardStep - 1];
        const data = (testResults.steps && testResults.steps[step.stepNumber]) || {};
        const hasResult = !!data.result;
        const required = typeof step.requiredVerifiers === 'number' ? step.requiredVerifiers : 1;
        const performers = Array.isArray(data.performers) ? data.performers : [];
        const hasSingle = !!data.performer; // backward compat
        const hasEnough = performers.length >= required || (required <= 1 && hasSingle);
        if (!hasResult || !hasEnough) {
            const msg = required > 1
                ? `Please select a result and at least ${required} verifier(s).`
                : 'Please select a result and at least one verifier.';
            showValidationMessage(msg);
            return;
        }
    }

    hideValidationMessage();
    if (currentWizardStep < totalSteps - 1) {
        currentWizardStep++;
        renderTestContent();
    // Ensure next step starts at top
    if (typeof scrollModalToTop === 'function') scrollModalToTop();
        if (typeof saveTestProgress === 'function') saveTestProgress();
    }
}

// Navigate to previous step
function previousStep() {
    if (currentWizardStep > 0) {
        currentWizardStep--;
        hideValidationMessage();
        renderTestContent();
    // Ensure previous step starts at top
    if (typeof scrollModalToTop === 'function') scrollModalToTop();
        if (typeof saveTestProgress === 'function') saveTestProgress();
    }
}

// Navigate to specific step (if allowed)
function goToStep(stepIndex) {
    // Only allow going to completed steps or the current step
    const canNavigate = stepIndex <= currentWizardStep || isStepCompleted(stepIndex);
    
    if (canNavigate) {
        currentWizardStep = stepIndex;
        hideValidationMessage();
        renderTestContent();
    if (typeof scrollModalToTop === 'function') scrollModalToTop();
    } else {
        M.toast({html: 'Please complete previous steps first.', classes: 'orange'});
    }
}

// Update personnel data from form inputs
function updatePersonnel() {
    // Collect technicians
    const technicians = [];
    for (let i = 1; i <= 3; i++) {
        const techEl = document.getElementById(`technician${i}`);
        if (techEl && techEl.value.trim()) {
            technicians.push(techEl.value.trim());
        }
    }
    
    // Collect contractors
    const contractors = [];
    for (let i = 1; i <= 3; i++) {
        const contEl = document.getElementById(`contractor${i}`);
        if (contEl && contEl.value.trim()) {
            contractors.push(contEl.value.trim());
        }
    }
    
    // Update test results
    testResults.technicians = technicians;
    testResults.contractors = contractors;
    
    // Update dropdowns if not in wizard mode or past personnel step
    if (!wizardMode || currentWizardStep > 0) {
        updatePersonnelDropdowns();
    }
    
    // Auto-save after updating personnel
    if (typeof saveTestProgress === 'function') saveTestProgress();
}

// Update personnel dropdowns for step performers
function updatePersonnelDropdowns() {
    const allPersonnel = [
        ...testResults.technicians.map(t => `Technician: ${t}`),
        ...testResults.contractors.map(c => `Contractor: ${c}`)
    ];
    
    // Update dropdowns for current step in wizard mode or all steps in classic mode
    const stepsToUpdate = wizardMode && currentWizardStep > 0 && currentWizardStep <= currentTest.steps.length 
        ? [currentTest.steps[currentWizardStep - 1]]
        : currentTest.steps;
    
    stepsToUpdate.forEach(step => {
        const select = document.getElementById(`step-${step.stepNumber}-performer`);
        if (select) {
            const currentValue = testResults.steps[step.stepNumber]?.performer || '';
            
            select.innerHTML = '<option value="">Select who performed this step</option>';
            
            allPersonnel.forEach(person => {
                const option = document.createElement('option');
                option.value = person;
                option.textContent = person;
                if (person === currentValue) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            
            select.disabled = allPersonnel.length === 0;
            M.FormSelect.init(select);
        }
    });
}

// Make functions available globally
window.nextStep = nextStep;
window.previousStep = previousStep;
window.goToStep = goToStep;
window.updatePersonnel = updatePersonnel;
window.showValidationMessage = showValidationMessage;
window.hideValidationMessage = hideValidationMessage;
window.scrollModalToTop = scrollModalToTop;
