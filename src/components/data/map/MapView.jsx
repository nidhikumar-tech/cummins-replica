"use client";

import { GoogleMap, Marker, InfoWindow } from "@react-google-maps/api";
import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { GoogleMapsOverlay } from '@deck.gl/google-maps';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';

const mapContainerStyle = {
  width: '100%',
  height: '600px',
};

const US_CENTER = {
  lat: 39.8283,
  lng: -98.5795,
};

// --- url to pin images ---
const PIN_IMAGES = {
  // AVAILABLE (Status: 'E')
  available_public:     '/images/green.png',      
  available_commercial: '/images/green-dot.png',        
  
  // PLANNED (Status: 'P')
  planned_public:       '/images/red.png',    
  planned_commercial:   '/images/red-dot.png',     
};

const getPlantIconUrl = (fuelType) => {
  if (!fuelType) return '/images/blue-pin.png'; // Fallback
  
  const type = fuelType.toLowerCase();
  
  if (type.includes('cng')) return '/images/pink-pin.png';
  if (type.includes('elec')) return '/images/blue-pin.png';
  
  return '/images/blue-pin.png'; // Default to electric/blue if unknown
};

// --- DECK.GL OVERLAY (Heatmap) ---
function DeckGlOverlay({ mapInstance, vehicleHeatmapData }) {
  const deckRef = useRef(null);

  useEffect(() => {
    if (!mapInstance || deckRef.current) return;
    const deck = new GoogleMapsOverlay({ layers: [] });
    deckRef.current = deck;

    const timeoutId = setTimeout(() => {
      try { deck.setMap(mapInstance); } 
      catch (error) { }
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (deckRef.current) {
        try { deckRef.current.setMap(null); deckRef.current = null; } 
        catch (error) { }
      }
    };
  }, [mapInstance]);

  useEffect(() => {
    const deck = deckRef.current;
    if (!deck || !mapInstance) return;

    if (!vehicleHeatmapData || vehicleHeatmapData.length === 0) {
      deck.setProps({ layers: [] });
      return;
    }

    try {
      const deckData = vehicleHeatmapData.map(d => ({
        position: [d.location.lng, d.location.lat],
        weight: d.weight
      }));

      const layer = new HeatmapLayer({
        id: 'vehicle-heatmap-layer',
        data: deckData,
        getPosition: d => d.position,
        getWeight: d => d.weight,
        radiusPixels: 150,        // Slightly reduced for better definition
        intensity: 2.5,            // Adjusted for better balance
        threshold: 0.02,           // Fine-tuned threshold
        colorRange: [
          [100, 255, 100, 180],    // Bright green (low) - more visible
          [150, 255, 50, 200],     // Yellow-green
          [255, 255, 0, 220],      // Yellow (medium-low)
          [255, 200, 0, 230],      // Orange (medium)
          [255, 150, 0, 240],      // Red-orange (medium-high)
          [255, 50, 0, 255]        // Red (high)
        ],
        aggregation: 'SUM',
        opacity: 0.5
      });
      deck.setProps({ layers: [layer] });
    } catch (error) { }
  }, [vehicleHeatmapData, mapInstance]);

  return null;
}


export default function MapView({ 
  onLoad, 
  filteredStations, 
  selectedStation, 
  setSelectedStation,
  showHeatmap,
  vehicleHeatmapData,
  mapInstance,
  productionPlants,      // New Prop
  showProductionPlants   // New Prop
}) {
  
  // ========== FIX: Debounce ref to prevent hover flickering ==========
  const hoverTimeoutRef = useRef(null);
  const plantHoverTimeoutRef = useRef(null); 
  // ===================================================================
  
  // --- 1. STATIC IMAGE PIN LOGIC (Fuel Stations) ---
  const getIcon = useCallback((station) => {
    // Check Status
    const isAvailable = station.status_code === 'E';
    // Check Access (Commercial/Private vs Public)
    const isCommercial = station.access_code && station.access_code.toLowerCase() === 'private';

    // Select Image URL based on the 4 combinations
    let iconUrl;
    if (isAvailable) {
      iconUrl = isCommercial ? PIN_IMAGES.available_commercial : PIN_IMAGES.available_public;
    } else {
      iconUrl = isCommercial ? PIN_IMAGES.planned_commercial : PIN_IMAGES.planned_public;
    }

    return {
      url: iconUrl,
      scaledSize: new window.google.maps.Size(10, 10), 
      anchor: new window.google.maps.Point(6, 6),    
    };
  }, []);
/*
  // --- 2. PRODUCTION PLANT ICON LOGIC ---
  const plantIcon = useMemo(() => ({
    url: '/images/round1.png',
    scaledSize: new window.google.maps.Size(30, 30), 
    anchor: new window.google.maps.Point(15, 15)     
  }), []);
*/

  // --- 3. STATE FOR PLANT POPUP ---
  const [selectedPlant, setSelectedPlant] = useState(null);

  // ========== FIX: Cleanup timeout on unmount to prevent memory leaks ==========
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (plantHoverTimeoutRef.current) {
      clearTimeout(plantHoverTimeoutRef.current);
      }
    };
  }, []);
  // ============================================================================

  const shouldShowMarkers = showHeatmap === 'markers' || showHeatmap === 'both';
  const shouldShowHeatmap = showHeatmap === 'heatmap' || showHeatmap === 'both';

  const usBounds = {
  north: 85,       // near the North Pole
  south: -60,      // well below South America and Australia
  west: -175,      // covers Pacific, Alaska, Hawaii with margin
  east: 20,        // extends into Europe/Africa for exploration
};

const mapOptions = {
  restriction: {
    latLngBounds: usBounds,
    strictBounds: true,
  },
  minZoom: 2,
  noWrap: true,
};

  return (
    <GoogleMap
      options={mapOptions}
      onLoad={onLoad}
      mapContainerStyle={mapContainerStyle}
      center={US_CENTER}
      zoom={4}
    >
      {/* --- RENDER FUEL STATIONS --- */}
      {shouldShowMarkers && filteredStations.map((s, index) => (
        <Marker
          key={`${s.station_id || s.ID || 'unknown'}-${index}`}
          position={{ lat: s.lat, lng: s.lng }}
          icon={getIcon(s)}
          // onClick={() => setSelectedStation(s)}
          onMouseOver={() => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            setSelectedStation(s);
          }}
          onMouseOut={() => {
            hoverTimeoutRef.current = setTimeout(() => {
              setSelectedStation(null);
            }, 200);
          }}
        />
      ))}

      {/* --- RENDER PRODUCTION PLANTS --- */}
      {showProductionPlants && productionPlants && productionPlants.map((plant, index) => (
        <Marker
          key={`plant-${index}`}
          position={{ lat: plant.lat, lng: plant.lng }}
          icon={{
             url: getPlantIconUrl(plant.fuel_type),
             scaledSize: new window.google.maps.Size(30, 30), 
             anchor: new window.google.maps.Point(15, 15)
          }}
          // onClick={() => setSelectedPlant(plant)}
          onMouseOver={() => {
            if (plantHoverTimeoutRef.current) clearTimeout(plantHoverTimeoutRef.current);
            setSelectedPlant(plant);
          }}
          onMouseOut={() => {
            plantHoverTimeoutRef.current = setTimeout(() => {
              setSelectedPlant(null);
            }, 200);
          }}
          zIndex={1000} // Keeps plants on top of fuel stations
        />
      ))}

      {/* Info Window for Fuel Stations */}
      {selectedStation && (
        <InfoWindow
          position={{ lat: selectedStation.lat, lng: selectedStation.lng }}
          onCloseClick={() => setSelectedStation(null)}
        >
          {/* ========== FIX: Prevent closing when hovering over InfoWindow ========== */}
          <div 
            style={{minWidth: '200px',maxWidth: '300px',}}
            onMouseEnter={() => {
              if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            }}
            onMouseLeave={() => {
              setSelectedStation(null);
            }}
          >
          {/* ======================================================================= */}
            <h4 style={{margin: '0 0 4px', paddingBottom: '4px'}}>
              {selectedStation.station_name || "Station"}
            </h4>
            <div style={{    display: 'flex',    gap: '8px',    marginBottom: '8px',    flexWrap: 'wrap'}}>
                <span style={{    fontSize: '10px',    padding: '2px 6px',    borderRadius: '4px',    color: '#374151',    fontWeight: 'bold',    border: '1px solid #d1d5db', background: (selectedStation.access_code || '').toLowerCase() === 'private' ? '#e5e7eb' : '#f3f4f6'}}>
                    {(selectedStation.access_code || 'PUBLIC').toUpperCase()}
                </span>
                
                <span style={{    fontSize: 10,    padding: '2px 6px',    borderRadius: 4,    color: '#374151',    fontWeight: 'bold', border: '1px solid #d1d5db', background: selectedStation.status_code === 'E' ? '#DBEAFE' : '#FFF7ED', color: selectedStation.status_code === 'E' ? '#1E40AF' : '#9A3412', borderColor: selectedStation.status_code === 'E' ? '#93C5FD' : '#FED7AA'}}>
                    {selectedStation.status_code === 'E' ? 'AVAILABLE' : 'PLANNED'}
                </span>
            </div>
            
            <p style={{margin: '4px 0', fontSize: '13px'}}>
              <strong>Fuel Type:</strong> {selectedStation.fuel_type?.toUpperCase()}
            </p>
            <p style={{margin: '4px 0', fontSize: '13px'}}>
              <strong>Address:</strong> {selectedStation.street_address || 'N/A'}
            </p>
          </div>
        </InfoWindow>
      )}

      {/* Info Window for Production Plant */}
      {selectedPlant && (
        <InfoWindow
          position={{ lat: selectedPlant.lat, lng: selectedPlant.lng }}
          onCloseClick={() => setSelectedPlant(null)}
        >
          <div 
            style={{minWidth: '200px', maxWidth: '300px'}}
            onMouseEnter={() => {
              if (plantHoverTimeoutRef.current) clearTimeout(plantHoverTimeoutRef.current);
            }}
            onMouseLeave={() => {
              setSelectedPlant(null);
            }}
          >
            <h4 style={{margin: '0 0 4px', paddingBottom: '4px'}}>
              Production Plant
            </h4>
            
            <p style={{margin: '4px 0', fontSize: '13px'}} >
              <strong>Vendor:</strong> {selectedPlant.vendor || 'N/A'}
            </p>
            
            <p style={{margin: '4px 0', fontSize: '13px'}} >
              <strong>Operator:</strong> {selectedPlant.operator || 'N/A'}
            </p>
            
            <p style={{margin: '4px 0', fontSize: '13px'}} >
              <strong>Fuel Type:</strong> {selectedPlant.fuel_type ? selectedPlant.fuel_type.toUpperCase() : 'N/A'}
            </p>

            <p style={{margin: '4px 0', fontSize: '13px'}} >
              <strong>State: </strong> {selectedPlant.state}
            </p>

            <p style={{margin: '4px 0', fontSize: '13px'}} >
              <strong>Coordinates:</strong> {selectedPlant.lat.toFixed(4)}, {selectedPlant.lng.toFixed(4)}
            </p>


          </div>
        </InfoWindow>
      )}

      {/* --- HEATMAP OVERLAY --- */}
      {shouldShowHeatmap && mapInstance && vehicleHeatmapData && vehicleHeatmapData.length > 0 && (
        <DeckGlOverlay
          mapInstance={mapInstance}
          vehicleHeatmapData={vehicleHeatmapData}
        />
      )}
    </GoogleMap>
  );
}




