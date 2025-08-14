# Data Centre Asset Management Dashboard

A complete HTML dashboard for managing data centre assets with a modern Material Design interface.

## Features

- **Asset Overview**: View all assets with filtering and search capabilities
- **Real-time Status**: Monitor asset status (Normal, In Maintenance, Fault/Shutdown)
- **Maintenance Tracking**: Track maintenance schedules and overdue items
- **Detailed Asset Information**: View specifications, history, and maintenance records
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Technologies Used

- HTML5
- CSS3 with Material Design styling
- JavaScript (Vanilla)
- Materialize CSS Framework
- Material Icons
- Google Fonts (Roboto)

## Getting Started

### Method 1: Direct File Opening
1. Open `index.html` directly in your web browser
2. The dashboard will load with sample data

### Method 2: Live Server (Recommended)
1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html` and select "Open with Live Server"
3. The dashboard will open in your browser with live reload capabilities

### Method 3: Simple HTTP Server
If you have Python installed:
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```
Then open http://localhost:8000 in your browser

If you have Node.js installed:
```bash
npx http-server
```

## File Structure

```
11th-aug-at-assetmanager/
├── index.html          # Main dashboard file
└── README.md           # This file
```

## Sample Data

The dashboard includes sample data for demonstration:
- 6 sample assets (servers, networking, storage, cooling, power)
- Various status types and maintenance schedules
- Interactive asset details modal

## Customization

### Adding New Assets
Edit the `assetData` object in the JavaScript section of `index.html` to add new assets.

### Styling
All styles are contained within the `<style>` section in the HTML file. Modify CSS variables and classes to customize the appearance.

### Functionality
The dashboard uses vanilla JavaScript for all interactions. Extend the filtering and modal functions to add new features.

## Browser Compatibility

- Chrome 70+
- Firefox 65+
- Safari 12+
- Edge 79+

## Future Enhancements

- Backend integration for real data
- User authentication
- Advanced reporting features
- Maintenance scheduling system
- Real-time notifications
- Asset lifecycle management

## License

This project is open source and available under the MIT License.
