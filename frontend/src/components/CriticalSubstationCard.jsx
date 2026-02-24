import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';

const CriticalSubstationCard = ({ substation, tags, onOpen }) => {
    const activeCount = tags.filter(t => t.is_inforce).length;
    const bays = tags.filter(t => t.load_transformer_bay_id);
    const categories = Array.from(new Set(tags.map(t => t.category_name).filter(Boolean)));

    const formatBayTagLabel = (bayId, lvVoltage) => {
        if (!bayId) return '';
        const match = bayId.match(/_T(\d+)$/i) || bayId.match(/T(\d+)/i);
        const base = match ? `T${match[1]}` : bayId;
        if (lvVoltage) {
            return `${base} ${lvVoltage}kV`;
        }
        return base;
    };

    const bayLabels = bays.slice(0, 6).map(tag => ({
        key: tag.id,
        label: formatBayTagLabel(tag.load_transformer_bay_id, tag.load_transformer_lv_voltage)
    }));

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

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'rgba(255,159,67,0.15)',
                        color: '#ff9f43',
                        padding: '3px 6px',
                        borderRadius: '999px',
                        fontSize: '0.65rem',
                        fontWeight: 600
                    }}>
                        <ShieldAlert size={12} /> {activeCount} Active
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {categories.map(cat => (
                    <span key={cat} style={tagPillStyle}>
                        {cat}
                    </span>
                ))}
                {bayLabels.map(tag => (
                    <span key={tag.key} className="mono" style={tagPillStyle}>
                        {tag.label}
                    </span>
                ))}
                {bays.length > 6 && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>+{bays.length - 6} more</span>
                )}
            </div>
        </motion.div>
    );
};

export default CriticalSubstationCard;
