import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CompactRegionalMetrics = ({ data, labelKey = 'region', valueKey = 'assigned_mw', targetKey = 'target_mw', colorFunction }) => {
    
    const [hoveredIndex, setHoveredIndex] = useState(null);

    const parseVal = (v) => {
        const p = parseFloat(v);
        return isNaN(p) ? 0 : p;
    };

    // Find the max target MW to scale all bars relative to the largest regional target
    const maxTarget = Math.max(...data.map(item => parseVal(item[targetKey])), 1);

    // Sort descending by target weight
    const sortedData = [...data].sort((a, b) => parseVal(b[targetKey]) - parseVal(a[targetKey]));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', width: '100%', padding: '0.5rem 0' }}>
            {sortedData.map((item, idx) => {
                const target = parseVal(item[targetKey]);
                const assigned = parseVal(item[valueKey]);
                
                // Cap progress at 100% visually — over-assigned regions still show full bar
                const progressPercent = target > 0 ? Math.min((assigned / target) * 100, 100) : 0;
                
                // The width of the "Target" track relative to the biggest region
                const trackWidthPercent = (target / maxTarget) * 100;

                const label = item[labelKey];

                const isOver = target > 0 && assigned > target;
                const color = colorFunction
                    ? colorFunction(item, idx)
                    : (isOver ? '#ef4444' : `hsl(${190 + (idx * 30)}, 90%, 50%)`); // red if over-assigned

                const isHovered = hoveredIndex === idx;

                return (
                    <div 
                        key={idx}
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '2px',
                            padding: '4px 8px',
                            background: isHovered ? 'rgba(255,255,255,0.05)' : 'transparent',
                            borderRadius: '6px',
                            transition: 'background 0.2s ease',
                            cursor: 'default',
                            position: 'relative',
                            zIndex: isHovered ? 10 : 1
                        }}
                    >
                        {/* Header Row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ 
                                fontSize: '0.75rem', 
                                fontWeight: 600, 
                                color: isHovered ? color : 'var(--text-secondary)',
                                transition: 'color 0.2s ease'
                            }}>
                                {label}
                            </span>
                            <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap' }}>
                                <span style={{ fontWeight: 700, color: isOver ? '#ef4444' : '#fff' }}>
                                    {assigned.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                </span>
                                <span style={{ color: 'var(--text-secondary)' }}> / {target.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MW</span>
                            </span>
                        </div>

                        {/* Bar Container */}
                        <div style={{ width: '100%', position: 'relative', height: '6px', overflow: 'visible' }}>
                            
                            {/* Target Background Track */}
                            <div style={{
                                width: `${trackWidthPercent}%`,
                                height: '100%',
                                background: 'rgba(255,255,255,0.1)',
                                borderRadius: '3px',
                                position: 'absolute',
                                top: 0,
                                left: 0
                            }} />

                            {/* Target Marker Pin */}
                            <div style={{
                                width: '2px',
                                height: '10px',
                                background: '#fff',
                                position: 'absolute',
                                left: `${trackWidthPercent}%`,
                                top: '-2px',
                                borderRadius: '1px',
                                boxShadow: '0 0 4px rgba(0,0,0,0.5)',
                                zIndex: 5
                            }} />

                            {/* Assigned Foreground Bar */}
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${trackWidthPercent * (progressPercent / 100)}%` }}
                                transition={{ duration: 0.8, delay: idx * 0.05, ease: 'easeOut' }}
                                style={{
                                    height: '100%',
                                    background: color,
                                    borderRadius: '3px',
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    boxShadow: isHovered ? `0 0 8px ${color}` : 'none',
                                    zIndex: 2
                                }}
                            />
                        </div>

                        {/* Tooltip Overlay */}
                        <AnimatePresence>
                            {isHovered && (
                                <motion.div
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 5 }}
                                    style={{
                                        position: 'absolute',
                                        right: '0',
                                        bottom: '100%',
                                        transform: 'translateY(-4px)',
                                        background: 'rgba(10, 12, 16, 0.95)',
                                        border: `1px solid ${color}`,
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        fontSize: '0.7rem',
                                        color: '#fff',
                                        zIndex: 999,
                                        whiteSpace: 'nowrap',
                                        pointerEvents: 'none',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                                    }}
                                >
                                    <span style={{ color }}>{((assigned / target) * 100).toFixed(1)}%</span> of regional target
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}
        </div>
    );
};

export default CompactRegionalMetrics;
