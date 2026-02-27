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

export default function MinMaxChartHybrid({ isSummaryView = false }) {
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
          fetch('/api/hybrid-data-for-min-max?year=all&dataType=yearwise'),
          fetch('/api/hybrid-data-for-min-max?year=all&dataType=statewise')
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

  // 1.5. Calculate GLOBAL min/max across ALL statewise data for consistent Y-axis scaling
  const globalYAxisLimits = useMemo(() => {
    if (mode === 'cumulative' || statewiseData.length === 0) {
      return null; // Let cumulative mode auto-scale
    }

    let globalMaxY = 0;

    // Find max across all states (both actual and predicted)
    statewiseData.forEach(d => {
      const actualVal = d.actualVehicles || 0;
      const predictedVal = d.vehicleCount || 0;
      
      if (actualVal > 0) {
        globalMaxY = Math.max(globalMaxY, actualVal);
      }
      if (predictedVal > 0) {
        globalMaxY = Math.max(globalMaxY, predictedVal);
      }
    });

    // Round up to next 200 interval and add extra headroom
    // E.g., if max is 1400, round to 1600
    const roundedMax = Math.ceil(globalMaxY / 200) * 200;
    const yMaxLimit = roundedMax + 200; // Add one extra interval (200)

    return { min: 0, max: yMaxLimit }; // Always start from 0
  }, [statewiseData, mode]);

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

    const stateData = rawData
      .filter(d => d.state === currentState)
      .sort((a, b) => a.year - b.year);

    const labels = stateData.map(d => d.year);
    //Hardcode year as we only have data till 2025
    const currentYear = 2025;
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
        if (d.year >= currentYear) {
            const val = d.vehicleCount;
            if (val && val !== 0) {
            if (val < minVal) {
                minVal = val;
                minIndex = index;
            }
            if (val > maxVal) {
                maxVal = val;
                maxIndex = index;
            }
          }
        }
    });

    const minPointData = Array(labels.length).fill(null);
    if (minIndex !== -1) minPointData[minIndex] = minVal;

    const maxPointData = Array(labels.length).fill(null);
    if (maxIndex !== -1) maxPointData[maxIndex] = maxVal;
    
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
          spanGaps: false,
          order: 1
        },
        {
          label: 'FORECASTED DATA',
          data: forecasts,
          borderColor: '#dc2626', // Red
          backgroundColor: '#dc2626',
          borderDash: [5, 5],
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 6,
          spanGaps: false,
          order: 1
        },
        {
            label: 'Forecast Max',
            data: maxPointData,
            borderColor: '#16a34a',
            backgroundColor: '#22c55e',
            pointStyle: 'circle',
            pointRadius: 10,
            pointHoverRadius: 12,
            borderWidth: 3,
            showLine: false,
            order: 0
        },
        {
            label: 'Forecast Min',
            data: minPointData,
            borderColor: '#ea580c',
            backgroundColor: '#f97316',
            pointStyle: 'circle',
            pointRadius: 10,
            pointHoverRadius: 12,
            borderWidth: 3,
            showLine: false,
            order: 0
        },
        {
            label: 'Max Fill',
            data: maxLineData,
            borderColor: 'transparent',
            pointRadius: 0,
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            fill: 1, 
            order: 2
        },
        {
            label: 'Min Fill',
            data: minLineData,
            borderColor: 'transparent',
            pointRadius: 0,
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            fill: 1,
            order: 2
        }
      ],
    };
  }, [yearwiseData, statewiseData, mode, selectedState]); // Updated dependencies for smooth transitions

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
                return item.text === 'ACTUAL DATA' || 
                       item.text === 'FORECASTED DATA' ||
                       item.text === 'Forecast Max' || 
                       item.text === 'Forecast Min';
            },
            sort: (a, b) => a.datasetIndex - b.datasetIndex
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        filter: function(tooltipItem) {
            return tooltipItem.dataset.label !== 'Max Fill' && 
                   tooltipItem.dataset.label !== 'Min Fill';
        }
      },
      title: {
        display: true,
        text: mode === 'cumulative' 
          ? `Electric Vehicle Adoption Trend - United States (Cumulative)` 
          : `Electric Vehicle Adoption Trend - ${selectedState}`,
        align: 'start',
        font: { size: 16 }
      },
    },
    scales: {
      y: {
        type: 'linear',
        // Use global limits for statewise to match matplotlib behavior
        min: mode === 'statewise' && globalYAxisLimits ? globalYAxisLimits.min : undefined,
        max: mode === 'statewise' && globalYAxisLimits ? globalYAxisLimits.max : undefined,
        beginAtZero: mode === 'cumulative', // Only for cumulative mode
        title: {
          display: true,
          text: 'Number of Vehicles'
        },
        grid: { color: '#f3f4f6' },
        ticks: {
          stepSize: mode === 'statewise' ? undefined : 200, // Auto-step for statewise with global scale
          callback: function(value) {
            return value.toLocaleString();
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
  }), [mode, selectedState, globalYAxisLimits]); // Added globalYAxisLimits dependency

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
        marginBottom: '16px', // Slightly tightened margin
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px', 
        flexWrap: 'wrap',
        flexShrink: 0 // Prevent squishing in flex layout
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
            <label htmlFor="state-select-hybrid" style={{ fontWeight: '600', color: '#475569' }}>State:</label>
            <select
              id="state-select-hybrid"
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
        {chartData && !loading && !error && <Line data={chartData} options={options} />}
        {!chartData && !loading && !error && <p>No data available for this selection.</p>}
      </div>
    </div>
  );
}