import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, FileText } from 'lucide-react';

const CriticalSubstationCard = ({ substation, tags, onOpen }) => {
    const activeCount = tags.filter(t => t.is_inforce).length;
    const activeTags = tags.filter(t => t.is_inforce);
    const maxSensitivity = activeTags.length > 0
        ? Math.max(...activeTags.map(t => t.sensitivity_impact || 0))
        : 0;

    const groupedAssets = tags.map(asset => {
        let voltagePresent = null;
        let bayNames = [];

        // Find transformer information if it exists in the detailed fetch from API
        if (asset.load_transformers_details && asset.load_transformers_details.length > 0) {
            asset.load_transformers_details.forEach(lt => {
                if (lt.lv_voltage && !voltagePresent) voltagePresent = `${lt.lv_voltage}kV`;

                const match = lt.bay_id.match(/_T(\d+)$/i) || lt.bay_id.match(/T(\d+)/i);
                const base = match ? `T${match[1]}` : lt.bay_id;
                bayNames.push(base);
            });
        }

        let categoryLabels = [];
        if (asset.category_name) categoryLabels.push(asset.category_name);
        if (asset.asset) categoryLabels.push(asset.asset);

        return {
            id: asset.id,
            voltage: voltagePresent,
            bays: bayNames,
            categoryAsset: categoryLabels.join(' - ') || 'Unnamed Asset',
            sensitivity: asset.sensitivity_impact || 0,
            sourceFile: asset.source_file || null
        };
    });

    const tagPillStyle = {
        fontSize: '0.65rem',
        background: 'rgba(255,255,255,0.08)',
        color: '#fff',
        padding: '2px 8px',
        borderRadius: '6px',
        border: '1px solid rgba(255,255,255,0.08)'
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="glass-card"
            whileHover={{ y: -4, borderColor: '#ff9f43', boxShadow: '0 8px 24px rgba(255, 159, 67, 0.18)' }}
            style={{
                padding: '0.75rem',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                minHeight: '120px'
            }}
            onClick={onOpen}
            role="button"
            tabIndex={0}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <span className="mono" style={{ color: '#ff9f43', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                        {substation.substation_id}
                    </span>
                    <h3 style={{ fontSize: '0.95rem', margin: '2px 0 0', lineHeight: '1.15', fontWeight: 600, color: '#fff' }}>
                        {substation.name}
                    </h3>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                {groupedAssets.slice(0, 4).map(item => (
                    <div key={item.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '6px 8px',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '6px',
                        width: '100%'
                    }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                                {item.categoryAsset}
                            </span>

                            {(item.voltage || item.bays.length > 0) && (
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    {item.voltage && (
                                        <span style={{ fontSize: '0.65rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                                            {item.voltage}
                                        </span>
                                    )}
                                    {item.voltage && item.bays.length > 0 && (
                                        <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                                    )}
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                        {item.bays.map((bay, idx) => (
                                            <span key={idx} className="mono" style={{
                                                background: 'rgba(255,255,255,0.08)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                color: '#fff',
                                                fontSize: '0.6rem',
                                                padding: '1px 5px',
                                                borderRadius: '4px'
                                            }}>
                                                {bay}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginTop: '2px',
                            flexShrink: 0
                        }}>
                            {/* Document Link Button */}
                            {item.sourceFile && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(item.sourceFile, '_blank', 'noopener,noreferrer');
                                    }}
                                    style={{
                                        background: 'rgba(255,255,255,0.08)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '4px',
                                        padding: '2px 6px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        color: '#fff',
                                        transition: 'all 0.2s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(255,159,67,0.15)';
                                        e.currentTarget.style.borderColor = '#ff9f43';
                                        e.currentTarget.style.color = '#ff9f43';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                        e.currentTarget.style.color = '#fff';
                                    }}
                                    title="View Source Document"
                                >
                                    <FileText size={12} />
                                </button>
                            )}

                            {/* Sensitivity Battery Bar */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'flex-end',
                                gap: '2px',
                                height: '14px',
                                paddingBottom: '2px'
                            }}>
                                {[1, 2, 3].map(level => {
                                    let isActive = level <= item.sensitivity;
                                    let color = 'rgba(255,255,255,0.15)';
                                    if (isActive) {
                                        if (item.sensitivity === 3) color = '#ef4444';
                                        else if (item.sensitivity === 2) color = '#f97316';
                                        else if (item.sensitivity === 1) color = '#eab308';
                                        else color = 'var(--accent-cyan)';
                                    }
                                    return (
                                        <div key={level} style={{
                                            width: '4px',
                                            height: `${level * 4}px`,
                                            background: color,
                                            borderRadius: '1px',
                                            transition: 'all 0.3s'
                                        }}></div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ))}
                {groupedAssets.length > 4 && (
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2px' }}>
                        +{groupedAssets.length - 4} more assets
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default CriticalSubstationCard;
