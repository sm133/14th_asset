// Utility Functions Module

// Show image in modal with zoom functionality
function showImage(imageUrl) {
    const previewImage = document.getElementById('previewImage');
    if (previewImage) {
        previewImage.src = imageUrl;
        currentImageZoom = 1;
        resetZoom();
        
        const modal = M.Modal.getInstance(document.getElementById('imageModal'));
        if (modal) {
            modal.open();
        }
    }
}

// Reset zoom for image modal
function resetZoom() {
    const previewImage = document.getElementById('previewImage');
    if (previewImage && typeof currentImageZoom !== 'undefined') {
        previewImage.style.transform = `scale(${currentImageZoom})`;
    }
}

// Zoom in on image
function zoomIn() {
    const previewImage = document.getElementById('previewImage');
    if (previewImage && typeof currentImageZoom !== 'undefined') {
        currentImageZoom = Math.min(currentImageZoom + 0.25, 3);
        previewImage.style.transform = `scale(${currentImageZoom})`;
    }
}

// Zoom out on image  
function zoomOut() {
    const previewImage = document.getElementById('previewImage');
    if (previewImage && typeof currentImageZoom !== 'undefined') {
        currentImageZoom = Math.max(currentImageZoom - 0.25, 0.5);
        previewImage.style.transform = `scale(${currentImageZoom})`;
    }
}

// Format date for display (robust for DD/MM/YYYY, ISO, Date, and timestamps)
function formatDate(dateInput) {
    if (!dateInput) return '-';

    let date = null;

    if (dateInput instanceof Date) {
        date = dateInput;
    } else if (typeof dateInput === 'number') {
        date = new Date(dateInput);
    } else if (typeof dateInput === 'string') {
        const s = dateInput.trim();
        // Handle DD/MM/YYYY
        const m1 = s.match(/^([0-3]?\d)\/([0-1]?\d)\/(\d{4})$/);
        if (m1) {
            const d = parseInt(m1[1], 10);
            const m = parseInt(m1[2], 10) - 1;
            const y = parseInt(m1[3], 10);
            date = new Date(y, m, d);
        } else if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
            // ISO-like
            date = new Date(s);
        } else {
            const tryAuto = new Date(s);
            if (!isNaN(tryAuto.getTime())) {
                date = tryAuto;
            }
        }
    }

    if (!date || isNaN(date.getTime())) {
        // Fallback: return input as-is if we can't parse
        return String(dateInput);
    }

    return date.toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Format status for display with proper styling
function formatStatus(status) {
    const statusMap = {
        'operational': { text: 'Operational', class: 'green-text' },
        'maintenance': { text: 'Under Maintenance', class: 'orange-text' },
        'offline': { text: 'Offline', class: 'red-text' },
        'decommissioned': { text: 'Decommissioned', class: 'grey-text' }
    };
    
    const statusInfo = statusMap[status?.toLowerCase()] || { text: status || 'Unknown', class: 'grey-text' };
    return `<span class="${statusInfo.class}">${statusInfo.text}</span>`;
}

// Initialize tooltips and other Materialize components
function initializeMaterializeComponents() {
    // Initialize tooltips
    M.Tooltip.init(document.querySelectorAll('.tooltipped'));
    
    // Initialize modals
    M.Modal.init(document.querySelectorAll('.modal'));
    
    // Initialize dropdowns
    M.Dropdown.init(document.querySelectorAll('.dropdown-trigger'));
    
    // Initialize select elements
    M.FormSelect.init(document.querySelectorAll('select'));
    
    // Initialize datepickers
    M.Datepicker.init(document.querySelectorAll('.datepicker'), {
        format: 'yyyy-mm-dd',
        defaultDate: new Date(),
        setDefaultDate: true
    });
    
    // Initialize collapsibles
    M.Collapsible.init(document.querySelectorAll('.collapsible'));
    
    // Initialize tabs
    M.Tabs.init(document.querySelectorAll('.tabs'));
}

// Debounce function for search inputs
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Safe DOM element getter
function safeGetElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element with ID '${id}' not found`);
    }
    return element;
}

// Make functions available globally
window.showImage = showImage;
window.resetZoom = resetZoom;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.formatDate = formatDate;
window.formatStatus = formatStatus;
window.initializeMaterializeComponents = initializeMaterializeComponents;
window.debounce = debounce;
window.safeGetElement = safeGetElement;

// Convert an image File to a compressed data URL (JPEG) with max dimension constraint
async function imageFileToDataUrlCompressed(file, options = {}) {
    const { maxDimension = 1280, quality = 0.7 } = options;
    return new Promise((resolve, reject) => {
        try {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('Failed to read image file'));
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        let { width, height } = img;
                        // Scale down maintaining aspect ratio
                        if (width > height) {
                            if (width > maxDimension) {
                                height = Math.round(height * (maxDimension / width));
                                width = maxDimension;
                            }
                        } else {
                            if (height > maxDimension) {
                                width = Math.round(width * (maxDimension / height));
                                height = maxDimension;
                            }
                        }
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        const dataUrl = canvas.toDataURL('image/jpeg', quality);
                        resolve(dataUrl);
                    } catch (e) {
                        reject(e);
                    }
                };
                img.onerror = () => reject(new Error('Invalid image'));
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        } catch (err) {
            reject(err);
        }
    });
}

// Expose image compression helper
window.imageFileToDataUrlCompressed = imageFileToDataUrlCompressed;
