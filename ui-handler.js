// UI handler for the Glasgow Mapping Application
class UIHandler {
    constructor() {
        this.infoPanel = document.getElementById('selected-land-info');
        this.plotsList = document.getElementById('plots-list');
        this.searchInput = document.getElementById('search-input');
    }

    // Initialize the UI
    async initialize() {
        // Initialize the map
        const map = dataHandler.initializeMap();
        
        // Wait for the map to load
        if (!map.loaded()) {
            await new Promise(resolve => map.on('load', resolve));
        }
        
        // Fetch data and add layers
        await dataHandler.fetchData();
        dataHandler.renderData();
        
        // Set up event listeners
        this.setupEventListeners(map);
        
        // Populate the plots list
        this.populatePlotsList(dataHandler.getEmptyLands());
    }
    
    // Set up event listeners for user interactions
    setupEventListeners(map) {
        // Click event for selecting empty lands
        map.on('click', 'empty-lands', e => {
            if (e.features && e.features.length > 0) {
                const landId = e.features[0].properties.id;
                const updatedFeature = dataHandler.toggleLandSelection(landId);
                
                this.updateInfoPanel();
                this.updatePlotsList();
            }
        });
        
        // Change cursor on hover over lands
        map.on('mouseenter', 'empty-lands', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        
        map.on('mouseleave', 'empty-lands', () => {
            map.getCanvas().style.cursor = '';
        });
        
        // Click event for railway stations
        map.on('click', 'railway-stations', e => {
            if (e.features && e.features.length > 0) {
                const coordinates = e.features[0].geometry.coordinates.slice();
                const description = e.features[0].properties.description;
                
                new mapboxgl.Popup()
                    .setLngLat(coordinates)
                    .setHTML(`<h4>${description}</h4>`)
                    .addTo(map);
            }
        });
        
        // Change cursor on hover over stations
        map.on('mouseenter', 'railway-stations', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        
        map.on('mouseleave', 'railway-stations', () => {
            map.getCanvas().style.cursor = '';
        });
        
        // Search input event
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => {
                const query = this.searchInput.value;
                this.populatePlotsList(dataHandler.searchLands(query));
            });
        }
    }
    
    // Update the information panel with selected land
    updateInfoPanel() {
        if (!this.infoPanel) return;
        
        this.infoPanel.innerHTML = '';
        
        const selectedLand = dataHandler.getSelectedLand();
        
        if (!selectedLand) {
            this.infoPanel.innerHTML = '<p>No land selected. Click on a highlighted area to select.</p>';
            return;
        }
        
        const header = document.createElement('h4');
        header.textContent = 'Selected Land:';
        this.infoPanel.appendChild(header);
        
        const landDiv = document.createElement('div');
        landDiv.className = 'selected-land';
        
        const properties = selectedLand.properties;
        
        landDiv.innerHTML = `
            <strong>ID:</strong> ${properties.id}<br>
            <strong>Owner:</strong> ${properties.owner}<br>
            <strong>Area:</strong> ${properties.area.toFixed(2)} m²<br>
            ${properties.description ? `<strong>Description:</strong> ${properties.description}<br>` : ''}
        `;
        
        this.infoPanel.appendChild(landDiv);
    }
    
    // Populate the plots list with all available lands
    populatePlotsList(lands) {
        if (!this.plotsList) return;
        
        this.plotsList.innerHTML = '';
        
        if (!lands || lands.length === 0) {
            this.plotsList.innerHTML = '<p>No lands found matching your criteria.</p>';
            return;
        }
        
        for (const land of lands) {
            const landItem = document.createElement('div');
            landItem.className = 'plot-item';
            if (land.properties.selected) {
                landItem.classList.add('selected');
            }
            
            const properties = land.properties;
            
            landItem.innerHTML = `
                <h4>${properties.description || 'Land Plot'}</h4>
                <p><strong>Owner:</strong> ${properties.owner}</p>
                <p><strong>Area:</strong> ${properties.area.toFixed(2)} m²</p>
            `;
            
            // Add click event to select/deselect the land
            landItem.addEventListener('click', () => {
                dataHandler.toggleLandSelection(properties.id);
                this.updateInfoPanel();
                this.updatePlotsList();
            });
            
            this.plotsList.appendChild(landItem);
        }
    }
    
    // Update the plots list to reflect current selection state
    updatePlotsList() {
        this.populatePlotsList(dataHandler.getEmptyLands());
    }
}

// Create a UI handler instance
const uiHandler = new UIHandler();

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    uiHandler.initialize();
});