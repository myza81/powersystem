import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SpiralChart = ({ data, labelKey = 'region', valueKey = 'total_pload_mw', targetKey = null, colorFunction }) => {
    // Robust Parsing: Handle potential strings or nulls
    const parseVal = (v) => {
        const p = parseFloat(v);
        return isNaN(p) ? 0 : p;
    };

    // If targetKey is provided, we compare valueKey to targetKey per row.
    // If targetKey is NOT provided, we compare valueKey to the totalLoad sum.
    const totalLoad = targetKey ? 0 : data.reduce((acc, curr) => acc + parseVal(curr[valueKey]), 0);
    const [hoveredIndex, setHoveredIndex] = useState(null);

    // Sort data (descending by value)
    const sortedData = [...data].sort((a, b) => parseVal(b[valueKey]) - parseVal(a[valueKey]));

    return (
        <div style={{ position: 'relative', width: '100%', maxWidth: '500px', margin: '0 auto', aspectRatio: '500/340', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 500 340" style={{ overflow: 'visible' }}>
                {sortedData.map((item, idx) => {
                    const value = parseVal(item[valueKey]);
                    let target = 0;
                    let percent = 0;

                    if (targetKey) {
                        target = parseVal(item[targetKey]);
                        percent = target > 0 ? (value / target) : 0;
                        // cap at 100% for visual sanity, or let it overlap
                        percent = Math.min(percent, 1);
                    } else {
                        percent = totalLoad > 0 ? (value / totalLoad) : 0;
                    }

                    const label = item[labelKey];

                    // Track config
                    const center = { x: 300, y: 190 };
                    const maxRadius = 160;
                    const trackWidth = 16;
                    const gap = 12;
                    const radius = maxRadius - (idx * (trackWidth + gap));

                    const getCoords = (angleInDegrees) => {
                        const angleInRad = (angleInDegrees * Math.PI) / 180;
                        return {
                            x: center.x + radius * Math.cos(angleInRad),
                            y: center.y + radius * Math.sin(angleInRad)
                        };
                    };

                    const startDeg = -90;
                    const fullSweep = 270;
                    const endDeg = startDeg + fullSweep;

                    const bgStart = getCoords(startDeg);
                    const bgEnd = getCoords(endDeg);
                    const bgPath = `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 1 1 ${bgEnd.x} ${bgEnd.y}`;

                    const percentDeg = startDeg + (percent * fullSweep);
                    const fgEnd = getCoords(percentDeg);
                    const largeArcFlag = (percent * fullSweep) > 180 ? 1 : 0;
                    const fgPath = percent > 0
                        ? `M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${fgEnd.x} ${fgEnd.y}`
                        : '';

                    // Default color logic or custom function
                    const color = colorFunction
                        ? colorFunction(item, idx)
                        : `hsl(${190 + (idx * 30)}, 90%, 50%)`;

                    const isHovered = hoveredIndex === idx;

                    return (
                        <g key={idx}
                            onMouseEnter={() => setHoveredIndex(idx)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            style={{ cursor: 'pointer' }}
                        >
                            <text
                                x={bgStart.x - 12}
                                y={bgStart.y + 5}
                                textAnchor="end"
                                style={{
                                    fill: isHovered ? '#fff' : 'rgba(255,255,255,0.7)',
                                    fontSize: '0.85rem',
                                    fontWeight: isHovered ? 600 : 400,
                                    fontFamily: 'monospace',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                <tspan style={{ fontWeight: 700, fill: color }}>{label}</tspan>
                                <tspan dx="8">{value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MW</tspan>
                                <tspan dx="8" style={{ fill: 'rgba(255,255,255,0.5)' }}>{(percent * 100).toFixed(1)}%</tspan>
                            </text>

                            <path
                                d={bgPath}
                                fill="none"
                                stroke="rgba(255,255,255,0.05)"
                                strokeWidth={trackWidth}
                                strokeLinecap="round"
                            />

                            <motion.path
                                d={fgPath}
                                fill="none"
                                stroke={color}
                                strokeWidth={trackWidth}
                                strokeLinecap="round"
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 1, delay: idx * 0.1, ease: 'easeOut' }}
                                style={{
                                    filter: isHovered ? `drop-shadow(0 0 8px ${color})` : 'none'
                                }}
                            />
                        </g>
                    );
                })}
            </svg>

            {!targetKey && (
                <div style={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none', top: '50%', transform: 'translateY(-20%)' }}>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Total System Load</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
                        {totalLoad.toLocaleString(undefined, { maximumFractionDigits: 0 })} MW
                    </div>
                </div>
            )}

            <AnimatePresence>
                {hoveredIndex !== null && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.9 }}
                        style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: '50%',
                            x: '-50%',
                            marginBottom: '10px',
                            background: 'rgba(10, 12, 16, 0.95)',
                            border: `1px solid ${colorFunction ? colorFunction(sortedData[hoveredIndex], hoveredIndex) : `hsl(${190 + (hoveredIndex * 30)}, 90%, 50%)`}`,
                            padding: '0.5rem 0.75rem',
                            borderRadius: '8px',
                            zIndex: 40,
                            backdropFilter: 'blur(12px)',
                            pointerEvents: 'none',
                            whiteSpace: 'nowrap',
                            textAlign: 'center',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                        }}
                    >
                        <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                            {sortedData[hoveredIndex][labelKey]}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                                color: colorFunction ? colorFunction(sortedData[hoveredIndex], hoveredIndex) : `hsl(${190 + (hoveredIndex * 30)}, 90%, 50%)`,
                                fontWeight: 700,
                                fontSize: '1rem',
                                fontFamily: 'monospace'
                            }}>
                                {parseVal(sortedData[hoveredIndex][valueKey]).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MW
                            </span>
                            <span style={{
                                fontSize: '0.8rem',
                                color: 'rgba(255,255,255,0.5)'
                            }}>
                                {targetKey ? (
                                    <> / {parseVal(sortedData[hoveredIndex][targetKey]).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MW ({((parseVal(sortedData[hoveredIndex][valueKey]) / parseVal(sortedData[hoveredIndex][targetKey])) * 100).toFixed(1)}%)</>
                                ) : (
                                    <>({((parseVal(sortedData[hoveredIndex][valueKey]) / totalLoad) * 100).toFixed(1)}%)</>
                                )}
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SpiralChart;
