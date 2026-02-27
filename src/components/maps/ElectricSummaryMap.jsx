"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { GoogleMapsOverlay } from '@deck.gl/google-maps';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { parseVehicleCSV, aggregateByState } from '@/utils/csvParser';

const LIBRARIES = ['places', 'visualization'];
const US_CENTER = { lat: 39.8283, lng: -98.5795 };
const MIN_PIN_SIZE = 2; // For plants
const MAX_PIN_SIZE = 12; // For plants

const MAP_CONTAINER_STYLE = {
  width: '100%',
  height: '100%',
  borderRadius: '12px',
};

const MAP_OPTIONS = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
};

// --- DECK.GL OVERLAY (Heatmap) ---
function DeckGlOverlay({ mapInstance, vehicleHeatmapData }) {
  const deckRef = useRef(null);

  useEffect(() => {
    if (!mapInstance || deckRef.current) return;
    const deck = new GoogleMapsOverlay({ layers: [] });
    deckRef.current = deck;

    const timeoutId = setTimeout(() => {
      try { deck.setMap(mapInstance); } catch (error) {}
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (deckRef.current) {
        try { deckRef.current.setMap(null); deckRef.current = null; } catch (error) {}
      }
    };
  }, [mapInstance]);

  useEffect(() => {
    const deck = deckRef.current;
    if (!deck || !mapInstance || !vehicleHeatmapData || vehicleHeatmapData.length === 0) {
      if (deck) deck.setProps({ layers: [] });
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
        radiusPixels: 150,
        intensity: 2.5,
        threshold: 0.02,
        colorRange: [
          [100, 255, 100, 180],
          [150, 255, 50, 200],
          [255, 255, 0, 220],
          [255, 200, 0, 230],
          [255, 150, 0, 240],
          [255, 50, 0, 255]
        ],
        aggregation: 'SUM',
        opacity: 0.5
      });
      deck.setProps({ layers: [layer] });
    } catch (error) {}
  }, [vehicleHeatmapData, mapInstance]);

  return null;
}

export default function ElectricSummaryMap() {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  const [mapInstance, setMapInstance] = useState(null);
  
  // Data States
  const [plants, setPlants] = useState([]);
  const [stations, setStations] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchJSON = async (url) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error(`Failed to fetch ${url}:`, e);
      return { success: false, data: [] };
    }
  };

  // 1. Fetch All Data
  useEffect(() => {
    if (!isLoaded) return;

    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [plantsRes, stationsRes, vehiclesRes] = await Promise.all([
          fetchJSON('/api/electric-production-plants'),
          fetchJSON('/api/fuel-stations?type=ELEC'), 
          parseVehicleCSV('all').catch(() => []) 
        ]);

        if (plantsRes?.success) setPlants(plantsRes.data || []);
        if (stationsRes?.success) setStations(stationsRes.data || []);
        if (vehiclesRes) setVehicles(vehiclesRes);

      } catch (err) {
        console.error("Failed to compile electric summary map data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [isLoaded]);

  // 2. Process Heatmap Data
  const vehicleHeatmapData = useMemo(() => {
    if (vehicles.length === 0 || !isLoaded) return [];

    const elecVehicles = vehicles.filter(v => v.fuel_type?.toLowerCase() === 'electric');
    const aggregated = aggregateByState(elecVehicles);

    if (aggregated.length === 0) return [];

    const max = Math.max(...aggregated.map(state => state.totalVehicles), 1);
    const min = Math.min(...aggregated.map(state => state.totalVehicles), 1);

    return aggregated.map((stateData) => {
      const logValue = Math.log10(stateData.totalVehicles + 1);
      const logMax = Math.log10(max + 1);
      const logMin = Math.log10(min + 1);
      const normalizedWeight = 0.3 + (0.7 * (logValue - logMin) / (logMax - logMin));

      return {
        location: { lat: stateData.lat, lng: stateData.lng },
        weight: normalizedWeight * 100,
      };
    });
  }, [vehicles, isLoaded]);

  // 3. Icons
  const getPlantIcon = useCallback((plant) => {
    if (!window.google || !plant) return null;

    const grossGen = plant.gross_generation ?? 0;
    const netGen = plant.net_generation ?? 0;

    const isGrossZero = grossGen === 0;
    const hasNetValue = netGen !== 0;

    let iconUrl = '/images/round1.png';
    let size;

    if (isGrossZero && hasNetValue) {
      iconUrl = '/images/round2.png';
      size = MIN_PIN_SIZE; 
    } else {
      const safeGen = Math.max(Math.abs(grossGen), 1); 
      const scale = Math.log(safeGen) / Math.log(1000000); 
      size = MIN_PIN_SIZE + (scale * (MAX_PIN_SIZE - MIN_PIN_SIZE));
      size = Math.max(MIN_PIN_SIZE, Math.min(size, MAX_PIN_SIZE));
    }

    return {
      url: iconUrl,
      scaledSize: new window.google.maps.Size(size, size),
      anchor: new window.google.maps.Point(size / 2, size / 2)
    };
  }, []);

  const getStationIcon = useCallback((station) => {
    if (!window.google) return null;
    const isAvailable = station.status_code === 'E';
    const isCommercial = station.access_code && station.access_code.toLowerCase() === 'private';
    
    let iconUrl;
    if (isAvailable) {
      iconUrl = isCommercial ? '/images/green-dot.png' : '/images/green.png';
    } else {
      iconUrl = isCommercial ? '/images/red-dot.png' : '/images/red.png';
    }

    return {
      url: iconUrl,
      scaledSize: new window.google.maps.Size(10, 10), // Reverted to 5px
      anchor: new window.google.maps.Point(5, 5),
    };
  }, []);

  const onLoad = useCallback((map) => {
    setMapInstance(map);
  }, []);

  if (!isLoaded) return <div style={{ height: '100%', background: '#f1f5f9', borderRadius: '12px' }} />;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '8px', overflow: 'hidden' }}>
      
      {loading && (
        <div style={{
          position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 50, background: 'white', padding: '8px 16px', borderRadius: '20px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)', fontWeight: '600', color: '#64748b'
        }}>
          Loading Map Data...
        </div>
      )}

      <GoogleMap 
        onLoad={onLoad}
        mapContainerStyle={MAP_CONTAINER_STYLE} 
        center={US_CENTER} 
        zoom={4} 
        options={MAP_OPTIONS}
      >

        {/* ELECTRIC PRODUCTION PLANTS */}
        {plants.map((plant, index) => {
          const iconData = getPlantIcon(plant);
          if (!iconData) return null;
          
          return (
            <Marker
              key={`plant-${plant.plant_code}-${index}`}
              position={{ lat: plant.latitude, lng: plant.longitude }}
              icon={iconData}
              clickable={false} // Disabled interactions
              zIndex={100} 
            />
          );
        })}

        {/* FUEL STATIONS */}
        {stations.map((s, index) => {
          const iconData = getStationIcon(s);
          if (!iconData) return null;

          return (
            <Marker
              key={`station-${s.station_id || index}`}
              position={{ lat: s.lat, lng: s.lng }}
              icon={iconData}
              clickable={false} // Disabled interactions
              zIndex={50}
            />
          );
        })}

        {/* HEATMAP */}
        {mapInstance && vehicleHeatmapData.length > 0 && (
          <DeckGlOverlay mapInstance={mapInstance} vehicleHeatmapData={vehicleHeatmapData} />
        )}

      </GoogleMap>
    </div>
  );
}