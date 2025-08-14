# Data Centre Asset Management Dashboard - Modular Version

## Overview
This is a modularized version of the Data Centre Asset Management Dashboard, designed to be more maintainable and AI-friendly. The application has been broken down into focused modules that handle specific functionality areas.

## Project Structure

```
11th-aug-at-assetmanager/
├── dashboard-modular.html          # Main entry point (modular version)
├── dashboard-complete.html         # Original monolithic version
├── css/
│   └── dashboard.css              # Main stylesheet
├── js/                            # JavaScript modules
│   ├── config.js                  # Configuration and constants
│   ├── auth.js                    # Google authentication
│   ├── data-loader.js             # Data loading from Google Sheets
│   ├── asset-display.js           # Asset filtering and display
│   ├── asset-details.js           # Asset modal and details
│   ├── maintenance.js             # Maintenance logging functionality
│   ├── test-navigation.js         # Test wizard navigation
│   ├── test-execution.js          # Test execution and management
│   └── utils.js                   # Utility functions and helpers
└── README.md                      # This documentation
```

## Module Descriptions

### Core Modules

#### `config.js`
- **Purpose**: Central configuration management
- **Contents**: 
  - Google Sheets API configuration
  - Application settings and feature flags
  - UI themes and constants
  - Error and success messages
  - Validation rules
- **Key Functions**: `getConfig()`, `setConfig()`, `validateConfig()`

#### `auth.js`
- **Purpose**: Google authentication and authorisation
- **Contents**:
  - Google Identity Services integration
  - Token management and refresh
  - User session handling
  - Authentication status checks
- **Key Functions**: `initializeGoogleAuth()`, `handleSignoutClick()`, `isAuthenticated()`

#### `data-loader.js`
- **Purpose**: Data loading and synchronization
- **Contents**:
  - Google Sheets API integration
  - Local data storage and sync
  - Error handling for network issues
  - Offline mode support
- **Key Functions**: `loadAllData()`, `loadAssets()`, `uploadLocalData()`

### UI Modules

#### `asset-display.js`
- **Purpose**: Asset grid display and filtering
- **Contents**:
  - Asset filtering logic
  - Statistics calculation
  - Grid rendering
  - Search functionality
- **Key Functions**: `filterAssets()`, `displayAssets()`, `updateStatistics()`

#### `asset-details.js`
- **Purpose**: Asset modal and detailed views
- **Contents**:
  - Asset detail modal
  - Status updates
  - Tab navigation
  - Asset information display
- **Key Functions**: `showAssetDetails()`, `showAssetInfo()`, `updateAssetStatus()`

### Feature Modules

#### `maintenance.js`
- **Purpose**: Maintenance history and logging
- **Contents**:
  - Maintenance history display
  - Maintenance event logging
  - Modal creation and handling
  - Customer notification logic
- **Key Functions**: `showMaintenanceHistory()`, `openLogMaintenanceModal()`

#### `test-navigation.js`
- **Purpose**: Test wizard navigation and validation
- **Contents**:
  - Step navigation (next/previous)
  - Form validation
  - Personnel management
  - Progress tracking
- **Key Functions**: `nextStep()`, `previousStep()`, `updatePersonnel()`

#### `test-execution.js`
- **Purpose**: Test procedure execution
- **Contents**:
  - Test workflow management
  - Wizard and classic modes
  - Step rendering
  - Result collection
- **Key Functions**: `startTest()`, `renderTestContent()`, `finishTest()`

#### `utils.js`
- **Purpose**: Common utility functions
- **Contents**:
  - Image modal functionality
  - Date formatting
  - Component initialization
  - Helper functions
- **Key Functions**: `showImage()`, `formatDate()`, `initializeMaterializeComponents()`

## Key Features

### 🔧 Modular Architecture
- Each module has a single responsibility
- Clean separation of concerns
- Easy to debug and maintain
- AI-friendly code organisation

### 🔐 Authentication
- Google Identity Services integration
- Secure token management
- Offline mode fallback
- Automatic token refresh

### 📊 Data Management
- Google Sheets backend integration
- Local storage for offline mode
- Automatic data synchronization
- Error handling and recovery

### 🎯 Asset Management
- Visual asset grid with filtering
- Detailed asset information modals
- Status tracking and updates
- Maintenance scheduling

### 🔬 Test Procedures
- Wizard-guided test execution
- Step-by-step validation
- Personnel tracking
- Result documentation

### 🛠 Maintenance Tracking
- Maintenance history display
- Event logging with types
- Customer notification system
- Local storage backup

## Usage Instructions

### Getting Started
1. Open `dashboard-modular.html` in a web browser
2. Sign in with Google account for full functionality
3. The application will load data from Google Sheets
4. Use filters to find specific assets
5. Click on assets to view details and perform actions

### Configuration
Edit `js/config.js` to customize:
- Google Sheets integration settings
- UI themes and colors
- Feature toggles
- Validation rules

### Adding New Modules
1. Create new `.js` file in the `js/` directory
2. Follow the module pattern:
   ```javascript
   // Module description and purpose
   
   // Private variables and functions
   
   // Public functions
   
   // Make functions available globally
   window.functionName = functionName;
   ```
3. Add script tag to `dashboard-modular.html`
4. Update this README with module description

## Browser Compatibility
- Modern browsers with ES6 support
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Dependencies
- **Materialize CSS**: UI framework
- **Google APIs**: Authentication and Sheets access
- **Material Icons**: Icon font

## Security Considerations
- OAuth 2.0 for secure authentication
- Client-side only (no server-side secrets)
- Local storage for offline data
- HTTPS required for production

## Troubleshooting

### Common Issues

#### Authentication Problems
- Check Google API configuration in `config.js`
- Verify OAuth consent screen setup
- Ensure correct redirect URIs

#### Data Loading Issues
- Verify Google Sheets sharing permissions
- Check API key and spreadsheet ID
- Monitor browser console for errors

#### Module Loading Errors
- Ensure all script tags are present
- Check for JavaScript errors in console
- Verify module dependencies

### Debug Mode
Enable debug logging by setting:
```javascript
window.DEBUG_MODE = true;
```

## Performance Considerations
- Modules load asynchronously
- Data caching in localStorage
- Lazy loading for large datasets
- Optimized DOM updates

## Future Enhancements
- [ ] Export/Import functionality
- [ ] Bulk operations
- [ ] Advanced reporting
- [ ] Mobile app version
- [ ] Real-time notifications
- [ ] Advanced analytics

## Support
For issues or questions:
1. Check browser console for errors
2. Review this documentation
3. Verify configuration settings
4. Test with original `dashboard-complete.html`

## License
This project is for educational and demonstration purposes.

---

**Note**: This modular version maintains full compatibility with the original functionality while providing better maintainability and AI-friendly code organisation.
