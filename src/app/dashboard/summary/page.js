"use client";

import React from 'react';
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import CNGSummaryMap from "@/components/maps/CNGSummaryMap";
import ElectricSummaryMap from "@/components/maps/ElectricSummaryMap";
import dynamic from 'next/dynamic';

// Reusable Placeholder component 
const Placeholder = ({ label }) => (
  <div style={{
    backgroundColor: '#f1f5f9',
    border: '2px dashed #3b82f6',
    borderRadius: '8px',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    color: '#475569',
    fontWeight: '600',
    fontSize: '0.875rem',
    padding: '8px',
    boxSizing: 'border-box'
  }}>
    {label}
  </div>
);

// Dynamically import the CNG and Electric MinMax Chart (Required for Chart.js)
const MinMaxChartCNG = dynamic(() => import('@/components/predictions/MinMaxChartCNG'), {
  ssr: false, 
  loading: () => <Placeholder label="Loading Chart..." />
});

const MinMaxChartHybrid = dynamic(() => import('@/components/predictions/MinMaxChartHybrid'), {
  ssr: false, 
  loading: () => <Placeholder label="Loading Chart..." />
});

const CNGSupplyConsumptionLineChart = dynamic(() => import('@/components/predictions/line_charts/CNGSupplyConsumptionLineChart'), { ssr: false });
const CNGCombinedBarChart = dynamic(() => import('@/components/predictions/stacked_bar_graph/CNGCombinedBarChart'), { ssr: false });
const CNGLineChart = dynamic(() => import('@/components/predictions/line_charts/CNGLineChart'), { ssr: false });

export default function SummaryPage() {
  
  const styles = {
    wrapper: {
      display: 'flex',
      flexDirection: 'column',
      gap: '80px',
      padding: '24px',
      maxWidth: '2000px',
      margin: '0 auto',
    },
    section: {
      height: 'calc(100vh - 120px)', 
      minHeight: '550px', 
      display: 'flex',
      flexDirection: 'column',
    },
    sectionHeader: {
      marginBottom: '20px',
      paddingBottom: '10px',
      borderBottom: '2px solid #e2e8f0',
      flexShrink: 0,
    },
    quadrantGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr', 
      gridTemplateRows: '1fr 1fr',    
      gap: '24px',
      flexGrow: 1, 
      minHeight: 0,
    },
    quadrant: {
      background: 'white',
      border: '3px solid #94a3b8', 
      borderRadius: '16px',
      padding: '16px',
      height: '100%',
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      
    },
    innerGrid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', width: '100%', height: '100%' },
    innerGrid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', width: '100%', height: '100%' },
    innerGrid5: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', width: '100%', height: '100%' }
  };

  return (
    <DashboardLayout>
      <div style={styles.wrapper}>
        
        {/* ========================================== */}
        {/* SECTION 1: CNG SUMMARY                     */}
        {/* ========================================== */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              CNG Summary
            </h1>
          </div>
          
          <div style={styles.quadrantGrid}>
            {/* Top Left: Map Component */}
            <div style={{...styles.quadrant, padding: 0, overflow: 'hidden'}}>
              {/*<CNGSummaryMap /> */}
            </div>

            {/* Top Right: Powertrain Predictions Chart */}
            <div style={styles.quadrant}>
              {/* [NEW] Inserted MinMaxChartCNG with the isSummaryView prop */}
              <MinMaxChartCNG isSummaryView={true} />
            </div>

            {/* Bottom Left */}
            <div style={styles.quadrant}>
              <div style={styles.innerGrid3}>
                <CNGSupplyConsumptionLineChart isSummaryView={true} />
                <CNGCombinedBarChart isSummaryView={true} />
                <CNGLineChart 
                  label="Natural Gas Spot Price at Henry Hub" 
                  title="Natural Gas Price (2023-2050)" 
                  borderColor="#fb7185" 
                  isSummaryView={true} 
                />
              </div>
            </div>

            {/* Bottom Right */}
            <div style={styles.quadrant}>
              <div style={styles.innerGrid5}>
                <Placeholder label="Chart 1" />
                <Placeholder label="Chart 2" />
                <Placeholder label="Chart 3" />
                <Placeholder label="Chart 4" />
                <Placeholder label="Chart 5" />
              </div>
            </div>
          </div>
        </section>

        {/* ========================================== */}
        {/* SECTION 2: ELECTRIC SUMMARY                */}
        {/* ========================================== */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Electric Summary
            </h1>
          </div>
          
          <div style={styles.quadrantGrid}>
            {/* Top Left: Map Component */}
            <div style={{...styles.quadrant, padding: 0, overflow: 'hidden'}}>
              {/*<ElectricSummaryMap />*/}
            </div>

            {/* Top Right */}
            <div style={styles.quadrant}>
              <MinMaxChartHybrid isSummaryView={true} />
            </div>

            {/* Bottom Left */}
            <div style={styles.quadrant}>
              <div style={styles.innerGrid4}>
                <Placeholder label="Chart 1" />
                <Placeholder label="Chart 2" />
                <Placeholder label="Chart 3" />
                <Placeholder label="Chart 4" />
              </div>
            </div>

            {/* Bottom Right */}
            <div style={styles.quadrant}>
              <div style={styles.innerGrid5}>
                <Placeholder label="Chart 1" />
                <Placeholder label="Chart 2" />
                <Placeholder label="Chart 3" />
                <Placeholder label="Chart 4" />
                <Placeholder label="Chart 5" />
              </div>
            </div>
          </div>
        </section>

      </div>
    </DashboardLayout>
  );
}