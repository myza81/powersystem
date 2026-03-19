import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Plus } from 'lucide-react';
import { LuCircuitBoard } from 'react-icons/lu';

const CriticalSubstationListRow = ({ substation, tags, onEditAsset, onAddAsset }) => {
    const activeTags = tags.filter(t => t.is_inforce);
    
    // Grouping logic similar to CriticalSubstationCard
    const groupedAssets = tags.map(asset => {
        let voltageGroups = {};
        if (asset.load_transformers_details && asset.load_transformers_details.length > 0) {
            asset.load_transformers_details.forEach(lt => {
                const volt = lt.lv_voltage ? `${lt.lv_voltage}kV` : '';
                if (!voltageGroups[volt]) voltageGroups[volt] = [];
                const match = lt.bay_id.match(/_T(\d+)$/i) || lt.bay_id.match(/T(\d+)/i);
                const base = match ? `T${match[1]}` : lt.bay_id;
                voltageGroups[volt].push(base);
            });
        }
        return {
            id: asset.id,
            originalAsset: asset,
            voltageGroups: Object.entries(voltageGroups).map(([voltage, bays]) => ({ voltage, bays })),
            categoryAsset: (asset.category_name && asset.asset) ? `${asset.category_name} - ${asset.asset}` : (asset.category_name || asset.asset || 'Unnamed Asset'),
            sensitivity: asset.sensitivity_impact || 0,
            sourceFile: asset.source_file || null,
            isActive: asset.is_inforce
        };
    });

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="glass-card"
            style={{
                padding: '0.75rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1.5rem',
                marginBottom: '0.75rem',
                transition: 'all 0.2s',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                cursor: 'default'
            }}
            whileHover={{ 
                borderColor: '#ff9f43', 
                background: 'rgba(255, 159, 67, 0.02)',
                x: 4 
            }}
        >
            {/* Substation Info */}
            <div style={{ flex: '0 0 250px', display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                <span className="mono" style={{ color: '#ff9f43', fontSize: '0.7rem', fontWeight: 700 }}>
                    {substation.substation_id}
                </span>
                <h3 style={{ fontSize: '0.9rem', margin: 0, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {substation.name}
                </h3>
            </div>

            {/* Critical Assets List (Compact) */}
            <div style={{ flex: '1', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {groupedAssets.map(item => (
                    <div
                        key={item.id}
                        onClick={() => onEditAsset(item.originalAsset)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 8px',
                            background: item.isActive ? 'rgba(255, 159, 67, 0.1)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${item.isActive ? 'rgba(255, 159, 67, 0.3)' : 'rgba(255,255,255,0.1)'}`,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 159, 67, 0.2)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = item.isActive ? 'rgba(255, 159, 67, 0.1)' : 'rgba(255,255,255,0.05)'}
                    >
                        <span style={{ fontSize: '0.75rem', color: item.isActive ? '#fff' : 'var(--text-secondary)' }}>
                            {item.categoryAsset}
                        </span>
                        
                        {/* Status Icons */}
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            {item.sourceFile && (
                                <FileText size={10} color="#ff9f43" />
                            )}
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1px', height: '10px' }}>
                                {[1, 2, 3].map(level => (
                                    <div key={level} style={{
                                        width: '3px',
                                        height: `${level * 2.5}px`,
                                        background: level <= item.sensitivity ? (item.sensitivity === 3 ? '#ef4444' : (item.sensitivity === 2 ? '#f97316' : '#eab308')) : 'rgba(255,255,255,0.1)',
                                        borderRadius: '0.5px'
                                    }} />
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {substation.has_active_relay && (
                    <div title="Active Load Shedding Relay" style={{ color: '#ffb74d' }}>
                        <LuCircuitBoard size={16} />
                    </div>
                )}
                
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onAddAsset) onAddAsset();
                    }}
                    style={{
                        background: 'rgba(255, 159, 67, 0.1)',
                        border: '1px solid rgba(255, 159, 67, 0.2)',
                        borderRadius: '6px',
                        padding: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#ff9f43',
                        transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,159,67,0.2)';
                        e.currentTarget.style.borderColor = '#ff9f43';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 159, 67, 0.1)';
                        e.currentTarget.style.borderColor = 'rgba(255, 159, 67, 0.2)';
                    }}
                    title="Add Critical Asset"
                >
                    <Plus size={16} />
                </button>
            </div>
        </motion.div>
    );
};

export default CriticalSubstationListRow;
