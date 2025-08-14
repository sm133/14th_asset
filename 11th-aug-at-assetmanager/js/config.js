// Configuration Module

// Google Sheets API Configuration
const GOOGLE_CONFIG = {
    API_KEY: 'AIzaSyBKMeccFQLd_0Co5ge15hcAXZphr8HePiw',
    CLIENT_ID: '611395134102-b0913rahbehjqghfkasgtlfl9ogojneq.apps.googleusercontent.com',
    SPREADSHEET_ID: '1O3QrecIyS2nrc_w6UpRMthFPCQF5MY5s_NFqsylz3w4',
    SHEETS: {
        ASSETS: 'Assets',
        MAINTENANCE_HISTORY: 'MaintenanceHistory',
        TEST_PROCEDURES: 'TestProcedures',
    TEST_RESULTS: 'TestResults',
    CONTRACTORS: 'Contractors' // New sheet for asset-type specific contractors
    }
};

// Application Configuration
const APP_CONFIG = {
    NAME: 'Data Centre Asset Management',
    VERSION: '2.0.0',
    ORG_NAME: 'Air trunk',
    ORG_LOGO_URL: '', // e.g., 'https://example.com/logo.png'
    REPORT: {
        BRAND_COLOR: '#1565c0',
        SHOW_SIGNATURES: true,
        SIGNATORIES: [
            { label: 'Technician', name: '' },
            { label: 'Supervisor', name: '' }
        ]
    },
    FEATURES: {
        OFFLINE_MODE: true,
        AUTO_SAVE: true,
        WIZARD_MODE: true,
        IMAGE_ZOOM: true
    },
    SETTINGS: {
        AUTO_SAVE_INTERVAL: 30000, // 30 seconds
        TOKEN_REFRESH_INTERVAL: 3300000, // 55 minutes
        MAX_LOCAL_STORAGE_ITEMS: 100,
        DEFAULT_DATE_FORMAT: 'en-GB'
    }
};

// UI Configuration
const UI_CONFIG = {
    THEMES: {
        PRIMARY_COLOR: '#1976d2',
        SECONDARY_COLOR: '#1565c0',
        SUCCESS_COLOR: '#4caf50',
        WARNING_COLOR: '#ff9800',
        ERROR_COLOR: '#f44336'
    },
    ANIMATIONS: {
        CARD_DELAY: 0.1, // seconds
        MODAL_TRANSITION: 300, // milliseconds
        TOAST_DURATION: 3000 // milliseconds
    },
    BREAKPOINTS: {
        MOBILE: 600,
        TABLET: 992,
        DESKTOP: 1200
    }
};

// Asset Type Icons Mapping
const ASSET_ICONS = {
    'generator': 'power',
    'chiller': 'ac_unit',
    'ups': 'battery_charging_full',
    'pac-unit': 'air',
    'fan-wall-unit': 'air',
    'power-train-unit': 'electrical_services',
    'default': 'settings'
};

// Status Color Mapping
const STATUS_COLORS = {
    'normal': 'green-text',
    'operational': 'green-text',
    'in maintenance': 'orange-text',
    'maintenance': 'orange-text',
    'fault/shutdown': 'red-text',
    'offline': 'red-text',
    'decommissioned': 'grey-text'
};

// Maintenance Type Classes
const MAINTENANCE_TYPES = {
    'preventive': {
        class: 'preventive',
        color: '#4caf50',
        icon: 'build'
    },
    'corrective': {
        class: 'corrective',
        color: '#ff9800',
        icon: 'build_circle'
    },
    'emergency': {
        class: 'emergency',
        color: '#f44336',
        icon: 'emergency'
    },
    'routine': {
        class: 'routine',
        color: '#2196f3',
        icon: 'schedule'
    }
};

// Test Status Configuration
const TEST_STATUS = {
    'passed': {
        color: '#4caf50',
        icon: 'check_circle',
        class: 'green'
    },
    'failed': {
        color: '#f44336',
        icon: 'cancel',
        class: 'red'
    },
    'in-progress': {
        color: '#ff9800',
        icon: 'hourglass_empty',
        class: 'orange'
    }
};

// Local Storage Keys
const STORAGE_KEYS = {
    GAPI_TOKEN: 'gapi_token',
    LOCAL_MAINTENANCE: 'localMaintenance',
    LOCAL_TEST_RESULTS: 'localTestResults',
    LOCAL_ASSET_UPDATES: 'localAssetUpdates',
    USER_PREFERENCES: 'userPreferences',
    TEST_PROGRESS_PREFIX: 'testProgress_'
};

// Error Messages
const ERROR_MESSAGES = {
    AUTH_FAILED: 'Authentication failed. Please try again.',
    DATA_LOAD_FAILED: 'Failed to load data. Check your connection.',
    SAVE_FAILED: 'Failed to save changes. Data saved locally.',
    VALIDATION_FAILED: 'Please check all required fields.',
    NETWORK_ERROR: 'Network error. Working in offline mode.',
    PERMISSION_DENIED: 'Permission denied. Check your access rights.'
};

// Success Messages
const SUCCESS_MESSAGES = {
    DATA_SAVED: 'Data saved successfully',
    TEST_COMPLETED: 'Test completed successfully',
    STATUS_UPDATED: 'Status updated successfully',
    MAINTENANCE_LOGGED: 'Maintenance event logged',
    SYNC_COMPLETED: 'Data synchronized with Google Sheets'
};

// Validation Rules
const VALIDATION_RULES = {
    REQUIRED_FIELDS: {
        MAINTENANCE: ['type', 'date', 'technician', 'description'],
        TEST: ['technicians', 'contractors'], // At least one is required
        ASSET_UPDATE: ['status']
    },
    MIN_LENGTHS: {
        DESCRIPTION: 10,
        NOTES: 5,
        TECHNICIAN_NAME: 2
    },
    MAX_LENGTHS: {
        DESCRIPTION: 500,
        NOTES: 1000,
        TECHNICIAN_NAME: 50
    }
};

// API Endpoints
const API_ENDPOINTS = {
    SHEETS_BASE: 'https://sheets.googleapis.com/v4/spreadsheets',
    DISCOVERY_DOC: 'https://sheets.googleapis.com/$discovery/rest?version=v4'
};

// Feature Flags
const FEATURE_FLAGS = {
    ENABLE_OFFLINE_MODE: true,
    ENABLE_AUTO_SAVE: true,
    ENABLE_WIZARD_MODE: true,
    ENABLE_IMAGE_PREVIEW: true,
    ENABLE_EXPORT: false,
    ENABLE_IMPORT: false,
    ENABLE_BULK_OPERATIONS: false
};

// Initialize configuration on load
function initializeConfig() {
    // Set up global configuration object
    window.GOOGLE_CONFIG = GOOGLE_CONFIG;
    window.APP_CONFIG = APP_CONFIG;
    window.UI_CONFIG = UI_CONFIG;
    window.ASSET_ICONS = ASSET_ICONS;
    window.STATUS_COLORS = STATUS_COLORS;
    window.MAINTENANCE_TYPES = MAINTENANCE_TYPES;
    window.TEST_STATUS = TEST_STATUS;
    window.STORAGE_KEYS = STORAGE_KEYS;
    window.ERROR_MESSAGES = ERROR_MESSAGES;
    window.SUCCESS_MESSAGES = SUCCESS_MESSAGES;
    window.VALIDATION_RULES = VALIDATION_RULES;
    window.API_ENDPOINTS = API_ENDPOINTS;
    window.FEATURE_FLAGS = FEATURE_FLAGS;
    
    console.log('Configuration initialized');
}

// Get configuration value safely
function getConfig(path, defaultValue = null) {
    const keys = path.split('.');
    let current = window;
    
    for (const key of keys) {
        if (current[key] === undefined) {
            return defaultValue;
        }
        current = current[key];
    }
    
    return current;
}

// Set configuration value
function setConfig(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let current = window;
    
    for (const key of keys) {
        if (!current[key]) {
            current[key] = {};
        }
        current = current[key];
    }
    
    current[lastKey] = value;
}

// Validate configuration
function validateConfig() {
    const required = [
        'GOOGLE_CONFIG.API_KEY',
        'GOOGLE_CONFIG.CLIENT_ID',
        'GOOGLE_CONFIG.SPREADSHEET_ID'
    ];
    
    const missing = required.filter(path => !getConfig(path));
    
    if (missing.length > 0) {
        console.error('Missing required configuration:', missing);
        return false;
    }
    
    return true;
}

// Initialize on script load
initializeConfig();

// Make functions available globally
window.getConfig = getConfig;
window.setConfig = setConfig;
window.validateConfig = validateConfig;
window.initializeConfig = initializeConfig;
