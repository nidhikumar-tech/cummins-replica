"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function CNGCombinedBarChart({ isSummaryView = false }) {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState('');
  const [units, setUnits] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/cng-bar-graph?label=Production').then(r => r.json()),
      fetch('/api/cng-bar-graph?label=Net Imports').then(r => r.json()),
      fetch('/api/cng-bar-graph?label=Consumption by Sector').then(r => r.json()),
      fetch('/api/cng-bar-graph').then(r => r.json()) // Fetch all to debug
    ])
      .then(([prodRes, netImpRes, consRes, allRes]) => {
        // Debug: Log all unique labels in the database
        if (allRes.success && allRes.data) {
          const uniqueLabels = [...new Set(allRes.data.map(r => r.Label))];
          console.log('All unique Labels in database:', uniqueLabels);
        }
        console.log('Production rows:', prodRes.success ? prodRes.data.length : 0);
        console.log('Net Imports rows:', netImpRes.success ? netImpRes.data.length : 0);
        console.log('Consumption rows:', consRes.success ? consRes.data.length : 0);
        
        const combined = [
          ...(prodRes.success ? prodRes.data : []),
          ...(netImpRes.success ? netImpRes.data : []),
          ...(consRes.success ? consRes.data : [])
        ];
        console.log('Combined Bar Data:', combined.length);
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

  const data = useMemo(() => {
    if (!allData.length) return null;

    const years = Array.from({ length: 28 }, (_, i) => 2023 + i);
    const filtered = selectedCase === 'All' ? allData : allData.filter(r => r.Case === selectedCase);
    if (!filtered.length) return null;

    // Group by Label and Sub_Label
    const prodRows = filtered.filter(r => r.Label === 'Production');
    const netImpRows = filtered.filter(r => r.Label === 'Net Import' || r.Label === 'Net Imports');
    const consRows = filtered.filter(r => r.Label === 'Consumption by Sector');

    const STACK_PROD = 'Production';
    const STACK_NET_IMP = 'Net Import';
    const STACK_CONS = 'Consumption';

    const datasets = [];

    // Production datasets (blue/cyan/green)
    const prodSubLabels = [...new Set(prodRows.map(r => r.Sub_Label))];
    const prodColors = ['#2563eb', '#0891b2', '#10b981'];
    prodSubLabels.forEach((subLabel, idx) => {
      const rows = prodRows.filter(r => r.Sub_Label === subLabel);
      const values = years.map(year => {
        const key = `year_${year}`;
        return rows.reduce((sum, row) => sum + (row[key] || 0), 0);
      });
      datasets.push({
        label: `Prod: ${subLabel}`,
        data: values,
        backgroundColor: prodColors[idx % prodColors.length],
        stack: STACK_PROD
      });
    });

    // Net Import datasets (amber/orange/lime)
    const netImpSubLabels = [...new Set(netImpRows.map(r => r.Sub_Label))];
    const netImpColors = ['#f59e0b', '#f97316', '#84cc16'];
    netImpSubLabels.forEach((subLabel, idx) => {
      const rows = netImpRows.filter(r => r.Sub_Label === subLabel);
      const values = years.map(year => {
        const key = `year_${year}`;
        return rows.reduce((sum, row) => sum + (row[key] || 0), 0);
      });
      datasets.push({
        label: `Net Import: ${subLabel}`,
        data: values,
        backgroundColor: netImpColors[idx % netImpColors.length],
        stack: STACK_NET_IMP
      });
    });

    // Consumption datasets (red/pink/purple/magenta/rose)
    const consSubLabels = [...new Set(consRows.map(r => r.Sub_Label))];
    const consColors = ['#fe2c54', '#fb7185', '#7c3aed', '#da1884', '#f43f5e'];
    consSubLabels.forEach((subLabel, idx) => {
      const rows = consRows.filter(r => r.Sub_Label === subLabel);
      const values = years.map(year => {
        const key = `year_${year}`;
        return rows.reduce((sum, row) => sum + (row[key] || 0), 0);
      });
      datasets.push({
        label: `Cons: ${subLabel}`,
        data: values,
        backgroundColor: consColors[idx % consColors.length],
        stack: STACK_CONS
      });
    });

    return { labels: years.map(y => y.toString()), datasets };
  }, [allData, selectedCase]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: { display: true, text: 'CNG Production, Net Import & Consumption (2023-2050)', align: 'start', font: { size: 16 }, padding: { bottom: 25 } },
      legend: { 
        display: !isSummaryView,
        position: 'bottom', 
        labels: { boxWidth: 10, font: { size: 10 }, padding: 8 },
        align: 'center'
      },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      x: { 
        stacked: true, 
        title: { display: true, text: 'Year' }, 
        grid: { display: false }
      },
      y: { 
        stacked: true, 
        title: { display: true, text: units || '' },
        grid: {
          color: ctx => ctx.tick.value === 0 ? '#000' : 'rgba(0,0,0,0.1)',
          lineWidth: ctx => ctx.tick.value === 0 ? 2 : 1,
        },
        ticks: {
          callback: function(value) {
            return value.toLocaleString();
          }
        }
      }
    }
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;

  return (
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
        flexShrink: 0
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

      {/* [CHANGE 3] Toggle between flexGrow and 600px height */}
      <div style={isSummaryView ? { flexGrow: 1, minHeight: 0, position: 'relative' } : { height: '600px', position: 'relative' }}>
        {data ? <Bar data={data} options={options} /> : <p style={{ textAlign: 'center' }}>No data available</p>}
      </div>
    </div>
  );
}
