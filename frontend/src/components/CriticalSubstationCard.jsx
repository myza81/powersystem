import React from 'react';
import { motion } from 'framer-motion';
import { Edit2, Trash2, ShieldAlert, Plus } from 'lucide-react';

const CriticalSubstationCard = ({ substation, tags, onEdit, onAdd, onEditTag, onDeactivate }) => {
    const activeCount = tags.filter(t => t.is_inforce).length;
    const bays = tags.filter(t => t.load_transformer_bay_id);
    const categories = Array.from(new Set(tags.map(t => t.category_name).filter(Boolean)));

    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="glass-card"
            whileHover={{ y: -4, borderColor: '#ff9f43', boxShadow: '0 8px 24px rgba(255, 159, 67, 0.18)' }}
            style={{
                padding: '1rem',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                minHeight: '180px'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <span className="mono" style={{ color: '#ff9f43', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                        {substation.substation_id}
                    </span>
                    <h3 style={{ fontSize: '1rem', margin: '2px 0', lineHeight: '1.2', fontWeight: 600, color: '#fff' }}>
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
                        padding: '4px 8px',
                        borderRadius: '999px',
                        fontSize: '0.7rem',
                        fontWeight: 600
                    }}>
                        <ShieldAlert size={12} /> {activeCount} Active
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {categories.map(cat => (
                    <span key={cat} style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px' }}>
                        {cat}
                    </span>
                ))}
                {substation.region && (
                    <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px' }}>
                        {substation.region}
                    </span>
                )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {bays.map(tag => (
                    <button
                        key={tag.id}
                        className="mono"
                        onClick={() => onEditTag(tag)}
                        style={{
                            fontSize: '0.65rem',
                            background: 'rgba(0,0,0,0.35)',
                            color: '#fff',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: '1px solid rgba(255,255,255,0.08)',
                            cursor: 'pointer'
                        }}
                    >
                        {tag.load_transformer_bay_id}
                    </button>
                ))}
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                <button
                    onClick={onAdd}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '4px 8px',
                        borderRadius: '4px'
                    }}
                >
                    <Plus size={14} /> Add Bay Tag
                </button>

                <button
                    onClick={onEdit}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '4px 8px',
                        borderRadius: '4px'
                    }}
                >
                    <Edit2 size={14} /> Edit Tags
                </button>

                <button
                    onClick={onDeactivate}
                    style={{
                        marginLeft: 'auto',
                        background: 'rgba(255, 59, 48, 0.12)',
                        border: '1px solid rgba(255, 59, 48, 0.4)',
                        color: '#ff3b30',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '4px 8px',
                        borderRadius: '6px'
                    }}
                >
                    <Trash2 size={14} /> Deactivate All
                </button>
            </div>
        </motion.div>
    );
};

export default CriticalSubstationCard;
