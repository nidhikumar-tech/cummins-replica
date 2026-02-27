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
  Filler
);

export default function CNGLineChart({
  label,
  borderColor = '#10b981',
  backgroundColor = 'rgba(16, 185, 129, 0.1)',
  title = null,
  isSummaryView = false
}) {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCase, setSelectedCase] = useState('');
  const [units, setUnits] = useState('');

  // Fetch data on mount and when label changes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/cng-line-plot?label=${encodeURIComponent(label)}`);
        const result = await response.json();

        if (result.success && Array.isArray(result.data)) {
          setAllData(result.data);
          // Extract units from first row if available
          if (result.data.length > 0 && result.data[0].Units) {
            setUnits(result.data[0].Units);
          } else {
            setUnits('');
          }
        } else {
          setError(result.error || 'Failed to load data');
          setAllData([]);
          setUnits('');
        }
      } catch (err) {
        console.error('Error fetching CNG line plot data:', err);
        setError('Failed to load CNG line plot data');
        setAllData([]);
        setUnits('');
      } finally {
        setLoading(false);
      }
    };

    if (label) {
      fetchData();
    }
  }, [label]);

// Get unique cases from data and create color mapping
  const cases = useMemo(() => {
    if (!allData || allData.length === 0) return [];
    const uniqueCases = [...new Set(allData.map(row => row.Case))].filter(Boolean);
    return ['All', ...uniqueCases];
  }, [allData]);

  // Set default selectedCase randomly (not 'All') if not set
  useEffect(() => {
    if (cases.length > 1 && !selectedCase) {
      // Exclude 'All' from random selection
      const randomIndex = Math.floor(Math.random() * (cases.length - 1)) + 1;
      setSelectedCase(cases[randomIndex]);
    }
  }, [cases, selectedCase]);

  // Define color mapping for cases (consistent colors)
  const caseColorMap = useMemo(() => {
    if (!allData || allData.length === 0) return {};
    const uniqueCases = [...new Set(allData.map(row => row.Case))].filter(Boolean);
    const colors = ['#10b981', '#f59e0b', '#2563eb', '#fb7185', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];
    const colorMap = {};
    uniqueCases.forEach((caseName, index) => {
      colorMap[caseName] = colors[index % colors.length];
    });
    return colorMap;
  }, [allData]);

  // Process data for chart (filter by selected case)
  const chartData = useMemo(() => {
    if (!allData || allData.length === 0) return null;

    // Years from 2023 to 2050
    const allYears = Array.from({ length: 28 }, (_, i) => 2023 + i);
    
    // Filter data by selected case
    let filteredData;
    if (selectedCase === 'All' || !selectedCase) {
      filteredData = allData;
    } else {
      filteredData = allData.filter(row => row.Case === selectedCase);
    }
    if (filteredData.length === 0) return null;

    // Extract data from rows
    const datasets = filteredData.map((row) => {
      const values = allYears.map(year => {
        const key = `year_${year}`;
        return row[key] !== null && row[key] !== undefined ? row[key] : null;
      });

      // Use consistent colors from color map
      const datasetBorderColor = caseColorMap[row.Case] || borderColor;

      return {
        label: row.Case || row.Label,
        data: values,
        borderColor: datasetBorderColor,
        backgroundColor: datasetBorderColor,
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        spanGaps: true,
      };
    });

    return {
      labels: allYears.map(y => y.toString()),
      datasets: datasets,
    };
  }, [allData, selectedCase, caseColorMap, borderColor]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: !isSummaryView,
        position: 'top',
        align: selectedCase === 'All' ? 'center' : 'end'
      },
      title: {
        display: true,
        text: title || label,
        align: 'start',
        font: { size: 16 }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: function (context) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${value !== null ? value.toLocaleString() : 'N/A'}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: units || ''
        },
        ticks: {
          callback: function (value) {
            return value.toLocaleString();
          }
        },
        grid: { color: '#f3f4f6' }
      },
      x: {
        title: {
          display: true,
          text: 'Year'
        },
        grid: { display: false }
      }
    }
  }), [title, label, units, selectedCase]);

  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      padding: isSummaryView ? '0px' : '20px', 
      background: 'white', 
      borderRadius: '8px',
      display: isSummaryView ? 'flex' : 'block',
      flexDirection: isSummaryView ? 'column' : 'unset'
    }}>
      {/* Case Filter */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <label htmlFor="case-select" style={{ fontWeight: '600', color: '#475569' }}>Select Case:</label>
        <select
          id="case-select"
          value={selectedCase}
          onChange={e => setSelectedCase(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            fontSize: '14px',
            cursor: 'pointer',
            minWidth: '150px'
          }}
        >
          {cases.map(caseOption => (
            <option key={caseOption} value={caseOption}>{caseOption}</option>
          ))}
        </select>
        {units && (
          <div style={{ marginLeft: 'auto', color: '#64748b', fontSize: '14px', fontStyle: 'italic' }}>
            Units: {units}
          </div>
        )}
      </div>

      {/* Chart */}
      <div style={isSummaryView ? { flexGrow: 1, width: '100%', minHeight: 0, position: 'relative' } : { height: '500px', width: '100%', position: 'relative' }}>
        {loading && <div style={{ padding: '20px', textAlign: 'center' }}>Loading Chart Data...</div>}
        {error && <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>{error}</div>}
        {chartData && !loading && !error && <Line data={chartData} options={options} />}
        {!chartData && !loading && !error && <p style={{ textAlign: 'center', padding: '20px' }}>No data available.</p>}
      </div>
    </div>
  );
}