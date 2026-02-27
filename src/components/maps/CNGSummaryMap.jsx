"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from "@react-google-maps/api";
import { GoogleMapsOverlay } from '@deck.gl/google-maps';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { parseVehicleCSV, aggregateByState } from '@/utils/csvParser';

const LIBRARIES = ['places', 'visualization'];
const US_CENTER = { lat: 39.8283, lng: -98.5795 };
const MIN_PIN_SIZE = 5;
const MAX_PIN_SIZE = 20;

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

const PIPELINE_OPTIONS = {
  strokeColor: "#dc2626",
  strokeOpacity: 0.8,
  strokeWeight: 1,
  clickable: false, // Disabled clicking
  zIndex: 1
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

export default function CNGSummaryMap() {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  const [mapInstance, setMapInstance] = useState(null);
  
  // Data States
  const [plants, setPlants] = useState([]);
  const [pipelines, setPipelines] = useState([]);
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

  // 1. Fetch All Data Safely
  useEffect(() => {
    if (!isLoaded) return;

    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [plantsRes, pipesRes, stationsRes, vehiclesRes] = await Promise.all([
          fetchJSON('/api/cng-production-plants'),
          fetchJSON('/api/cng-pipelines'),
          fetchJSON('/api/fuel-stations?type=CNG'),
          parseVehicleCSV('all').catch(() => []) 
        ]);

        if (plantsRes?.success) setPlants(plantsRes.data || []);
        if (pipesRes?.success) setPipelines(pipesRes.data || []);
        if (stationsRes?.success) setStations(stationsRes.data || []);
        if (vehiclesRes) setVehicles(vehiclesRes);

      } catch (err) {
        console.error("Failed to compile summary map data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [isLoaded]);

  // 2. Process Pipelines
  const processedPipelines = useMemo(() => {
    if (!pipelines || pipelines.length === 0) return [];

    const extractPaths = (coords) => {
      if (!Array.isArray(coords) || coords.length === 0) return [];
      const firstItem = coords[0];
      if (!firstItem) return [];

      const isPoint = Array.isArray(firstItem) && firstItem.length >= 2 && typeof firstItem[0] === 'number';
      if (isPoint) return [coords];
      
      if (Array.isArray(firstItem)) {
        return coords.flatMap(child => extractPaths(child));
      }
      return [];
    };

    const drawablePaths = [];
    pipelines.forEach((pipe) => {
      try {
        if (!pipe.coordinates) return;
        const rawCoords = typeof pipe.coordinates === 'string' ? JSON.parse(pipe.coordinates) : pipe.coordinates;
        const paths = extractPaths(rawCoords);

        paths.forEach(pathSegment => {
          if (pathSegment.length > 0) {
            const googlePath = pathSegment.map(c => ({ lat: c[1], lng: c[0] }));
            drawablePaths.push({ ...pipe, path: googlePath });
          }
        });
      } catch (e) { }
    });
    return drawablePaths;
  }, [pipelines]);

  // 3. Process Heatmap Data
  const vehicleHeatmapData = useMemo(() => {
    if (vehicles.length === 0 || !isLoaded) return [];

    const cngVehicles = vehicles.filter(v => v.fuel_type?.toLowerCase() === 'cng');
    const aggregated = aggregateByState(cngVehicles);

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

  // 4. Icons
  const getPlantIcon = useCallback((capacity) => {
    if (!window.google) return null;
    const safeCapacity = Math.max(Math.abs(capacity || 0), 1); 
    const scale = Math.log(safeCapacity) / Math.log(100000); 
    let size = MIN_PIN_SIZE + (scale * (MAX_PIN_SIZE - MIN_PIN_SIZE));
    size = Math.max(MIN_PIN_SIZE, Math.min(size, MAX_PIN_SIZE));
    return {
      url: '/images/round1.png',
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
        {/* PIPELINES */}
        {processedPipelines.map((pipe, idx) => (
          <Polyline
            key={`pipe-${idx}`}
            path={pipe.path}
            options={PIPELINE_OPTIONS}
          />
        ))}

        {/* PRODUCTION PLANTS */}
        {plants.map((plant, index) => {
          const iconData = getPlantIcon(plant.capacity);
          if (!iconData) return null;
          
          return (
            <Marker
              key={`plant-${index}`}
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