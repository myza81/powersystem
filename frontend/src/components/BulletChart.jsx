import React from 'react';

/**
 * A compact Bullet Chart component.
 * @param {Object} props
 * @param {number} props.actual - The actual value.
 * @param {number} props.target - The target value.
 * @param {number} props.max - The maximum value for the scale.
 * @param {string} props.label - Label for the chart.
 * @param {string} props.unit - Unit for the values (e.g., "MW").
 * @param {string} props.color - Primary color for the actual bar.
 */
const BulletChart = ({ actual, target, max, label, unit = 'MW', color = 'var(--accent-cyan)' }) => {
    // Ensure we don't divide by zero
    const scaleMax = max || Math.max(actual, target, 1) * 1.2;

    const actualWidth = Math.min((actual / scaleMax) * 100, 100);
    const targetLeft = Math.min((target / scaleMax) * 100, 100);

    // Performance indicator: actual as % of target
    const percentOfTarget = target > 0 ? (actual / target) * 100 : 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontFamily: 'monospace', color: '#fff' }}>
                    <span style={{ color: color }}>{actual.toFixed(1)}</span>
                    <span style={{ margin: '0 4px', opacity: 0.3 }}>/</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{target.toFixed(1)}</span> {unit}
                </span>
            </div>

            <div style={{ position: 'relative', height: '14px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                {/* Scale Background (Optional qualitative ranges could go here) */}

                {/* Actual Bar */}
                <div
                    style={{
                        position: 'absolute',
                        top: '25%',
                        left: 0,
                        height: '50%',
                        width: `${actualWidth}%`,
                        background: color,
                        borderRadius: '0 2px 2px 0',
                        boxShadow: `0 0 10px ${color}44`,
                        transition: 'width 0.5s ease-out'
                    }}
                />

                {/* Target Marker */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: `${targetLeft}%`,
                        height: '100%',
                        width: '2px',
                        background: '#fff',
                        zIndex: 2,
                        boxShadow: '0 0 5px rgba(255,255,255,0.5)',
                        transition: 'left 0.5s ease-out'
                    }}
                />
            </div>

            {/* Percentage Display */}
            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'right', marginTop: '-2px' }}>
                {percentOfTarget.toFixed(1)}% of target
            </div>
        </div>
    );
};

export default BulletChart;
