"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  LogarithmicScale
} from 'chart.js';
import { Line } from 'react-chartjs-2';


ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend, 
  Filler,
  LogarithmicScale
);

// Standard US State Codes (50 States + DC)
const US_STATES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA',
  'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY',
  'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX',
  'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
]);

export default function MinMaxChartCNG({ isSummaryView = false }) {
  const [yearwiseData, setYearwiseData] = useState([]);
  const [statewiseData, setStatewiseData] = useState([]);
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Mode filter - 'cumulative' (US aggregate) or 'statewise'
  const [mode, setMode] = useState('cumulative');

  // 1. Fetch both datasets on mount for smooth transitions
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch both yearwise (cumulative) and statewise data in parallel
        const [yearwiseResponse, statewiseResponse] = await Promise.all([
          fetch('/api/vehicle-data-for-min-max?year=all&dataType=yearwise'),
          fetch('/api/vehicle-data-for-min-max?year=all&dataType=statewise')
        ]);

        const [yearwiseResult, statewiseResult] = await Promise.all([
          yearwiseResponse.json(),
          statewiseResponse.json()
        ]);

        if (yearwiseResult.success && Array.isArray(yearwiseResult.data)) {
          setYearwiseData(yearwiseResult.data);
        }

        if (statewiseResult.success && Array.isArray(statewiseResult.data)) {
          setStatewiseData(statewiseResult.data);
          
          // Extract unique states, FILTER for only US states, and sort them
          const uniqueStates = [...new Set(statewiseResult.data.map(item => item.state))]
            .filter(state => US_STATES.has(state))
            .sort();
          
          setStates(uniqueStates);
          
          // Default to first state if available, prioritize 'CA' if it exists
          if (!selectedState && uniqueStates.length > 0) {
            setSelectedState(uniqueStates.includes('CA') ? 'CA' : uniqueStates[0]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch chart data:', err);
        setError('Failed to load chart data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []); // Fetch once on mount

  // 2. Prepare Chart Data based on mode and selected State using useMemo for smooth transitions
  const chartData = useMemo(() => {
    // Select data based on mode
    let rawData;
    let currentState;
    
    if (mode === 'cumulative') {
      rawData = yearwiseData;
      currentState = 'US';
    } else {
      rawData = statewiseData;
      currentState = selectedState;
    }
    
    if (!currentState || rawData.length === 0) return null;

    // Filter by selected state and Sort by Year
    const stateData = rawData
      .filter(d => d.state === currentState)
      .sort((a, b) => a.year - b.year);

    const labels = stateData.map(d => d.year);
    // Hardcoding the year as we only have data till 2025
    const currentYear = 2025;
    // If the data year is greater than current year, return null to stop drawing the line
    const actuals = stateData.map(d => 
        d.year > currentYear ? null : (d.actualVehicles !== undefined && d.actualVehicles !== null ? d.actualVehicles : null)
    );
    const forecasts = stateData.map(d => 
        (d.vehicleCount !== undefined && d.vehicleCount !== null && d.vehicleCount !== 0) 
        ? d.vehicleCount 
        : null
    );

    let minVal = Infinity;
    let maxVal = -Infinity;
    let minIndex = -1;
    let maxIndex = -1;

    stateData.forEach((d, index) => {
        // Only consider current year onwards for forecast highlights
        if (d.year >= currentYear) {
            const val = d.vehicleCount;
            if (val && val !== 0) {
            // STRICT INEQUALITY (<) ensures we only update if we find a SMALLER value.
            // If we find an EQUAL value later, we ignore it, preserving the FIRST one.
            if (val < minVal) {
                minVal = val;
                minIndex = index;
            }
          
            // STRICT INEQUALITY (>) ensures we only update if we find a LARGER value.
            // If we find an EQUAL value later, we ignore it, preserving the FIRST one.
            if (val > maxVal) {
                maxVal = val;
                maxIndex = index;
            }
          }
        }
    });

    // ============= START OF NEW CODE: CALCULATE DYNAMIC Y-AXIS MAX =============
    // Calculate the absolute maximum value across ALL data points (actual + forecast)
    const allValues = [
      ...actuals.filter(v => v !== null && v > 0),
      ...forecasts.filter(v => v !== null && v > 0)
    ];
    
    const absoluteMax = allValues.length > 0 ? Math.max(...allValues) : 100;

    // Round up to next logarithmic milestone with buffer
    // For log scale: 10, 100, 1000, 10000, 100000, 1000000
    let suggestedMax;
    if (absoluteMax <= 10) {
      suggestedMax = 10;
    } else if (absoluteMax <= 100) {
      suggestedMax = 100;
    } else if (absoluteMax <= 1000) {
      suggestedMax = 1000;
    } else if (absoluteMax <= 10000) {
      suggestedMax = 10000;
    } else if (absoluteMax <= 100000) {
      suggestedMax = 100000;
    } else {
      suggestedMax = 1000000;
    }

    // Apply buffer: if data is close to the milestone (>80% of it), jump to next log level
    if (absoluteMax > suggestedMax * 0.8) {
      suggestedMax = suggestedMax * 10; // Jump to next logarithmic level
    }
    // ============= END OF NEW CODE =============

    // Create sparse arrays containing only the min and max points at the correct positions
    const minPointData = Array(labels.length).fill(null);
    if (minIndex !== -1) minPointData[minIndex] = minVal;

    const maxPointData = Array(labels.length).fill(null);
    if (maxIndex !== -1) maxPointData[maxIndex] = maxVal;

    // Create arrays that are NULL for past years, and CONSTANT value for future years
    const maxLineData = stateData.map(d => d.year >= currentYear ? maxVal : null);
    const minLineData = stateData.map(d => d.year >= currentYear ? minVal : null);

    return {
      labels,
      datasets: [
        {
          label: 'ACTUAL DATA',
          data: actuals,
          borderColor: '#2563eb', // Blue
          backgroundColor: '#2563eb',
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
          spanGaps: false, // Ensures the line stops exactly at null, doesn't jump gaps
          order: 1
        },
        {
          label: 'FORECASTED DATA',
          data: forecasts,
          borderColor: '#dc2626', // Red
          backgroundColor: '#dc2626',
          borderDash: [5, 5], // Dashed line for forecast distinction
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
          spanGaps: false,
          order: 1
        },
        {
            label: 'Forecast Max',
            data: maxPointData,
            borderColor: '#16a34a', // Green border
            backgroundColor: '#22c55e', // Green fill
            pointStyle: 'circle',
            pointRadius: 10,
            pointHoverRadius: 12,
            borderWidth: 3,
            showLine: false,
            order: 0 // brings to front
        },
        {
            label: 'Forecast Min',
            data: minPointData,
            borderColor: '#ea580c', // Orange/Amber border
            backgroundColor: '#f97316', // Orange/Amber fill
            pointStyle: 'circle',
            pointRadius: 10,
            pointHoverRadius: 12,
            borderWidth: 3,
            showLine: false,
            order: 0 // brings to front
        },
        {
            label: 'Max Fill',
            data: maxLineData,
            borderColor: 'transparent', // Invisible line
            pointRadius: 0,             // No dots
            backgroundColor: 'rgba(220, 38, 38, 0.1)', // Light Red shading
            fill: 1, // Fills to Dataset Index 1 (Forecasted Data)
            order: 2 // Draw behind lines
        },
        {
            label: 'Min Fill',
            data: minLineData,
            borderColor: 'transparent', // Invisible line
            pointRadius: 0,             // No dots
            backgroundColor: 'rgba(220, 38, 38, 0.1)', // Light Red shading
            fill: 1, // Fills to Dataset Index 1 (Forecasted Data)
            order: 2 // Draw behind lines
        }
      ],
      suggestedMax // ← NEW: Return the calculated max value for Y-axis
    };
  }, [yearwiseData, statewiseData, mode, selectedState]); // Updated dependencies for smooth transitions

  // ============= MODIFIED: Convert options to useMemo and use dynamic max =============
  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: !isSummaryView,
        position: 'top',
        align: 'end',
        labels: {
            filter: function(item, chart) {
                // Only show legends for Actual, Forecast, and the Min/Max Dots
                return item.text === 'ACTUAL DATA' || 
                       item.text === 'FORECASTED DATA' ||
                       item.text === 'Forecast Max' || 
                       item.text === 'Forecast Min';
            },
            // Sort by dataset index to keep logical order (Actual -> Forecast -> Dots)
            sort: (a, b) => a.datasetIndex - b.datasetIndex
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        filter: function(tooltipItem) {
            // Hide tooltips for the shading layers
            return tooltipItem.dataset.label !== 'Max Fill' && 
                   tooltipItem.dataset.label !== 'Min Fill';
        }
      },
      title: {
        display: true,
        text: mode === 'cumulative' 
          ? `CNG Vehicle Adoption Trend - United States (Cumulative)` 
          : `CNG Vehicle Adoption Trend - ${selectedState}`,
        align: 'start',
        font: { size: 16 }
      },
    },
    scales: {
      y: {
        type: 'logarithmic', 
        min: 1,
        max: chartData?.suggestedMax || undefined, // ← NEW: Use calculated max from chartData
        beginAtZero: false,
        title: {
          display: true,
          text: 'Number of Vehicles'
        },
        grid: { color: '#f3f4f6' }, 
        ticks: {
          callback: function(value, index, values) {
             if (value === 10 || value === 100 || value === 1000 || value === 10000 || value === 100000 || value === 1000000) {
                return value.toLocaleString();
             }
             return null;
          }
        }
      },
      x: {
        title: {
          display: true,
          text: 'Year'
        },
        grid: { display: false }
      }
    },
  }), [chartData, mode, selectedState]); // Updated dependencies
  // ============= END OF MODIFIED CODE =============

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading Chart Data...</div>;
  if (error) return <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>{error}</div>;

  
  return (
    <div style={{ 
      width: '100%', 
      height: '100%',
      // [CHANGE 2] Apply flex layout and remove padding ONLY if isSummaryView is true
      display: isSummaryView ? 'flex' : 'block',
      flexDirection: isSummaryView ? 'column' : 'unset',
      padding: isSummaryView ? '0px' : '20px', 
      background: 'white', 
      borderRadius: '8px' 
    }}>
      
      {/* Filter Controls */}
      <div style={{ 
        marginBottom: '16px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px', 
        flexWrap: 'wrap',
        // Prevent squishing in flex layout
        flexShrink: 0 
      }}>
        
        {/* Mode Selection Dropdown */}
        <label style={{ fontWeight: '600', color: '#475569' }}>Mode:</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            fontSize: '14px',
            cursor: 'pointer',
            minWidth: '150px'
          }}
        >
          <option value="cumulative">Cumulative</option>
          <option value="statewise">Statewise</option>
        </select>

        {/* State Filter Dropdown - Only show for statewise mode */}
        {mode === 'statewise' && states.length > 0 && (
          <>
            <label htmlFor="state-select" style={{ fontWeight: '600', color: '#475569' }}>State:</label>
            <select
              id="state-select"
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                cursor: 'pointer',
                minWidth: '100px'
              }}
            >
              {states.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* Chart Container */}
      <div style={
        isSummaryView 
        ? { flexGrow: 1, width: '100%', position: 'relative', minHeight: 0 } 
        : { height: '400px', width: '100%' }
      }>
        {loading && <div style={{ padding: '20px', textAlign: 'center' }}>Loading Chart Data...</div>}
        {error && <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>{error}</div>}
        {chartData && !loading && !error && <Line data={chartData} options={options} />}
        {!chartData && !loading && !error && <p>No data available for this selection.</p>}
      </div>
    </div>
  );
}