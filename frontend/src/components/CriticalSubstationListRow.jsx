import React from 'react';
import { motion } from 'framer-motion';
import { Edit2, FileText, Gauge } from 'lucide-react';
import { LuCircuitBoard } from 'react-icons/lu';

const CriticalSubstationListRow = ({ substation, tags, onEditAsset, onAddAsset }) => {
    const activeTags = tags.filter(t => t.is_inforce);

    const getGaugeColors = (s) => {
        const colors = {
            3: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444', icon: '#ef4444' },
            2: { bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.3)', text: '#f97316', icon: '#f97316' },
            1: { bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.3)', text: '#eab308', icon: '#eab308' },
            0: { bg: 'rgba(100, 116, 139, 0.08)', border: 'rgba(100, 116, 139, 0.15)', text: '#64748b', icon: '#64748b' }
        };
        return colors[s] || colors[0];
    };

    const voltageColor = (v) => {
        if (!v) return { color: '#64748b', bg: 'rgba(100, 116, 139, 0.1)' };
        if (v >= 500) return { color: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)' };
        if (v >= 275) return { color: '#ea580c', bg: 'rgba(234, 88, 12, 0.1)' };
        return { color: '#059669', bg: 'rgba(5, 150, 105, 0.1)' };
    };
    const vc = voltageColor(substation.voltage);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
                display: 'grid',
                gridTemplateColumns: '2fr 0.6fr 0.8fr 2.5fr 100px',
                gap: '1rem',
                alignItems: 'center',
                padding: '0.85rem 1.25rem',
                borderBottom: '1px solid rgba(255, 159, 67, 0.08)',
                background: 'rgba(255, 255, 255, 0.4)',
                transition: 'background 0.15s ease',
                cursor: 'default',
            }}
            whileHover={{ background: 'rgba(255, 159, 67, 0.06)' }}
        >
            {/* Substation Name & ID */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {substation.name}
                        </span>
                        {substation.has_active_relay && (
                            <span title="Active Load Shedding Relay" style={{ color: '#f59e0b', flexShrink: 0 }}>
                                <LuCircuitBoard size={13} />
                            </span>
                        )}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>
                        {substation.mnemonic || substation.substation_id}
                    </span>
                </div>
            </div>

            {/* Voltage */}
            <div>
                {substation.voltage ? (
                    <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: vc.color,
                        background: vc.bg,
                        padding: '3px 8px',
                        borderRadius: '4px',
                    }}>
                        {substation.voltage}kV
                    </span>
                ) : (
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>—</span>
                )}
            </div>

            {/* Region */}
            <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                {substation.region || '—'}
            </div>

            {/* Critical Assets */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                {tags.map(asset => {
                    const isActive = asset.is_inforce;
                    const label = (asset.category_name && asset.asset)
                        ? `${asset.category_name} — ${asset.asset}`
                        : (asset.category_name || asset.asset || 'Unnamed');

                    const sensitivity = asset.sensitivity_impact || 0;

                    return (
                        <div
                            key={asset.id}
                            title={label}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3px 8px',
                                background: isActive ? 'rgba(255, 159, 67, 0.1)' : 'rgba(100, 116, 139, 0.08)',
                                border: `1px solid ${isActive ? 'rgba(255, 159, 67, 0.3)' : 'rgba(100, 116, 139, 0.15)'}`,
                                borderRadius: '5px',
                                cursor: 'default',
                                maxWidth: '200px',
                            }}
                        >
                            <span style={{ fontSize: '0.72rem', color: isActive ? '#0f172a' : '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {label}
                            </span>
                            {asset.source_file && <FileText size={9} color="#ff9f43" style={{ flexShrink: 0 }} />}
                            {sensitivity > 0 && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '2px 5px',
                                    borderRadius: '4px',
                                    background: getGaugeColors(sensitivity).bg,
                                    border: `1px solid ${getGaugeColors(sensitivity).border}`,
                                    flexShrink: 0,
                                    gap: '3px',
                                }}>
                                    <Gauge size={11} color={getGaugeColors(sensitivity).icon} />
                                    <span style={{ fontSize: '0.58rem', fontWeight: 700, color: getGaugeColors(sensitivity).text, textTransform: 'uppercase' }}>
                                        {sensitivity === 3 ? 'High' : sensitivity === 2 ? 'Med' : 'Low'}
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
                {tags.length === 0 && (
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>No assets</span>
                )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
                {onEditAsset && (
                    <button
                        onClick={e => { e.stopPropagation(); tags[0] && onEditAsset(tags[0]); }}
                        title="Edit Critical Asset"
                        style={{
                            background: 'transparent',
                            border: '1px solid #e2e8f0',
                            color: '#64748b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '6px',
                            borderRadius: '6px',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#ff9f43'; e.currentTarget.style.color = '#ff9f43'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
                    >
                        <Edit2 size={14} />
                    </button>
                )}
            </div>
        </motion.div>
    );
};

export default CriticalSubstationListRow;
