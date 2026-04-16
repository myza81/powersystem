import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, FileText, Plus, Zap, CircuitBoard, Gauge } from 'lucide-react';

const CriticalSubstationCard = ({ substation, tags, onEditAsset, onAddAsset }) => {
    const activeCount = tags.filter(t => t.is_inforce).length;
    const inactiveCount = tags.length - activeCount;

    const groupedAssets = useMemo(() => tags.map(asset => {
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

        let categoryLabels = [];
        if (asset.category_name) categoryLabels.push(asset.category_name);
        if (asset.asset) categoryLabels.push(asset.asset);

        return {
            id: asset.id,
            originalAsset: asset,
            voltageGroups: Object.entries(voltageGroups).map(([voltage, bays]) => ({ voltage, bays })),
            categoryAsset: categoryLabels.join(' - ') || 'Unnamed Asset',
            sensitivity: asset.sensitivity_impact || 0,
            sourceFile: asset.source_file || null,
            isActive: asset.is_inforce
        };
    }), [tags]);

    const containerStyle = {
        background: '#fff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
    };

    const headerStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '16px 16px 12px',
        borderBottom: '1px solid #f1f5f9',
        background: 'linear-gradient(135deg, rgba(255,159,67,0.04), rgba(255,159,67,0.02))'
    };

    const iconWrapStyle = {
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255, 159, 67, 0.1)',
        border: '1px solid rgba(255, 159, 67, 0.2)',
        flexShrink: 0
    };

    const titleStyle = {
        fontSize: '0.9rem',
        fontWeight: 700,
        color: '#0f172a',
        fontFamily: "'Poppins', sans-serif",
        letterSpacing: '-0.01em'
    };

    const subtitleStyle = {
        fontSize: '0.65rem',
        color: '#64748b',
        fontFamily: "'Poppins', sans-serif",
        marginTop: '1px'
    };

    const countBadgeStyle = (active) => ({
        fontSize: '0.6rem',
        fontWeight: 700,
        padding: '3px 10px',
        borderRadius: '20px',
        background: active ? 'rgba(4, 125, 96, 0.08)' : 'rgba(100, 116, 139, 0.08)',
        color: active ? '#047d60' : '#64748b',
        border: `1px solid ${active ? 'rgba(4, 125, 96, 0.2)' : 'rgba(100, 116, 139, 0.15)'}`,
        marginLeft: 'auto'
    });

    const actionBtnStyle = {
        background: 'transparent',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '6px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        cursor: 'pointer',
        color: '#64748b',
        fontSize: '0.7rem',
        fontWeight: 600,
        transition: 'all 0.15s ease',
        fontFamily: "'Poppins', sans-serif"
    };

    const cardStyle = {
        display: 'flex',
        alignItems: 'stretch',
        gap: '12px',
        padding: '10px 16px',
        borderBottom: '1px solid #f8fafc',
        transition: 'all 0.2s ease',
        cursor: 'pointer'
    };

    const cardHoverStyle = {
        background: '#f8fafc'
    };

    const voltageBadgeStyle = (isActive) => ({
        fontSize: '0.6rem',
        fontWeight: 700,
        color: isActive ? '#047d60' : '#64748b',
        background: isActive ? 'rgba(4, 125, 96, 0.08)' : 'rgba(100, 116, 139, 0.08)',
        border: `1px solid ${isActive ? 'rgba(4, 125, 96, 0.2)' : 'rgba(100, 116, 139, 0.15)'}`,
        padding: '2px 8px',
        borderRadius: '4px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        textTransform: 'uppercase',
        letterSpacing: '0.3px'
    });

    const bayTagStyle = (isActive) => ({
        fontSize: '0.65rem',
        fontWeight: 600,
        fontFamily: 'monospace',
        color: isActive ? '#0f172a' : '#64748b',
        background: isActive ? 'rgba(4, 125, 96, 0.08)' : 'rgba(100, 116, 139, 0.06)',
        border: `1px solid ${isActive ? 'rgba(4, 125, 96, 0.15)' : 'rgba(100, 116, 139, 0.1)'}`,
        padding: '2px 6px',
        borderRadius: '4px'
    });

    const getGaugeColors = (sensitivity) => {
        const colors = {
            3: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444', icon: '#ef4444' },
            2: { bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.3)', text: '#f97316', icon: '#f97316' },
            1: { bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.3)', text: '#eab308', icon: '#eab308' },
            0: { bg: 'rgba(100, 116, 139, 0.08)', border: 'rgba(100, 116, 139, 0.15)', text: '#64748b', icon: '#64748b' }
        };
        return colors[sensitivity] || colors[0];
    };

    const fileBtnStyle = {
        background: 'rgba(255, 255, 255, 0.6)',
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        padding: '4px 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: '#64748b',
        transition: 'all 0.2s ease',
        flexShrink: 0
    };

    const [hoveredRow, setHoveredRow] = React.useState(null);

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={containerStyle}
            whileHover={{ boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
        >
            <div style={headerStyle}>
                <div style={iconWrapStyle}>
                    <ShieldAlert size={20} color="#ff9f43" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={titleStyle}>{substation.substation_id}</div>
                    <div style={subtitleStyle}>{substation.name}</div>
                </div>
                {substation.has_active_relay && (
                    <div
                        title="Active Load Shedding Relay"
                        style={{
                            background: 'rgba(255, 183, 77, 0.1)',
                            border: '1px solid rgba(255, 183, 77, 0.3)',
                            color: '#ff9f43',
                            padding: '4px 6px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <CircuitBoard size={14} />
                    </div>
                )}
                <span style={countBadgeStyle(activeCount > 0)}>
                    {activeCount} active
                </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {groupedAssets.slice(0, 4).map((item, idx) => (
                    <div
                        key={item.id}
                        onClick={() => onEditAsset(item.originalAsset)}
                        style={{
                            ...cardStyle,
                            background: hoveredRow === idx ? '#f8fafc' : 'transparent',
                            borderBottom: idx === Math.min(groupedAssets.length - 1, 3) ? 'none' : '1px solid #f1f5f9'
                        }}
                        onMouseEnter={() => setHoveredRow(idx)}
                        onMouseLeave={() => setHoveredRow(null)}
                    >
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    color: '#0f172a'
                                }}>
                                    {item.categoryAsset}
                                </span>
                                <span style={{
                                    ...voltageBadgeStyle(item.isActive),
                                    marginLeft: '4px'
                                }}>
                                    {item.voltageGroups[0]?.voltage || 'Unknown'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {item.voltageGroups[0]?.bays.map((bay, bIdx) => (
                                    <span key={bIdx} style={bayTagStyle(item.isActive)}>
                                        {bay}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                            {item.sourceFile && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(item.sourceFile, '_blank', 'noopener,noreferrer');
                                    }}
                                    style={fileBtnStyle}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(255, 159, 67, 0.1)';
                                        e.currentTarget.style.borderColor = '#ff9f43';
                                        e.currentTarget.style.color = '#ff9f43';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)';
                                        e.currentTarget.style.borderColor = '#e2e8f0';
                                        e.currentTarget.style.color = '#64748b';
                                    }}
                                    title="View Source"
                                >
                                    <FileText size={12} />
                                </button>
                            )}

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '4px 6px',
                                borderRadius: '6px',
                                background: getGaugeColors(item.sensitivity).bg,
                                border: `1px solid ${getGaugeColors(item.sensitivity).border}`
                            }}>
                                <Gauge size={14} color={getGaugeColors(item.sensitivity).icon} />
                                <span style={{
                                    fontSize: '0.6rem',
                                    fontWeight: 700,
                                    color: getGaugeColors(item.sensitivity).text,
                                    marginLeft: '4px',
                                    textTransform: 'uppercase'
                                }}>
                                    {item.sensitivity === 3 ? 'High' : item.sensitivity === 2 ? 'Med' : item.sensitivity === 1 ? 'Low' : 'None'}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}

                {groupedAssets.length > 4 && (
                    <div style={{
                        padding: '10px 16px',
                        textAlign: 'center',
                        fontSize: '0.7rem',
                        color: '#94a3b8',
                        borderTop: '1px solid #f1f5f9'
                    }}>
                        +{groupedAssets.length - 4} more assets
                    </div>
                )}

                <div style={{
                    display: 'flex',
                    gap: '8px',
                    padding: '10px 16px',
                    borderTop: '1px solid #f1f5f9',
                    background: '#fafafa'
                }}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onAddAsset) onAddAsset();
                        }}
                        style={actionBtnStyle}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f1f5f9';
                            e.currentTarget.style.borderColor = '#ff9f43';
                            e.currentTarget.style.color = '#ff9f43';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.color = '#64748b';
                        }}
                    >
                        <Plus size={14} />
                        Add Asset
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

export default React.memo(CriticalSubstationCard);