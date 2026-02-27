"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function CNGSupplyConsumptionLineChart({ isSummaryView = false }) {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState('');
  const [units, setUnits] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/cng-line-plot?label=Total Supply').then(r => r.json()),
      fetch('/api/cng-line-plot?label=Consumption by Sector').then(r => r.json())
    ])
      .then(([supplyRes, consRes]) => {
        const combined = [
          ...(supplyRes.success ? supplyRes.data : []),
          ...(consRes.success ? consRes.data : [])
        ];
        setAllData(combined);
        if (combined.length > 0 && combined[0].Units) setUnits(combined[0].Units);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const cases = useMemo(() => {
    if (!allData.length) return [];
    return ['All', ...[...new Set(allData.map(r => r.Case))].filter(Boolean)];
  }, [allData]);

  useEffect(() => {
    if (cases.length > 1 && !selectedCase) {
      setSelectedCase(cases[Math.floor(Math.random() * (cases.length - 1)) + 1]);
    }
  }, [cases, selectedCase]);

  const chartData = useMemo(() => {
    if (!allData.length) return null;
    const years = Array.from({ length: 28 }, (_, i) => 2023 + i);
    const filtered = selectedCase === 'All' ? allData : allData.filter(r => r.Case === selectedCase);
    if (!filtered.length) return null;

    // Group by Label (Total Supply vs Consumption by Sector)
    const supplyRows = filtered.filter(r => r.Label === 'Total Supply');
    const consRows = filtered.filter(r => r.Label === 'Consumption by Sector');

    const datasets = [];

    // Total Supply line
    if (supplyRows.length > 0) {
      const supplyValues = years.map(year => {
        const key = `year_${year}`;
        return supplyRows.reduce((sum, row) => sum + (row[key] || 0), 0);
      });
      // Dotted line for any year where value is zero
      datasets.push({
        label: 'Total Supply',
        data: supplyValues,
        borderColor: '#facc15',
        backgroundColor: '#facc15',
        tension: 0.3,
        pointRadius: 3,
        segment: {
          borderDash: ctx => supplyValues[ctx.p0DataIndex] === 0 ? [6, 6] : [],
        },
      });
    }

    // Consumption line
    if (consRows.length > 0) {
      const consValues = years.map(year => {
        const key = `year_${year}`;
        return consRows.reduce((sum, row) => sum + (row[key] || 0), 0);
      });
      // Dotted line for any year where value is zero
      datasets.push({
        label: 'Consumption',
        data: consValues,
        borderColor: '#10b981',
        backgroundColor: '#10b981',
        tension: 0.3,
        pointRadius: 3,
        segment: {
          borderDash: ctx => consValues[ctx.p0DataIndex] === 0 ? [6, 6] : [],
        },
      });
    }

    return { labels: years.map(y => y.toString()), datasets };
  }, [allData, selectedCase]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: { display: true, text: 'CNG Total Supply vs Consumption (2023-2050)', align: 'start', font: { size: 16 }, padding: { bottom: 25 } },
      legend: {
        display: !isSummaryView,
        position: 'top',
        align: 'end',
        labels: {
          boxWidth: 16,
          font: { size: 14 },
          padding: 16
        }
      },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      x: {
        title: { display: true, text: 'Year' },
        grid: {
          display: false,
        }
      },
      y: {
        title: { display: true, text: units || '' },
        grid: {
          color: 'rgba(0,0,0,0.05)',
          lineWidth: 1,
          display: true,
        }
      }
    }
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;

  return (
    // [CHANGE 2] Toggle styles based on isSummaryView
    <div style={{ 
      background: 'white', 
      padding: isSummaryView ? '0px' : '20px', 
      borderRadius: '8px',
      height: '100%',
      display: isSummaryView ? 'flex' : 'block',
      flexDirection: isSummaryView ? 'column' : 'unset'
    }}>
      <div style={{ 
        marginBottom: '20px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px', 
        flexWrap: 'wrap',
        flexShrink: 0 // Prevent header from squishing
      }}>
        <label style={{ fontWeight: '600', color: '#475569' }}>Select Case:</label>
        <select
          value={selectedCase}
          onChange={e => setSelectedCase(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', cursor: 'pointer', minWidth: '150px' }}
        >
          {cases.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {units && <div style={{ marginLeft: 'auto', color: '#64748b', fontSize: '14px', fontStyle: 'italic' }}>Units: {units}</div>}
      </div>
      
      {/* [CHANGE 3] Toggle between flexGrow and 500px height */}
      <div style={isSummaryView ? { flexGrow: 1, minHeight: 0, position: 'relative' } : { height: '500px', position: 'relative' }}>
        {chartData ? <Line data={chartData} options={options} /> : <p style={{ textAlign: 'center' }}>No data available</p>}
      </div>
    </div>
  );
}