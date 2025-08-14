// Asset Display and Filtering Module

let filteredAssets = [];

// Update statistics display
function updateStatistics() {
    const stats = {
        total: allAssets.length,
        overdue: 0,
        dueSoon: 0,
        inMaintenance: 0
    };
    
    allAssets.forEach(asset => {
        const maintenanceStatus = getMaintenanceStatus(asset);
        if (maintenanceStatus === 'overdue') stats.overdue++;
        else if (maintenanceStatus === 'due-soon') stats.dueSoon++;
        
        if (asset.status === 'in maintenance') stats.inMaintenance++;
    });
    
    const totalEl = document.getElementById('totalAssets');
    const overdueEl = document.getElementById('overdueCount');
    const dueSoonEl = document.getElementById('dueSoonCount');
    const inMaintenanceEl = document.getElementById('inMaintenanceCount');
    
    if (totalEl) totalEl.textContent = stats.total;
    if (overdueEl) overdueEl.textContent = stats.overdue;
    if (dueSoonEl) dueSoonEl.textContent = stats.dueSoon;
    if (inMaintenanceEl) inMaintenanceEl.textContent = stats.inMaintenance;
}

// Populate filter dropdown options
function populateFilters() {
    // Populate asset type filter dynamically from Assets sheet
    const types = [...new Set(allAssets.map(a => a.type))].filter(Boolean).sort();
    const typeSelect = document.getElementById('assetTypeFilter');
    if (typeSelect) {
        typeSelect.innerHTML = '<option value="">All Types</option>';
        types.forEach(t => {
            const option = document.createElement('option');
            option.value = t;
            option.textContent = t.replace(/-/g, ' ').toUpperCase();
            typeSelect.appendChild(option);
        });
    }
    // Populate building filter
    const buildings = [...new Set(allAssets.map(a => a.building))].filter(Boolean).sort();
    const buildingSelect = document.getElementById('buildingFilter');
    if (buildingSelect) {
        buildingSelect.innerHTML = '<option value="">All Buildings</option>';
        buildings.forEach(building => {
            const option = document.createElement('option');
            option.value = building;
            option.textContent = building;
            buildingSelect.appendChild(option);
        });
    }
    
    // Populate floor/level filter
    const floors = [...new Set(allAssets.map(a => a.floor))].filter(Boolean).sort();
    const floorSelect = document.getElementById('floorFilter');
    if (floorSelect) {
        floorSelect.innerHTML = '<option value="">All Levels</option>';
        floors.forEach(floor => {
            const option = document.createElement('option');
            option.value = floor;
            option.textContent = floor;
            floorSelect.appendChild(option);
        });
    }
    
    // Reinitialize Materialize selects
    M.FormSelect.init(document.querySelectorAll('select'));
}

// Filter assets based on selected criteria
function filterAssets() {
    const typeFilter = document.getElementById('assetTypeFilter')?.value || '';
    const buildingFilter = document.getElementById('buildingFilter')?.value || '';
    const floorFilter = document.getElementById('floorFilter')?.value || '';
    const maintenanceSelect = document.getElementById('maintenanceFilter');
    const maintenanceFilters = maintenanceSelect ? Array.from(maintenanceSelect.selectedOptions).map(o => o.value) : [];
    
    filteredAssets = allAssets.filter(asset => {
        if (typeFilter && asset.type !== typeFilter) return false;
        if (buildingFilter && asset.building !== buildingFilter) return false;
        if (floorFilter && asset.floor !== floorFilter) return false;
        
        if (maintenanceFilters && maintenanceFilters.length > 0) {
            const maintenanceStatus = getMaintenanceStatus(asset);
            const isInMaintenance = asset.status === 'in maintenance';
            const isFault = asset.status === 'fault/shutdown';
            const matches = maintenanceFilters.some(f => {
                if (f === 'in-maintenance') return isInMaintenance;
                if (f === 'fault-shutdown') return isFault;
                if (f === 'due-soon') return maintenanceStatus === 'due-soon';
                if (f === 'overdue') return maintenanceStatus === 'overdue';
                return false;
            });
            if (!matches) return false;
        }
        
        return true;
    });
    
    displayAssets();
}

// Get maintenance status for an asset
function getMaintenanceStatus(asset) {
    if (asset.status === 'in maintenance') return 'in-maintenance';
    
    const today = new Date();
    const nextMaintenance = parseDate(asset.nextMaintenanceDate);
    const diffDays = Math.ceil((nextMaintenance - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 30) return 'due-soon';
    return 'normal';
}

// Display filtered assets
function displayAssets() {
    const container = document.getElementById('assetsContainer');
    if (!container) return;
    
    if (filteredAssets.length === 0) {
        container.innerHTML = `
            <div class="col s12">
                <div class="card-panel" style="text-align: center; padding: 40px;">
                    <i class="material-icons" style="font-size: 48px; color: #94a3b8;">search_off</i>
                    <p style="color: #64748b; margin-top: 10px;">No assets found matching the selected filters.</p>
                </div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredAssets.map((asset, index) => {
        const maintenanceStatus = getMaintenanceStatus(asset);
        const statusClass = asset.status.replace(/[\s\/]/g, '-').toLowerCase();
        const maintenanceClass = maintenanceStatus === 'overdue' ? 'maintenance-overdue' : 
                               maintenanceStatus === 'due-soon' ? 'maintenance-due-soon' : '';
        
        const assetIcons = (typeof ASSET_ICONS !== 'undefined' && ASSET_ICONS) ? ASSET_ICONS : {
            'generator': 'power',
            'chiller': 'ac_unit',
            'ups': 'battery_charging_full',
            'pac-unit': 'air',
            'fan-wall-unit': 'air',
            'power-train-unit': 'electrical_services',
            'default': 'settings'
        };
        const icon = assetIcons[asset.type] || assetIcons.default || 'settings';
        
        let badge = '';
        if (maintenanceStatus === 'overdue') {
            badge = `<span class="asset-label overdue"><i class="material-icons tiny">warning</i> Maintenance Overdue</span>`;
        } else if (maintenanceStatus === 'due-soon') {
            badge = `<span class="asset-label due-soon"><i class="material-icons tiny">schedule</i> Due Soon</span>`;
        }
        
        return `
            <div class="col s12 m6 l4 asset-col" style="animation-delay: ${index * 0.1}s">
                <div class="card asset-card ${maintenanceClass}" onclick="showAssetDetails('${asset.id}')">
                    <div class="asset-card-content">
                        <div class="asset-card-header">
                            <i class="material-icons asset-icon">${icon}</i>
                            <span class="asset-name">${asset.name}</span>
                        </div>
                        <div class='asset-label-row'>${badge}</div>
                        <div class="asset-card-details">
                            <span class="asset-type">${asset.type.replace(/-/g, ' ').toUpperCase()}</span>
                            <span class="asset-location">${asset.building ? asset.building : ''}${asset.floor ? ', Level ' + asset.floor : ''}</span>
                        </div>
                        <div class="asset-card-status-row">
                            <span class="asset-status-label">Status:</span>
                            <span class="status-${statusClass}">${asset.status}</span>
                        </div>
                        <div class="asset-card-nextmaint-row">
                            <span class="asset-status-label">Next Maintenance:</span>
                            <span>${asset.nextMaintenanceDate || '-'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Clear all filters
function clearFilters() {
    const filters = ['assetTypeFilter', 'buildingFilter', 'floorFilter', 'maintenanceFilter'];
    filters.forEach(filterId => {
        const element = document.getElementById(filterId);
        if (element) {
            if (element.multiple) {
                Array.from(element.options).forEach(opt => (opt.selected = false));
            } else {
                element.value = '';
            }
        }
    });
    
    // Reinitialize Materialize selects
    M.FormSelect.init(document.querySelectorAll('select'));
    
    // Refilter assets
    filterAssets();
}

// Search assets by name or type
function searchAssets(searchTerm) {
    if (!searchTerm || searchTerm.length < 2) {
        filterAssets(); // Reset to filtered view
        return;
    }
    
    const searchLower = searchTerm.toLowerCase();
    filteredAssets = allAssets.filter(asset => {
        return asset.name.toLowerCase().includes(searchLower) ||
               asset.type.toLowerCase().includes(searchLower) ||
               asset.building.toLowerCase().includes(searchLower) ||
               asset.manufacturer.toLowerCase().includes(searchLower) ||
               asset.model.toLowerCase().includes(searchLower);
    });
    
    displayAssets();
}

// Sort assets by different criteria
function sortAssets(criteria, direction = 'asc') {
    filteredAssets.sort((a, b) => {
        let valueA, valueB;
        
        switch (criteria) {
            case 'name':
                valueA = a.name.toLowerCase();
                valueB = b.name.toLowerCase();
                break;
            case 'type':
                valueA = a.type.toLowerCase();
                valueB = b.type.toLowerCase();
                break;
            case 'status':
                valueA = a.status.toLowerCase();
                valueB = b.status.toLowerCase();
                break;
            case 'nextMaintenance':
                valueA = parseDate(a.nextMaintenanceDate);
                valueB = parseDate(b.nextMaintenanceDate);
                break;
            case 'building':
                valueA = a.building.toLowerCase();
                valueB = b.building.toLowerCase();
                break;
            default:
                return 0;
        }
        
        if (valueA < valueB) return direction === 'asc' ? -1 : 1;
        if (valueA > valueB) return direction === 'asc' ? 1 : -1;
        return 0;
    });
    
    displayAssets();
}

// Make functions available globally
window.updateStatistics = updateStatistics;
window.populateFilters = populateFilters;
window.filterAssets = filterAssets;
window.getMaintenanceStatus = getMaintenanceStatus;
window.displayAssets = displayAssets;
window.clearFilters = clearFilters;
window.searchAssets = searchAssets;
window.sortAssets = sortAssets;
window.filteredAssets = filteredAssets;
