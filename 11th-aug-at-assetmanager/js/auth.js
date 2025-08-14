// Authentication Module

// Google API Configuration  
// Only load Sheets discovery at init; Drive discovery can be loaded lazily or accessed via direct REST requests.
const DISCOVERY_DOCS = [
    'https://sheets.googleapis.com/$discovery/rest?version=v4'
];
// Always include both Sheets and Drive scopes so token is good for uploads and appends
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';

let tokenClient;
let gapiInited = false;
let gisInited = false;
let currentUser = null;
// Expose token client via getter for other modules if needed (read-only reference)
function getTokenClient() { return tokenClient; }

// Silent token refresh timer id
let _tokenRefreshTimer = null;

function startTokenAutoRefresh() {
    try {
        stopTokenAutoRefresh();
        const interval = (window.APP_CONFIG && window.APP_CONFIG.SETTINGS && window.APP_CONFIG.SETTINGS.TOKEN_REFRESH_INTERVAL) || 55 * 60 * 1000;
        _tokenRefreshTimer = setInterval(async () => {
            try {
                if (!tokenClient) return;
                tokenClient.callback = (resp) => {
                    if (resp && resp.access_token && !resp.error) {
                        localStorage.setItem('gapi_token', resp.access_token);
                        gapi.client.setToken({ access_token: resp.access_token });
                    }
                };
                tokenClient.requestAccessToken({ prompt: '' });
            } catch (e) {
                console.warn('Silent token refresh failed (will retry later)', e);
            }
        }, interval);
    } catch (e) {
        console.warn('Could not start token auto-refresh', e);
    }
}

function stopTokenAutoRefresh() {
    if (_tokenRefreshTimer) {
        clearInterval(_tokenRefreshTimer);
        _tokenRefreshTimer = null;
    }
}

// New function to handle Google services initialization
function initializeGoogleServices() {
    console.log('Initializing Google services...');
    
    // Check if gapi is available
    if (typeof gapi !== 'undefined') {
        gapiLoad();
    } else {
        console.error('Google API (gapi) not loaded');
        showFallbackButton('Google API failed to load. Please refresh the page.');
        return;
    }
    
    // Check if google identity services is available
    if (typeof google !== 'undefined' && google.accounts) {
        gisLoad();
    } else {
        console.warn('Google Identity Services not loaded immediately, retrying...');
        // Retry a few times
        let retries = 0;
        const maxRetries = 5;
        const retryInterval = setInterval(() => {
            retries++;
            if (typeof google !== 'undefined' && google.accounts) {
                clearInterval(retryInterval);
                gisLoad();
            } else if (retries >= maxRetries) {
                clearInterval(retryInterval);
                console.error('Google Identity Services failed to load after retries');
                showFallbackButton('Authentication service unavailable. Please refresh the page.');
            }
        }, 1000);
    }
}

// Alias for backward compatibility
const initializeGoogleAuth = initializeGoogleServices;

// Function to show fallback button
function showFallbackButton(message) {
    document.getElementById('buttonDiv').innerHTML = 
        `<button class="btn white blue-text" onclick="initializeGoogleServices()">
            <i class="material-icons left">refresh</i>Retry Authentication
        </button>
        <p style="color: white; font-size: 0.9rem; margin-top: 10px;">${message}</p>`;
}

// New Google Identity Services implementation
function gapiLoad() {
    console.log('Loading Google API...');
    gapi.load('client', gapiInit);
}

async function gapiInit() {
    try {
        await gapi.client.init({
            apiKey: GOOGLE_CONFIG.API_KEY,
            discoveryDocs: DISCOVERY_DOCS,
        });
        gapiInited = true;
        console.log('Google API initialized successfully');
        maybeEnableButtons();
    } catch (error) {
        console.error('Error initializing Google API:', error);
    showFallbackButton('Failed to initialise Google API. Click to retry.');
    }
}

function gisLoad() {
    try {
        console.log('Loading Google Identity Services...');
    tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CONFIG.CLIENT_ID,
            scope: SCOPES,
            callback: '', // defined later
        });
        gisInited = true;
        console.log('Google Identity Services loaded successfully');
        maybeEnableButtons();
    } catch (error) {
        console.error('Error initializing Google Identity Services:', error);
        // Show retry button
    showFallbackButton('Failed to initialise authentication. Click to retry.');
    }
}

function maybeEnableButtons() {
    console.log('Checking if both services are ready...', { gapiInited, gisInited });
    
    if (gapiInited && gisInited) {
        console.log('Both GAPI and GIS initialized, setting up auth...');
        
        // Check if we have stored credentials
        const storedToken = localStorage.getItem('gapi_token');
        if (storedToken) {
            gapi.client.setToken({access_token: storedToken});
            // Verify token is still valid
            verifyToken(storedToken);
        } else {
            // Always use manual sign-in button for reliability
            renderSignInButton();
        }
    }
}

// New function to render sign-in button
function renderSignInButton() {
    const buttonDiv = document.getElementById('buttonDiv');
    if (buttonDiv) {
        buttonDiv.innerHTML = 
            '<button class="btn white blue-text waves-effect waves-light" onclick="handleManualSignIn()" style="min-width: 200px;">' +
            '<i class="material-icons left">account_circle</i>Sign In with Google' +
            '</button>';
        console.log('Sign-in button rendered');
    } else {
        console.error('Button div not found');
    }
}

async function verifyToken(token) {
    try {
        // Try to make a simple API call to verify the token
        const response = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: GOOGLE_CONFIG.SPREADSHEET_ID
        });
        
        if (response.status === 200) {
            // Token is valid
            updateUIForSignedIn();
            startTokenAutoRefresh();
            if (typeof uploadLocalData === 'function') {
                uploadLocalData();
            }
        }
    } catch (error) {
        console.error('Token verification failed:', error);
        // Token is invalid, clear it and show sign-in button
        localStorage.removeItem('gapi_token');
        gapi.client.setToken(null);
        maybeEnableButtons();
    }
}

function handleManualSignIn() {
    console.log('Manual sign-in button clicked');
    
    // Check if services are initialized
    if (!gapiInited || !gisInited) {
        M.toast({html: 'Authentication system not ready. Retrying...', classes: 'orange'});
        initializeGoogleServices();
        return;
    }
    
    if (tokenClient) {
        console.log('Requesting access token...');
        tokenClient.callback = async (resp) => {
            if (resp.error !== undefined) {
                console.error('Token error:', resp);
                M.toast({html: 'Sign-in failed. Please try again.', classes: 'red'});
                return;
            }
            console.log('Token received successfully');
            
            // Store token
            localStorage.setItem('gapi_token', resp.access_token);
            gapi.client.setToken({access_token: resp.access_token});
            
            // Get user info manually
            currentUser = {
                email: 'Authenticated User',
                name: 'User',
                picture: ''
            };
            
            updateUIForSignedIn();
            startTokenAutoRefresh();
            
            // Upload any local results
            if (typeof uploadLocalData === 'function') {
                await uploadLocalData();
            }
        };
        
        try {
            // Use 'consent' on first login; subsequent calls should reuse stored token
            tokenClient.requestAccessToken({ prompt: localStorage.getItem('gapi_token') ? '' : 'consent' });
        } catch (error) {
            console.error('Error requesting access token:', error);
            M.toast({html: 'Failed to open sign-in window. Please check your pop-up blocker.', classes: 'red'});
        }
    } else {
        M.toast({html: 'Authentication system not ready. Please wait...', classes: 'orange'});
        // Retry initialization
        initializeGoogleServices();
    }
}

function handleCredentialResponse(response) {
    console.log('Credential response received');
    
    // Decode the JWT credential response
    const responsePayload = decodeJwtResponse(response.credential);
    currentUser = {
        email: responsePayload.email,
        name: responsePayload.name,
        picture: responsePayload.picture
    };
    
    // Request access token for Sheets API
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            console.error('Token error:', resp);
            M.toast({html: 'Failed to get access token', classes: 'red'});
            return;
        }
        // Store token
        localStorage.setItem('gapi_token', resp.access_token);
        gapi.client.setToken({access_token: resp.access_token});
        updateUIForSignedIn();
    startTokenAutoRefresh();
        
        // Upload any local results
        if (typeof uploadLocalData === 'function') {
            await uploadLocalData();
        }
    };

    tokenClient.requestAccessToken({prompt: ''});
}

// Request additional Drive access (drive.file) if needed, prompting user for consent
async function requestDriveAccess() {
    try {
        if (!tokenClient) throw new Error('Auth not ready');
    return await new Promise((resolve) => {
            tokenClient.callback = (resp) => {
                if (resp && resp.access_token && !resp.error) {
                    localStorage.setItem('gapi_token', resp.access_token);
                    gapi.client.setToken({ access_token: resp.access_token });
                    resolve(true);
                } else {
                    console.warn('Drive access request denied or failed', resp);
                    resolve(false);
                }
            };
            try {
        tokenClient.requestAccessToken({ prompt: 'consent', scope: SCOPES });
            } catch (e) {
                console.error('Failed to request Drive access token', e);
        try { M && M.toast({ html: 'Pop-up blocked. Allow pop-ups for Google sign-in/consent.', classes: 'orange' }); } catch(_) {}
                resolve(false);
            }
        });
    } catch (e) {
        console.warn('requestDriveAccess not available', e);
        return false;
    }
}

// Escalate to full Drive access (https://www.googleapis.com/auth/drive) once, if user approves
async function requestFullDriveAccess() {
    try {
        if (!tokenClient) throw new Error('Auth not ready');
        return await new Promise((resolve) => {
            tokenClient.callback = (resp) => {
                if (resp && resp.access_token && !resp.error) {
                    localStorage.setItem('gapi_token', resp.access_token);
                    gapi.client.setToken({ access_token: resp.access_token });
                    resolve(true);
                } else {
                    console.warn('Full Drive access request denied or failed', resp);
                    resolve(false);
                }
            };
            try {
                tokenClient.requestAccessToken({ prompt: 'consent', scope: 'https://www.googleapis.com/auth/drive' });
            } catch (e) {
                console.error('Failed to request full Drive access token', e);
                try { M && M.toast({ html: 'Pop-up blocked. Allow pop-ups for Google consent.', classes: 'orange' }); } catch(_) {}
                resolve(false);
            }
        });
    } catch (e) {
        console.warn('requestFullDriveAccess not available', e);
        return false;
    }
}

// Add the missing decodeJwtResponse function
function decodeJwtResponse(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

function updateUIForSignedIn() {
    document.getElementById('buttonDiv').style.display = 'none';
    document.getElementById('signout_button').style.display = 'inline-block';
    if (currentUser && currentUser.email) {
        document.getElementById('user_info').textContent = `Signed in as: ${currentUser.email}`;
        document.getElementById('user_info').style.display = 'inline';
    } else {
        // If we don't have user info, just show generic message
        document.getElementById('user_info').textContent = 'Signed in';
        document.getElementById('user_info').style.display = 'inline';
    }
    M.toast({html: 'Successfully signed in to Google', classes: 'green'});
}

function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        localStorage.removeItem('gapi_token');
        currentUser = null;
    stopTokenAutoRefresh();
        
        document.getElementById('buttonDiv').style.display = 'inline-block';
        document.getElementById('signout_button').style.display = 'none';
        document.getElementById('user_info').style.display = 'none';
        
        // Re-render sign-in button
        renderSignInButton();
        
        M.toast({html: 'Signed out successfully', classes: 'blue'});
    }
}

// Check if user is authenticated
function isAuthenticated() {
    if (typeof gapi === 'undefined' || !gapi.client || !gapi.client.getToken) {
        return false;
    }
    const token = gapi.client.getToken();
    return token !== null && token.access_token;
}

// Get current authentication status
function getAuthStatus() {
    return {
        isSignedIn: isAuthenticated(),
        user: currentUser,
        hasValidToken: isAuthenticated()
    };
}

// Make functions available globally
window.initializeGoogleServices = initializeGoogleServices;
window.initializeGoogleAuth = initializeGoogleAuth;
window.handleManualSignIn = handleManualSignIn;
window.handleSignoutClick = handleSignoutClick;
window.renderSignInButton = renderSignInButton;
window.showFallbackButton = showFallbackButton;
window.isAuthenticated = isAuthenticated;
window.getAuthStatus = getAuthStatus;
window.currentUser = currentUser;
window.requestDriveAccess = requestDriveAccess;
window.requestFullDriveAccess = requestFullDriveAccess;
window.getTokenClient = getTokenClient;
