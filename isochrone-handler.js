// Improved Isochrone handler for Glasgow Mapping Application
// This file handles the isochrone analysis for public transport accessibility

// Mapbox token (using the same token as in data-handler.js)
const mapboxToken = 'pk.eyJ1IjoiaGVzaGFtc2hhd3F5IiwiYSI6ImNrdnBvY2UwcTFkNDkzM3FmbTFhenM0M3MifQ.ZqIuL9khfbCyOF3DU_IH5w';

// Time in minutes for the isochrone
const minutes = 8;

// Track if isochrones are currently displayed
let isochronesVisible = false;

// Generate isochrones for a selected land
async function generateIsochrones(feature) {
    if (!feature || !feature.properties.center) {
        alert('No valid plot selected for accessibility analysis');
        return;
    }
    
    const center = feature.properties.center;
    const map = dataHandler.map;
    
    // Clear any existing isochrones
    clearIsochrones();
    
    try {
        // Construct the Mapbox Isochrone API URL for public transport
        // Note: Mapbox doesn't have a direct "public transport" profile, but we can use "driving-traffic"
        // as a reasonable approximation for public transport in urban areas
        const url = `https://api.mapbox.com/isochrone/v1/mapbox/driving-traffic/${center[0]},${center[1]}?contours_minutes=${minutes}&polygons=true&access_token=${mapboxToken}&generalize=0`;
        
        // Fetch isochrone data
        const response = await fetch(url);
        const data = await response.json();
        
        // Add source if it doesn't exist
        if (!map.getSource('iso')) {
            map.addSource('iso', {
                type: 'geojson',
                data: data
            });
        } else {
            map.getSource('iso').setData(data);
        }
        
        // Add layer if it doesn't exist
        if (!map.getLayer('isoLayer')) {
            map.addLayer({
                'id': 'isoLayer',
                'type': 'fill',
                'source': 'iso',
                'layout': {},
                'paint': {
                    'fill-color': '#5a3fc0',
                    'fill-opacity': 0.3,
                    'fill-outline-color': '#5a3fc0'
                }
            }, 'empty-lands-outline'); // Add below the land outlines
        }
        
        // Update toggle button text
        const toggleButton = document.getElementById('isochrone-toggle');
        if (toggleButton) {
            toggleButton.textContent = `Hide ${minutes}-min Access`;
        }
        
        isochronesVisible = true;
        
        // Calculate and display the accessibility score
        calculateAccessibilityScore(data, feature);
        
    } catch (error) {
        console.log('Error generating isochrones:', error);
        alert('Could not generate accessibility analysis. Please try again.');
    }
}

// Clear all isochrone layers
function clearIsochrones() {
    const map = dataHandler.map;
    if (!map) return;
    
    // Remove layer and source if they exist
    if (map.getLayer('isoLayer')) {
        map.removeLayer('isoLayer');
    }
    
    if (map.getSource('iso')) {
        map.removeSource('iso');
    }
    
    // Update toggle button text
    const toggleButton = document.getElementById('isochrone-toggle');
    if (toggleButton) {
        toggleButton.textContent = `Show ${minutes}-min Access`;
    }
    
    // Remove score display
    const scoreContainer = document.getElementById('accessibility-score');
    if (scoreContainer) {
        scoreContainer.innerHTML = '';
    }
    
    isochronesVisible = false;
}

// Calculate a simple accessibility score based on isochrone area
function calculateAccessibilityScore(isochroneData, feature) {
    if (!isochroneData.features || isochroneData.features.length === 0) return;
    
    // Get the area of the isochrone polygon
    let area = 0;
    
    // Loop through all features (there might be multiple polygons)
    for (const isoFeature of isochroneData.features) {
        // Use a more accurate area calculation
        area += calculateGeoJSONArea(isoFeature);
    }
    
    // Normalize to a 0-100 score (larger area = better accessibility)
    // Using a more appropriate divisor for the Glasgow area
    const score = Math.min(100, Math.max(1, Math.sqrt(area) / 100));
    
    // Display the score
    displayAccessibilityScore(Math.round(score), feature);
}

// Calculate area of a GeoJSON feature in square meters
function calculateGeoJSONArea(feature) {
    if (!feature || !feature.geometry || !feature.geometry.coordinates) return 0;
    
    const coords = feature.geometry.coordinates;
    let area = 0;
    
    // Handle different geometry types
    if (feature.geometry.type === 'Polygon') {
        area = calculatePolygonArea(coords);
    } else if (feature.geometry.type === 'MultiPolygon') {
        for (const polygon of coords) {
            area += calculatePolygonArea(polygon);
        }
    }
    
    return area;
}

// Calculate area of a polygon in square meters
function calculatePolygonArea(polygonCoords) {
    if (!polygonCoords || polygonCoords.length === 0) return 0;
    
    // Get the outer ring of the polygon
    const ring = polygonCoords[0];
    if (!ring || ring.length < 4) return 0;
    
    // Calculate area using the Shoelace formula (Gauss's area formula)
    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) {
        const p1 = ring[i];
        const p2 = ring[i + 1];
        area += (p1[0] * p2[1]) - (p2[0] * p1[1]);
    }
    
    // Convert to square meters using an approximation
    // This is a rough approximation that works reasonably well for small areas
    const earthRadius = 6371000; // Earth radius in meters
    const degToRad = Math.PI / 180;
    
    // Get the center latitude of the polygon for the conversion
    let centerLat = 0;
    for (const point of ring) {
        centerLat += point[1];
    }
    centerLat /= ring.length;
    centerLat *= degToRad;
    
    // Convert square degrees to square meters
    const metersPerDegreeLatitude = earthRadius * degToRad;
    const metersPerDegreeLongitude = earthRadius * Math.cos(centerLat) * degToRad;
    
    return Math.abs(area) * metersPerDegreeLatitude * metersPerDegreeLongitude / 2;
}

// Display the accessibility score in the UI
function displayAccessibilityScore(score, feature) {
    // Create or get the score container
    let scoreContainer = document.getElementById('accessibility-score');
    
    if (!scoreContainer) {
        // Create the container if it doesn't exist
        scoreContainer = document.createElement('div');
        scoreContainer.id = 'accessibility-score';
        scoreContainer.className = 'score-container';
        
        // Add it to the right panel
        const rightPanel = document.getElementById('right-panel');
        if (rightPanel) {
            rightPanel.appendChild(scoreContainer);
        } else {
            // Create right panel if it doesn't exist
            createRightPanel();
            document.getElementById('right-panel').appendChild(scoreContainer);
        }
    }
    
    // Set the content
    scoreContainer.innerHTML = `
        <h3>${minutes}-Minute Public Transport Access</h3>
        <p>Plot: ${feature.properties.description || 'Selected Land'}</p>
        <div class="score-display">
            <div class="score-number">${score}</div>
            <div class="score-bar">
                <div class="score-bar-fill" style="width: ${score}%; background-color: ${getScoreColor(score)};"></div>
            </div>
        </div>
        <p class="score-explanation">This score represents how accessible this location is within a ${minutes}-minute journey by public transport.</p>
    `;
}

// Get color based on score (red to green gradient)
function getScoreColor(score) {
    if (score < 30) return '#f44336'; // Red for poor accessibility
    if (score < 60) return '#ff9800'; // Orange for moderate accessibility
    return '#4caf50'; // Green for good accessibility
}

// Create right panel for UI elements
function createRightPanel() {
    // Check if it already exists
    if (document.getElementById('right-panel')) return;
    
    // Create the right panel
    const rightPanel = document.createElement('div');
    rightPanel.id = 'right-panel';
    rightPanel.className = 'right-panel';
    
    // Add to body
    document.body.appendChild(rightPanel);
}

// Add isochrone toggle button to the UI
function addIsochroneToggle() {
    // Create right panel if it doesn't exist
    createRightPanel();
    
    // Create toggle button
    const toggleButton = document.createElement('button');
    toggleButton.id = 'isochrone-toggle';
    toggleButton.className = 'isochrone-toggle';
    toggleButton.textContent = `Show ${minutes}-min Access`;
    
    // Add to right panel
    const rightPanel = document.getElementById('right-panel');
    rightPanel.appendChild(toggleButton);
    
    // Add click event
    toggleButton.addEventListener('click', () => {
        const selectedLand = dataHandler.getSelectedLand();
        
        if (selectedLand) {
            if (isochronesVisible) {
                // If isochrones are already shown, clear them
                clearIsochrones();
            } else {
                // Otherwise, generate new isochrones
                generateIsochrones(selectedLand);
            }
        } else {
            alert('Please select a plot first to analyze accessibility.');
        }
    });
}

// Add CSS styles for isochrone UI
function addIsochroneStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .right-panel {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 300px;
            z-index: 10;
            display: flex;
            flex-direction: column;
        }
        
        .isochrone-toggle {
            margin: 10px;
            padding: 8px 16px;
            background-color: #5a3fc0;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
        }
        
        .isochrone-toggle:hover {
            background-color: #4a32a0;
        }
        
        .score-container {
            background: white;
            padding: 10px;
            border-radius: 4px;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            margin: 10px;
        }
        
        .score-display {
            display: flex;
            align-items: center;
            margin: 15px 0;
        }
        
        .score-number {
            font-size: 24px;
            font-weight: bold;
            margin-right: 15px;
            min-width: 40px;
        }
        
        .score-bar {
            flex-grow: 1;
            height: 12px;
            background-color: #f0f0f0;
            border-radius: 6px;
            overflow: hidden;
        }
        
        .score-bar-fill {
            height: 100%;
            border-radius: 6px;
        }
        
        .score-explanation {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
        }
    `;
    
    document.head.appendChild(style);
}

// Initialize isochrone functionality
function initializeIsochrones() {
    // Add CSS for isochrone UI
    addIsochroneStyles();
    
    // Add toggle button
    addIsochroneToggle();
    
    // Create score container
    const scoreContainer = document.createElement('div');
    scoreContainer.id = 'accessibility-score';
    scoreContainer.className = 'score-container';
    
    // Add to right panel
    createRightPanel();
    document.getElementById('right-panel').appendChild(scoreContainer);
    
    // Listen for land selection changes
    document.addEventListener('landSelectionChanged', (e) => {
        // If isochrones are visible, update them for the new selection
        if (isochronesVisible && e.detail && e.detail.feature) {
            generateIsochrones(e.detail.feature);
        } else {
            // Otherwise just clear existing isochrones
            clearIsochrones();
        }
    });
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', initializeIsochrones);